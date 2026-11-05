# Ferramentas Ruby do projeto

Utilitários executados explicitamente para manutenção, diagnóstico e validação.
Não pertencem ao código de aplicação carregado pelo Rails e não são executados
automaticamente por esta organização de pastas. Os scripts shell de operação
permanecem em [script/](../script/README.md).

Use o Ruby indicado em [.ruby-version](../.ruby-version), as dependências do
checkout e `bundle exec rails runner`, sempre a partir da raiz do repositório.
Confira o ambiente de banco, Redis, índice de busca e storage antes da execução.

## Manutenção

| Ferramenta                                                                               | Finalidade                                                               | Efeitos                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [backfill_applied_sla_completed_at.rb](maintenance/backfill_applied_sla_completed_at.rb) | Recalcular conclusão dos SLAs aplicados a partir de eventos de resolução | Usa o serviço Enterprise de SLA; padrão dry run, gravação com `APPLY=true` |
| [bulk_reindex_messages.rb](maintenance/bulk_reindex_messages.rb)                         | Reindexação global de mensagens com limitação de ritmo                   | Enfileira jobs Searchkick em `bulk_reindex_low`                            |
| [monitor_reindex.rb](maintenance/monitor_reindex.rb)                                     | Acompanhar filas de reindexação e retries                                | Consulta filas em loop; `Ctrl+C` encerra o monitor                         |

Exemplo de simulação do backfill para uma conta, em ambiente com o serviço
Enterprise disponível:

```bash
ACCOUNT_ID=123 bundle exec rails runner tools/maintenance/backfill_applied_sla_completed_at.rb
```

Para a reindexação global, consulte as opções no próprio arquivo e planeje a
carga de banco e filas antes de executá-la. Não confunda esse utilitário com
uma reindexação isolada por conta.

## Atualização do Rails

| Ferramenta                                                       | Finalidade                                                          | Efeitos                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [preflight.rb](rails_upgrade/preflight.rb)                       | Validar versão, defaults, migrations, criptografia e Active Storage | Consultas de diagnóstico; exige `EXPECTED_RAILS_VERSION`                      |
| [active_storage_smoke.rb](rails_upgrade/active_storage_smoke.rb) | Validar upload, download e remoção de um blob de teste              | Escreve no storage e no banco; exige `RAILS_UPGRADE_ALLOW_STORAGE_WRITE=true` |

As variáveis e a ordem de execução estão no
[guia de atualização para Rails 7.2](../docs/rails_upgrades/7_2.md).
O smoke de storage não é uma verificação somente de leitura.

## Legado / experimental

[reindex_single_account.rb](legacy/reindex_single_account.rb) foi preservado
para consulta. Apesar do nome e dos exemplos antigos de chamada, a versão
atual está com a seleção de conta comentada e usa
`Message.where('created_at >= ?', days_back.days.ago)`. Portanto, pode
enfileirar mensagens de todas as contas no período.

Não o utilize como procedimento de reindexação por conta sem revisar e corrigir
explicitamente essa lógica. A movimentação para `legacy/` não corrigiu nem
executou o arquivo.

## Mudança dos caminhos

Os arquivos Ruby anteriormente localizados em `script/` agora ficam nestas
categorias. Atualize comandos manuais externos que ainda utilizem os caminhos
antigos; não foram criados wrappers nem cópias de compatibilidade.
A migração preserva o código executável e altera somente os caminhos nos
comentários de uso e na documentação.
