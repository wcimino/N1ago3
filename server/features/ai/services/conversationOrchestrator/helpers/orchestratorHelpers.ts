import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";

export interface EscalationOptions {
  sendApologyMessage?: boolean;
  apologyMessage?: string;
  updateCaseDemandStatus?: boolean;
  caseDemandStatus?: "error" | "demand_not_found";
}

const DEFAULT_APOLOGY_MESSAGE = "Desculpe, não consegui entender sua solicitação. Vou te transferir para um humano continuar o atendimento, aguarde um momento...";

export async function escalateConversation(
  conversationId: number,
  context: OrchestratorContext,
  reason: string,
  options: EscalationOptions = {}
): Promise<void> {
  const {
    sendApologyMessage = false,
    apologyMessage = DEFAULT_APOLOGY_MESSAGE,
    updateCaseDemandStatus = true,
    caseDemandStatus = "demand_not_found",
  } = options;

  console.log(`[OrchestratorHelpers] Escalating conversation ${conversationId}: ${reason}`);

  if (sendApologyMessage) {
    const transferAction: OrchestratorAction = {
      type: "TRANSFER_TO_HUMAN",
      payload: { reason, message: apologyMessage },
    };
    await ActionExecutor.execute(context, [transferAction]);
  }

  if (context.currentStatus !== ORCHESTRATOR_STATUS.ESCALATED) {
    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
      conversationOwner: null,
      waitingForCustomer: false,
    });
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
  }

  if (updateCaseDemandStatus) {
    await caseDemandStorage.updateStatus(conversationId, caseDemandStatus);
  }
}

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

export function createEscalationResult<T extends { success: boolean; error?: string }>(
  error?: string,
  additionalFields: Partial<T> = {}
): T {
  return {
    success: true,
    error,
    ...additionalFields,
  } as T;
}

export async function handleAgentError(
  conversationId: number,
  context: OrchestratorContext,
  error: any,
  agentName: string
): Promise<void> {
  console.error(`[${agentName}] Error processing conversation ${conversationId}:`, error);

  try {
    await conversationStorage.updateOrchestratorState(conversationId, {
      orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
      conversationOwner: null,
      waitingForCustomer: false,
    });
    await caseDemandStorage.updateStatus(conversationId, "error");
    context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
  } catch (statusError) {
    console.error(`[${agentName}] Failed to update status on error:`, statusError);
  }
}
