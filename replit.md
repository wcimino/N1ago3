## Overview

N1ago is a system for managing and monitoring customer credit inquiry interactions.

## Recent Changes (2026-01-02)

**Bug Fixes for Conversation Orchestration:**

1. **Message Variation Selection Fix (conversationCore.ts):**
   - Fixed issue where `client_hub_data` was NULL, preventing message variation matching
   - Now propagates `authenticated` field from Zendesk user data even when ClientHub returns no data
   - Uses safe merge pattern: `{ ...(existingData ?? {}), authenticated }` to preserve existing data

2. **Closer Orchestrator Fix (orchestrator.ts):**
   - Fixed duplicate solution message sending and incorrect workflow execution
   - Changed condition from single check (`currentStatus === FINALIZING`) to dual check (`FINALIZING && waitingForCustomer === true`)
   - Added try-catch error handling with fallback to `waitingForCustomer = false`
   - Uses defensive null coalescing: `state?.waitingForCustomer ?? false`

It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and provides a real-time React dashboard. The project aims to improve customer service efficiency, offer insights from interactions, and enable future AI-driven automations like conversation summarization, product classification, and automated support to enhance customer experience and generate business insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system uses a decoupled architecture with a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend. The backend is built with Express.js, Drizzle ORM (PostgreSQL), and Replit Auth, deployed on a `vm` target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests and normalizes events via webhooks, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Uses Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports various AI capabilities (summarization, classification, response generation, knowledge search) using centralized OpenAI services and automatic API call logging.
*   **Conversation Orchestrator Pipeline:** Manages conversation flow using a 2-field state model (`conversation_owner` + `waiting_for_customer`) with defined owner transition validations. The flow is: DemandFinder → SolutionProvider → Closer.
*   **SolutionProviderAgent & Orchestrator:** Uses a **deterministic orchestrator pattern** where AI only generates message text, and the orchestrator handles workflow logic.
*   **Case Solution and Demand Architecture:** `case_solutions` table tracks solution instances; `case_demand` stores customer demands per conversation.
*   **External Knowledge via Solution Center API:** All knowledge retrieval uses the external Solution Center API exclusively.
*   **Clean Separation of Concerns:** Orchestration logic (deterministic) is separated from AI agents (prompts, OpenAI calls).

**UI/UX Decisions:**

The React frontend provides a real-time dashboard and administrative interfaces, built with a component-based design and Tailwind CSS.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Processes and stores conversation data.
*   **External Events Ingestion:** API endpoint (`POST /api/events/ingest`) with API key authentication, validation, rate limiting, and audit logging.
*   **Real-time Dashboard:** Displays live events, metrics, and user/webhook management.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Hierarchical conversation classification (Product → Subproduct → Subject → Intent) using sequential AI tools.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific structured fields.
*   **Inbound Conversation Routing:** Unified routing system processes rules at webhook start, routing conversations to `n1ago`, `human`, or `bot` using Zendesk Switchboard API.
*   **TransferService:** Centralized service for conversation transfer logic (Zendesk passControl, handler persistence, tag management, farewell/welcome messages).
*   **AutoPilot:** Automatically sends suggested responses based on conditions.
*   **SendMessageService:** Centralized message sending controller for all outbound messages.
*   **ResponseFormatterService:** Adjusts tone of voice for outbound messages using an AI agent's configuration.
*   **Solution Center Integration:** External KB API integration for DemandFinder's article and problem search, serving as the sole knowledge source.
*   **Scheduled Maintenance Services:** Daily scheduled tasks for archiving old data and database vacuuming.
*   **Server Bootstrap & Initialization:** Includes preflight checks, granular scheduler control, enhanced health endpoints, and production static file verification.
*   **Database Migrations:** Automated Drizzle and manual SQL migration execution during build.
*   **Server Resilience:** Server starts even if database is unavailable (degraded mode); background workers start when database is healthy.

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular for config tables; `snake_case` foreign keys.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types and Constants Architecture:** Centralized type definitions and UI constants.
*   **Modular Conversation Storage:** `conversations/storage/` layer split into focused modules for CRUD, lifecycle, and orchestrator state.
*   **Idempotent Event Creation:** Ensures unique event processing.
*   **Modular AI Tools and Prompts:** AI tools in individual files; prompt variables centralized.
*   **OpenAI Services Architecture:** Unified architecture with modular services for client factory, chat, embeddings, and a public API layer.
*   **AI Agent Framework Patterns:** Centralized framework for running agents and saving suggestions.
*   **External Knowledge Architecture:** All knowledge retrieval uses the external Solution Center API exclusively.
*   **Agent Framework Placement Rules:** Clear guidelines for placing AI-driven components vs. deterministic orchestration logic.

### Agent Framework Placement Decision Tree

When adding new AI-powered functionality, use this decision tree to determine the correct location:

```
Is the component making OpenAI API calls?
├── YES: Place in server/features/ai/services/
│   ├── Is it a conversational agent (generates responses)?
│   │   └── Place in ai/services/conversationOrchestrator/agents/
│   ├── Is it a tool (classification, embedding, etc)?
│   │   └── Place in ai/services/openai/tools/
│   └── Otherwise: Create new module under ai/services/
│
└── NO: Place in server/features/conversation-orchestration/
    ├── Is it workflow logic (state transitions, routing)?
    │   └── Place in conversation-orchestration/dispatcher/
    ├── Is it a phase orchestrator (DemandFinder, SolutionProvider)?
    │   └── Create feature folder: conversation-orchestration/<phase>/
    └── Is it shared utilities (types, helpers)?
        └── Place in conversation-orchestration/shared/
```

**Key Principle:** AI agents generate text; orchestrators make decisions. Keep them separate.

**Examples:**
- `SummaryAgent` → `ai/services/` (makes OpenAI calls to generate summary)
- `DemandFinderOrchestrator` → `conversation-orchestration/demandFinder/` (deterministic workflow logic)
- `classifyConversation()` → `ai/services/openai/tools/` (OpenAI tool call)
- `TransferService` → `conversation-orchestration/shared/` (deterministic transfer logic)

### Storage Placement Decision Tree

When adding new storage modules, use this decision tree:

```
Is this storage specific to a single feature?
├── YES: Place in server/features/<feature>/storage/
│   ├── Name the file: <entity>Storage.ts (e.g., webhookStorage.ts)
│   └── Export a singleton object: export const <entity>Storage = { ... }
│
└── NO: Is it a generic utility used by multiple features?
    ├── YES: Place in server/shared/storage/
    │   └── Examples: crudFactory.ts, filterHelpers.ts
    │
    └── NO: Consider if it belongs to an existing feature
        └── Avoid creating new top-level storage modules
```

**Examples:**
- `webhookStorage.ts` → `features/export/storage/` (specific to export feature)
- `conversationStorage.ts` → `features/conversations/storage/` (specific to conversations)
- `crudFactory.ts` → `shared/storage/` (generic utility used everywhere)
- `configStorage.ts` → `features/ai/storage/` (AI configuration)

### Routes Placement Decision Tree

When adding new API routes, use this decision tree:

```
Is this route specific to a single feature?
├── YES: Place in server/features/<feature>/routes/
│   ├── Name the file: <resource>.ts (e.g., webhooks.ts)
│   └── Export default router
│
└── NO: Is it a cross-cutting concern (health, auth, etc)?
    ├── YES: Place in server/routes/
    └── NO: Create a new feature folder if justified
```

**URL Patterns:**
- REST resources: `/api/<plural-resource>` (e.g., `/api/conversations`)
- Config endpoints: `/api/<singular-config>` (e.g., `/api/openai-config`)
- Actions: `/api/<resource>/<verb>` (e.g., `/api/events/ingest`)

### Naming Conventions

| Context | Convention | Examples |
|---------|------------|----------|
| **Classes/Types** | PascalCase | `SummaryAgent`, `ConversationStorage`, `RoutingResult` |
| **Functions/Variables** | camelCase | `getSummaries`, `processEvent`, `userId` |
| **Database Tables** | snake_case, plural | `conversations`, `webhook_logs`, `users_standard` |
| **Database Columns** | snake_case | `created_at`, `external_id`, `processing_status` |
| **API URLs** | kebab-case | `/api/webhook-logs`, `/api/openai-config` |
| **Files** | camelCase | `eventStorage.ts`, `agentRunner.ts`, `inboundRouting.ts` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT`, `EVENTS` |

### When to Create a New Feature Folder

Create a new feature folder (`server/features/<name>/`) when:

1. **Independence**: The functionality is self-contained with its own storage, routes, and services
2. **Size**: It has 3+ files (not just a single utility)
3. **Domain**: It represents a distinct business domain (e.g., `routing`, `sync`, `export`)
4. **Reusability**: It could theoretically be extracted as a separate module

**Do NOT create a new feature for:**
- Single utility files → use `shared/`
- Extensions of existing features → add to existing feature folder
- Temporary experiments → use existing structure

**Standard Feature Structure:**
```
server/features/<feature>/
├── routes/           # API endpoints (optional)
├── services/         # Business logic
└── storage/          # Database operations
```

**Note on Barrel Files (index.ts):**
- **Avoid** creating barrel files that re-export from multiple modules
- Feature-level `index.ts` files are acceptable ONLY when they export a single public API for the feature
- Prefer direct imports (e.g., `from "../storage/webhookStorage.js"`) over barrel imports
- This reduces hidden coupling and makes dependencies explicit

### Logging Standards

All log statements must follow these patterns:

**Prefixes (Required):**
- Format: `[ModuleName]` at the start of every log message
- Examples: `[EventProcessor]`, `[AgentFramework]`, `[InboundRouting]`

**Log Levels:**
| Level | Usage |
|-------|-------|
| `console.log` | Normal operations, status updates |
| `console.warn` | Recoverable issues, fallbacks, deprecations |
| `console.error` | Failures, exceptions (always include error object) |

**Required Fields for Key Operations:**
- `conversationId` or `externalConversationId` when processing conversations
- `rawId` and `source` when processing webhooks
- Duration in ms for performance-sensitive operations

**Examples:**
```typescript
console.log(`[EventProcessor] Processed raw event ${rawId}: ${count} events created`);
console.warn(`[AgentFramework] Failed to parse JSON, using rawResponse fallback`);
console.error(`[InboundRouting] Rule ${ruleId}: Error:`, error);
```

## External Dependencies

*   **Zendesk Sunshine Conversations:** Webhook source for conversation data.
*   **PostgreSQL/Neon:** Database backend with pgvector extension.
*   **Replit Auth:** User authentication service.
*   **Passport.js:** Authentication sessions management.
*   **Express.js:** Web application framework.
*   **Drizzle ORM:** TypeScript ORM for database interaction.
*   **React:** Frontend UI library.
*   **Vite:** Fast frontend build tool.
*   **Tailwind CSS:** Utility-first CSS framework.
*   **TanStack Query:** Data fetching library for React.
*   **Lucide React:** Icon library.
*   **date-fns:** JavaScript date utility library.
*   **wouter:** Lightweight React router.
*   **AI Services:** Replit AI Integrations (default) or OpenAI (fallback).
*   **OpenAI API:** Used for AI chat capabilities.