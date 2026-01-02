import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../ai/services/agentFramework.js";
import { buildResolvedClassification } from "../../ai/services/helpers/index.js";
import { conversationStorage } from "../../conversations/storage/conversationStorage.js";
import { caseDemandStorage } from "../../ai/storage/caseDemandStorage.js";
import { 
  ActionExecutor, 
  ORCHESTRATOR_STATUS, 
  CONVERSATION_OWNER, 
  type OrchestratorContext, 
  type OrchestratorAction,
  type ActionExecutorResult,
} from "../shared/index.js";

const CONFIG_KEY = "closer";
export const DEFAULT_CLOSING_MESSAGE = "Obrigado por entrar em contato! Tenha um otimo dia!";
export const DEFAULT_MORE_HELP_PROMPT = "Claro! Em que posso te ajudar agora?";
export const DEFAULT_FOLLOW_UP_MESSAGE = "Posso te ajudar com mais alguma coisa?";

export interface CloserProcessResult {
  success: boolean;
  wantsMoreHelp: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export class CloserOrchestrator {
  static async process(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, currentStatus } = context;

    const isProcessingCustomerResponse = currentStatus === ORCHESTRATOR_STATUS.FINALIZING;

    console.log(`[CloserOrchestrator] Processing conversation ${conversationId}, mode: ${isProcessingCustomerResponse ? "processing_response" : "sending_followup"}`);

    if (isProcessingCustomerResponse) {
      return this.processCustomerResponse(context);
    } else {
      return this.sendFollowUp(context);
    }
  }

  private static async sendFollowUp(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserOrchestrator] Sending follow-up for conversation ${conversationId}`);

      const followUpMessage = DEFAULT_FOLLOW_UP_MESSAGE;
      const savedSuggestion = await saveSuggestedResponse(conversationId, followUpMessage, {
        lastEventId: event.id,
        externalConversationId: event.externalConversationId || null,
        inResponseTo: String(event.id),
      });

      if (!savedSuggestion?.id) {
        console.log(`[CloserOrchestrator] Failed to save follow-up suggestion, keeping conversation open`);
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
          conversationOwner: CONVERSATION_OWNER.CLOSER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
        return {
          success: true,
          wantsMoreHelp: false,
          error: "Failed to save follow-up suggestion",
        };
      }

      const action: OrchestratorAction = {
        type: "SEND_MESSAGE",
        payload: { suggestionId: savedSuggestion.id, responsePreview: followUpMessage }
      };
      const sendResult = await ActionExecutor.execute(context, [action]);

      console.log(`[CloserOrchestrator] Follow-up ${sendResult.messageSent ? "sent" : "not sent"} (reason: ${sendResult.skipReason}), waiting for customer response`);

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
        conversationOwner: CONVERSATION_OWNER.CLOSER,
        waitingForCustomer: true,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;

      return {
        success: true,
        wantsMoreHelp: false,
        suggestedResponse: followUpMessage,
        suggestionId: savedSuggestion.id,
      };

    } catch (error: any) {
      console.error(`[CloserOrchestrator] Error sending follow-up for conversation ${conversationId}:`, error);
      
      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
        conversationOwner: CONVERSATION_OWNER.CLOSER,
        waitingForCustomer: true,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;

      return {
        success: true,
        wantsMoreHelp: false,
        error: error.message || "Error sending follow-up",
      };
    }
  }

  private static async processCustomerResponse(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserOrchestrator] Analyzing customer response for conversation ${conversationId}`);

      const resolvedClassification = await buildResolvedClassification(context.classification);

      const agentContext = await buildAgentContextFromEvent(event, {
        overrides: {
          summary: context.summary,
          classification: resolvedClassification,
        },
      });

      const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
        skipIfDisabled: true,
        defaultModelName: "gpt-4o-mini",
        suggestionField: "suggestedResponse",
        inResponseTo: String(event.id),
      });

      if (!result.success) {
        console.log(`[CloserOrchestrator] Agent call failed for conversation ${conversationId}: ${result.error}, using fallback`);
        return this.handleFallbackClose(context, DEFAULT_CLOSING_MESSAGE);
      }

      const wantsMoreHelp = result.parsedContent?.wantsMoreHelp === true;
      let suggestedResponse = result.parsedContent?.suggestedResponse as string | undefined;
      let suggestionId = result.suggestionId;

      if (!suggestedResponse) {
        suggestedResponse = wantsMoreHelp ? DEFAULT_MORE_HELP_PROMPT : DEFAULT_CLOSING_MESSAGE;
      }

      if (!suggestionId) {
        const savedSuggestion = await saveSuggestedResponse(conversationId, suggestedResponse, {
          lastEventId: event.id,
          externalConversationId: event.externalConversationId || null,
          inResponseTo: String(event.id),
        });
        suggestionId = savedSuggestion?.id;
      }

      console.log(`[CloserOrchestrator] Analysis complete - wantsMoreHelp: ${wantsMoreHelp}`);

      let sendResult: ActionExecutorResult = { messageSent: false, messageSkipped: false };
      if (suggestionId && suggestedResponse) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId, responsePreview: suggestedResponse }
        };
        sendResult = await ActionExecutor.execute(context, [action]);
      }

      if (!sendResult.messageSent) {
        console.log(`[CloserOrchestrator] Response not sent (reason: ${sendResult.skipReason}), keeping conversation open for ${conversationId}`);
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
          conversationOwner: CONVERSATION_OWNER.CLOSER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
      } else if (wantsMoreHelp) {
        console.log(`[CloserOrchestrator] Customer wants more help, creating new demand`);

        const newDemandRecord = await caseDemandStorage.createNewDemand(conversationId);
        console.log(`[CloserOrchestrator] Created new demand ${newDemandRecord.id} for conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINDING_DEMAND,
          conversationOwner: CONVERSATION_OWNER.DEMAND_FINDER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
      } else {
        console.log(`[CloserOrchestrator] Customer satisfied, closing conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.CLOSED,
          conversationOwner: null,
          waitingForCustomer: false,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;
      }

      return {
        success: true,
        wantsMoreHelp,
        suggestedResponse,
        suggestionId,
      };

    } catch (error: any) {
      console.error(`[CloserOrchestrator] Error processing customer response for conversation ${conversationId}:`, error);
      return this.handleFallbackClose(context, DEFAULT_CLOSING_MESSAGE);
    }
  }

  private static async handleFallbackClose(context: OrchestratorContext, message: string): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      const savedSuggestion = await saveSuggestedResponse(conversationId, message, {
        lastEventId: event.id,
        externalConversationId: event.externalConversationId || null,
        inResponseTo: String(event.id),
      });

      if (savedSuggestion?.id) {
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId: savedSuggestion.id, responsePreview: message }
        };
        await ActionExecutor.execute(context, [action]);
      }

      await conversationStorage.updateOrchestratorState(conversationId, {
        orchestratorStatus: ORCHESTRATOR_STATUS.CLOSED,
        conversationOwner: null,
        waitingForCustomer: false,
      });
      context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;

      return {
        success: true,
        wantsMoreHelp: false,
        suggestedResponse: message,
        suggestionId: savedSuggestion?.id,
      };
    } catch (recoveryError) {
      console.error(`[CloserOrchestrator] Fallback close failed for conversation ${conversationId}:`, recoveryError);
      return {
        success: false,
        wantsMoreHelp: false,
        error: "Failed to close conversation",
      };
    }
  }
}

export { CloserOrchestrator as CloserAgent };
