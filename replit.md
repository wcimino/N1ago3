## Overview

N1ago is a system for managing and monitoring customer credit inquiry interactions. It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and provides a real-time React dashboard for visualization. The project aims to improve customer service efficiency, offer interaction insights, and lay the groundwork for future AI-driven automations like conversation summarization, product classification, and automated support to enhance customer experience and generate business insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system employs a decoupled architecture with a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend, and an Express.js, Drizzle ORM (PostgreSQL), and Replit Auth backend. It operates on a `vm` deployment target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Events are ingested and normalized into a `StandardEvent` format via webhook endpoints, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Uses Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table. Auth module is fully encapsulated in `server/features/auth/` with: `services/replitAuth.ts` (OIDC setup, session management, login/logout routes), `services/oidcConfig.ts` (centralized OIDC discovery config), `middleware/authMiddleware.ts` (isAuthenticated, requireAuthorizedUser guards), `routes/auth.ts` (user info endpoints), `storage/authStorage.ts` (authorized users persistence), and `types/authTypes.ts` (Express.User interface, AUTH_CONFIG constants).
*   **AI-Powered Features:** A unified architecture supports various AI capabilities (summarization, classification, response generation, knowledge search) with centralized OpenAI services and automatic API call logging. Agents are invoked via the ConversationOrchestrator pipeline rather than event triggers.
*   **ConversationOrchestrator Pipeline:** Uses a simplified status-based delegation model. The orchestrator only defines which agent is responsible based on status, and each agent controls its own lifecycle. **Status Flow:** `NEW → FINDING_DEMAND → [loop: enrich + search articles + evaluate score] → score OK? → DEMAND_CONFIRMED → PROVIDING_SOLUTION → FINALIZING → CLOSED` or `score not OK? → clarification question → AWAITING_CUSTOMER_REPLY → back to FINDING_DEMAND`. From FINALIZING: customer wants more help → creates new demand → FINDING_DEMAND. **Key Components:**
    - **Orchestrator:** Simple dispatcher that maps status → agent. Terminal statuses: COMPLETED, ESCALATED, CLOSED.
    - **EnrichmentService:** Wrapper for Summary + Classification, called internally by DemandFinder.
    - **DemandFinderAgent:** Owns the demand identification loop - calls enrichment, searches articles, evaluates if any article answers the customer question (score ≥ 80%), generates clarification questions if needed, updates status when done.
    - **SolutionProviderAgent:** Handles solution delivery after demand is confirmed.
    - **CloserAgent:** Handles conversation finalization after solution is resolved. Asks if customer needs more help. If yes, creates a new demand (multiple demands per conversation supported) and returns to FINDING_DEMAND. If no, closes the conversation.
    - **Status transitions:** Agents update their own status. Orchestrator reads status and dispatches accordingly.
*   **Case Solution Architecture:** The `case_solutions` table stores solution instances for conversations, tracking `provided_inputs` (from DemandFinder), `collected_inputs_customer` (from customer), and `collected_inputs_systems` (from API calls). The `case_actions` table tracks individual action executions within a solution, with status transitions (pending → in_progress → completed/failed). Storage layers: `caseSolutionStorage` and `caseActionsStorage` in `server/features/ai/storage/`.
*   **Case Demand Architecture:** The `case_demand` table stores customer demands per conversation, including `articles_and_objective_problems` (matched articles and problems), `interaction_count` (DemandFinder interaction counter), and `status` (demand finder status: not_started, in_progress, demand_found, demand_not_found, error, completed). Supports multiple demands per conversation - when CloserAgent detects a new request, it marks the current demand as `completed` and creates a new one. Storage layer: `caseDemandStorage` in `server/features/ai/storage/` with `getActiveByConversationId()` to get the current active demand.
*   **Shared Embeddings Architecture:** A centralized embeddings layer (`server/shared/embeddings/`) standardizes embedding generation, content hashing, and processing across knowledge sources.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard, administrative interfaces, and uses a component-based design with Tailwind CSS. Reusable components include badges, data tables, modals, and pagination.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, logs, processes, and stores conversation data and events.
*   **External Events Ingestion:** API endpoint (`POST /api/events/ingest`) allows external systems to send events directly to `events_standard`. Authentication via API keys managed in Settings → Eventos externos. Supports single and batch ingestion with validation. Each external system has a mandatory `channel_type` that is validated against incoming events. Systems can be edited to update name and channel_type. Security features include: rate limiting (60/min, 600/hour per API key), field size validation (128 chars), date window validation (±30 days), audit logging to `external_event_audit_logs`, and key rotation tracking with 90-day warning.
*   **Real-time Dashboard:** Live view of events, metrics, and user/webhook management. Uses a consolidated `/api/dashboard/analytics` endpoint that returns all 5 panel data (Products, Sentiments, Problems, Atendimentos donut chart, and Hourly chart) in a single SQL query for efficiency and consistency. All panels filter conversations with >2 actual messages (event_type='message').
*   **Atendimentos Listing:** Displays individual conversations with filtering and pagination.
*   **User Management:** Secure authentication and authorization.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Hierarchical conversation classification (Product → Subproduct → Subject → Intent) using sequential AI tools.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific structured fields.
*   **Automatic Routing Rules:** Unified routing system for conversation allocation (`n1ago`, `human`, `bot`) with detailed logging and Zendesk Switchboard API integration.
*   **AutoPilot:** Automatically sends suggested responses based on conditions.
*   **SendMessageService:** Centralized message sending controller (`server/features/send-message/`). All outbound messages to customers must go through this service. Validates: handler=N1ago, autopilotEnabled (for responses), lastEventId, no newer messages, lastMessage from customer, inResponseTo match. Transfer messages only require handler=N1ago check.
*   **ResponseFormatterService:** Tone of voice adjustment layer (`server/features/send-message/services/responseFormatterService.ts`). Automatically formats outbound messages before sending to customers using the Response agent's configuration (promptSystem, promptTemplate, responseFormat). Enabled/disabled via the Response agent toggle. Skipped for transfer messages or when `skipFormatting: true` is passed. Logs formatting with `response_formatting` request type. Returns `wasFormatted` and `formattingLogId` in SendMessageResult for auditing.
*   **Objective Problems Catalog:** Normalized catalog of evidence-based problems in `knowledge_base_objective_problems`.

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular for config tables; `snake_case` foreign keys; `idx_<table_name>_<field>` indices.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types Architecture:** Centralized type definitions in `shared/types/`. Frontend re-exports via `client/src/types/`.
*   **Shared Constants Architecture:** Centralized UI constants in `client/src/shared/constants/` including `emotionConfig`, `intentConfig`, `severityConfig`, and filter options like `EMOTION_OPTIONS`.
*   **Shared Hooks Architecture:** Reusable hooks in `client/src/shared/hooks/` including `useProductHierarchySelects` (cascading product→subject→intent with ID-based filtering), `useModalState` (modal state with clear method), and `useCrudFormOperations` (CRUD mutations with callbacks).
*   **Shared Form Components:** Reusable form components in `client/src/shared/components/forms/` including `ProductHierarchySelects` (cascading selects) and `ProductHierarchyDisplay` (read-only taxonomy badges). Also includes modals in `ui/` like `ConfirmModal` and `InputModal`.
*   **Backend Feature Architecture:** Each feature module includes `routes/`, `storage/`, and `services/`. Event adapters are in `server/features/events/adapters/`.
*   **External API Services:** Zendesk API service is in `server/features/external-sources/zendesk/services/zendeskApiService.ts`.
*   **Idempotent Event Creation:** Ensures unique event processing.
*   **Modular AI Tools and Prompts:** AI tools are in individual files; prompt variables are centralized.
*   **Objective Problems Search Tool:** Searches objective problems by keywords and product filter, using semantic search with OpenAI embeddings and text-based fallback.
*   **Unified Knowledge Base Search Helper:** Single entry point for knowledge base searches, using semantic search with PostgreSQL FTS fallback, and recording article views. Supports filtering by `productId`.
*   **Hybrid Search Architecture:** Knowledge base tools support hybrid search: `conversationContext` for semantic search, optional `keywords` for boosting/filtering, and text-based fallback.
*   **Enrichment Agent Modular Architecture:** Refactored into a sequential pipeline for robust logging.
*   **Centralized AI Agent Configuration Metadata:** All AI agent configuration pages consume a central metadata registry.
*   **Reports Feature Architecture:** Modular reports with shared infrastructure for date filtering, service layers, route handlers, data fetching hooks, and reusable components.
*   **OpenAI Services Architecture:** Centralized services in `shared/services/openai/` provide wrappers for `chat()`, `chatWithTools()`, and `embedding()` with automatic logging to `openai_api_logs` and `correlationId` support.
*   **AI Agent Framework Patterns:** Centralized in `server/features/ai/services/agentFramework.ts` with `runAgent()`, `buildAgentContextFromEvent()`, and `runAgentAndSaveSuggestion()`. Product catalog is cached for 5 minutes.
*   **External Sources & Knowledge Base Architecture:** Replicas of external data (e.g., Zendesk articles) are synced manually. Internal Q&A articles stored in `knowledge_base` with `question`, `answer`, `keywords`, `question_variation`, `product_id`, `subject_id`, `intent_id`, and `is_active` (boolean, default false - reserved for future use, does NOT affect searchability). Knowledge base embeddings are stored with content hash. Raw Zendesk data is in `zendesk_articles` with separate `zendesk_article_embeddings`.
*   **RAG (Retrieval Augmented Generation):** Implements semantic search using OpenAI embeddings with pgvector and HNSW indexing, with fallbacks to full-text search.
*   **Embeddings Regeneration:** Scripts available for knowledge base and objective problems embeddings regeneration, including product context.

## External Dependencies

*   **Zendesk Sunshine Conversations:** Webhook source.
*   **PostgreSQL/Neon:** Database with pgvector extension.
*   **Replit Auth:** User authentication.
*   **Passport.js:** Authentication sessions.
*   **Express.js:** Backend framework.
*   **Drizzle ORM:** TypeScript ORM.
*   **React:** Frontend UI.
*   **Vite:** Frontend build tool.
*   **Tailwind CSS:** CSS framework.
*   **TanStack Query:** React data fetching.
*   **Lucide React:** Icons.
*   **date-fns:** Date utilities.
*   **wouter:** React routing.
*   **AI Services (Chat):** Uses Replit AI Integrations by default (no API key required, billed to Replit credits). Can fallback to OpenAI with `AI_CHAT_PROVIDER=openai` environment variable.
*   **OpenAI API:** Required for embeddings (Replit AI doesn't support embeddings). Uses `OPENAI_API_KEY`.