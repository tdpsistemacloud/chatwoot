# Automação de releases upstream — INPERA Chat

## Responsabilidades e limites

A automação prepara uma atualização do Chatwoot para revisão. Nunca faz merge em
`inpera_chat`, resolve conflitos automaticamente, publica imagens ou executa deploy.
O deploy local atual continua independente e incorpora `GIT_SHA`.

O núcleo Git está em `script/sync_upstream_branches.sh`. O auxiliar Node 24 em
`.github/scripts/inpera-release.mjs` usa GitHub CLI para consultar a API, publicar
PRs/issues e enviar Slack. Nenhuma dependência npm é necessária para esses scripts.

A consulta semanal está definida para segunda-feira, **07h17 de Brasília**
(`17 10 * * 1`, UTC). O agendamento somente executa quando a variável
`INPERA_SYNC_ENABLED` for `true`. Mantê-la ausente durante a homologação.
GitHub executa schedules na default branch; ela deverá ser `inpera_chat` na ativação.

A seleção percorre todas as páginas de releases publicadas de `chatwoot/chatwoot`,
exclui drafts/prereleases e aceita tags canônicas `vX.Y.Z`. A maior versão semântica
vence, inclusive nova major. Uma tag informada manualmente também precisa ser uma
release estável publicada. Compara `VERSION_CW` na base remota e ancestralidade Git;
não propõe downgrade nem release já integrada.

## Entregas e ativação, com autorização separada

1. Integrar a estabilização dos workflows herdados. CE/EE, Heroku, instalador
   noturno, GHSA/Linear, stale, lock e Codespaces somente executam no upstream.
   `frontend-fe.yml` também fica restrito ao upstream; o CI CE assume lint/testes.
2. Integrar o sincronizador, workflows de proposta/notificação e esta documentação.
3. Com autorização administrativa, conferir default branch, rulesets/proteções,
   permissões de Actions e workflows habilitados. Instalar a App e cadastrar secrets.
4. Proteger `inpera_chat` exigindo revisão humana e **`INPERA / validação`**.
   Habilitar merge commits; as PRs de sincronização devem usar **Create a merge
   commit**. Não usar squash/rebase: isso perde a ancestralidade upstream. Se a
   proteção exigir histórico linear, adaptá-la antes da homologação. Não conceder
   bypass à App. Recomenda-se desabilitar squash/rebase no fork para garantir a regra.
5. Somente após integrar as restrições dos publicadores herdados, mudar a default
   branch para `inpera_chat`. Confirmar que o workflow consta nessa branch.
6. Executar manualmente com `dry_run: true`. Depois, autorizar uma execução com
   `dry_run: false`, verificar uma PR real, os checks e o tratamento de conflitos.
7. Antes do primeiro merge de atualização, executar smoke tests de Evolution e
   exportação PDF/CSV. Depois de homologar, cadastrar `INPERA_SYNC_ENABLED=true`.
8. Acompanhar a primeira execução semanal. O resultado JSON sanitizado é retido
   por 30 dias como artefato `inpera-sync-result`.

Commit, push, merge, alteração de configuração GitHub e deploy exigem as respectivas
autorizações. A implementação local não configura nem acessa produção. As etapas
administrativas e a homologação real permanecem pendentes até sua execução.

## GitHub App e Slack

Criar uma GitHub App privada, instalada **somente em `tdpsistemacloud/chatwoot`**.
Conceder permissões de repositório **Contents, Pull requests, Issues e Workflows:
write**. Workflows permite publicar commits de releases que alterem Actions.
Metadata read é implícita. Não cadastrar a App na lista de bypass da proteção.

Em Settings → Secrets and variables → Actions:

| Tipo                       | Nome                               | Uso                             |
| -------------------------- | ---------------------------------- | ------------------------------- |
| Variable                   | `INPERA_SYNC_APP_ID`               | App ID                          |
| Secret                     | `INPERA_SYNC_APP_PRIVATE_KEY`      | Chave privada PEM da App        |
| Secret opcional            | `INPERA_RELEASE_SLACK_WEBHOOK_URL` | Webhook do canal técnico        |
| Variable, após homologação | `INPERA_SYNC_ENABLED`              | `true` ativa a execução semanal |

O webhook é separado da integração de atendimento. Sua ausência desliga avisos.
Slack indisponível gera aviso no resumo, sem invalidar a sincronização. Mensagens
incluem versão e links; não incluem chave, token, webhook ou logs completos.
Notificações cobrem nova PR, novo conflito, falha operacional, resultado final do CI
e merge. Reexecuções de sincronização não reenviam avisos de PR/issue já existentes.

O token de instalação da App, restrito ao fork, permite que push/PR disparem CI.
O `GITHUB_TOKEN` comum não serve para essa publicação: seus eventos não disparam
os workflows de PR esperados. Nenhum teste, instalação de dependências ou código
upstream é executado no job que recebe a chave. Antes do merge, o job copia os
scripts da branch protegida para `$RUNNER_TEMP` e executa somente essas cópias.
Os jobs de CI não recebem a chave da App nem o webhook. Notificações executam
somente código de `inpera_chat`, sem baixar artefatos ou executar código da PR.

## Execução manual e local

No GitHub: Actions → INPERA - Sync upstream Chatwoot → Run workflow, selecionando
`inpera_chat`. Deixar `tag` vazia seleciona a maior estável. `dry_run` inicia marcado.
Dry-run não publica branch, PR, issue ou Slack. O preview também consulta PRs para
informar `waiting`/`declined` quando aplicável.

Localmente, exigir Bash, Git, Node 24, GitHub CLI autenticado (`gh auth login`),
identidade Git e permissões de push no fork. Usar o único checkout do projeto,
com árvore limpa, incluindo arquivos não rastreados. Não executar este script
enquanto houver alterações de outra tarefa; nenhum stash/reset é automático.

```bash
bash script/sync_upstream_branches.sh --latest --dry-run
bash script/sync_upstream_branches.sh v5.0.0 --no-push
bash script/sync_upstream_branches.sh v5.0.0
INPERA_SYNC_RESULT=/tmp/inpera-result.json bash script/sync_upstream_branches.sh --ci --dry-run
```

Exemplos de versão são ilustrativos. O Bash local prepara/publica somente a branch;
PR/issue/Slack são responsabilidade do workflow. `--develop` falha sem tocar Git.
`--no-push` permite revisar o merge local antes de autorizar sua publicação.

O dry-run faz fetch de objetos e atualiza `FETCH_HEAD`, para verificar a base remota
e ancestralidade corretamente. Não muda branch, worktree, índice, configuração Git,
tags, commits ou branches de release. Não contorna hooks.
Configurações locais ignoradas também não podem ser sobrescritas ao trocar de
branch ou incorporar uma release. Os merges desabilitam autostash e rerere.

O resultado `--ci` contém `current_version`, `tag`, `upstream_sha`, `base_sha`,
`branch`, `status` e `conflicts`. Estados: `no_release`, `up_to_date`, `integrated`,
`available`, `ready`, `conflict`, `waiting`, `declined`, `error`. Conflito capturado
no CI é um resultado esperado; falhas de API/autenticação/fetch/commit/push retornam
erro. Em uso local, conflito retorna erro e deixa o merge disponível para resolução.

## Uma atualização por vez, retomada e recusa

Cada versão usa `release/inpera-X.Y.Z`, criada de `origin/inpera_chat`. Branch remota
existente é recuperada. Commits humanos são preservados; não há force-push.
Branches locais/remotas divergentes exigem reconciliação manual. Uma rejeição de
push retorna erro, sem alegar sucesso. A automação global tem concorrência igual a um.

Mantém no máximo uma PR de release aberta. Se aparecer versão superior, atualiza
um trecho identificado no corpo da PR pendente, preservando o restante. Não cria
comentários repetidos nem atualiza essa branch para outra versão. Concluir a PR
permite tratar a próxima versão na execução seguinte. Mais de uma PR aberta gera
erro para correção manual. A verificação presume ausência de criação manual
concorrente de PRs de release durante uma execução.

Fechar uma PR sem merge recusa aquela versão. A automação não a recria: reabrir
manualmente a mesma PR para autorizar retomada. Não apagar a PR recusada.

Conflitos criam/atualizam uma issue identificada por versão, com arquivos e instruções.
No CI, o merge é abortado antes de sair; nenhum marcador é commitado ou publicado.
Para resolver localmente, com árvore limpa:

```bash
bash script/sync_upstream_branches.sh v5.0.0 --no-push
# Resolver conflitos na release/inpera-5.0.0; preservar customizações INPERA.
git add <arquivos-resolvidos>
git commit
bash script/sync_upstream_branches.sh v5.0.0
```

Na retomada, `VERSION_CW` é atualizado mesmo se a tag já estiver incorporada.
Reexecutar manualmente o workflow com a mesma tag e `dry_run: false` abre/recupera
a PR. A issue de conflito é fechada quando a preparação terminar. Alternativamente,
`git merge --abort` cancela apenas o merge local em andamento.

## CI e revisão humana

`run_foss_spec.yml` concentra RuboCop, ESLint, Vitest, RSpec CE, Brakeman,
bundle-audit, validação da automação e migrations. PostgreSQL pgvector 16 e Redis
executam isolados em cada job Rails, usando banco `chatwoot_test`, nunca produção.
Os builds Docker de app e PDF são `linux/amd64`, `push: false`, sem login em registry.
O lock npm do serviço PDF é versionado em `docker/pdf/package-lock.json`, pois
seu Dockerfile usa `npm ci`. O aplicativo principal continua usando pnpm.
`INPERA / validação` exige sucesso de todos os jobs obrigatórios; falha, cancelamento
ou skip indevido bloqueiam o check agregado. O check só será obrigatório depois
de cadastrá-lo na proteção/ruleset.

A política herdada mantém os warnings do Brakeman não bloqueantes (saída 3);
erros de execução/infraestrutura continuam bloqueantes, assim como bundle-audit.
Não há baseline por fingerprint do Brakeman neste checkout; warnings novos também
precisam de revisão humana até existir uma classificação individual. Não interpretar
o check verde como ausência de vulnerabilidades. `.bundler-audit.yml` mantém suas
exceções já declaradas. Não adicionar exceções para fazer CI passar.

Checklist para revisão de cada atualização:

- Evolution: criar/conectar inbox, QR/estado, webhook, mensagem recebida e envio.
- WhatsApp Cloud: cadastro, envio, recebimento e alterações compartilhadas.
- Branding: nome da instalação, logos, cores e traduções protegidas.
- PDF/CSV: exportações reais com acentos, paginação e dados esperados; serviço PDF.
- Workers: Sidekiq, filas, retries e configurações de pool.
- Migrations: mudanças de schema/dados, locking, backup e ordem de deploy.
- Runtime: Ruby, Rails, Node, pnpm, banco/Redis e imagens Docker.
- Enterprise: extensões sobrepostas e funcionalidades licenciadas em uso.

**Limite:** testes CE removem `enterprise/` e `spec/enterprise/`. Não comprovam a
compatibilidade integral Enterprise. Os smoke tests precisam de ambiente homologado,
credenciais de teste e PostgreSQL/Redis isolados, antes do primeiro merge real.

## Validação e diagnóstico

```bash
actionlint -shellcheck=
shellcheck script/sync_upstream_branches.sh .github/scripts/test-inpera-sync.sh
bash -n script/sync_upstream_branches.sh
node --test .github/scripts/inpera-release.test.mjs
bash .github/scripts/test-inpera-sync.sh
```

O CI instala ShellCheck e actionlint 1.7.12 (binário Linux com SHA-256 conferido).
ShellCheck cobre os scripts Bash novos;
actionlint valida todos os workflows, com análise ShellCheck embutida desligada
para não misturar dívida dos scripts upstream. Os testes Git criam somente
repositórios sintéticos temporários e não criam outro checkout do projeto.

### Evidência local da implementação — 2026-11-03

- Passaram 10 testes Node, os cenários Git sintéticos e `bash -n` dos dois scripts.
- Os 19 workflows passaram no parser YAML; 59 blocos `run` passaram em `bash -n`.
  Foram conferidos os guards do fork, builds sem push e o check agregado com
  sucesso, falha, skip e cancelamento.
- O lock PDF corresponde ao manifesto: 170 pacotes com integridade e URLs do
  registry npm público. A instalação offline completa não terminou porque um
  tarball não está no cache; isso não valida o build Docker.
- Actionlint e ShellCheck não estavam instalados no ambiente local. Permanecem
  como gates do CI, sem alegação de execução local.
- O ambiente negou acesso ao daemon Docker e à API GitHub pelo terminal. Não
  foram executados Rails/PostgreSQL/Redis, build Docker, smoke tests ou homologação
  remota. Default branch, proteções, App, secrets e Actions habilitadas ainda
  precisam de conferência autenticada e autorização para qualquer alteração.

- **401/403 ou erro na criação do token:** conferir App ID, PEM, instalação restrita
  ao fork e permissões aprovadas. Alterações de Workflows exigem write específico.
  Não imprimir secrets para diagnosticar.
- **Push negado:** conferir instalação, permissões e mudanças concorrentes da
  branch. A App não pode escrever diretamente em `inpera_chat`.
- **Rate limit/5xx/API offline:** execução falha explicitamente. Consultar limites
  da instalação e reexecutar após liberação; não tratar lista vazia como sucesso.
- **CI não disparou:** conferir token da App no push/PR, Actions habilitadas,
  aprovação para workflows de fork e políticas de Actions permitidas por SHA.
- **CI com erro de instalação/build:** corrigir a causa; não silenciar o job.
- **Slack:** conferir webhook do canal técnico e acesso de rede; o resumo registra
  falha sem revelar a URL. A proposta continua válida quando já preparada.
- **Nenhuma execução semanal:** conferir default branch, workflow habilitado,
  `INPERA_SYNC_ENABLED` e atrasos do scheduler GitHub.

Para suspender, desabilitar **INPERA - Sync upstream Chatwoot** em Actions.
Remover/alterar `INPERA_SYNC_ENABLED` também pausa somente a consulta semanal.
Branches e PRs permanecem disponíveis; produção não é alterada.

Sincronização prepara a proposta; CI verifica; revisão humana autoriza merge;
publicação e deploy são processos separados. GHCR/DockerHub, imagens imutáveis por
SHA e deploy automatizado ficam para entrega posterior.
