import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { runCombinedKnowledgeSearch } from "../../tools/combinedKnowledgeSearchTool.js";
import { caseDemandStorage } from "../../../storage/caseDemandStorage.js";
import { getClientRequestVersions, buildCleanSearchContext, buildResolvedClassification } from "../../helpers/index.js";
import type { DemandFinderAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "demand_finder";

export class DemandFinderAgent {
  static async process(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { conversationId } = context;

    try {
      const searchResults = await this.searchAndSaveKnowledge(context);
      const agentResult = await this.runAgent(context);

      console.log(`[DemandFinderAgent] Processed conversation ${conversationId}, searchResults: ${searchResults?.length || 0}, suggestionId: ${agentResult.suggestionId || 'none'}`);

      return {
        success: true,
        searchResults,
        suggestedResponse: agentResult.suggestedResponse,
        suggestionId: agentResult.suggestionId,
      };
    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to process demand finder",
      };
    }
  }

  static async searchOnly(context: OrchestratorContext): Promise<DemandFinderAgentResult["searchResults"]> {
    const { conversationId } = context;

    try {
      const searchResults = await this.searchAndSaveKnowledge(context);
      console.log(`[DemandFinderAgent] searchOnly completed for conversation ${conversationId}, found ${searchResults?.length || 0} results`);
      return searchResults;
    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error in searchOnly for conversation ${conversationId}:`, error);
      return [];
    }
  }

  static async generateResponseOnly(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { conversationId } = context;

    try {
      const agentResult = await this.runAgent(context);

      console.log(`[DemandFinderAgent] generateResponseOnly completed for conversation ${conversationId}, suggestionId: ${agentResult.suggestionId || 'none'}`);

      return {
        success: true,
        suggestedResponse: agentResult.suggestedResponse,
        suggestionId: agentResult.suggestionId,
      };
    } catch (error: any) {
      console.error(`[DemandFinderAgent] Error in generateResponseOnly for conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to generate response",
      };
    }
  }

  private static async searchAndSaveKnowledge(context: OrchestratorContext): Promise<DemandFinderAgentResult["searchResults"]> {
    const { conversationId, summary, classification } = context;

    const conversationContext = await buildCleanSearchContext(summary, classification);
    
    const versions = getClientRequestVersions(summary);
    const articleContext = versions?.clientRequestQuestionVersion;
    const problemContext = versions?.clientRequestProblemVersion;
    
    console.log(`[DemandFinderAgent] Search input for conversation ${conversationId}:`);
    console.log(`  - articleContext: ${articleContext ? 'Question version' : 'fallback'}`);
    console.log(`  - problemContext: ${problemContext ? 'Problem version' : 'fallback'}`);
    console.log(`  - fallback: ${conversationContext}`);
    
    const searchResponse = await runCombinedKnowledgeSearch({
      productId: classification?.productId,
      conversationContext,
      articleContext,
      problemContext,
      limit: 5,
    });

    if (searchResponse.results.length === 0) {
      console.log(`[DemandFinderAgent] No articles/problems found for conversation ${conversationId}`);
      return [];
    }

    const resultsForStorage = searchResponse.results.map(r => ({
      source: r.source,
      id: r.id,
      name: r.question || r.answer || "",
      description: r.answer || "",
      matchScore: r.matchScore,
      matchReason: r.matchReason,
      matchedTerms: r.matchedTerms,
      products: r.products,
    }));

    await caseDemandStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
    console.log(`[DemandFinderAgent] Saved ${resultsForStorage.length} articles/problems for conversation ${conversationId}`);

    return resultsForStorage;
  }

  private static async runAgent(context: OrchestratorContext): Promise<{ suggestedResponse?: string; suggestionId?: number }> {
    const { event, conversationId, summary, classification, searchResults } = context;

    const resolvedClassification = await buildResolvedClassification(classification);

    const agentContext = await buildAgentContextFromEvent(event, {
      overrides: {
        summary,
        classification: resolvedClassification,
        searchResults,
      },
    });

    const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
      skipIfDisabled: true,
      defaultModelName: "gpt-4o-mini",
      suggestionField: "suggestedAnswerToCustomer",
      inResponseTo: String(event.id),
    });

    if (!result.success) {
      console.log(`[DemandFinderAgent] Agent call failed for conversation ${conversationId}: ${result.error}`);
      return {};
    }

    return {
      suggestedResponse: result.parsedContent?.suggestedAnswerToCustomer,
      suggestionId: result.suggestionId,
    };
  }
}
