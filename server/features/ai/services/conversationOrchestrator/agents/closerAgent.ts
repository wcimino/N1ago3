import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../agentFramework.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { ActionExecutor, type ActionExecutorResult } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, CONVERSATION_OWNER, type OrchestratorContext, type OrchestratorAction } from "../types.js";

const CONFIG_KEY = "closer";
export const DEFAULT_CLOSING_MESSAGE = "Obrigado por entrar em contato! Tenha um otimo dia!";
export const DEFAULT_MORE_HELP_PROMPT = "Claro! Em que posso te ajudar agora?";

export interface CloserProcessResult {
  success: boolean;
  wantsMoreHelp: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export class CloserAgent {
  static async process(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserAgent] Analyzing conversation ${conversationId}`);

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
        console.log(`[CloserAgent] Agent call failed for conversation ${conversationId}: ${result.error}, using fallback`);
        
        const fallbackResponse = DEFAULT_CLOSING_MESSAGE;
        const savedSuggestion = await saveSuggestedResponse(conversationId, fallbackResponse, {
          lastEventId: event.id,
          externalConversationId: event.externalConversationId || null,
          inResponseTo: String(event.id),
        });
        
        // Send fallback message and close conversation
        if (savedSuggestion?.id) {
          const action: OrchestratorAction = {
            type: "SEND_MESSAGE",
            payload: { suggestionId: savedSuggestion.id, responsePreview: fallbackResponse }
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
          suggestedResponse: fallbackResponse,
          suggestionId: savedSuggestion?.id,
        };
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

      console.log(`[CloserAgent] Analysis complete - wantsMoreHelp: ${wantsMoreHelp}`);

      // Require suggestionId for message sending
      if (!suggestionId && suggestedResponse) {
        console.log(`[CloserAgent] Failed to save suggestion (no suggestionId), escalating`);
        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.ESCALATED,
          conversationOwner: null,
          waitingForCustomer: false,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        return {
          success: true,
          wantsMoreHelp: false,
          error: "Failed to save suggestion",
        };
      }

      // Send message (ActionExecutor handles isN1agoHandler check)
      let sendResult: ActionExecutorResult = { messageSent: false, messageSkipped: false };
      if (suggestedResponse && suggestionId) {
        console.log(`[CloserAgent] Sending response for conversation ${conversationId}`);
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId, responsePreview: suggestedResponse }
        };
        sendResult = await ActionExecutor.execute(context, [action]);
      }

      if (wantsMoreHelp) {
        // Customer wants more help - start new demand cycle
        console.log(`[CloserAgent] Customer wants more help, creating new demand`);

        const newDemandRecord = await caseDemandStorage.createNewDemand(conversationId);
        console.log(`[CloserAgent] Created new demand ${newDemandRecord.id} for conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINDING_DEMAND,
          conversationOwner: CONVERSATION_OWNER.DEMAND_FINDER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
      } else if (sendResult.messageSent) {
        // Message was sent successfully - close conversation
        console.log(`[CloserAgent] Message sent successfully, closing conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.CLOSED,
          conversationOwner: null,
          waitingForCustomer: false,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;
      } else {
        // Message was NOT sent (skipped/expired) - keep conversation open, wait for customer
        console.log(`[CloserAgent] Message not sent (reason: ${sendResult.skipReason}), keeping conversation open for ${conversationId}`);

        await conversationStorage.updateOrchestratorState(conversationId, {
          orchestratorStatus: ORCHESTRATOR_STATUS.FINALIZING,
          conversationOwner: CONVERSATION_OWNER.CLOSER,
          waitingForCustomer: true,
        });
        context.currentStatus = ORCHESTRATOR_STATUS.FINALIZING;
      }

      return {
        success: true,
        wantsMoreHelp,
        suggestedResponse,
        suggestionId,
      };

    } catch (error: any) {
      console.error(`[CloserAgent] Error analyzing conversation ${conversationId}:`, error);
      
      try {
        const savedSuggestion = await saveSuggestedResponse(conversationId, DEFAULT_CLOSING_MESSAGE, {
          lastEventId: event.id,
          externalConversationId: event.externalConversationId || null,
          inResponseTo: String(event.id),
        });
        
        // Send fallback message and close conversation
        if (savedSuggestion?.id) {
          const action: OrchestratorAction = {
            type: "SEND_MESSAGE",
            payload: { suggestionId: savedSuggestion.id, responsePreview: DEFAULT_CLOSING_MESSAGE }
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
          suggestedResponse: DEFAULT_CLOSING_MESSAGE,
          suggestionId: savedSuggestion?.id,
          error: error.message || "Recovered from error with fallback",
        };
      } catch (recoveryError) {
        console.error(`[CloserAgent] Recovery failed for conversation ${conversationId}:`, recoveryError);
        return {
          success: false,
          wantsMoreHelp: false,
          error: error.message || "Failed to process closer agent",
        };
      }
    }
  }
}
