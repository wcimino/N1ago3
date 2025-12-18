import { runAgentAndSaveSuggestion, buildAgentContextFromEvent, saveSuggestedResponse } from "../../agentFramework.js";
import { buildResolvedClassification } from "../../helpers/index.js";
import { type OrchestratorContext } from "../types.js";

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
