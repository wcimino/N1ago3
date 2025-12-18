import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../agentFramework.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { conversationStorage } from "../../../../conversations/storage/index.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { ORCHESTRATOR_STATUS, type CloserAgentResult, type OrchestratorContext } from "../types.js";

const CONFIG_KEY = "closer";
const DEFAULT_CLOSING_MESSAGE = "Obrigado por entrar em contato! Tenha um otimo dia!";
const DEFAULT_MORE_HELP_PROMPT = "Claro! Em que posso te ajudar agora?";

export interface CloserProcessResult {
  success: boolean;
  wantsMoreHelp: boolean;
  newDemandCreated: boolean;
  conversationClosed: boolean;
  suggestedResponse?: string;
  suggestionId?: number;
  error?: string;
}

export class CloserAgent {
  static async process(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserAgent] Processing conversation ${conversationId}`);

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

      let wantsMoreHelp = false;
      let newDemand: string | undefined;
      let suggestedResponse: string | undefined;
      let suggestionId: number | undefined;

      if (!result.success) {
        console.log(`[CloserAgent] Agent call failed for conversation ${conversationId}: ${result.error}, using fallback`);
        suggestedResponse = DEFAULT_CLOSING_MESSAGE;
      } else {
        wantsMoreHelp = result.parsedContent?.wantsMoreHelp === true;
        newDemand = result.parsedContent?.newDemand as string | undefined;
        suggestedResponse = result.parsedContent?.suggestedResponse;
        suggestionId = result.suggestionId;
      }

      console.log(`[CloserAgent] Customer wants more help: ${wantsMoreHelp}, newDemand: ${newDemand || 'none'}`);

      if (wantsMoreHelp) {
        const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
        if (activeDemand) {
          await caseDemandStorage.markAsCompleted(activeDemand.id);
          console.log(`[CloserAgent] Marked demand ${activeDemand.id} as completed`);
        }

        const newDemandRecord = await caseDemandStorage.createNewDemand(conversationId);
        console.log(`[CloserAgent] Created new demand ${newDemandRecord.id} for conversation ${conversationId}`);

        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.FINDING_DEMAND);
        context.currentStatus = ORCHESTRATOR_STATUS.FINDING_DEMAND;

        const responseToSend = suggestedResponse || DEFAULT_MORE_HELP_PROMPT;
        let finalSuggestionId = suggestionId;
        
        if (!finalSuggestionId) {
          const savedSuggestion = await saveSuggestedResponse(conversationId, responseToSend, {
            lastEventId: event.id,
            externalConversationId: event.externalConversationId || null,
            inResponseTo: String(event.id),
          });
          finalSuggestionId = savedSuggestion?.id;
        }

        return {
          success: true,
          wantsMoreHelp: true,
          newDemandCreated: true,
          conversationClosed: false,
          suggestedResponse: responseToSend,
          suggestionId: finalSuggestionId,
        };
      }

      const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
      if (activeDemand) {
        await caseDemandStorage.markAsCompleted(activeDemand.id);
        console.log(`[CloserAgent] Marked demand ${activeDemand.id} as completed (closing)`);
      }

      await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
      context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;

      console.log(`[CloserAgent] Conversation ${conversationId} closed`);

      const closingResponse = suggestedResponse || DEFAULT_CLOSING_MESSAGE;
      let finalSuggestionId = suggestionId;
      
      if (!finalSuggestionId) {
        const savedSuggestion = await saveSuggestedResponse(conversationId, closingResponse, {
          lastEventId: event.id,
          externalConversationId: event.externalConversationId || null,
          inResponseTo: String(event.id),
        });
        finalSuggestionId = savedSuggestion?.id;
      }

      return {
        success: true,
        wantsMoreHelp: false,
        newDemandCreated: false,
        conversationClosed: true,
        suggestedResponse: closingResponse,
        suggestionId: finalSuggestionId,
      };

    } catch (error: any) {
      console.error(`[CloserAgent] Error processing conversation ${conversationId}:`, error);
      
      try {
        const activeDemand = await caseDemandStorage.getActiveByConversationId(conversationId);
        if (activeDemand) {
          await caseDemandStorage.markAsCompleted(activeDemand.id);
        }
        
        await conversationStorage.updateOrchestratorStatus(conversationId, ORCHESTRATOR_STATUS.CLOSED);
        context.currentStatus = ORCHESTRATOR_STATUS.CLOSED;
        
        const savedSuggestion = await saveSuggestedResponse(conversationId, DEFAULT_CLOSING_MESSAGE, {
          lastEventId: event.id,
          externalConversationId: event.externalConversationId || null,
          inResponseTo: String(event.id),
        });
        
        console.log(`[CloserAgent] Error recovery: closed conversation ${conversationId} with fallback message`);
        
        return {
          success: true,
          wantsMoreHelp: false,
          newDemandCreated: false,
          conversationClosed: true,
          suggestedResponse: DEFAULT_CLOSING_MESSAGE,
          suggestionId: savedSuggestion?.id,
          error: error.message || "Recovered from error with fallback",
        };
      } catch (recoveryError) {
        console.error(`[CloserAgent] Recovery failed for conversation ${conversationId}:`, recoveryError);
        return {
          success: false,
          wantsMoreHelp: false,
          newDemandCreated: false,
          conversationClosed: false,
          error: error.message || "Failed to process closer agent",
        };
      }
    }
  }

  static async sendInitialClosingMessage(context: OrchestratorContext): Promise<CloserProcessResult> {
    const { conversationId, event } = context;

    try {
      console.log(`[CloserAgent] Sending initial closing message for conversation ${conversationId}`);

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
        console.log(`[CloserAgent] Failed to generate initial closing message: ${result.error}`);
        return {
          success: false,
          wantsMoreHelp: false,
          newDemandCreated: false,
          conversationClosed: false,
          error: result.error,
        };
      }

      return {
        success: true,
        wantsMoreHelp: false,
        newDemandCreated: false,
        conversationClosed: false,
        suggestedResponse: result.parsedContent?.suggestedResponse,
        suggestionId: result.suggestionId,
      };

    } catch (error: any) {
      console.error(`[CloserAgent] Error sending initial closing message:`, error);
      return {
        success: false,
        wantsMoreHelp: false,
        newDemandCreated: false,
        conversationClosed: false,
        error: error.message,
      };
    }
  }
}
