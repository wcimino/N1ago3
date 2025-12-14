import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import type { SolutionProviderAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "solution_provider";

export class SolutionProviderAgent {
  static async process(context: OrchestratorContext): Promise<SolutionProviderAgentResult> {
    const { event, summary, classification, demand, searchResults } = context;

    try {
      const agentContext = await buildAgentContextFromEvent(event, {
        overrides: {
          summary,
          classification: classification ? {
            product: classification.product,
            subproduct: classification.subproduct,
            subject: classification.subject,
            intent: classification.intent,
          } : undefined,
          demand,
          searchResults,
        },
      });

      const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
        skipIfDisabled: true,
        defaultModelName: "gpt-4o",
        suggestionField: "suggestedResponse",
      });

      if (!result.success) {
        return {
          success: false,
          resolved: false,
          needsEscalation: true,
          error: result.error || "Failed to run solution provider",
        };
      }

      if (!result.responseContent) {
        console.log(`[SolutionProviderAgent] No response for conversation ${conversationId}`);
        return {
          success: true,
          resolved: false,
          needsEscalation: false,
        };
      }

      const parsedContent = result.parsedContent;

      console.log(`[SolutionProviderAgent] Processed conversation ${conversationId}, resolved: ${parsedContent.resolved}, suggestionId: ${result.suggestionId || 'none'}`);

      return {
        success: true,
        resolved: parsedContent.resolved ?? true,
        solution: parsedContent.solution,
        confidence: parsedContent.confidence,
        needsEscalation: parsedContent.needsEscalation ?? false,
        escalationReason: parsedContent.escalationReason,
        suggestedResponse: parsedContent.suggestedResponse,
        suggestionId: result.suggestionId,
      };
    } catch (error: any) {
      console.error(`[SolutionProviderAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        resolved: false,
        needsEscalation: true,
        error: error.message || "Failed to provide solution",
      };
    }
  }
}
