// =============================================================================
// SERVICES FACADE
// =============================================================================
// This file provides a unified service interface for cross-cutting concerns.
// For feature-specific code, prefer importing directly from the feature module:
//   import { eventBus } from "../features/events/services/eventBus.js";
//   import { SummaryAgent } from "../features/ai/services/conversationOrchestrator/agents/index.js";
// =============================================================================

// --- Events Domain ---
// Prefer: import from "../features/events/index.js" or "../features/events/services/eventBus.js"
export { eventBus, EVENTS } from "../features/events/services/eventBus.js";
export { processRawEvent, processPendingRaws } from "../features/events/services/eventProcessor.js";

// --- Sync Domain ---
// Prefer: import from "../features/sync/index.js"
export { startPollingWorker, stopPollingWorker, isPollingWorkerRunning } from "../features/sync/services/pollingWorker.js";
export { reprocessingService, type ReprocessingType, type ReprocessingProgress } from "../features/sync/services/reprocessingService.js";

// --- AI Domain ---
// Prefer: import from "../features/ai/services/..." directly
export { callOpenAI, getOpenaiLogs, getOpenaiLogById } from "../features/ai/services/openaiApiService.js";
export { processResponseForEvent, generateConversationResponse } from "../features/ai/services/responseOrchestrator.js";

// AI Agents (prompt-based, make OpenAI calls)
// Prefer: import from "../features/ai/services/conversationOrchestrator/agents/index.js"
export { 
  SummaryAgent,
  ClassificationAgent,
  TopicClassificationAgent,
} from "../features/ai/services/conversationOrchestrator/agents/index.js";

// --- Conversation Orchestration Domain ---
// Prefer: import from "../features/conversation-orchestration/index.js"
export { DemandFinderAgent } from "../features/conversation-orchestration/index.js";
