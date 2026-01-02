import { conversationStorage } from "../../../../conversations/storage/conversationStorage.js";
import { 
  ORCHESTRATOR_STATUS, 
  CONVERSATION_OWNER, 
  type OrchestratorContext, 
  type OrchestratorAction 
} from "../../../../conversation-orchestration/shared/types.js";

export {
  createAgentLogger,
  createSuccessResult,
  type AgentProcessResult,
} from "../../../../conversation-orchestration/shared/logger.js";

export {
  escalateConversation,
  handleAgentError,
  createEscalatedResult,
  type EscalationOptions,
} from "../../../../conversation-orchestration/shared/escalation.js";

export {
  ORCHESTRATOR_STATUS,
  CONVERSATION_OWNER,
  type OrchestratorContext,
  type OrchestratorAction,
};

export async function updateOrchestratorStatus(
  conversationId: number,
  context: OrchestratorContext,
  status: keyof typeof ORCHESTRATOR_STATUS,
  owner: keyof typeof CONVERSATION_OWNER | null,
  waitingForCustomer: boolean = false
): Promise<void> {
  await conversationStorage.updateOrchestratorState(conversationId, {
    orchestratorStatus: ORCHESTRATOR_STATUS[status],
    conversationOwner: owner ? CONVERSATION_OWNER[owner] : null,
    waitingForCustomer,
  });
  context.currentStatus = ORCHESTRATOR_STATUS[status];
}
