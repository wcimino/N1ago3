# Zendesk Switchboard - Referência de IDs

Este documento contém todos os IDs e configurações do Zendesk Switchboard para o n1ago.

## App e Switchboard

| Recurso | ID |
|---------|-----|
| **App ID** | `5fbcf8fffea626000bbaa1eb` |
| **Switchboard ID** | `5fbcf900066663000dfd8a2d` |
| **Default Integration** | `64d65d81a40bc6cf30ebfbb1` (zd-answerBot) |

## Integrações do Switchboard

| Integração | Switchboard Integration ID | Integration ID | Tipo | Próximo (escalação) |
|------------|---------------------------|----------------|------|---------------------|
| **zd-answerBot** | `64d65d81a40bc6cf30ebfbb1` | `5fbcf900e2059d2c998df19b` | zd:answerBot | → zd-agentWorkspace |
| **zd-agentWorkspace** | `5fbcf90112addf000c227bb2` | `5fbcf8ffe2059d2c998dd53a` | zd:agentWorkspace | → zd-answerBot |
| **n1ago-dev** | `69357782256891c6fda71018` | `6932434c4334cffa4dbbdb8a` | custom | → zd-agentWorkspace |
| **n1ago-prod** | `693577c73ef61062218d9705` | `693249c8e4ca9754f520a88e` | custom | → zd-agentWorkspace |

## Webhooks

| Ambiente | Webhook ID |
|----------|------------|
| **Development** | `6932434c4334cffa4dbbdb89` |
| **Production** | `693249c8e4ca9754f520a88d` |

## API Base URL

```
https://api.smooch.io
```

## Autenticação

Usar HTTP Basic Auth com API keys do tipo `app_` (escopo app).

```bash
curl -u "app_XXXX:SECRET" https://api.smooch.io/v2/apps/{appId}/...
```

**Secrets configurados:**
- `ZENDESK_APP_API_KEY` (development) - Chave com escopo app para dev

## Comandos Úteis

### Listar Switchboard
```bash
curl -X GET "https://api.smooch.io/v2/apps/5fbcf8fffea626000bbaa1eb/switchboards" \
  -u "$ZENDESK_APP_API_KEY" \
  -H "Content-Type: application/json"
```

### Listar Integrações do Switchboard
```bash
curl -X GET "https://api.smooch.io/v2/apps/5fbcf8fffea626000bbaa1eb/switchboards/5fbcf900066663000dfd8a2d/switchboardIntegrations" \
  -u "$ZENDESK_APP_API_KEY" \
  -H "Content-Type: application/json"
```

### Passar Controle para n1ago-dev
```bash
curl -X POST "https://api.smooch.io/v2/apps/5fbcf8fffea626000bbaa1eb/conversations/{conversationId}/passControl" \
  -u "$ZENDESK_APP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "switchboardIntegration": "69357782256891c6fda71018",
    "metadata": { "reason": "credit_card_topic" }
  }'
```

### Passar Controle para Agente Humano (transbordo)
```bash
curl -X POST "https://api.smooch.io/v2/apps/5fbcf8fffea626000bbaa1eb/conversations/{conversationId}/passControl" \
  -u "$ZENDESK_APP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "switchboardIntegration": "5fbcf90112addf000c227bb2",
    "metadata": { "reason": "escalation_to_human" }
  }'
```

### Enviar Mensagem
```bash
curl -X POST "https://api.smooch.io/v2/apps/5fbcf8fffea626000bbaa1eb/conversations/{conversationId}/messages" \
  -u "$ZENDESK_APP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "author": { "type": "business" },
    "content": { "type": "text", "text": "Olá! Como posso ajudar?" }
  }'
```

## Fluxo de Handoff

```
┌─────────────────┐
│  Cliente entra  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  zd-answerBot   │  (Bot automático do Zendesk)
│  atende         │
└────────┬────────┘
         │ Cliente escolhe "cartão de crédito"
         │ passControl → n1ago
         ▼
┌─────────────────┐
│    n1ago        │  (Nossa IA)
│    assume       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────────────┐
│Resolve│ │  passControl   │
│sozinho│ │→ agentWorkspace│
└───────┘ └────────────────┘
                  │
                  ▼
          ┌────────────────┐
          │ Agente humano  │
          │ assume         │
          └────────────────┘
```

## Eventos de Webhook Relevantes

Quando o n1ago receber controle, o webhook terá:
- `trigger`: `switchboard:passControl`
- `activeSwitchboardIntegration.name`: `n1ago-dev` ou `n1ago-prod`

---

*Documentado em: 07/12/2025*
