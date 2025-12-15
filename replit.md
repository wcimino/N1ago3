## Overview

N1ago is a system for managing and monitoring customer credit inquiry interactions. It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and provides a real-time React dashboard for visualization. The project aims to improve customer service efficiency, offer interaction insights, and lay the groundwork for future AI-driven automations like conversation summarization, product classification, and automated support to enhance customer experience and generate business insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system employs a decoupled architecture with a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend, and an Express.js, Drizzle ORM (PostgreSQL), and Replit Auth backend. It operates on a `vm` deployment target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Events are ingested and normalized into a `StandardEvent` format via webhook endpoints, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Uses Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports various AI capabilities (summarization, classification, response generation, knowledge search) with centralized OpenAI services and automatic API call logging. Agents are invoked via the ConversationOrchestrator pipeline rather than event triggers.
*   **ConversationOrchestrator Pipeline:** Sequential agent execution pipeline (Summary → Classification → ArticlesAndSolutions → StatusController → DemandFinder/SolutionProvider → AutoPilot) that processes customer messages. Each agent has a simple "enabled" toggle as a kill switch.
*   **Shared Embeddings Architecture:** A centralized embeddings layer (`server/shared/embeddings/`) standardizes embedding generation, content hashing, and processing across knowledge sources.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard, administrative interfaces, and uses a component-based design with Tailwind CSS. Reusable components include badges, data tables, modals, and pagination.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, logs, processes, and stores conversation data and events.
*   **Real-time Dashboard:** Live view of events, metrics, and user/webhook management.
*   **Atendimentos Listing:** Displays individual conversations with filtering and pagination.
*   **User Management:** Secure authentication and authorization.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Hierarchical conversation classification (Product → Subproduct → Subject → Intent) using sequential AI tools.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific structured fields.
*   **Automatic Routing Rules:** Unified routing system for conversation allocation (`n1ago`, `human`, `bot`) with detailed logging and Zendesk Switchboard API integration.
*   **AutoPilot:** Automatically sends suggested responses based on conditions.
*   **Objective Problems Catalog:** Normalized catalog of evidence-based problems in `knowledge_base_objective_problems`.

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular for config tables; `snake_case` foreign keys; `idx_<table_name>_<field>` indices.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types Architecture:** Centralized type definitions in `shared/types/`. Frontend re-exports via `client/src/types/`.
*   **Shared Constants Architecture:** Centralized UI constants in `client/src/shared/constants/` including `emotionConfig`, `intentConfig`, `severityConfig`, and filter options like `EMOTION_OPTIONS`.
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
*   **External Sources & Knowledge Base Architecture:** Replicas of external data (e.g., Zendesk articles) are synced manually. Internal Q&A articles stored in `knowledge_base` with `question`, `answer`, `keywords`, `question_variation`, `product_id`, `subject_id`, and `intent_id`. Knowledge base embeddings are stored with content hash. Raw Zendesk data is in `zendesk_articles` with separate `zendesk_article_embeddings`.
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
*   **OpenAI API:** AI capabilities (chat, embeddings).