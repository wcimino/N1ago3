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
*   **AI-Powered Features:** Supports multiple AI capabilities (summarization, classification, response generation) via a unified architecture with a shared `openai_api_config` table, configurable triggers, and lazy OpenAI client initialization. All OpenAI calls are logged.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard for events and conversations, administrative interfaces, and uses a component-based design with Tailwind CSS for styling. Reusable components include badges, data tables, modals, and pagination.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, logs, processes, and stores conversation data and events in PostgreSQL.
*   **Real-time Dashboard:** Live view of events, metrics, and management of users/webhooks.
*   **User Management:** Secure authentication and authorization with domain and user-list restrictions.
*   **Extensibility:** Designed for easy integration of new communication channels.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific fields (`client_request`, `agent_actions`, `current_status`, `important_info`) parsed from JSON responses.
*   **Automatic Routing Rules:** Manages conversation routing to `n1ago`, `human`, or `bot` based on predefined rules in `routing_rules` table, using atomic slot consumption and Zendesk Switchboard API for control transfer.
*   **AutoPilot - Automatic Response Sending:** Automatically sends suggested responses under specific conditions (conversation assigned to n1ago, last message from client, no newer messages, `in_response_to` matches).

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular, `snake_case` for config tables; `snake_case` foreign keys; `idx_<table_name>_<field>` indices.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types Architecture:** Centralized type definitions in `shared/types/`.
*   **Backend Feature Architecture:** Each feature module includes `routes/`, `storage/`, and `services/`.
*   **Idempotent Event Creation:** `saveStandardEvent` handles unique constraint violations by returning existing events, and all downstream orchestrators are idempotent to prevent duplicate processing.
*   **Modular AI Tools and Prompts:** Centralized tool definitions and prompt variables for AI agents, using a standardized 2-field configuration (`promptSystem`, `responseFormat`) and `promptUtils.ts` for variable substitution.
*   **Enrichment Agent Modular Architecture:** Refactored into a sequential pipeline (`enrichmentOpenAICaller`, `enrichmentRunLogger`, `enrichmentRunProcessor`, `enrichmentOrchestrator`) to ensure robust logging of AI enrichment attempts.
*   **RAG (Retrieval Augmented Generation) for Zendesk Articles:** Semantic search using OpenAI embeddings (`text-embedding-3-small`) stored in PostgreSQL. Articles are vectorized and searched by cosine similarity for more accurate knowledge base retrieval. Key components:
    - `embeddingService.ts`: Generates embeddings for article content
    - `zendeskArticlesStorage.ts`: Contains `searchBySimilarity()` for semantic search
    - Automatic embedding generation during Zendesk sync
    - Endpoint `/api/zendesk-articles/embeddings/generate` for batch processing
    - Endpoint `/api/zendesk-articles/search/semantic` for semantic search
    - `createZendeskKnowledgeBaseTool()` uses semantic search when embeddings are available, with fallback to full-text search

## External Dependencies

*   **Zendesk Sunshine Conversations:** Webhook source.
*   **PostgreSQL/Neon:** Database.
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