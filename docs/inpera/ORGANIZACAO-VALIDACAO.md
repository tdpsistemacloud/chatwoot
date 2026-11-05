# Organização e validação do checkout

Trabalho na branch `fix/inbox-timezone-working-hours`, no checkout único
`C:/projetos-inpera/inpera-chat`. Sem commit, push, integração ou deploy.
As mudanças funcionais e de automação já pendentes continuam separadas da
organização de arquivos. Esta etapa não resolve o incidente da instância
Evolution do cliente.

## Inventário e critérios

| Arquivos ou grupo                                                                                          | Decisão e finalidade                                                   | Evidência e limites                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`, `.env.example`, `.env.*.example`, manifests, lockfiles e versões                                   | Manter na raiz; ambientes reais ignorados, templates preservados       | Rails, Vite, Compose e gerenciadores consultam esses caminhos; não criar pasta de credenciais                                                                                |
| `app/`, `config/`, `db/`, `lib/`, `enterprise/`, `spec/`                                                   | Manter arquitetura Rails                                               | Autoload, rotas, views, assets e overlay Enterprise dependem da estrutura convencional                                                                                       |
| `bin/rails`, `rake`, `bundle`, `vite`, `setup`, `update`, `yarn`, `sync_i18n_file_change`, `validate_push` | Manter launchers convencionais                                         | Chamadas de ferramentas e fluxos upstream; ausência de referências internas não comprova abandono                                                                            |
| `bin/install_nginx_ssl_inpera_chat.sh`                                                                     | Mover para `script/install_nginx_ssl_inpera_chat.sh`                   | Uso explícito nos guias; referências e mensagens do próprio script atualizadas; sem execução administrativa                                                                  |
| `bin/sync_upstream_branches.sh`                                                                            | Mover para `script/sync_upstream_branches.sh`                          | Workflow, teste sintético, documentação e instruções geradas pelo auxiliar Node atualizados; lógica de sincronização preservada                                              |
| `.github/scripts/`                                                                                         | Manter auxiliares de CI e testes da automação                          | São invocados pelos workflows; alterações anteriores de `inpera-release.mjs` e `inpera_sync_upstream.yml` não pertencem à reorganização                                      |
| `temp/Deploy_Prod.sh`, `temp/Logs/diagnostico-hostgator.sh`                                                | Consolidar em `script/`                                                | Entradas operacionais explícitas; deploy calcula a raiz pelo diretório pai; exemplos atualizados; diagnóstico ganhou shebang; duas variáveis sem leitura removidas do deploy |
| `script/backfill_applied_sla_completed_at.rb`, `bulk_reindex_messages.rb`, `monitor_reindex.rb`            | Consolidar em `tools/maintenance/`                                     | Execução explícita por Rails runner; comentários e referências atualizados; conferir equivalência de tokens Ruby                                                             |
| `script/rails_upgrade/{preflight,active_storage_smoke}.rb`                                                 | Consolidar em `tools/rails_upgrade/`                                   | Guia Rails 7.2 e deploy apontam para o destino; smoke escreve somente quando explicitamente autorizado                                                                       |
| `script/reindex_single_account.rb`                                                                         | Preservar em `tools/legacy/`                                           | Seleção por conta está comentada; ferramenta pode enfileirar outras contas; documentada e não executada                                                                      |
| Documentos `temp/*.md`                                                                                     | Consolidar em `docs/inpera/{api,historico,integracoes,propostas}/`     | Todos os nomes têm destino no índice INPERA; documentação histórica mantém os comandos antigos com indicação do fluxo atual                                                  |
| `temp/Images/`, `temp/Responses/`, `temp/image.png`, `temp/logsEmail.txt`, `temp/logsVM.txt`               | Restaurar exclusões pendentes; manter fora desta limpeza               | Não há comprovação suficiente de abandono ou término do uso externo; não promover dados de diagnóstico a documentação                                                        |
| `temp/pdf-referencia/`                                                                                     | Restaurar exclusões pendentes integralmente                            | PDFs, dados, templates e serviço são evidências de referência; exclusão sem prova de obsolescência não autorizada por esta organização                                       |
| `docker/pdf/`, exportação Rails PDF/CSV e respectivos templates                                            | Preservar                                                              | Serviço ativo separado do material de referência; validar por smoke isolado                                                                                                  |
| `log/.keep`                                                                                                | Restaurar                                                              | Rails e imagem Docker precisam do diretório; logs continuam ignorados                                                                                                        |
| `.gitattributes`                                                                                           | Versionar; remover regra que o ignorava                                | LF para scripts Linux e hooks; sem normalização geral dos arquivos pendentes                                                                                                 |
| `.gitignore`, `.dockerignore`                                                                              | Excluir ambientes reais, chaves, diagnósticos e artefatos              | Exceções explícitas para templates; `temp/` excluído apenas do contexto Docker, sem apagar arquivos locais                                                                   |
| Hooks `.husky/` e `bin/validate_push`                                                                      | Validar índice sem alterar arquivos; proteger origem e destino do push | ESLint via pnpm e RuboCop via bundle exec recebem stdin do índice; sem autocorreção, stash, git add ou supressão de falhas                                                   |
| Configurações CI, plataforma e ferramentas                                                                 | Manter                                                                 | Uso externo não foi comprovadamente encerrado; nenhuma remoção baseada somente em `rg`                                                                                       |

Não houve remoção definitiva de arquivos por suposto abandono. Os caminhos
de origem excluídos no diff correspondem às movimentações com destino documentado.
Logs, fixtures externas e PDFs restaurados não foram executados nem publicados.

## Ambiente de validação

Compose temporário ignorado em `tmp/organization-validation/compose.yml`, projeto
`inpera-organization-validation`. PostgreSQL e Redis próprios, sem portas públicas,
com `POSTGRES_DATABASE=inpera_organization_test` explícito. Dados PostgreSQL,
storage, logs e temporários em tmpfs; nenhuma tarefa usa o banco de desenvolvimento.
Imagem Ruby 3.4.4, Node 24.18.0 e pnpm 10.2.0. O Node satisfaz `engines: 24.x`,
mas difere do pin 24.22.1 em `.nvmrc`; auditorias locais usam Node 24.19.0 disponível.
Dependências existentes compartilhadas; nenhuma instalação de dependência do produto.
ShellCheck instalado somente no container temporário. Actionlint 1.7.12 com SHA256
conferido contra o valor declarado no workflow.

## Resultados

Resultados já concluídos:

- Build Vite de produção: **passou**, 5.122 módulos, 8m26s, com
  `NODE_OPTIONS=--max-old-space-size=4096`. A primeira tentativa atingiu o heap
  padrão de aproximadamente 2 GB. O plugin Vite Ruby gravou em `public/vite/`,
  diretório gerado e ignorado, mesmo com `--outDir` temporário informado.
- Automação upstream: **10 testes Node passaram**; cenários Git sintéticos
  passaram, incluindo conflitos, retomada, erro de API, push recusado e preservação
  de configuração ignorada. Nenhuma sincronização remota real executada.
- Hooks: **passaram** com comandos simulados, conteúdo do índice, nomes com
  espaços, falha do linter propagada e origem/destino das cinco branches protegidas.
- ShellCheck dos cinco scripts operacionais, teste sintético e hooks: **passou**.
- `bash -n`, `sh -n`, `node --check` e actionlint dos dois workflows: **passaram**.
- Seis utilitários Ruby movidos: tokens executáveis comparados com HEAD,
  **sem mudança de comportamento**. Não há `require_relative` ou cálculo de raiz
  relativo que seja invalidado pelos novos diretórios.
- Auditoria heurística dos candidatos: **nenhum segredo apontado**; valores não
  impressos. Links Markdown locais: **sem destinos ausentes**, incluindo os dois
  links corrigidos para os repositórios TDP vizinhos. Não substitui um scanner
  especializado ou revisão de conteúdo de dados externos.
- `graphify update .`: **concluído**, 35.720 nós e 46.636 arestas. Limitações da
  ferramenta: 2.782 fontes sem nós, parser SQL ausente e HTML omitido pelo limite
  de 5.000 nós. O grafo JSON e o relatório foram atualizados.
- `docker build --check -f docker/Dockerfile .`: **retornou 1 com dez avisos**
  no Dockerfile inalterado: capitalização de `FROM ... as` e formato antigo de
  nove declarações `ENV`. Não houve alerta `CopyIgnoredFile`; Dockerfile e contexto
  não são apresentados como aprovados sem ressalvas.

Os resultados de RSpec, smoke integrado e lint consolidado serão acrescentados
ao concluir as execuções. O smoke usa banco `inpera_organization_smoke`, Redis
`/1` e storage de outro container para não interferir no RSpec (`/0`).

## Grupos sugeridos para revisão e commits futuros

1. **Funcionalidades e testes:** conversas por identidade, abas e filtros, atividade
   dos cartões, documentos de templates, saudação em grupos e traduções já pendentes.
2. **Documentação e movimentações:** índices, guias, `tools/`, `script/` e ajustes
   pontuais de caminhos em workflows e testes. Revisar como renomes, sem wrappers.
3. **Higiene e hooks:** ignores, `.gitattributes`, marcador de log, validação do índice
   e bloqueio de push nas cinco branches protegidas.
4. **Automação upstream anterior:** manter identificadas as alterações funcionais
   já existentes em `.github/scripts/inpera-release.mjs` e no workflow de sync;
   separar os ajustes de caminho desta organização ao preparar commits.

Nenhum arquivo foi preparado no índice por esta tarefa. Os grupos acima são uma
proposta de revisão; commits e integração precisam de autorização própria.
