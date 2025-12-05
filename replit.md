# N1ago - Agente de Atendimento sobre Crédito

## Visão Geral

N1ago é um sistema para receber e monitorar webhooks do Zendesk Sunshine Conversations. Ele:

- **Recebe mensagens** via webhooks do Sunshine Conversations
- **Armazena todas as conversas** no banco de dados PostgreSQL
- **Exibe eventos em tempo real** no dashboard React
- **Registra TODAS as chamadas** do webhook, mesmo as que falham

## Stack Tecnológico

### Frontend
- React com TypeScript
- Vite (bundler e servidor de desenvolvimento)
- Tailwind CSS (estilização)
- TanStack Query (gerenciamento de estado e cache)
- Lucide React (ícones)
- date-fns (manipulação de datas)

### Backend
- Express.js (servidor Node.js)
- Drizzle ORM (interação com banco de dados)
- PostgreSQL/Neon (banco de dados)

### Estrutura
```
/client         - código do frontend React
/server         - código do backend Express
/shared         - esquemas e tipos compartilhados
```

## Banco de Dados

O sistema usa PostgreSQL para armazenar todas as interações:

### Tabelas

1. **webhook_raw_logs** - Log bruto de TODAS as chamadas do webhook
   - Armazena headers, payload, raw_body
   - Status de processamento (pending, success, error)
   - Mensagem de erro quando aplicável

2. **conversations** - Conversas do Zendesk
   - ID da conversa e app do Zendesk
   - Dados do usuário
   - Status (active, closed)

3. **messages** - Mensagens individuais
   - Autor (user, agent, bot)
   - Conteúdo (texto ou payload)
   - Timestamps do Zendesk e local

## Configuração

### Variáveis de Ambiente

- `DATABASE_URL`: URL de conexão do PostgreSQL (configurado automaticamente)
- `ZENDESK_WEBHOOK_SECRET`: Segredo compartilhado para validação de assinatura HMAC (opcional)

### Configurar Zendesk

1. Vá para Admin Center → Apps and integrations → Integrations → Conversations integrations
2. Clique em "Create integration"
3. Configure:
   - **URL do ponto de extremidade**: `https://seu-dominio.replit.dev/webhook/zendesk`
   - **Assinaturas do webhook**: Selecione os eventos desejados
4. Copie o **segredo compartilhado** e configure como `ZENDESK_WEBHOOK_SECRET`

## Endpoints

### Webhooks

#### `/webhook/zendesk` (POST)
Endpoint principal para receber eventos do Zendesk Sunshine Conversations.
- Registra TODAS as chamadas no banco antes de processar
- Valida assinatura HMAC se `ZENDESK_WEBHOOK_SECRET` estiver configurado
- Processa eventos: `conversation:message`, `conversation:create`

### APIs de Consulta

#### `/api/webhook-logs` (GET)
Lista logs de webhooks recebidos
- Parâmetros: `status`, `limit`, `offset`

#### `/api/webhook-logs/:id` (GET)
Detalhes completos de um log específico

#### `/api/webhook-logs/stats` (GET)
Estatísticas dos logs por status

#### `/api/conversations` (GET)
Lista todas as conversas armazenadas

#### `/api/conversations/:zendeskId/messages` (GET)
Mensagens de uma conversa específica

#### `/health` (GET)
Health check do servidor

## Scripts

```bash
npm run dev          # Inicia desenvolvimento (frontend + backend)
npm run dev:server   # Apenas backend
npm run dev:client   # Apenas frontend
npm run build        # Build para produção
npm run db:push      # Sincroniza schema do banco
```

## Troubleshooting

### Webhook não recebe eventos
- Confirme URL do webhook no Zendesk (Admin Center → Integrations)
- Verifique se é HTTPS e acessível publicamente
- Teste com curl: `curl -X POST https://seu-dominio/webhook/zendesk -H "Content-Type: application/json" -d '{"events": []}'`

### Erro de assinatura
- Verifique se `ZENDESK_WEBHOOK_SECRET` está configurado corretamente
- Se não quiser validação, deixe a variável vazia

---

**Última atualização**: 2025-12-05
**Versão**: 2.0.0

## Changelog

### v2.0.0 (2025-12-05)
- Migração completa para stack TypeScript/Node.js
- Frontend React com Tailwind CSS
- Backend Express com Drizzle ORM
- Dashboard para visualização de eventos em tempo real

### v0.2 (2025-12-05)
- Versão Python/Flask (depreciada)
