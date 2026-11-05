#!/usr/bin/env bash
# Sync published stable Chatwoot releases into a review branch, never production.
# Usage: bash script/sync_upstream_branches.sh [vX.Y.Z|--latest] [--dry-run] [--no-push] [--ci]
# Requires Bash, Git, Node 24 and authenticated GitHub CLI (gh).
set -euo pipefail

ORIGIN_REMOTE=${ORIGIN_REMOTE:-origin}
UPSTREAM_REPO=${UPSTREAM_REPO:-https://github.com/chatwoot/chatwoot.git}
INPERA_BRANCH=${INPERA_BRANCH:-inpera_chat}
HELPER=${INPERA_RELEASE_HELPER:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.github/scripts" && pwd)/inpera-release.mjs}
TAG='' DRY_RUN=false PUSH=true CI_MODE=false
STATUS=error CURRENT='' SHA='' WORK='' CONFLICTS='' BASE=''

while (($#)); do
  case "$1" in
    --latest) ;;
    --dry-run) DRY_RUN=true ;;
    --no-push) PUSH=false ;;
    --ci) CI_MODE=true ;;
    --develop) echo 'develop desativado. Use uma release publicada vX.Y.Z; integração somente por PR.' >&2; exit 2 ;;
    --help|-h) sed -n '2,4p' "$0"; exit 0 ;;
    -*) echo "Opção desconhecida: $1" >&2; exit 2 ;;
    *) [[ -z "$TAG" ]] || { echo 'Informe somente uma tag.' >&2; exit 2; }; TAG=$1 ;;
  esac
  shift
done
[[ -z "$TAG" || "$TAG" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || { echo 'Tag inválida: esperado vX.Y.Z.' >&2; exit 2; }

TEMP_DIR=$(mktemp -d)
finish() {
  local code=$?
  trap - EXIT
  if [[ "$CI_MODE" == true ]]; then
    node "$HELPER" result "$CURRENT" "$TAG" "$SHA" "$WORK" "$STATUS" "$CONFLICTS" "${INPERA_SYNC_RESULT:-}" "$BASE" || code=1
  fi
  rm -rf -- "$TEMP_DIR"
  exit "$code"
}
trap finish EXIT
log() { printf '[sync-release] %s\n' "$*" >&2; }
fail() { log "$*"; exit 1; }

git rev-parse --show-toplevel >/dev/null
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail 'Árvore com alterações locais. Nada foi descartado; use uma árvore limpa.'
[[ ! -f "$(git rev-parse --git-path MERGE_HEAD)" ]] || fail 'Conclua ou aborte o merge pendente antes de retomar.'

# Fetch only objects/FETCH_HEAD: dry-run never creates a release branch, commits,
# remote configuration or tags. API/authentication/fetch failures remain errors.
git fetch --no-tags --refmap= "$ORIGIN_REMOTE" "refs/heads/$INPERA_BRANCH" >&2
BASE=$(git rev-parse FETCH_HEAD)
CURRENT=$(git show "$BASE:VERSION_CW" | tr -d '\r\n')
[[ "$CURRENT" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail 'VERSION_CW inválido na branch base.'
node "$HELPER" select "$TAG" > "$TEMP_DIR/release.json"
TAG=$(node "$HELPER" field "$TEMP_DIR/release.json" tag_name)
if [[ -z "$TAG" ]]; then STATUS=no_release; exit 0; fi
VERSION=${TAG#v}
if [[ "$(printf '%s\n' "$CURRENT" "$VERSION" | sort -V | tail -n 1)" == "$CURRENT" ]]; then
  STATUS=up_to_date
  exit 0
fi
git fetch --no-tags --refmap= "$UPSTREAM_REPO" "refs/tags/$TAG" >&2
SHA=$(git rev-parse 'FETCH_HEAD^{commit}')
if git merge-base --is-ancestor "$SHA" "$BASE"; then STATUS=integrated; exit 0; fi
WORK="release/inpera-$VERSION"
if [[ "$DRY_RUN" == true ]]; then
  STATUS=available
  log "DRY-RUN: $CURRENT -> $TAG ($SHA), branch $WORK. Nenhuma branch ou commit criado."
  exit 0
fi

# Git's merge strategy may overwrite ignored files even with its safety flag.
# Check files tracked by the target commits before switching or merging.
protect_ignored() {
  git ls-tree -r --name-only -z "$1" > "$TEMP_DIR/target-paths"
  local code=0
  git check-ignore --stdin -z < "$TEMP_DIR/target-paths" > "$TEMP_DIR/ignored-paths" || code=$?
  [[ "$code" -le 1 ]] || fail 'Falha ao conferir arquivos ignorados.'
  node "$HELPER" protect-ignored "$TEMP_DIR/ignored-paths"
}
protect_ignored "$BASE"
protect_ignored "$SHA"

REMOTE_HEAD=$(git ls-remote --heads "$ORIGIN_REMOTE" "refs/heads/$WORK")
if [[ -n "$REMOTE_HEAD" ]]; then
  git fetch --no-tags --refmap= "$ORIGIN_REMOTE" "refs/heads/$WORK" >&2
  REMOTE_SHA=$(git rev-parse FETCH_HEAD)
  protect_ignored "$REMOTE_SHA"
  if git show-ref --verify --quiet "refs/heads/$WORK"; then
    git switch --no-overwrite-ignore "$WORK" >&2
    # Never overwrite a human commit, including local commits not yet pushed.
    if git merge-base --is-ancestor HEAD "$REMOTE_SHA"; then
      git -c rerere.enabled=false merge --no-autostash --no-overwrite-ignore --ff-only "$REMOTE_SHA" >&2
    elif ! git merge-base --is-ancestor "$REMOTE_SHA" HEAD; then
      fail 'Branch local e remota divergiram. Reconcilie manualmente; nenhum force-push será feito.'
    fi
  else
    git switch --no-overwrite-ignore -c "$WORK" "$REMOTE_SHA" >&2
  fi
elif git show-ref --verify --quiet "refs/heads/$WORK"; then
  git switch --no-overwrite-ignore "$WORK" >&2
else
  git switch --no-overwrite-ignore -c "$WORK" "$BASE" >&2
fi

# Avoid proposing a downgrade on a release branch changed by a human.
WORK_VERSION=$(tr -d '\r\n' < VERSION_CW)
[[ "$WORK_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'VERSION_CW inválido na branch de trabalho.'
[[ "$(printf '%s\n' "$WORK_VERSION" "$VERSION" | sort -V | tail -n 1)" == "$VERSION" ]] || fail 'Branch de trabalho contém versão superior à solicitada.'

if ! git merge-base --is-ancestor "$SHA" HEAD; then
  if ! git -c rerere.enabled=false merge --no-autostash --no-overwrite-ignore --no-ff "$SHA" -m "chore(release): sync upstream $TAG" >&2; then
    CONFLICTS=$(git diff --name-only --diff-filter=U)
    if [[ -z "$CONFLICTS" ]]; then
      # A failing hook/identity/signing error is operational, not a conflict.
      if [[ "$CI_MODE" == true && -f "$(git rev-parse --git-path MERGE_HEAD)" ]]; then git merge --abort >&2; fi
      fail 'Falha operacional no merge.'
    fi
    STATUS=conflict
    log "Resolva os conflitos em $WORK, git add, git commit e execute novamente a mesma tag."
    if [[ "$CI_MODE" == true ]]; then git merge --abort >&2; exit 0; fi
    exit 1
  fi
fi
# Also runs on resume after a manually resolved merge already containing SHA.
if [[ "$(tr -d '\r\n' < VERSION_CW)" != "$VERSION" ]]; then
  printf '%s\n' "$VERSION" > VERSION_CW
  git add VERSION_CW
  git commit -m "chore(release): bump VERSION_CW to $VERSION" >&2
fi
if [[ "$PUSH" == true ]]; then git push "$ORIGIN_REMOTE" "HEAD:refs/heads/$WORK" >&2; fi
STATUS=ready
log "$WORK pronta para PR em $INPERA_BRANCH. Merge e deploy exigem revisão e autorização."
