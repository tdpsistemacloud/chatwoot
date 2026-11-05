# Documentação INPERA Chat

Este índice separa referências de operação e integração de propostas e material
histórico. Os documentos migrados de `temp/` mantêm seus nomes para facilitar
o rastreamento no Git. A migração documental não valida nem executa seus comandos.

## Operação e desenvolvimento

- [Stack, versões e orientação para agentes](STACK.md).
- [Scripts operacionais](../../script/README.md) e [ferramentas Ruby](../../tools/README.md).
- [Inventário da organização e validação](ORGANIZACAO-VALIDACAO.md).
- [Ambientes Docker e escolha do Compose](DOCKER.md).
- [Desenvolvimento local na porta 3025](DEV-LOCAL-PORTA-3025.md).
- [Relatórios PDF e CSV](RELATORIOS-PDF.md).
- [Filtros, ciclo de atendimento e documentos de templates](CONVERSATION-LIFECYCLE.md).
- [Controle de saudação em grupos WhatsApp](GROUP-GREETINGS.md).
- [Sincronização de releases upstream](AUTOMACAO-UPSTREAM.md).
- [Mudanças previstas](CHANGELOG-UPCOMING.md).

O script de deploy está em [script/Deploy_Prod.sh](../../script/Deploy_Prod.sh).
Antes de qualquer publicação, siga as regras de autorização e validação do
[AGENTS.md](../../AGENTS.md). Os guias Macromind abaixo são históricos e não
substituem o fluxo atual do script. Os comandos de deploy devem ser executados
a partir da raiz do checkout; não a partir das subpastas de documentação.

## Referências de API

- [Mapa de rotas e autenticação](api/inpera-chat-rotas-api.md): visão geral.
- [Provisionamento de usuário e conta administradora](api/platform-api-provisionamento-conta-admin.md).
- [CRUD de usuários, contas, Evolution e mensagens](api/rotas-crud-usuarios-contas-evolution-mensagens.md): exemplos detalhados.

Essas referências incluem contratos com sistemas externos. Confira os exemplos
contra as rotas do checkout e a versão implantada antes de usá-los como critério
de aceite. Valores de tokens encontrados nos exemplos foram substituídos por
placeholders; obtenha credenciais reais pelos canais administrativos apropriados.

## Integrações

- [Webhooks e notificações para a Retaguarda](integracoes/webhook-notificacoes-inpera-chat.md).
- [Website Widget e integração do Front Retaguarda](integracoes/snippet-widget-chatwoot-front-retaguarda.md).

## Propostas e especificações históricas

Estes arquivos registram solicitações e critérios de aceite. Não representam,
por si só, comprovação de implementação ou de publicação em produção.

- [Janela de 24 horas e conversas duplicadas](propostas/inpera-chat-janela-24h-e-conversas-duplicadas.md).
- [Indicador de digitação antes do envio pela mensageria](propostas/typing-antes-envio-mensageria.md).

## Histórico de infraestrutura e incidentes

Preservado para consulta e contexto. Endereços, scripts removidos, limites de
recursos e comandos antigos não devem ser reaplicados como rotina atual.

- [Deploy no ambiente antigo Macromind](historico/comandos-deploy-producao-inpera.md).
- [Migração Macromind para HostGator](historico/migracao-macromind-hostgator.md).
- [Nginx e SSL na VM antiga](historico/nginx-ssl-chatwoot-vm-inpera.md).
- [Incidente de provisionamento de julho de 2026](historico/INPERA-Chat-dificuldades-Chatwoot.md).

## Material temporário

Logs, imagens e arquivos de diagnóstico de `temp/` podem conter credenciais e
dados de clientes e não foram promovidos a documentação. A migração dos guias
não executa a limpeza desse material; exclusões feitas separadamente devem ser
revisadas como alterações próprias. Não inclua evidências temporárias em commits
de documentação sem uma revisão específica. Scripts executáveis têm finalidade
diferente dos guias; a movimentação já existente do deploy para `script/` foi
preservada.
