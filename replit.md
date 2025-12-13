# N1ago - Atendimento sobre Crédito

## Overview

N1ago is a system designed to manage and monitor customer credit inquiry interactions. It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and provides a real-time React dashboard for event visualization. The project's primary goal is to enhance customer service efficiency, offer comprehensive interaction insights, and establish a foundation for future AI-driven automations such as conversation summarization, product classification, and automated support to improve customer experience and generate valuable business insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system utilizes a decoupled architecture comprising a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend, and an Express.js, Drizzle ORM (for PostgreSQL), and Replit Auth backend. It operates on a `vm` deployment target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Events from various sources are ingested and normalized into a `StandardEvent` format using dedicated webhook endpoints, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Leverages Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports multiple AI capabilities (summarization, classification, response generation) with centralized OpenAI services, configurable triggers, and automatic logging of all API calls.
*   **Shared Embeddings Architecture:** A centralized embeddings layer in `server/shared/embeddings/` standardizes embedding generation, content hashing, and processing across different knowledge sources.

**UI/UX Decisions:**

The React frontend offers a real-time dashboard for events and conversations, administrative interfaces, and employs a component-based design with Tailwind CSS for styling. Reusable components include badges, data tables, modals, and pagination.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, logs, processes, and stores conversation data and events in PostgreSQL.
*   **Real-time Dashboard:** Live view of events, metrics, and user/webhook management.
*   **Atendimentos Listing:** Displays individual conversations with full filtering capabilities and pagination.
*   **User Management:** Secure authentication and authorization with domain and user-list restrictions.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Classifies conversations hierarchically (Product → Subproduct → Subject → Intent) using sequential AI tools.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific structured fields.
*   **Automatic Routing Rules:** A unified routing system handles conversation allocation to `n1ago`, `human`, or `bot` using rule types like `allocate_next_n` and `transfer_ongoing`, with detailed logging and Zendesk Switchboard API integration.
*   **AutoPilot - Automatic Response Sending:** Automatically sends suggested responses under specific conditions.
*   **Objective Problems Catalog:** A normalized catalog of evidence-based problems stored in `knowledge_base_objective_problems` table, used by the Organizer Agent and Diagnostician, and accessible via the Base de Conhecimento.

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular for config tables; `snake_case` foreign keys; `idx_<table_name>_<field>` indices.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types Architecture:** Centralized type definitions in `shared/types/`.
*   **Backend Feature Architecture:** Each feature module includes `routes/`, `storage/`, and `services/`.
*   **Idempotent Event Creation:** Ensures unique event processing and prevents duplicates.
*   **Modular AI Tools and Prompts:** AI tools are separated into individual files, and prompt variables are centralized.
*   **Objective Problems Search Tool:** Searches objective problems by keywords and product filter, utilizing semantic search with OpenAI embeddings and falling back to text-based search.
*   **Unified Knowledge Base Search Helper:** Provides a single entry point for knowledge base searches, using semantic search with PostgreSQL FTS fallback, and recording article views.
*   **Enrichment Agent Modular Architecture:** Refactored into a sequential pipeline for robust logging of AI enrichment attempts.
*   **Centralized AI Agent Configuration Metadata:** All AI agent configuration pages consume a central metadata registry for consistency.
*   **Reports Feature Architecture:** Reports are modular with shared infrastructure:
    - `server/features/reports/utils/dateFilter.ts`: Reusable period filter helper (1h, 24h, all)
    - `server/features/reports/services/reportsService.ts`: Service layer with SQL queries
    - `server/features/reports/routes/reports.ts`: Thin route handlers
    - `client/src/features/reports/hooks/useReportData.ts`: Generic data fetching hook
    - `client/src/features/reports/components/`: Reusable components (ReportTable, PeriodFilter)

**OpenAI Services Architecture:**

Centralized OpenAI services in `shared/services/openai/` provide wrappers for `chat()`, `chatWithTools()`, and `embedding()` methods, with automatic logging of all OpenAI calls to `openai_api_logs` and support for `correlationId` for tracing.

**External Sources & Knowledge Base Architecture:**

*   **External Sources:** Replicas of external data (e.g., Zendesk articles) are synced manually.
*   **Knowledge Base:** Internal generated knowledge from external and internal content.
*   **Zendesk Articles:** Raw data from Zendesk Help Center stored in `zendesk_articles` with separate `zendesk_article_embeddings` for semantic search using pgvector and HNSW index.
*   **RAG (Retrieval Augmented Generation):** Implements semantic search using OpenAI embeddings with pgvector and HNSW indexing for accurate results, with fallbacks to full-text search.

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