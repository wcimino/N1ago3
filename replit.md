# N1ago - Atendimento sobre Crédito

## Overview

N1ago is a system for managing and monitoring customer credit inquiry interactions. It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and displays real-time events on a React dashboard. The project aims to improve customer service efficiency, provide comprehensive interaction data, and lays the groundwork for future AI-powered automation like conversation summarization and product classification to enhance customer experience and generate insights for automated support.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system employs a decoupled frontend (React, TypeScript, Vite, Tailwind CSS, TanStack Query, wouter) and backend (Express.js, Drizzle ORM for PostgreSQL, Replit Auth). It runs on a `vm` deployment target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests events from various sources, normalizing them into a `StandardEvent` format using dedicated webhook endpoints, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker` for retries.
*   **Authentication System:** Uses Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** Supports multiple AI capabilities (summarization, classification, response generation) via a unified architecture with centralized OpenAI services, configurable triggers, and automatic logging of all API calls.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard for events and conversations, administrative interfaces, and uses a component-based design with Tailwind CSS for styling. Reusable components include badges, data tables, modals, and pagination.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, logs, processes, and stores conversation data and events in PostgreSQL.
*   **Real-time Dashboard:** Live view of events, metrics, and management of users/webhooks.
*   **User Management:** Secure authentication and authorization with domain and user-list restrictions.
*   **Extensibility:** Designed for easy integration of new communication channels.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Classifies conversations using hierarchical fields (Product → Subproduct → Subject → Intent). Uses two sequential AI tools: `search_product_catalog` (finds product/subproduct) and `search_subject_and_intent` (finds subject/intent based on product). Configurable via `use_subject_intent_tool` flag.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific fields (`client_request`, `agent_actions`, `current_status`, `important_info`) parsed from JSON responses.
*   **Automatic Routing Rules:** Unified routing system in `server/features/routing/` that routes conversations to `n1ago`, `human`, or `bot`. Uses a single `processRoutingEvent` function called by the EventDispatcher for all relevant events. Supports two rule types: `allocate_next_n` (routes new conversations on `conversation_started`) and `transfer_ongoing` (routes based on exact text match in messages). Features detailed logging at each step, atomic slot consumption, and Zendesk Switchboard API for control transfer.
*   **AutoPilot - Automatic Response Sending:** Automatically sends suggested responses under specific conditions (conversation assigned to n1ago, last message from client, no newer messages, `in_response_to` matches).

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular, `snake_case` for config tables; `snake_case` foreign keys; `idx_<table_name>_<field>` indices.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types Architecture:** Centralized type definitions in `shared/types/`.
*   **Backend Feature Architecture:** Each feature module includes `routes/`, `storage/`, and `services/`.
*   **Idempotent Event Creation:** `saveStandardEvent` handles unique constraint violations by returning existing events, and all downstream orchestrators are idempotent to prevent duplicate processing.
*   **Modular AI Tools and Prompts:** AI tools separated into individual files in `server/features/ai/services/tools/`:
    - `knowledgeBaseTool.ts`: Internal knowledge base search
    - `productCatalogTool.ts`: Product catalog search
    - `subjectIntentTool.ts`: Subject and intent lookup
    - `zendeskKnowledgeBaseTool.ts`: Zendesk Help Center semantic search
    - Centralized prompt variables and `promptUtils.ts` for variable substitution.
*   **Unified Knowledge Base Search Helper** (`server/features/ai/services/knowledgeBaseSearchHelper.ts`):
    - `runKnowledgeBaseSearch()` provides a single entry point for KB searches
    - Always uses semantic search (embeddings) with PostgreSQL FTS fallback when no embeddings available
    - Records article views to `knowledge_base_statistics` table with conversation context
    - Resolves subject/intent synonyms before filtering
    - Used by AI tools (`createKnowledgeBaseTool`, `buildKnowledgeBaseTool`), API endpoints, and learning adapters
    - Security: Uses parameterized SQL queries to prevent SQL injection
*   **Enrichment Agent Modular Architecture:** Refactored into a sequential pipeline (`enrichmentOpenAICaller`, `enrichmentRunLogger`, `enrichmentRunProcessor`, `enrichmentOrchestrator`) to ensure robust logging of AI enrichment attempts.

## OpenAI Services Architecture

Centralized OpenAI services in `shared/services/openai/`:
*   **openaiService.ts:** Wrapper with `chat()`, `chatWithTools()`, and `embedding()` methods
*   **openaiLogger.ts:** Automatic logging of all OpenAI calls to `openai_api_logs` table
*   **Lazy initialization:** OpenAI client created on first use, API key validated
*   **correlationId support:** For end-to-end tracing across features

All features (enrichment, AutoPilot, knowledge-base) consume these centralized services.

## External Sources & Knowledge Base Architecture

**Concept:**
*   **External Sources** (`server/features/external-sources/`): Replicas of external data (e.g., Zendesk articles) synced manually
*   **Knowledge Base** (internal): Generated knowledge from external sources and internal content

**Zendesk Articles** (`server/features/external-sources/zendesk/`):
*   `zendesk_articles` table: Raw data from Zendesk Help Center
*   `zendesk_article_embeddings` table: Separate table for embeddings with:
    - `article_id` (FK to zendesk_articles)
    - `content_hash` (MD5 hash for change detection)
    - `embedding_vector` (pgvector vector(1536))
    - `model_used`, `tokens_used`, `openai_log_id`
*   HNSW index for accurate cosine similarity search
*   Automatic embedding generation on sync via `generateEmbeddingsForNewOrOutdatedArticles()`
*   Processes articles 1 by 1 in continuous loop until all pending are done
*   Tracks real processing state via `isEmbeddingProcessing` flag
*   Skips failed articles to prevent infinite loops, stops after 5 consecutive errors

**RAG (Retrieval Augmented Generation):**
*   Semantic search using OpenAI embeddings (`text-embedding-3-small`)
*   pgvector extension with HNSW index for accurate results
*   `searchBySimilarity()` joins articles with embeddings table
*   Endpoints:
    - `/api/zendesk-articles/embeddings/progress` for real-time processing status
    - `/api/zendesk-articles/embeddings/logs` for monitoring failures
    - `/api/zendesk-articles/search/semantic` for semantic search
*   `createZendeskKnowledgeBaseTool()` uses semantic search with fallback to full-text
*   `embedding_generation_logs` table for monitoring success/failure rates

## Known Issues & Workarounds

### Drizzle DESC Index Bug (Resolved Dec 2024)
**Problem:** Drizzle ORM previously had issues tracking indexes with DESC ordering, causing repeated DROP/CREATE migration cycles.

**Affected indexes:**
- `idx_conversations_updated_at`
- `idx_zendesk_webhook_received_at`
- `idx_openai_api_logs_created_at`
- `idx_events_standard_occurred_at`

**Solution (Dec 11, 2024):** Using Drizzle ORM 0.31.x+ which now supports `.desc()` on index columns, these indexes are now properly declared in `schema.ts` using the syntax `table.column.desc()`. Migrations 0007 and 0008 sync the state between schema and database using `IF EXISTS/IF NOT EXISTS` clauses to handle both fresh installs and existing production databases.

**Status:** Fully resolved. Running `drizzle-kit generate` now correctly reports "No schema changes, nothing to migrate".

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
*   **OpenAI API:** AI capabilities (chat, embeddings).
