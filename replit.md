# Overview

N1ago is a system designed for managing and monitoring customer credit inquiry interactions. It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and provides a real-time React dashboard. The project aims to enhance customer service efficiency, derive insights from interactions, and enable future AI-driven automations such as conversation summarization, product classification, and automated support to improve customer experience and generate business insights.

# User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

# System Architecture

The system employs a decoupled architecture with a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend. The backend is built with Express.js, Drizzle ORM (PostgreSQL), and Replit Auth, deployed on a `vm` target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests and normalizes events via webhooks, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Uses Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports various AI capabilities (summarization, classification, response generation, knowledge search) using centralized OpenAI services and automatic API call logging.
*   **Conversation Orchestrator Pipeline:** Manages conversation flow using a 2-field state model (`conversation_owner` + `waiting_for_customer`) with defined owner transition validations. The flow is: DemandFinder → SolutionProvider → Closer.
*   **SolutionProviderAgent & Orchestrator:** Uses a **deterministic orchestrator pattern** where AI only generates message text, and the orchestrator handles workflow logic.
*   **Case Solution and Demand Architecture:** `case_solutions` table tracks solution instances; `case_demand` stores customer demands per conversation.
*   **External Knowledge via Solution Center API:** All knowledge retrieval uses the external Solution Center API exclusively.
*   **Clean Separation of Concerns:** Orchestration logic (deterministic) is separated from AI agents (prompts, OpenAI calls).
*   **ClientContextService Architecture:** Refactored client context enrichment into a separated service architecture with robust error handling for `AuthenticationResolver`, `CustomerDataFetcher`, and `ClientContextService`.

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
*   **TransferService:** Centralized service for conversation transfer logic.
*   **AutoPilot:** Automatically sends suggested responses based on conditions.
*   **SendMessageService:** Centralized message sending controller for all outbound messages.
*   **ResponseFormatterService:** Adjusts tone of voice for outbound messages using an AI agent's configuration.
*   **Solution Center Integration:** External KB API integration for DemandFinder's article and problem search, serving as the sole knowledge source.
*   **Scheduled Maintenance Services:** Daily scheduled tasks for archiving old data and database vacuuming.
*   **Server Bootstrap & Initialization:** Includes preflight checks, granular scheduler control, enhanced health endpoints, and production static file verification.
*   **Database Migrations:** Automated Drizzle and manual SQL migration execution during build.
*   **Server Resilience:** Server starts even if database is unavailable (degraded mode); background workers start when database is healthy.
*   **Progressive Stage Progress Tracking:** AI agents (Summary, Classification, DemandFinder, SolutionProvider) track processing status (pending, running, completed, error) in `stage_progress` JSONB column, enabling frontend to show skeleton loaders that progressively reveal components as agents complete. Polling interval: 3 seconds.

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
*   **Storage Placement Decision Tree:** Guidelines for placing feature-specific vs. generic storage modules.
*   **Routes Placement Decision Tree:** Guidelines for placing feature-specific vs. cross-cutting API routes.
*   **Naming Conventions:** Standardized conventions for Classes/Types, Functions/Variables, Database Tables/Columns, API URLs, Files, and Constants.
*   **Feature Folder Creation Criteria:** Defines when to create a new feature folder based on independence, size, domain, and reusability.
*   **Logging Standards:** Specifies required prefixes, log levels, and fields for key operations.

# External Dependencies

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