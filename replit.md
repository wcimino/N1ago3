## Overview

N1ago is a system designed to manage and monitor customer credit inquiry interactions, processing webhooks from Zendesk Sunshine Conversations, storing conversation data, and providing a real-time React dashboard. Its primary purpose is to enhance customer service efficiency, offer interaction insights, and lay the groundwork for future AI-driven automations such as conversation summarization, product classification, and automated support to improve customer experience and generate business insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system employs a decoupled architecture with a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend. The backend is built with Express.js, Drizzle ORM (PostgreSQL), and Replit Auth, deployed on a `vm` target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests and normalizes events via webhooks, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Uses Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports various AI capabilities (summarization, classification, response generation, knowledge search) using centralized OpenAI services and automatic API call logging.
*   **ConversationOrchestrator Pipeline:** Manages conversation flow using a 2-field state model (`conversation_owner` + `waiting_for_customer`) with defined owner transition validations and status values. The flow is: DemandFinder → SolutionProvider → Closer. The SolutionProvider handles solution resolution using `case_solutions` and `case_actions` tables.
*   **SolutionProviderAgent:** Receives `articleId` or `(solutionId + rootCauseId)` from DemandFinder and resolves the appropriate solution. Currently uses a fallback strategy (transfer to human) until Central de Soluções API integration is implemented.
*   **Case Solution and Demand Architecture:** `case_solutions` table tracks solution instances; `case_demand` stores customer demands per conversation, supporting multiple demands and interaction counts.
*   **External Knowledge via Solution Center API:** All knowledge retrieval uses the external Solution Center API; no internal knowledge base or embeddings.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard and administrative interfaces, built with a component-based design and Tailwind CSS.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Processes and stores conversation data.
*   **External Events Ingestion:** API endpoint (`POST /api/events/ingest`) with API key authentication, validation, rate limiting, and audit logging.
*   **Real-time Dashboard:** Displays live events, metrics, and user/webhook management.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Hierarchical conversation classification (Product → Subproduct → Subject → Intent) using sequential AI tools.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific structured fields.
*   **Inbound Conversation Routing:** Unified routing system (`inboundConversationRouting.ts`) that processes routing rules at the very start of webhook processing, before any enrichment. Routes conversations to `n1ago`, `human`, or `bot` using Zendesk Switchboard API. When routing to n1ago, also handles tag addition and welcome message. Designed for minimal latency (~1-10ms).
*   **TransferService:** Centralized service (`server/features/routing/services/transferService.ts`) that encapsulates all conversation transfer logic including: Zendesk passControl API call, handler persistence in database, tag management, farewell messages (when transferring to human), and welcome messages (when transferring to N1ago). Used by manual transfers, orchestrator (DemandFinder escalations), and inbound routing to ensure consistent behavior.
*   **AutoPilot:** Automatically sends suggested responses based on conditions.
*   **SendMessageService:** Centralized message sending controller for all outbound messages to customers.
*   **ResponseFormatterService:** Adjusts tone of voice for outbound messages using an AI agent's configuration.
*   **Solution Center Integration:** External KB API integration (Solution Center) for DemandFinder's article and problem search, storing results in `solution_center_articles_and_problems`. This is the sole knowledge source - no internal knowledge base.
*   **Scheduled Maintenance Services:** Daily scheduled tasks for archiving old data and performing database vacuuming.
*   **Server Bootstrap & Initialization:** Includes preflight checks for environment variables, granular scheduler control via flags, an enhanced `/ready` endpoint, and production static file verification.
*   **Database Migrations:** Automated migration execution during build process using Drizzle ORM. Supports both Drizzle migrations (`./drizzle/`) and manual SQL migrations (`./migrations/`). Features timeout protection (60s per operation), proper Neon serverless transaction handling, and graceful error recovery.
*   **Server Resilience:** Server starts even if database is unavailable (degraded mode). Background workers only start when database is healthy. Health endpoints (`/health`, `/ready`) include real-time database status with cached checks.

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular for config tables; `snake_case` foreign keys.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types and Constants Architecture:** Centralized type definitions and UI constants.
*   **Shared Hooks and Form Components:** Reusable frontend components.
*   **Backend Feature Architecture:** Each feature module contains `routes/`, `storage/`, and `services/`.
*   **Modular Conversation Storage:** The `conversations/storage/` layer is split into focused modules:
    - `conversationCore.ts` - CRUD operations and queries
    - `conversationLifecycle.ts` - Closing and inactivity operations
    - `conversationOrchestratorState.ts` - Orchestrator state management
    - `conversationCrud.ts` - Aggregates and re-exports all modules for backward compatibility
*   **Idempotent Event Creation:** Ensures unique event processing.
*   **Modular AI Tools and Prompts:** AI tools in individual files; prompt variables centralized.
*   **OpenAI Services Architecture:** Centralized services provide wrappers for `chat()` and `chatWithTools()` with automatic logging.
*   **AI Agent Framework Patterns:** Centralized framework for running agents and saving suggestions, differentiating between conversation-based and non-conversation agents.
*   **External Knowledge Architecture:** All knowledge retrieval uses the external Solution Center API exclusively (no internal knowledge base).

## Recent Changes

*   **2024-12-24:** Removed query monitoring system (query_logs, query_stats tables, QueryMonitoringTab component, queryLogger service) to eliminate database overhead. The system was instrumenting every query via a Proxy wrapper, causing more performance degradation than value provided. The `system_config` table was preserved as it's used by other features.

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
*   **AI Services (Chat):** Utilizes Replit AI Integrations (default) or OpenAI (fallback).
*   **OpenAI API:** Used for AI chat capabilities.