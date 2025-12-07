# N1ago - Agente de Atendimento sobre Crédito

## Overview

N1ago is a system designed to receive and monitor webhooks from Zendesk Sunshine Conversations. Its primary purpose is to act as an attendance agent for credit-related inquiries. It captures and stores all conversation data, displays real-time events on a React dashboard, and provides robust access control. The project aims to streamline customer interaction data management and provide a foundation for advanced customer service automation.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system is built with a clear separation between frontend and backend. The frontend uses React with TypeScript, Vite, Tailwind CSS for styling, TanStack Query for state management, and wouter for routing. The backend is an Express.js server utilizing Drizzle ORM for PostgreSQL interaction and Replit Auth for secure authentication.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** The system employs a modular architecture to ingest events from various sources and normalize them into a consistent `StandardEvent` format.
    *   **Data Flow:** Raw webhooks are received and saved. An `EventBus` then triggers an `Event Processor` which uses `Adapters` to normalize the raw data into `events_standard`.
    *   **Polymorphic References:** Events in `events_standard` link back to their original raw data via `source` and `source_raw_id` fields, allowing for flexible expansion with new data sources.
*   **Component-Based Design:**
    *   **Webhook Isolado:** Dedicated endpoints for receiving raw webhook data without immediate processing logic.
    *   **EventBus:** Facilitates asynchronous communication between system components.
    *   **Event Processor:** Orchestrates the normalization of raw events using registered adapters.
    *   **Polling Worker:** Provides a fallback/retry mechanism for processing pending events.
    *   **Adapters:** Source-specific modules responsible for transforming raw payload structures into the standardized `StandardEvent` format.
*   **Authentication System:** Implements a dual authentication strategy:
    *   **Replit Auth (Google Login):** Users authenticate via Google accounts.
    *   **Access Control List:** Restricts access to specific email domains (`@ifood.com.br`) and requires users to be listed in the `authorized_users` table.

**UI/UX Decisions:**

The frontend dashboard provides a real-time view of events and conversations, with administrative interfaces for managing authorized users and reviewing webhook logs.

**Feature Specifications:**

*   **Webhook Ingestion:** Receives and logs all incoming webhooks, including failures.
*   **Conversation Storage:** Stores all conversation data and events in PostgreSQL.
*   **Real-time Dashboard:** Displays events and conversation metrics.
*   **User Management:** Secure authentication and authorization for system access.
*   **Extensibility:** Designed to easily integrate new communication channels via adapters.
*   **AI-Powered Features:** Unified architecture for multiple AI capabilities (summary and classification).
    *   **Unified Configuration:** All AI features use a single `openai_api_config` table with `config_type` discriminator.
    *   **Architecture (3 Layers per Feature):**
        *   `openaiApiService.ts`: Pure API layer - makes OpenAI calls and saves complete logs to `openai_api_logs` table.
        *   `*Adapter.ts`: Business logic layer - prepares prompts, calls API service, saves results.
        *   `*Orchestrator.ts`: Orchestration layer - determines when to trigger based on event type/author.
    *   **Conversation Summaries:**
        *   Auto-generates summaries using `summaryAdapter.ts` and `summaryOrchestrator.ts`
        *   Saves to `conversations_summary` table
    *   **Product Classification:**
        *   Auto-classifies products using `productClassificationAdapter.ts` and `classificationOrchestrator.ts`
        *   Saves to `conversation_classifications` table
    *   **API Logging:** All OpenAI calls logged with: request_type, model, prompts, full response, tokens used, duration, success/error status.
    *   **Endpoints:**
        *   `GET /api/openai-logs` - List all API call logs (supports ?limit and ?request_type filters)
        *   `GET /api/openai-logs/:id` - Get full details of a specific API call
        *   `GET/PUT /api/openai-config/:configType` - Generic config endpoints for all AI features
    *   **Configurable Triggers:** Each feature can be configured with specific event types and author types.
    *   **Lazy Initialization:** OpenAI client is only initialized when needed, preventing startup errors when API key is not configured.
    *   **Configuration UI:** Available at `/ai/settings/summary` and `/ai/settings/classification` with tabbed navigation.

## Development Conventions

**IMPORTANTE:** Sempre siga estas convenções ao criar ou modificar código neste projeto.

### Database Schema (PostgreSQL/Drizzle)

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Tabelas (coleções) | plural, snake_case | `users`, `events_standard`, `conversations` |
| Tabelas (config única) | singular, snake_case | `openai_summary_config` |
| Foreign keys | singular, snake_case | `user_id`, `conversation_id` |
| Índices | `idx_<tabela>_<campo>` | `idx_events_standard_conversation_id` |

### TypeScript Naming

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Variáveis (export tabela) | camelCase, plural | `eventsStandard`, `conversationsSummary` |
| Types/Interfaces | PascalCase | `EventStandard`, `ConversationSummary` |
| Funções | camelCase, verbo | `getConversationSummary`, `upsertUser` |
| Arquivos de serviço | camelCase | `summaryOrchestrator.ts`, `eventProcessor.ts` |
| Adapters | camelCase + Adapter | `zendeskAdapter.ts` |

### API Endpoints

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| REST resources | plural, kebab-case | `/api/conversations`, `/api/event-type-mappings` |
| Config endpoints | singular | `/api/openai-summary-config` |
| Ações específicas | verbo no path | `/api/conversations/:id/summary` |

### Estrutura de Arquivos

```
server/
  ├── features/         # Arquitetura feature-based (domínios de negócio)
  │   ├── ai/             # Funcionalidades de IA
  │   │   ├── routes/       # openaiConfig.ts, openaiLogs.ts, knowledgeBase.ts
  │   │   ├── services/     # openaiApiService.ts, summaryAdapter.ts, summaryOrchestrator.ts,
  │   │   │                 # productClassificationAdapter.ts, classificationOrchestrator.ts,
  │   │   │                 # responseAdapter.ts, responseOrchestrator.ts
  │   │   └── storage/      # configStorage.ts, knowledgeBaseStorage.ts
  │   ├── cadastro/       # Usuários e organizações
  │   │   ├── routes/       # usersStandard.ts, organizationsStandard.ts
  │   │   └── storage/      # usersStandardStorage.ts, organizationsStandardStorage.ts
  │   ├── events/         # Processamento de eventos
  │   │   ├── routes/       # events.ts
  │   │   ├── services/     # eventBus.ts, eventProcessor.ts
  │   │   └── storage/      # eventStorage.ts
  │   ├── export/         # Exportação e webhooks
  │   │   ├── routes/       # export.ts, webhookLogs.ts, webhooks.ts
  │   │   └── storage/      # webhookStorage.ts
  │   └── maintenance/    # Manutenção do sistema
  │       └── routes/       # maintenance.ts
  ├── adapters/         # Transformadores de dados por source (Zendesk)
  ├── routes/           # Rotas core (agregador + auth, conversations, products)
  │   ├── index.ts        # Registrador central (importa de features)
  │   ├── auth.ts         # Endpoints de autenticação
  │   ├── conversations.ts # Conversas e mensagens
  │   └── products.ts     # Produtos
  ├── services/         # Services compartilhados
  │   ├── index.ts        # Re-exporta services de features
  │   ├── pollingWorker.ts # Worker para processar eventos pendentes
  │   └── reprocessingService.ts # Serviço de reprocessamento
  ├── storage/          # Módulos de acesso a dados (agregador + core)
  │   ├── index.ts        # Agregador que importa de features e core
  │   ├── authStorage.ts  # Operações de autenticação
  │   ├── userStorage.ts  # Operações de usuários Zendesk
  │   └── conversationStorage.ts # Operações de conversas
  └── middleware/       # Middlewares compartilhados
      └── auth.ts         # Guards: isAuthenticated, requireAuthorizedUser
client/src/
  ├── features/       # Módulos de funcionalidades (feature-based architecture)
  │   ├── ai/           # Configurações e páginas de IA
  │   │   ├── components/  # OpenaiConfigForm, etc
  │   │   └── pages/       # AIPage, ClassificationConfigPage, etc
  │   ├── cadastro/     # Gestão de usuários e organizações
  │   │   ├── components/  # UsersListContent, OrganizationsListContent
  │   │   └── pages/       # CadastroPage, UserStandardDetailPage, etc
  │   ├── conversations/ # Atendimentos e conversas
  │   │   ├── components/  # ConversationChat, ConversationSelector, etc
  │   │   ├── pages/       # AtendimentosPage, UserConversationsPage
  │   │   └── types/       # Tipos específicos de conversas
  │   ├── events/       # Visualização de eventos
  │   │   └── pages/       # EventsLayout, EventsStandardPage, etc
  │   ├── export/       # Exportação de dados
  │   │   └── pages/       # ExportPage, ExportSummariesPage
  │   └── settings/     # Configurações do sistema
  │       ├── components/  # AccessControlTab, GeneralSettingsTab, etc
  │       └── pages/       # SettingsPage, ProductStandardsPage, etc
  ├── shared/         # Recursos compartilhados entre features
  │   ├── components/   # Componentes reutilizáveis
  │   │   ├── ui/         # Badge, Pagination, DataTable, Modal, etc
  │   │   ├── badges/     # StatusBadge, AuthorTypeBadge, etc
  │   │   ├── charts/     # DonutChart
  │   │   ├── layout/     # NavLink, EnvironmentBadge, TabbedLayout
  │   │   └── modals/     # EventDetailModal, UserDetailModal, etc
  │   ├── hooks/        # usePaginatedQuery, useAuth, useDateFormatters, etc
  │   └── pages/        # Páginas core (LandingPage, LoadingPage, HomePage, etc)
  ├── contexts/       # React contexts (TimezoneContext)
  ├── lib/            # Utilitários e helpers (queryClient, dateUtils, userUtils)
  └── types/          # Tipos compartilhados globalmente
      ├── dateUtils.ts  # Formatação de datas
      ├── userUtils.ts  # Formatação e extração de dados de usuário
      └── queryClient.ts # Configuração TanStack Query e helpers (fetchApi, fetchWithAuth, apiRequest)
shared/
  └── schema.ts       # Definições de tabelas Drizzle (fonte única)
```

### Padrões de Componentes

**Badge Component (client/src/components/ui/Badge.tsx):**
Componente genérico reutilizável para badges com variantes de estilo:
- Variants: `success`, `error`, `warning`, `info`, `purple`, `teal`, `default`
- Sizes: `sm`, `md`
- Suporte a ícones opcionais
- Badges especializados (StatusBadge, AuthorTypeBadge, EventTypeBadge, AuthBadge) usam este componente base

**Fetch/API Pattern (client/src/lib/queryClient.ts):**
- `fetchApi<T>`: Fetch tipado com tratamento de erros e redirect para login em 401/403
- `fetchWithAuth<T>`: Similar ao fetchApi mas retorna null em erros de autenticação (para hooks de auth)
- `apiRequest`: Para requisições com body (POST, PUT, DELETE)
- **SEMPRE** use estas funções em vez de `fetch` direto para manter consistência no tratamento de erros

### Checklist para Novas Features

Antes de considerar uma feature completa, verifique:

- [ ] Nomes de tabelas seguem o padrão (plural para coleções)?
- [ ] Variáveis TypeScript consistentes com o padrão?
- [ ] APIs protegidas com middleware de autenticação?
- [ ] Erros tratados graciosamente (try/catch, retorno de erro estruturado)?
- [ ] Lazy initialization para serviços externos (ex: OpenAI)?
- [ ] Documentação atualizada no replit.md?

## External Dependencies

*   **Zendesk Sunshine Conversations:** Primary source for webhook events.
*   **PostgreSQL/Neon:** Relational database for persistent storage.
*   **Replit Auth:** Handles user authentication via OpenID Connect (Google Login).
*   **Passport.js:** Used for managing authentication sessions.
*   **Express.js:** Web application framework for the backend.
*   **Drizzle ORM:** TypeScript ORM for database interaction.
*   **React:** Frontend JavaScript library for building user interfaces.
*   **Vite:** Fast build tool and development server for the frontend.
*   **Tailwind CSS:** Utility-first CSS framework for styling.
*   **TanStack Query:** Data fetching and state management library.
*   **Lucide React:** Icon library.
*   **date-fns:** Date utility library.
*   **wouter:** Small routing library for React.