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