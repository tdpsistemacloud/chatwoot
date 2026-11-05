# Filtros e ciclo WhatsApp

O endpoint de filtros aceita `assignee_type=me|unassigned|all`. A atribuição
restringe o resultado completo da consulta, preservando seus agrupamentos OR.
Os contadores representam a consulta original; não atribuídas exclui bots.
A aba é transitória e não integra a definição de uma pasta.

Account API, WhatsApp Cloud e Evolution reutilizam atendimentos não resolvidos
da mesma identidade ContactInbox. Uma aberta tem preferência; depois prevalece
a atividade mais recente e o ID. A seleção e criação usam bloqueio transacional
do vínculo. Após resolução, um novo atendimento é criado, mesmo quando a antiga
opção de conversa única estava ativa. O provedor legado mantém seu endereçamento.
Duplicatas históricas não são mescladas.

Os cartões mostram última atividade e conservam criação e atividade no tooltip.
Datas de criação e métricas históricas não são recalculadas.

## Documento enviado por template

No console, o cabeçalho `document` de
`additional_attributes.template_params.processed_params.header` aparece como
arquivo, com ícone, nome e link para o documento. A exibição usa `media_url` e
`media_name` já armazenados; não baixa o PDF no servidor nem dispara outro envio.
Mensagens antigas também exibem o arquivo quando esses parâmetros foram salvos.
O indicador de documento mostra o conteúdo associado à mensagem; a confirmação
de entrega continua sendo o status informado pelo WhatsApp.

Para conferir, carregar a versão atualizada do frontend e reabrir a conversa:
o documento deve aparecer junto ao texto, e o link deve abrir o PDF correspondente.
