import { conversationStorage } from "../../conversations/storage/index.js";
import { caseDemandStorage } from "../../ai/storage/caseDemandStorage.js";
import { ActionExecutor } from "./actionExecutor.js";
import { ORCHESTRATOR_STATUS, type OrchestratorContext, type OrchestratorAction } from "./types.js";

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

  console.log(`[Escalation] Escalating conversation ${conversationId}: ${reason}`);

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

export function createEscalatedResult(error?: string, suggestedResponse?: string) {
  return {
    success: true,
    demandConfirmed: false,
    needsClarification: false,
    maxInteractionsReached: true,
    messageSent: false,
    suggestedResponse: suggestedResponse || "Vou te transferir para um especialista que podera te ajudar.",
    error,
  };
}
