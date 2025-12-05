# N1ago - Agente de Atendimento sobre Crédito

## Visão Geral

N1ago é um sistema para receber e monitorar webhooks do Zendesk Sunshine Conversations. Ele:

- **Recebe mensagens** via webhooks do Sunshine Conversations
- **Armazena todas as conversas** no banco de dados PostgreSQL
- **Exibe eventos em tempo real** no dashboard React
- **Registra TODAS as chamadas** do webhook, mesmo as que falham
- **Controle de acesso** com login Replit Auth (Google) e lista de usuários autorizados

## Stack Tecnológico

### Frontend
- React com TypeScript
- Vite (bundler e servidor de desenvolvimento)
- Tailwind CSS (estilização)
- TanStack Query (gerenciamento de estado e cache)
- Lucide React (ícones)
- date-fns (manipulação de datas)
- wouter (roteamento)

### Backend
- Express.js (servidor Node.js)
- Drizzle ORM (interação com banco de dados)
- PostgreSQL/Neon (banco de dados)
- Replit Auth (autenticação via OpenID Connect)
- Passport.js (sessões de autenticação)

### Estrutura
```
/client              - código do frontend React
/server              - código do backend Express
  /adapters          - adaptadores para fontes de dados (Zendesk, etc)
  /services          - serviços de processamento (EventBus, EventProcessor, PollingWorker)
/shared              - esquemas e tipos compartilhados
```

## Arquitetura de Eventos Padronizados

O sistema implementa uma arquitetura modular para receber eventos de múltiplas fontes e normalizá-los em um formato padrão.

### Fluxo de Dados

```
┌─────────────────────┐
│  Webhook (isolado)  │  ← Só recebe e salva raw
│  /webhook/zendesk   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  webhook_events_raw │  ← Tabela de eventos brutos
│  (source: zendesk)  │
└──────────┬──────────┘
           │
   EventBus.emit("raw:created")
           │
           ▼
┌─────────────────────┐
│   Event Processor   │  ← Orquestrador
│  + ZendeskAdapter   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   events_standard   │  ← Eventos normalizados
└─────────────────────┘
```

### Componentes

1. **Webhook Isolado**: Apenas recebe e salva o evento raw, sem lógica de negócio
2. **EventBus**: Sistema de eventos para comunicação assíncrona
3. **Event Processor**: Orquestrador que usa adaptadores para normalizar eventos
4. **Polling Worker**: Processa eventos pendentes a cada 10 segundos (fallback/retry)
5. **Adapters**: Transformam dados específicos de cada fonte para o formato padrão

### Adaptadores Disponíveis

- **ZendeskAdapter**: Normaliza eventos do Zendesk Sunshine Conversations
  - Tipos suportados: `message`, `conversation_started`, `read_receipt`, `typing`
  - Mapeia autores: `user` → `customer`, `business` → `agent`, `app` → `bot`

### Adicionando Nova Fonte

Para adicionar uma nova fonte (ex: WhatsApp):

1. Criar o adaptador em `/server/adapters/whatsapp/index.ts`
2. Implementar a interface `SourceAdapter`:
   - `normalize(rawPayload)`: Converte para StandardEvent[]
   - `extractUser(rawPayload)`: Extrai dados do usuário
   - `extractConversation(rawPayload)`: Extrai dados da conversa
   - `verifyAuth()`: Valida autenticação do webhook
3. Registrar no `/server/adapters/index.ts`
4. Criar endpoint em `/webhook/whatsapp`

## Sistema de Autenticação

### Controle de Acesso
O sistema implementa autenticação dupla:

1. **Replit Auth (Google Login)**: Usuários fazem login com suas contas Google via Replit
2. **Restrição de Domínio**: Apenas emails `@ifood.com.br` podem acessar
3. **Lista de Autorizados**: Usuários devem estar cadastrados na tabela `authorized_users`

### Fluxo de Autenticação
1. Usuário clica em "Entrar com sua conta"
2. Replit Auth redireciona para login do Google
3. Após login, sistema verifica:
   - Se o email é do domínio @ifood.com.br
   - Se o email está na lista de usuários autorizados
4. Se autorizado, acessa o dashboard; senão, vê página de acesso negado

### Rotas Públicas (sem autenticação)
- `/webhook/zendesk` - Recebe eventos do Zendesk
- `/health` - Health check do servidor

### Gerenciamento de Usuários Autorizados
- Interface administrativa em `/authorized-users`
- Adicionar, listar e remover usuários autorizados
- Apenas usuários já autorizados podem gerenciar outros usuários

## Banco de Dados

O sistema usa PostgreSQL para armazenar todas as interações:

### Tabelas

1. **users** - Usuários do Sunshine Conversations (Zendesk)
   - `id`: ID interno do n1ago (usado em joins)
   - `sunshineId`: ID único do usuário no Zendesk (chave de upsert)
   - `externalId`: ID externo (quando autenticado)
   - `authenticated`: Se o usuário está autenticado
   - `profile`: JSON com dados do perfil (email, givenName, surname, locale)
   - `metadata`, `identities`: Dados adicionais do Zendesk
   - `firstSeenAt`, `lastSeenAt`: Timestamps de atividade

2. **zendesk_conversations_webhook_raw** - Log bruto do webhook legado (depreciado)
   - Mantido para compatibilidade com dados antigos

3. **webhook_events_raw** - Log bruto de TODOS os webhooks (nova arquitetura)
   - `source`: Fonte do evento (zendesk, whatsapp, etc.)
   - `headers`, `payload`, `raw_body`: Dados brutos
   - `processing_status`: pending, success, error
   - `retry_count`: Contagem de retentativas

4. **events_standard** - Eventos normalizados de todas as fontes
   - `event_type`: message, conversation_started, typing, read_receipt, etc.
   - `event_subtype`: text, image, file, etc.
   - `source`: zendesk, whatsapp, email, etc.
   - `author_type`: customer, agent, bot, system
   - `content_text`, `content_payload`: Conteúdo do evento
   - `occurred_at`: Timestamp original do evento
   - `source_raw_id`: FK para webhook_events_raw

5. **conversations** - Conversas do Zendesk
   - ID da conversa e app do Zendesk
   - Dados do usuário
   - Status (active, closed)

4. **messages** - Mensagens individuais
   - Autor (user, agent, bot)
   - Conteúdo (texto ou payload)
   - Timestamps do Zendesk e local

5. **sessions** - Sessões de autenticação (Replit Auth)
   - Gerenciadas pelo connect-pg-simple
   - TTL de 1 semana

6. **auth_users** - Usuários autenticados via Replit Auth
   - `id`: ID do usuário no Replit
   - `email`: Email do usuário
   - `firstName`, `lastName`: Nome do usuário
   - `profileImageUrl`: URL da foto de perfil

7. **authorized_users** - Lista de usuários autorizados
   - `id`: ID interno
   - `email`: Email autorizado (único, domínio @ifood.com.br)
   - `name`: Nome do usuário (opcional)
   - `createdAt`: Data de criação
   - `createdBy`: Email de quem autorizou

## Configuração

### Variáveis de Ambiente

- `DATABASE_URL`: URL de conexão do PostgreSQL (configurado automaticamente)
- `SESSION_SECRET`: Segredo para sessões de autenticação (obrigatório)
- `ZENDESK_WEBHOOK_SECRET`: Segredo compartilhado para validação de assinatura HMAC (opcional)

### Configurar Zendesk

1. Vá para Admin Center → Apps and integrations → Integrations → Conversations integrations
2. Clique em "Create integration"
3. Configure:
   - **URL do ponto de extremidade**: `https://seu-dominio.replit.dev/webhook/zendesk`
   - **Assinaturas do webhook**: Selecione os eventos desejados
4. Copie o **segredo compartilhado** e configure como `ZENDESK_WEBHOOK_SECRET`

## Endpoints

### Públicos (sem autenticação)

#### `/webhook/zendesk` (POST)
Endpoint principal para receber eventos do Zendesk Sunshine Conversations.
- Registra TODAS as chamadas no banco antes de processar
- Valida assinatura HMAC se `ZENDESK_WEBHOOK_SECRET` estiver configurado
- Processa eventos: `conversation:message`, `conversation:create`

#### `/health` (GET)
Health check do servidor

### Autenticação

#### `/api/login` (GET)
Inicia fluxo de login via Replit Auth

#### `/api/callback` (GET)
Callback do OpenID Connect

#### `/api/logout` (GET)
Encerra sessão do usuário

#### `/api/auth/user` (GET)
Retorna dados do usuário autenticado e autorizado

### APIs Protegidas (requer autenticação + autorização)

#### `/api/authorized-users` (GET, POST)
- GET: Lista usuários autorizados
- POST: Adiciona novo usuário autorizado

#### `/api/authorized-users/:id` (DELETE)
Remove usuário autorizado

#### `/api/webhook-logs` (GET)
Lista logs de webhooks recebidos
- Parâmetros: `status`, `limit`, `offset`

#### `/api/webhook-logs/:id` (GET)
Detalhes completos de um log específico

#### `/api/webhook-logs/stats` (GET)
Estatísticas dos logs por status

#### `/api/users/stats` (GET)
Estatísticas de usuários do Zendesk

#### `/api/conversations/grouped` (GET)
Lista usuários com suas conversas agrupadas
- Parâmetros: `limit`, `offset`

#### `/api/conversations/user/:userId/messages` (GET)
Todas as conversas e mensagens de um usuário específico

#### `/api/conversations/stats` (GET)
Estatísticas de conversas

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

### Problemas de autenticação
- Verifique se `SESSION_SECRET` está configurado
- Confirme que o email é do domínio @ifood.com.br
- Verifique se o usuário está na lista de autorizados

---

**Última atualização**: 2025-12-05
**Versão**: 3.0.0

## Changelog

### v3.0.0 (2025-12-05)
- Nova arquitetura de eventos padronizados com adaptadores
- Tabela `webhook_events_raw` para armazenar eventos brutos de qualquer fonte
- Tabela `events_standard` para eventos normalizados
- `ZendeskAdapter` implementado com normalize(), extractUser(), extractConversation()
- `EventBus` para processamento assíncrono via eventos
- `Polling Worker` para retry automático de eventos pendentes
- Webhook isolado (apenas recebe e salva, sem lógica de negócio)
- Novos endpoints: `GET /api/events`, `GET /api/events/stats`, `GET /api/webhook-raws/stats`
- Endpoint legacy mantido em `/webhook/zendesk/legacy` para compatibilidade

### v2.5.0 (2025-12-05)
- Rota `/users` agora é a página principal de usuários (antes era `/conversation`)
- Rota `/users/:userId` para ver histórico de conversas de um usuário
- Removida a antiga página de usuários (tabela simples)
- Adicionado botão "Ver Usuário" na lista que abre overlay com detalhes completos
- **APIs removidas (obsoletas)**:
  - `GET /api/users` - substituída por `/api/conversations/grouped`
  - `GET /api/conversations` - não utilizada
  - `GET /api/conversations/:zendeskId/messages` - substituída por `/api/conversations/user/:userId/messages`

### v2.4.0 (2025-12-05)
- Conversas agora agrupadas por usuário na lista principal
- Lista mostra: contagem de conversas, última atividade, nome/email do usuário
- Separadores visuais entre diferentes conversas do mesmo usuário
- Novos endpoints: `GET /api/conversations/grouped` e `GET /api/conversations/user/:userId/messages`

### v2.2.0 (2025-12-05)
- Sistema de autenticação com Replit Auth (Google Login)
- Restrição de acesso ao domínio @ifood.com.br
- Tabela `authorized_users` para controle granular de acesso
- Interface de administração de usuários autorizados
- Primeiro usuário autorizado: wilson.cimino@ifood.com.br
- Rotas de webhook permanecem públicas para receber eventos do Zendesk

### v2.1.0 (2025-12-05)
- Tabela `users` para armazenar usuários do Sunshine Conversations
- Upsert automático de usuários a cada evento recebido
- Campos seguem nomenclatura original do Zendesk (sunshineId, externalId, profile, etc)
- Rastreamento de firstSeenAt e lastSeenAt para cada usuário

### v2.0.0 (2025-12-05)
- Migração completa para stack TypeScript/Node.js
- Frontend React com Tailwind CSS
- Backend Express com Drizzle ORM
- Dashboard para visualização de eventos em tempo real

### v0.2 (2025-12-05)
- Versão Python/Flask (depreciada)
