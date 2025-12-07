# N1ago - Agente de Atendimento sobre Crédito

## Overview

N1ago is a system designed to receive and monitor webhooks from Zendesk Sunshine Conversations, acting as an attendance agent for credit-related inquiries. It captures and stores all conversation data, displays real-time events on a React dashboard, and provides robust access control. The project aims to streamline customer interaction data management, provide a real-time overview of events, and serve as a foundation for advanced customer service automation, including AI-powered features for conversation summarization and product classification. The business vision is to enhance customer service efficiency and data utilization, offering significant market potential in automated support and customer insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system employs a clear separation between frontend and backend. The frontend uses React with TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter. The backend is an Express.js server utilizing Drizzle ORM for PostgreSQL interaction and Replit Auth for secure authentication.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests events from various sources and normalizes them into a consistent `StandardEvent` format. Raw webhooks are saved, an `EventBus` triggers an `Event Processor`, which uses `Adapters` to normalize data into `events_standard`. Events maintain polymorphic references to their raw data.
*   **Component-Based Design:** Includes `Webhook Isolado` (dedicated webhook endpoints), `EventBus` (asynchronous communication), `Event Processor` (normalization orchestration), `Polling Worker` (retry mechanism for pending events), and `Adapters` (source-specific transformations).
*   **Authentication System:** Dual strategy using Replit Auth (Google Login) with an Access Control List that restricts access to specific email domains (`@ifood.com.br`) and `authorized_users` table entries.
*   **AI-Powered Features:** Unified architecture for multiple AI capabilities (summary, classification, response generation) using a single `openai_api_config` table. Each feature has a 3-layer architecture: `openaiApiService.ts` (API interaction & logging), `*Adapter.ts` (business logic), and `*Orchestrator.ts` (trigger orchestration). All OpenAI calls are logged for auditing and analysis. Features include configurable triggers and lazy initialization of the OpenAI client.

**UI/UX Decisions:**

The frontend dashboard offers a real-time view of events and conversations, administrative interfaces for user management, and webhook logs. It utilizes a component-based design with reusable UI components for badges, data tables, modals, pagination, and more, all styled with Tailwind CSS.

**Feature Specifications:**

*   **Webhook Ingestion:** Receives, logs, and processes incoming webhooks.
*   **Conversation Storage:** Stores all conversation data and events in PostgreSQL.
*   **Real-time Dashboard:** Displays events, conversation metrics, and allows user/webhook management.
*   **User Management:** Secure authentication and authorization with domain and user-list restrictions.
*   **Extensibility:** Designed for easy integration of new communication channels via adapters.
*   **AI Integrations:** Conversation Summaries, Product Classification, API Logging, and Configurable Triggers for AI features.

**System Design Choices:**

*   **Database Schema:** Tables are plural, `snake_case`; single-config tables are singular, `snake_case`; foreign keys are singular, `snake_case`; indices are `idx_<table_name>_<field>`.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs in the path.
*   **File Structure:** Feature-based organization for both frontend and backend.

**Shared Types Architecture (shared/types/):**

Types shared between frontend and backend are centralized in `shared/types/`:
```
shared/
├── schema.ts           # Drizzle database schema
└── types/
    ├── index.ts        # Re-exports all types
    ├── common.ts       # AuthorType, PaginatedResponse
    ├── users.ts        # User, UserProfile, StandardUser, AuthorizedUser
    ├── organizations.ts # StandardOrganization
    ├── events.ts       # StandardEvent, StandardEventInput, EventTypeMapping
    ├── conversations.ts # Conversation, Message, UserGroup, etc
    ├── webhooks.ts     # WebhookLog, WebhookLogDetail
    ├── config.ts       # OpenaiConfigResponse
    ├── products.ts     # ProductCount, ProductStatsResponse
    └── adapters.ts     # SourceAdapter interface
```

- Frontend imports: `import { User } from "@/types"` (via client/src/types/index.ts re-export)
- Backend imports: `import { StandardUser } from "../../shared/types"`
- `StandardEvent` (snake_case) = API/DB format
- `StandardEventInput` (camelCase) = Adapter internal format

**Backend Feature Architecture (server/features/):**

Each feature module follows a consistent structure:
```
server/features/<feature>/
├── routes/      # Express route handlers
├── storage/     # Database operations (Drizzle)
├── services/    # Business logic
└── index.ts     # Public exports
```

Current features:
- `auth/` - Authentication and authorization (authStorage, auth routes)
- `ai/` - OpenAI integrations (config, logs, knowledge base)
- `cadastro/` - User and organization management
- `conversations/` - Conversation and message handling (includes userStorage)
- `events/` - Event processing and normalization
- `export/` - Webhooks and data export
- `maintenance/` - System maintenance utilities
- `products/` - Product classification and stats
- `sync/` - Background workers (pollingWorker, reprocessingService)

Centralized entry points:
- `server/routes/index.ts` - Route registration
- `server/storage/index.ts` - Consolidated storage exports
- `server/services/index.ts` - Consolidated service exports
- `server/storage.ts` - Main storage facade

## External Dependencies

*   **Zendesk Sunshine Conversations:** Primary webhook source.
*   **PostgreSQL/Neon:** Relational database.
*   **Replit Auth:** User authentication (Google Login).
*   **Passport.js:** Authentication session management.
*   **Express.js:** Backend web framework.
*   **Drizzle ORM:** TypeScript ORM for database.
*   **React:** Frontend UI library.
*   **Vite:** Frontend build tool.
*   **Tailwind CSS:** Styling framework.
*   **TanStack Query:** Data fetching and state management.
*   **Lucide React:** Icon library.
*   **date-fns:** Date utility library.
*   **wouter:** React routing library.

---

## API Endpoints Reference

### Autenticação
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/login | - | Inicia fluxo de login OAuth |
| GET | /api/callback | - | Callback do OAuth |
| GET | /api/logout | - | Encerra sessão |
| GET | /api/auth/user | Yes | Retorna usuário autenticado |
| GET | /api/authorized-users | Yes | Lista usuários autorizados |
| POST | /api/authorized-users | Yes | Adiciona usuário autorizado |
| DELETE | /api/authorized-users/:id | Yes | Remove usuário autorizado |

### Webhooks
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /health | - | Health check do servidor |
| POST | /webhook/zendesk | HMAC | Recebe webhooks do Zendesk |
| GET | /api/webhook-logs | Yes | Lista logs de webhooks |
| GET | /api/webhook-logs/stats | Yes | Estatísticas de webhooks |
| GET | /api/webhook-logs/:id | Yes | Detalhes de um webhook |

### Conversas
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/conversations/stats | Yes | Estatísticas de conversas |
| GET | /api/conversations/filters | Yes | Filtros disponíveis |
| GET | /api/conversations/grouped | Yes | Conversas agrupadas por usuário |
| GET | /api/conversations/user/:userId/messages | Yes | Mensagens de um usuário |
| GET | /api/conversations/:id/summary | Yes | Resumo de uma conversa |

### Eventos
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/events/events_standard | Yes | Lista eventos normalizados |
| GET | /api/events/stats | Yes | Estatísticas de eventos |
| GET | /api/event-type-mappings | Yes | Mapeamentos de tipos |
| POST | /api/event-type-mappings | Yes | Cria mapeamento |
| PUT | /api/event-type-mappings/:id | Yes | Atualiza mapeamento |
| DELETE | /api/event-type-mappings/:id | Yes | Remove mapeamento |

### IA - OpenAI
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/openai-config/:configType | Yes | Obtém config |
| PUT | /api/openai-config/:configType | Yes | Atualiza config |
| GET | /api/openai-logs | Yes | Lista logs de chamadas OpenAI |
| GET | /api/openai-logs/:id | Yes | Detalhes de uma chamada |

### Knowledge Base
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/knowledge-base | - | Lista artigos |
| GET | /api/knowledge-base/:id | - | Detalhes de um artigo |
| POST | /api/knowledge-base | - | Cria artigo |
| PUT | /api/knowledge-base/:id | - | Atualiza artigo |
| DELETE | /api/knowledge-base/:id | - | Remove artigo |

### Cadastro
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/users-standard | Yes | Lista usuários padrão |
| GET | /api/users-standard/:email | Yes | Detalhes por email |
| GET | /api/organizations-standard | Yes | Lista organizações |
| GET | /api/organizations-standard/:cnpjRoot | Yes | Detalhes por CNPJ |

### Produtos
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/products/stats | Yes | Estatísticas de produtos |
| GET | /api/product-standards | Yes | Lista padrões de produto |
| PUT | /api/product-standards | Yes | Atualiza padrões |

### Exportação
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/export/summaries | Yes | Exporta resumos |
| GET | /api/export/filters | Yes | Filtros disponíveis |

### Manutenção
| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | /api/maintenance/reprocessing/progress | - | Progresso do reprocessamento |
| POST | /api/maintenance/reprocessing/start/:type | - | Inicia reprocessamento |
| POST | /api/maintenance/reprocessing/stop/:type | - | Para reprocessamento |

---

## Environment Variables

### Secrets Obrigatórios
- DATABASE_URL: URL de conexão PostgreSQL
- SESSION_SECRET: Chave secreta para sessões Express
- OPENAI_API_KEY: Chave da API OpenAI

### Secrets do Banco (Auto-gerenciados)
- PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

### Environment Variables Por Ambiente
- ZENDESK_WEBHOOK_SECRET (dev/prod): Chave HMAC para webhooks
- ZENDESK_WEBHOOK_ID (dev/prod): ID do webhook no Zendesk

---

## Deploy / Publicação

### Pré-requisitos
1. Banco de dados PostgreSQL configurado
2. Secrets configurados: SESSION_SECRET, OPENAI_API_KEY
3. Variáveis de ambiente de produção configuradas

### Passos para Publicar
1. Verifique se o app funciona em desenvolvimento
2. Configure variáveis de produção no painel Secrets
3. Clique Deploy no Replit
4. Escolha Autoscale (recomendado para APIs)

---

## Troubleshooting

### Webhooks não chegando
1. Verifique ZENDESK_WEBHOOK_SECRET
2. Confirme endpoint /webhook/zendesk acessível
3. Verifique logs em /api/webhook-logs

### Autenticação falhando
1. Verifique usuário em authorized_users
2. Confirme email com @ifood.com.br
3. Verifique SESSION_SECRET configurado

### IA não gerando resumos
1. Verifique OPENAI_API_KEY configurado
2. Confirme config ativa em /api/openai-config/:type
3. Verifique logs em /api/openai-logs

### Eventos não processando
1. Verifique logs em /api/webhook-raws/stats
2. Use /api/maintenance/reprocessing/start/all

---

## UI Components Catalog

Componentes em client/src/shared/components/ui/:

### Badge
- variant: success, error, warning, info, purple, teal, default
- size: sm, md
- icon: ReactNode opcional
- rounded: full, default

### DataTable
- columns: Column<T>[] - definição das colunas
- data: T[] - dados a exibir
- keyExtractor: extrai chave única
- pagination: props de paginação
- onRowClick: callback ao clicar

### Modal
- title: título do modal
- onClose: callback ao fechar
- maxWidth: sm, md, lg, xl, 2xl, 4xl

### Pagination
- page, totalPages, total
- onPreviousPage, onNextPage
- hasPreviousPage, hasNextPage

### Outros Componentes
- LoadingSpinner: spinner animado
- EmptyState: estado vazio
- Drawer: painel lateral
- ToggleSwitch: toggle on/off
- SegmentedTabs: tabs segmentadas
- PageCard: container para páginas
- MessageBubble: bolha de chat
- ImageLightbox: visualizador de imagens

