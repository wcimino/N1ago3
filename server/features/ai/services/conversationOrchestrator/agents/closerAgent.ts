import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../agentFramework.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { ActionExecutor } from "../actionExecutor.js";
import { ORCHESTRATOR_STATUS, type OrchestratorContext, type OrchestratorAction } from "../types.js";

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

        // Mark demand as completed and close
        const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
        if (activeDemand) {
          await caseDemandStorage.markAsCompleted(activeDemand.id);
        }
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
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
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.ESCALATED);
        context.currentStatus = ORCHESTRATOR_STATUS.ESCALATED;
        return {
          success: true,
          wantsMoreHelp: false,
          error: "Failed to save suggestion",
        };
      }

      // Send message (ActionExecutor handles isN1agoHandler check)
      if (suggestedResponse && suggestionId) {
        console.log(`[CloserAgent] Sending response for conversation ${conversationId}`);
        const action: OrchestratorAction = {
          type: "SEND_MESSAGE",
          payload: { suggestionId, responsePreview: suggestedResponse }
        };
        await ActionExecutor.execute(context, [action]);
      }

      if (wantsMoreHelp) {
        // Customer wants more help - create new demand and go back to FINDING_DEMAND
        console.log(`[CloserAgent] Customer wants more help, creating new demand`);
        
        const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
        if (activeDemand) {
          await caseDemandStorage.markAsCompleted(activeDemand.id);
          console.log(`[CloserAgent] Marked demand ${activeDemand.id} as completed`);
        }

        const newDemandRecord = await caseDemandStorage.createNewDemand(conversationId);
        console.log(`[CloserAgent] Created new demand ${newDemandRecord.id} for conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINDING_DEMAND);
        context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;
      } else {
        // Customer is done - close the conversation
        console.log(`[CloserAgent] Closing conversation ${conversationId}`);
        
        const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
        if (activeDemand) {
          await caseDemandStorage.markAsCompleted(activeDemand.id);
          console.log(`[CloserAgent] Marked demand ${activeDemand.id} as completed (closing)`);
        }

        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
        context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;
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

        // Mark demand as completed and close
        const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
        if (activeDemand) {
          await caseDemandStorage.markAsCompleted(activeDemand.id);
        }
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
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
