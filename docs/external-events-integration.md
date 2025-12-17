# Documentação de Integração - API de Eventos Externos N1ago

Esta documentação descreve como integrar sistemas externos com o N1ago para enviar eventos de forma segura e estruturada.

## Visão Geral

A API de Eventos Externos permite que sistemas externos (CRMs, ERPs, chatbots, agentes de IA, etc.) enviem eventos diretamente para o N1ago. Esses eventos são armazenados na tabela `events_standard` e podem ser processados pelo pipeline de automação.

## Autenticação

Todas as requisições devem incluir uma chave de API válida no header `X-API-Key`.

```
X-API-Key: nes_sua_chave_aqui
```

As chaves de API são geradas e gerenciadas na interface do N1ago em **Configurações → Eventos externos**.

**Importante:** Cada chave de API está vinculada a um `source` e um `channel_type` específicos. Ambos os campos no payload devem corresponder exatamente aos valores cadastrados para a chave.

## Endpoints

### Enviar Evento Único

```
POST /api/events/ingest
Content-Type: application/json
X-API-Key: nes_sua_chave_aqui
```

### Enviar Eventos em Lote

```
POST /api/events/ingest/batch
Content-Type: application/json
X-API-Key: nes_sua_chave_aqui
```

## Estrutura do Payload

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `event_type` | string | Tipo do evento. Valores: `message`, `status_change`, `assignment`, `tag_added`, `tag_removed`, `note`, `custom` |
| `source` | string | Identificador do sistema de origem. Deve corresponder ao source cadastrado para a API key |
| `author_type` | string | Tipo do autor. Valores: `customer`, `agent`, `bot`, `system` |
| `occurred_at` | string (ISO 8601) | Data/hora do evento. Exemplo: `2025-01-15T10:30:00Z` |
| `channel_type` | string | Tipo de canal. Deve corresponder ao channel_type cadastrado para a API key (ex: whatsapp, email, chat) |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `event_subtype` | string | Subtipo do evento (livre) |
| `source_event_id` | string | ID único do evento no sistema de origem (usado para idempotência) |
| `external_conversation_id` | string | ID da conversa no sistema de origem |
| `external_user_id` | string | ID do usuário/cliente no sistema de origem |
| `author_id` | string | ID do autor no sistema de origem |
| `author_name` | string | Nome do autor |
| `content_text` | string | Conteúdo textual do evento (mensagem, nota, etc.) |
| `content_payload` | object | Payload estruturado adicional (JSON livre) |
| `metadata` | object | Metadados adicionais (JSON livre) |

## Exemplos

### Exemplo 1: Enviar Mensagem de Cliente

```json
{
  "event_type": "message",
  "source": "meu-crm",
  "author_type": "customer",
  "occurred_at": "2025-01-15T10:30:00Z",
  "external_conversation_id": "conv-12345",
  "external_user_id": "user-789",
  "author_name": "João Silva",
  "content_text": "Olá, preciso de ajuda com meu pedido",
  "channel_type": "whatsapp",
  "metadata": {
    "phone": "+5511999999999",
    "order_id": "PED-2025-001"
  }
}
```

### Exemplo 2: Enviar Nota Interna

```json
{
  "event_type": "note",
  "source": "meu-crm",
  "author_type": "agent",
  "occurred_at": "2025-01-15T10:35:00Z",
  "external_conversation_id": "conv-12345",
  "author_id": "agent-42",
  "author_name": "Maria Atendente",
  "content_text": "Cliente informou que o pedido não chegou. Verificar com logística."
}
```

### Exemplo 3: Mudança de Status

```json
{
  "event_type": "status_change",
  "source": "meu-crm",
  "author_type": "system",
  "occurred_at": "2025-01-15T10:40:00Z",
  "external_conversation_id": "conv-12345",
  "content_payload": {
    "old_status": "open",
    "new_status": "pending"
  }
}
```

### Exemplo 4: Evento Customizado

```json
{
  "event_type": "custom",
  "event_subtype": "nps_response",
  "source": "meu-crm",
  "author_type": "customer",
  "occurred_at": "2025-01-15T11:00:00Z",
  "external_conversation_id": "conv-12345",
  "external_user_id": "user-789",
  "content_payload": {
    "score": 9,
    "comment": "Excelente atendimento!"
  }
}
```

### Exemplo 5: Envio em Lote

```json
{
  "events": [
    {
      "event_type": "message",
      "source": "meu-crm",
      "author_type": "customer",
      "occurred_at": "2025-01-15T10:00:00Z",
      "external_conversation_id": "conv-001",
      "content_text": "Primeira mensagem"
    },
    {
      "event_type": "message",
      "source": "meu-crm",
      "author_type": "agent",
      "occurred_at": "2025-01-15T10:05:00Z",
      "external_conversation_id": "conv-001",
      "content_text": "Resposta do agente"
    }
  ]
}
```

## Respostas da API

### Sucesso - Evento Único (201 Created)

```json
{
  "success": true,
  "event_id": 12345,
  "is_new": true,
  "message": "Evento criado com sucesso"
}
```

### Sucesso - Lote (200 OK)

```json
{
  "success": true,
  "total": 2,
  "created": 2,
  "failed": 0,
  "results": [
    { "index": 0, "success": true, "event_id": 12345 },
    { "index": 1, "success": true, "event_id": 12346 }
  ]
}
```

### Erro - API Key Não Fornecida (401 Unauthorized)

```json
{
  "error": "API key não fornecida",
  "details": "Inclua o header 'X-API-Key' com sua chave de API"
}
```

### Erro - API Key Inválida (403 Forbidden)

```json
{
  "error": "Acesso negado",
  "details": "API key inválida ou inativa"
}
```

### Erro - Source Não Autorizado (403 Forbidden)

```json
{
  "error": "Acesso negado",
  "details": "Source 'outro-sistema' não corresponde ao cadastrado para esta API key"
}
```

### Erro - Channel Type Não Autorizado (403 Forbidden)

```json
{
  "error": "Acesso negado",
  "details": "Channel type 'email' não corresponde ao cadastrado ('whatsapp')"
}
```

### Erro - Validação de Payload (400 Bad Request)

```json
{
  "error": "Dados inválidos",
  "details": [
    "event_type: Tipo de evento inválido. Use: message, status_change, assignment, tag_added, tag_removed, note, custom",
    "occurred_at: Data inválida. Use formato ISO 8601 (ex: 2025-01-15T10:30:00Z)"
  ]
}
```

## Códigos de Erro

| Código | Significado |
|--------|-------------|
| 201 | Evento criado com sucesso |
| 200 | Lote processado (verifique `results` para status individual) |
| 400 | Payload inválido - verifique os campos obrigatórios e formatos |
| 401 | API key não fornecida no header |
| 403 | API key inválida, inativa, ou source não autorizado |
| 500 | Erro interno do servidor |

## Idempotência

Se você fornecer o campo `source_event_id`, o sistema garantirá que o mesmo evento não seja processado duas vezes. Se um evento com o mesmo `source` + `source_event_id` já existir, a resposta será:

```json
{
  "success": true,
  "event_id": 12345,
  "is_new": false,
  "message": "Evento já existe (idempotência)"
}
```

## Limites

- **Lote máximo:** 100 eventos por requisição
- **Tamanho do payload:** 1MB por requisição
- **Rate limit:** Não há limite definido atualmente, mas use com moderação

## Exemplos de Código

### Python

```python
import requests
from datetime import datetime

API_URL = "https://seu-dominio.repl.co/api/events/ingest"
API_KEY = "nes_sua_chave_aqui"

def send_event(event_data):
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }
    
    response = requests.post(API_URL, json=event_data, headers=headers)
    
    if response.status_code in [200, 201]:
        return response.json()
    else:
        raise Exception(f"Erro: {response.status_code} - {response.text}")

# Exemplo de uso
event = {
    "event_type": "message",
    "source": "meu-sistema",
    "author_type": "customer",
    "occurred_at": datetime.utcnow().isoformat() + "Z",
    "external_conversation_id": "conv-123",
    "content_text": "Mensagem do cliente"
}

result = send_event(event)
print(f"Evento criado: {result['event_id']}")
```

### JavaScript/Node.js

```javascript
const API_URL = "https://seu-dominio.repl.co/api/events/ingest";
const API_KEY = "nes_sua_chave_aqui";

async function sendEvent(eventData) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify(eventData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro: ${error.error} - ${error.details}`);
  }

  return response.json();
}

// Exemplo de uso
const event = {
  event_type: "message",
  source: "meu-sistema",
  author_type: "customer",
  occurred_at: new Date().toISOString(),
  external_conversation_id: "conv-123",
  content_text: "Mensagem do cliente"
};

sendEvent(event)
  .then(result => console.log(`Evento criado: ${result.event_id}`))
  .catch(console.error);
```

### cURL

```bash
curl -X POST "https://seu-dominio.repl.co/api/events/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: nes_sua_chave_aqui" \
  -d '{
    "event_type": "message",
    "source": "meu-sistema",
    "author_type": "customer",
    "occurred_at": "2025-01-15T10:30:00Z",
    "external_conversation_id": "conv-123",
    "content_text": "Mensagem do cliente"
  }'
```

## Para Agentes de IA

Se você é um agente de IA integrando com o N1ago:

1. **Obtenha suas credenciais:** Solicite ao administrador do N1ago que cadastre seu sistema em Configurações → Eventos externos
2. **Armazene a API key com segurança:** A chave só é exibida uma vez na criação
3. **Use o source e channel_type corretos:** Ambos os campos devem corresponder exatamente ao cadastrado
4. **Forneça source_event_id:** Para garantir idempotência e evitar duplicatas
5. **Use timestamps UTC:** Sempre envie `occurred_at` em formato ISO 8601 com timezone UTC (Z)
6. **Estruture content_payload:** Para eventos customizados, use o campo `content_payload` para dados estruturados

## Suporte

Para dúvidas ou problemas, entre em contato com o administrador do N1ago.
