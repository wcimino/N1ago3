## Overview

N1ago is a system designed to manage and monitor customer credit inquiry interactions. It processes webhooks from Zendesk Sunshine Conversations, stores conversation data, and provides a real-time React dashboard for visualization. The project aims to enhance customer service efficiency, offer interaction insights, and establish a foundation for future AI-driven automations such as conversation summarization, product classification, and automated support to improve customer experience and generate business insights.

## User Preferences

I prefer clear and direct communication. When suggesting changes, please provide a brief explanation of the rationale. I value iterative development and prefer to review changes in smaller, manageable chunks. Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.

## System Architecture

The system utilizes a decoupled architecture, featuring a React, TypeScript, Vite, Tailwind CSS, TanStack Query, and wouter frontend. The backend is built with Express.js, Drizzle ORM (PostgreSQL), and Replit Auth. It is deployed on a `vm` target to support continuous background workers.

**Core Architectural Patterns:**

*   **Standardized Event Architecture:** Ingests and normalizes events into a `StandardEvent` format via webhooks, an `EventBus`, an `Event Processor` with `Adapters`, and a `Polling Worker`.
*   **Authentication System:** Leverages Replit Auth (Google Login) with an Access Control List (ACL) based on email domains and an `authorized_users` table.
*   **AI-Powered Features:** A unified architecture supports various AI capabilities (summarization, classification, response generation, knowledge search) using centralized OpenAI services and automatic API call logging.
*   **ConversationOrchestrator Pipeline:** Manages conversation flow using a status-based delegation model. Agents (DemandFinder, SolutionProvider, Closer) control their own lifecycles, transitioning through statuses like `NEW`, `FINDING_DEMAND`, `AWAITING_CUSTOMER_REPLY`, `PROVIDING_SOLUTION`, and `CLOSED`. Supports multiple demands per conversation.
*   **Case Solution and Demand Architecture:** `case_solutions` table tracks solution instances with inputs. `case_demand` table stores customer demands per conversation, including interaction counts and status, supporting multiple demands.
*   **Shared Embeddings Architecture:** Centralized embeddings layer for standardized generation, content hashing, and processing across knowledge sources.

**UI/UX Decisions:**

The React frontend provides a real-time dashboard and administrative interfaces, built with a component-based design and Tailwind CSS.

**Feature Specifications:**

*   **Webhook Ingestion & Conversation Storage:** Receives, processes, and stores conversation data and events.
*   **External Events Ingestion:** API endpoint (`POST /api/events/ingest`) for external systems, with API key authentication, validation, rate limiting, and audit logging.
*   **Real-time Dashboard:** Displays live events, metrics, and user/webhook management, optimized with a consolidated `/api/dashboard/analytics` endpoint.
*   **AI Integrations:** Includes Conversation Summaries, Product Classification, API Logging, and Configurable Triggers.
*   **Four-Field Classification System:** Hierarchical conversation classification (Product → Subproduct → Subject → Intent) using sequential AI tools.
*   **Structured Conversation Summary:** Displays AI-generated summaries with specific structured fields.
*   **Automatic Routing Rules:** Unified routing system for conversation allocation (`n1ago`, `human`, `bot`) with Zendesk Switchboard API integration.
*   **AutoPilot:** Automatically sends suggested responses based on conditions.
*   **SendMessageService:** Centralized message sending controller for all outbound messages to customers, including validation and handling of transfer messages.
*   **ResponseFormatterService:** Adjusts tone of voice for outbound messages using an AI agent's configuration.
*   **Objective Problems Catalog:** Normalized catalog of evidence-based problems.

**System Design Choices:**

*   **Database Schema:** Plural, `snake_case` table names; singular for config tables; `snake_case` foreign keys.
*   **API Endpoints:** REST resources are plural, `kebab-case`; config endpoints are singular; specific actions use verbs.
*   **File Structure:** Organized by feature for both frontend and backend.
*   **Shared Types and Constants Architecture:** Centralized type definitions and UI constants.
*   **Shared Hooks and Form Components:** Reusable frontend components for common functionalities.
*   **Backend Feature Architecture:** Each feature module contains `routes/`, `storage/`, and `services/`.
*   **Idempotent Event Creation:** Ensures unique event processing.
*   **Modular AI Tools and Prompts:** AI tools are in individual files; prompt variables are centralized.
*   **Unified Knowledge Base Search Helper:** Single entry point for knowledge base searches with semantic and full-text search capabilities.
*   **Hybrid Search Architecture:** Knowledge base tools support hybrid search using `conversationContext` for semantic search, optional `keywords`, and text-based fallback.
*   **Multi-Query Search Architecture:** Knowledge base articles and objective problems use a multi-query search approach (verbatim, keyword, normalized) with result aggregation.
*   **OpenAI Services Architecture:** Centralized services provide wrappers for `chat()`, `chatWithTools()`, and `embedding()` with automatic logging.
*   **AI Agent Framework Patterns:** Centralized framework for running agents and saving suggestions.
*   **External Sources & Knowledge Base Architecture:** Replicas of external data (e.g., Zendesk articles) and internal Q&A articles with embeddings.
*   **RAG (Retrieval Augmented Generation):** Implements semantic search using OpenAI embeddings with pgvector and HNSW indexing, with fallbacks to full-text search.

## External Dependencies

*   **Zendesk Sunshine Conversations:** Webhook source for conversation data.
*   **PostgreSQL/Neon:** Database backend with pgvector extension for semantic search.
*   **Replit Auth:** User authentication service.
*   **Passport.js:** Authentication sessions management.
*   **Express.js:** Web application framework for the backend.
*   **Drizzle ORM:** TypeScript ORM for database interaction.
*   **React:** Frontend UI library.
*   **Vite:** Fast frontend build tool.
*   **Tailwind CSS:** Utility-first CSS framework.
*   **TanStack Query:** Data fetching library for React.
*   **Lucide React:** Icon library.
*   **date-fns:** JavaScript date utility library.
*   **wouter:** Lightweight React router.
*   **AI Services (Chat):** Utilizes Replit AI Integrations by default, with an option to fallback to OpenAI.
*   **OpenAI API:** Used for embeddings (Replit AI does not support embeddings).