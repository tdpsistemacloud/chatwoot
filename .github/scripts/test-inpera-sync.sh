#!/usr/bin/env bash
# Synthetic Git repositories only; never change this project's checkout or remotes.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/bin/sync_upstream_branches.sh"
export REAL_HELPER
REAL_HELPER=$(node -p "require('node:path').resolve(process.argv[1])" "$ROOT/.github/scripts/inpera-release.mjs")
TASK_TEMP=$(mktemp -d)
trap 'rm -rf -- "$TASK_TEMP"' EXIT
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Test GIT_COMMITTER_NAME=Test
export GIT_AUTHOR_EMAIL=test@example.invalid GIT_COMMITTER_EMAIL=test@example.invalid

cat > "$TASK_TEMP/fixture.mjs" <<'JS'
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const [command, ...args] = process.argv.slice(2);
if (command === 'select') {
  if (process.env.FAIL_API === 'true') process.exit(1);
  const { selectRelease } = await import(pathToFileURL(process.env.REAL_HELPER));
  console.log(JSON.stringify(selectRelease(JSON.parse(readFileSync(process.env.RELEASE_FIXTURE, 'utf8')), args[0])));
} else {
  execFileSync(process.execPath, [process.env.REAL_HELPER, command, ...args], { stdio: 'inherit' });
}
JS
export INPERA_RELEASE_HELPER INPERA_SYNC_RESULT RELEASE_FIXTURE UPSTREAM_REPO
INPERA_RELEASE_HELPER=$(node -p "require('node:path').resolve(process.argv[1])" "$TASK_TEMP/fixture.mjs")
INPERA_SYNC_RESULT=$(node -p "require('node:path').resolve(process.argv[1])" "$TASK_TEMP/result.json")
RELEASE_FIXTURE=$(node -p "require('node:path').resolve(process.argv[1])" "$TASK_TEMP/releases.json")
printf '[{"tag_name":"v5.0.0","published_at":"2026-01-01","draft":false,"prerelease":false}]\n' > "$TASK_TEMP/releases.json"
git init -q --bare "$TASK_TEMP/upstream.git"
git init -q --bare "$TASK_TEMP/origin.git"
git init -q -b fixture "$TASK_TEMP/work"
cd "$TASK_TEMP/work"
printf '4.19.1\n' > VERSION_CW
printf 'base\n' > shared.txt
git add .
git commit -qm base
BASE=$(git rev-parse HEAD)
git remote add origin "$TASK_TEMP/origin.git"
UPSTREAM_REPO="$TASK_TEMP/upstream.git"
git push -q origin HEAD:inpera_chat
git switch -qc upstream-release
printf 'upstream\n' > shared.txt
git commit -qam upstream
git tag v5.0.0
UPSTREAM_SHA=$(git rev-parse HEAD)
git push -q "$UPSTREAM_REPO" refs/tags/v5.0.0
git switch -qc task "$BASE"
check_status() { [[ "$(node "$REAL_HELPER" field "$INPERA_SYNC_RESULT" status)" == "$1" ]]; }

# A pure preview preserves branches, index, worktree and Git configuration.
BEFORE=$(git for-each-ref refs/heads; git rev-parse HEAD; git status --porcelain; git config --local --list)
bash "$SCRIPT" --dry-run --ci
check_status available
AFTER=$(git for-each-ref refs/heads; git rev-parse HEAD; git status --porcelain; git config --local --list)
[[ "$BEFORE" == "$AFTER" ]]
if bash "$SCRIPT" --develop; then exit 1; fi
if FAIL_API=true bash "$SCRIPT" --dry-run --ci; then exit 1; fi
check_status error

# Dirty and untracked files stop before fetching or switching.
printf 'mine\n' > untracked.txt
if bash "$SCRIPT" --ci; then exit 1; fi
[[ "$(cat untracked.txt)" == mine && "$(git branch --show-current)" == task ]]
rm untracked.txt
printf 'mine\n' > shared.txt
if bash "$SCRIPT" --ci; then exit 1; fi
printf 'base\n' > shared.txt

# Clean merge, pushed release, rerun: no duplicate commits or force updates.
bash "$SCRIPT" --ci
check_status ready
[[ "$(cat VERSION_CW)" == 5.0.0 ]]
git merge-base --is-ancestor "$UPSTREAM_SHA" HEAD
FIRST=$(git rev-parse HEAD)
bash "$SCRIPT" --ci
[[ "$(git rev-parse HEAD)" == "$FIRST" ]]

# Recreate a local tracking branch from the remote and preserve a human commit.
git switch -q task
git branch -D release/inpera-5.0.0 >/dev/null
bash "$SCRIPT" --ci --no-push
printf 'review\n' > human.txt
git add human.txt
git commit -qm 'human review'
HUMAN=$(git rev-parse HEAD)
bash "$SCRIPT" --ci
git merge-base --is-ancestor "$HUMAN" HEAD

# Merge integrated into the protected base: no new proposal.
git push -q origin HEAD:inpera_chat
bash "$SCRIPT" --ci
check_status up_to_date

# New release conflicts with a fork customization. CI aborts; local keeps merge.
git switch -q upstream-release
printf 'upstream-next\n' > shared.txt
git commit -qam next
git tag v6.0.0
git push -q "$UPSTREAM_REPO" refs/tags/v6.0.0
git switch -qc fork-change "$HUMAN"
printf 'fork-customization\n' > shared.txt
git commit -qam customize
git push -q origin HEAD:inpera_chat
printf '[{"tag_name":"v6.0.0","published_at":"2026-01-02","draft":false,"prerelease":false}]\n' > "$TASK_TEMP/releases.json"
bash "$SCRIPT" --ci
check_status conflict
[[ ! -f "$(git rev-parse --git-path MERGE_HEAD)" ]]
[[ "$(node "$REAL_HELPER" field "$INPERA_SYNC_RESULT" conflicts)" == shared.txt ]]
if bash "$SCRIPT" --no-push; then exit 1; fi
[[ -f "$(git rev-parse --git-path MERGE_HEAD)" ]]
printf 'resolved\n' > shared.txt
git add shared.txt
git commit -qm 'resolve preserving fork'
[[ "$(cat VERSION_CW)" == 5.0.0 ]]
RESOLVED=$(git rev-parse HEAD)
git push -q origin HEAD:release/inpera-6.0.0
git switch -q fork-change
git branch -D release/inpera-6.0.0 >/dev/null
bash "$SCRIPT" --ci
[[ "$(cat VERSION_CW)" == 6.0.0 ]]
git merge-base --is-ancestor "$RESOLVED" HEAD
check_status ready

# A hook rejection on push must be an operational error, never ready.
printf '#!/bin/sh\nexit 1\n' > "$TASK_TEMP/origin.git/hooks/pre-receive"
chmod +x "$TASK_TEMP/origin.git/hooks/pre-receive"
printf 'not published\n' > rejected.txt
git add rejected.txt
git commit -qm rejected
if bash "$SCRIPT" --ci; then exit 1; fi
check_status error

# No published stable release and older versions make no proposals.
printf '[]\n' > "$TASK_TEMP/releases.json"
bash "$SCRIPT" --ci
check_status no_release
printf '[{"tag_name":"v4.0.0","published_at":"2026-01-01","draft":false,"prerelease":false}]\n' > "$TASK_TEMP/releases.json"
bash "$SCRIPT" --ci
check_status up_to_date
# An already integrated tag also blocks a proposal when VERSION_CW lags behind.
rm "$TASK_TEMP/origin.git/hooks/pre-receive"
printf '5.0.0\n' > VERSION_CW
git add VERSION_CW
git commit -qm 'fixture with lagging version metadata'
git push -q origin HEAD:inpera_chat
printf '[{"tag_name":"v6.0.0","published_at":"2026-01-02","draft":false,"prerelease":false}]\n' > "$TASK_TEMP/releases.json"
bash "$SCRIPT" --ci
check_status integrated

# An ignored local configuration must not be overwritten by a new tracked file.
git switch -q upstream-release
printf 'upstream default\n' > local.cfg
git add local.cfg
git commit -qm 'upstream tracked config'
git tag v7.0.0
git push -q "$UPSTREAM_REPO" refs/tags/v7.0.0
git switch -q release/inpera-6.0.0
printf 'local.cfg\n' >> .git/info/exclude
printf 'local configuration\n' > local.cfg
printf '[{"tag_name":"v7.0.0","published_at":"2026-01-03","draft":false,"prerelease":false}]\n' > "$TASK_TEMP/releases.json"
if bash "$SCRIPT" --ci; then exit 1; fi
check_status error
[[ "$(cat local.cfg)" == 'local configuration' ]]
printf 'Synthetic INPERA synchronization scenarios passed.\n'
