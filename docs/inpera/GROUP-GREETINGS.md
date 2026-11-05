# Saudação em grupos WhatsApp

Em Configurações → Caixas de entrada → canal Evolution → Preferências do canal,
a opção de enviar saudação para grupos fica desativada por padrão e é salva
imediatamente ao ser alterada. O envio em
conversas individuais permanece sujeito à configuração geral de saudação.
Ativar a opção de grupos permite a saudação quando a configuração geral também
estiver ativa. Grupos continuam recebendo mensagens e podem ser atendidos normalmente.

A Account API aceita `channel.greeting_enabled_for_groups` como booleano no
cadastro ou atualização da caixa. Exemplo de corpo para atualização:

```json
{"channel":{"greeting_enabled_for_groups":false}}
```

A resposta da caixa WhatsApp inclui `greeting_enabled_for_groups`. O valor é
persistido no `provider_config` existente, sem migração de banco. Ausência da
chave equivale a `false`, inclusive em canais já cadastrados.

Esta opção controla a saudação nativa do Chatwoot. Não desativa grupos no provedor
nem modifica respostas manuais, mensagens de ausência, automações ou integrações
externas. A instabilidade relatada em status de pedido e boas-vindas precisa ser
investigada com eventos, horários, payloads e respostas do ambiente afetado.
