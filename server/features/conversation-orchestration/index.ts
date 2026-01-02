export { ConversationOrchestrator, processConversationEvent } from "./dispatcher/index.js";

export {
  CONVERSATION_OWNER,
  ORCHESTRATOR_STATUS,
  isValidOwnerTransition,
  ActionExecutor,
  createAgentLogger,
  createSuccessResult,
  escalateConversation,
  handleAgentError,
  createEscalatedResult,
  isN1agoHandler,
  type ConversationOwner,
  type OrchestratorStatus,
  type DispatchResult,
  type AgentResult,
  type OrchestratorContext,
  type OrchestratorAction,
  type ActionExecutorResult,
  type AgentProcessResult,
  type EscalationOptions,
} from "./shared/index.js";

export { 
  DemandFinderOrchestrator, 
  DemandFinderAgent, 
  type DemandFinderProcessResult 
} from "./demandFinder/index.js";

export {
  CloserOrchestrator,
  CloserAgent,
  DEFAULT_CLOSING_MESSAGE,
  DEFAULT_MORE_HELP_PROMPT,
  DEFAULT_FOLLOW_UP_MESSAGE,
  type CloserProcessResult,
} from "./closer/index.js";

export * from "./solutionProvider/index.js";
