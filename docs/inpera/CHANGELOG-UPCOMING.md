# Plano de atualização por release — Chatwoot INPERA

> Regras gerais:
>
> - O produto é o **Chatwoot Inpera** (fork do Chatwoot).
> - As versões entram pela **tag upstream `vX.Y.Z`**.
> - Cada release usa `release/inpera-X.Y.Z`, criada de `origin/inpera_chat`. Não há espelho de develop.
> - `inpera_chat` é a branch de desenvolvimento/manutenção, protegida, que roda em produção.
>   O merge de releases e de features é só por revisão.
>
> **Fluxo implementado:** preparação local ou GitHub Actions, com revisão humana. Ativação remota ainda depende de homologação.
>
> ```bash
> cd /c/projetos-inpera/inpera-chat
> bash script/sync_upstream_branches.sh            # pega a última tag upstream, cria release/inpera-X.Y.Z, atualiza VERSION_CW
> ```
>
> Depois disso o agente abre a PR `release/inpera-X.Y.Z` → `inpera_chat`, roda o gate do fork e o merge fica por aprovação.

---

## 1. Estratégia de branches

| Branch | Papel | Como entra uma release |
|---|---|---|
| `release/inpera-X.Y.Z` | Branch de revisão da release publicada. | Criada de `origin/inpera_chat`; incorpora a tag upstream. |
| `inpera_chat` | Branch de desenvolvimento e produção. Protegida. | Recebe a PR `release/inpera-X.Y.Z` → `inpera_chat`. |
| `feat/*`, `fix/*` etc. | Features e correções isoladas. | Merge para `inpera_chat` (nunca para `sync_chatwoot` ou `develop` diretamente). |

Regras de fluxo:

1. Cada `release/inpera-X.Y.Z` recebe a tag publicada selecionada, sem espelhar develop.
2. `inpera_chat` é a integradora de tudo: features em andamento + releases.
3. Não modifique `inpera_chat` diretamente — sempre por branch de trabalho + PR.
4. O merge de uma release exige merge commit. O deploy local é separado, autorizado, com `GIT_SHA` do merge.

---

## 2. O que já está implementado

### 2.1 Script de sincronização

- **Arquivo:** `script/sync_upstream_branches.sh`
- **Comportamento:**
  - Sem argumento → seleciona a maior release estável publicada pela API GitHub paginada, inclusive nova major.
  - Com argumento → tag específica (formato `vX.Y.Z`).
  - Cria/atualiza `release/inpera-X.Y.Z` a partir de `origin/inpera_chat`.
  - Mergeia a tag nessa branch (sem fast-forward).
  - Atualiza `VERSION_CW` com a nova versão e commita (`chore(release): bump VERSION_CW to X.Y.Z`).
  - **Não pusha** para `inpera_chat`. O usuário abre a PR manualmente.
  - Guardas:
    - aborta se houver alteração não commitada (nada é descartado);
    - rejeita tags fora de formato `vX.Y.Z`;
    - idempotente se a tag já estiver na branch;
    - conflito no merge deixa a branch com o merge em andamento, orientando manter Evolution API + branding INPERA.
- **Execução:**
  ```bash
  bash script/sync_upstream_branches.sh
  bash script/sync_upstream_branches.sh v4.20.0      # tag específica
  bash script/sync_upstream_branches.sh --dry-run
  bash script/sync_upstream_branches.sh --no-push
  bash script/sync_upstream_branches.sh --ci --dry-run # resultado JSON, sem publicação
  ```
- **Status:** validado (`bash -n` ok, `--help` ok, `--dry-run` ok, tag inválida rejeitada).

### 2.2 Automação implementada e ativação pendente

A referência operacional é [AUTOMACAO-UPSTREAM.md](AUTOMACAO-UPSTREAM.md).
O workflow chama o Bash da branch protegida, usa GitHub App restrita ao fork e
prepara uma PR por release ou uma issue por versão em conflito. Uma única PR de
atualização pode ficar aberta. Reexecuções preservam commits humanos e evitam
registros duplicados. Fechar PR sem merge recusa a versão; reabertura manual
permite retomar. `--develop` está desativado.

O agendamento semanal é segunda-feira, 07h17 de Brasília (`17 10 * * 1`, UTC),
condicionado a `INPERA_SYNC_ENABLED=true` após homologação. O disparo manual tem
tag opcional e dry-run marcado por padrão. Slack é opcional e separado do atendimento.

### 2.3 Gate de regressão

O CI CE concentra RuboCop, ESLint, frontend, backend e segurança. Builds Docker de
app e PDF são amd64 e não publicam imagens. O check `INPERA / validação` exige
sucesso de todos os jobs obrigatórios. Testes CE removem Enterprise e não provam
sua compatibilidade integral. Warnings Brakeman continuam não bloqueantes;
infraestrutura e testes não são silenciados. Consulte os limites na referência operacional.

## 3. Pendências operacionais

- Integrar primeiro as restrições dos workflows herdados no fork.
- Instalar a GitHub App, cadastrar variável/secret e conferir permissões de Actions.
- Proteger `inpera_chat` com revisão humana e check agregado obrigatório.
- Permitir merge commit e preservar a ancestralidade das releases.
- Mudar default branch somente depois de integrar as restrições dos publicadores.
- Homologar dry-run, abertura real de PR, CI e conflitos antes de ativar o schedule.
- Executar smoke tests de Evolution e PDF/CSV antes do primeiro merge de atualização.
- Acompanhar a primeira execução semanal; artefatos sanitizados com retenção de 30 dias.

## 4. Deploy e revisão do fork

O deploy local atual permanece independente, já incorpora `GIT_SHA` e exige
autorização. Publicação GHCR/DockerHub e deploy automático ficam para outra entrega.
Não apagar branches históricas como parte desta implementação.

Em cada atualização, revisar Evolution API, WhatsApp Cloud, branding INPERA,
PDF/CSV, workers, migrations, runtime e Enterprise. O merge e o deploy permanecem
sob revisão e autorização humanas.
