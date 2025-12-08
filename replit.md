# N1ago - Atendimento sobre Crédito

## Overview

N1ago is a system designed to manage and monitor customer interactions related to credit inquiries. It receives and processes webhooks from Zendesk Sunshine Conversations, stores all conversation data, and displays real-time events on a React dashboard. The project aims to enhance customer service efficiency, provide a comprehensive overview of interaction data, and serve as a platform for future AI-powered automation, including conversation summarization and product classification. The ultimate goal is to improve customer experience and leverage data for better insights in automated support.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system utilizes a decoupled frontend and backend architecture. The frontend is built with React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter. The backend is an Express.js server, using Drizzle ORM for PostgreSQL interactions and Replit Auth for secure user authentication.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests events from various sources, normalizing them into a consistent `StandardEvent` format. It includes dedicated webhook endpoints (`Webhook Isolado`), an `EventBus` for asynchronous communication, an `Event Processor` for data normalization via `Adapters`, and a `Polling Worker` for retry mechanisms.
*   **Authentication System:** Leverages Replit Auth (Google Login) with an Access Control List (ACL) that restricts access to specific email domains and entries in an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports multiple AI capabilities (summarization, classification, response generation) using a shared `openai_api_config` table. Each AI feature follows a 3-layer structure (`openaiApiService.ts`, `*Adapter.ts`, `*Orchestrator.ts`) with configurable triggers and lazy OpenAI client initialization. All OpenAI calls are logged for auditing.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard for events and conversations, administrative interfaces for user and webhook management, and utilizes a component-based design with Tailwind CSS for styling. Reusable UI components include badges, data tables, modals, and pagination.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, logs, processes, and stores all conversation data and events in PostgreSQL.
*   **Real-time Dashboard:** Offers a live view of events, conversation metrics, and allows user/webhook management.
*   **User Management:** Secure authentication and authorization with domain and user-list restrictions.
*   **Extensibility:** Designed for easy integration of new communication channels.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers for AI features.

**System Design Choices:**

*   **Database Schema:** Uses plural, `snake_case` table names; singular, `snake_case` for single-config tables; singular, `snake_case` foreign keys; and `idx_<table_name>_<field>` indices.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs in the path.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types Architecture:** Centralized type definitions in `shared/types/` for consistency between frontend and backend.
*   **Backend Feature Architecture:** Each backend feature module follows a consistent structure including `routes/`, `storage/`, and `services/`.

**Recent Refactoring (December 2025):**

*   **Shared Formatters:** Centralized CPF/CNPJ/date formatting functions in `client/src/lib/formatters.ts`.
*   **Reusable Detail Components:** Created shared components for detail pages (`DetailPageHeader`, `InfoField`, `HistoryList`, `RelatedEntityList`) in `client/src/shared/components/detail/`.
*   **HandlerBadge Component:** Reusable badge for bot/human/n1ago handler identification in `client/src/shared/components/badges/`.
*   **AtendimentosPage Refactor:** Extracted `FilterBar` and `UserGroupCard` components to reduce file size.
*   **Storage Modularization:** Split large storage files for better maintainability:
    *   `conversationStorage.ts` → `conversationCrud.ts` + `conversationStats.ts`
    *   `configStorage.ts` → `summaryStorage.ts` + `classificationStorage.ts` + `openaiLogsStorage.ts`
*   **Products Catalog (December 2025):** 
    *   Table `products_catalog` with hierarchical structure: Produto > Subproduto (opcional) > Categoria 1 (opcional) > Categoria 2 (opcional)
    *   CRUD API endpoints at `/api/ifood-products` and `/api/ifood-products/fullnames`
    *   Hierarchical tree interface for product registration with expandable nodes
    *   Product Standardization page uses dropdown selecting from registered products
*   **Navigation Restructuring (December 2025):**
    *   "Cadastro" (Usuários/Organizações) moved to Settings > Cadastro tab at `/settings/catalog/*`
    *   "Exportações" moved to Settings > Manutenção tab at `/settings/maintenance/export`
    *   Simplified main navigation: Home, Atendimentos, AI, Base de Conhecimento
*   **Learning Attempts Tracking (December 2025):**
    *   Table `learning_attempts` tracks every knowledge extraction attempt with results
    *   Results: `suggestion_created`, `insufficient_messages`, `skipped_by_agent`, `processing_error`
    *   API endpoints at `/api/learning-attempts` and `/api/learning-attempts/stats`
    *   New "Processamento" tab in Knowledge Base page with stats and filtered list
    *   Stats use SQL aggregation for scalability (COUNT with FILTER)

## Deployment Configuration

**Important:** This application uses `deploymentTarget = "vm"` instead of `autoscale`. This is required because the system has background workers (polling worker, event processor, AI orchestrators) that must run continuously. The `autoscale` mode only runs when requests are made, which would break these background processes.

## External Dependencies

*   **Zendesk Sunshine Conversations:** Primary source for incoming webhooks.
*   **PostgreSQL/Neon:** Relational database for data storage.
*   **Replit Auth:** Handles user authentication via Google Login.
*   **Passport.js:** Manages authentication sessions.
*   **Express.js:** Backend web framework.
*   **Drizzle ORM:** TypeScript ORM for database interactions.
*   **React:** Frontend UI library.
*   **Vite:** Frontend build tool.
*   **Tailwind CSS:** Utility-first CSS framework.
*   **TanStack Query:** Data fetching and state management for React.
*   **Lucide React:** Icon library.
*   **date-fns:** JavaScript date utility library.
*   **wouter:** Lightweight React routing library.