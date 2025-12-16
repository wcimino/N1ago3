import { runAgent, buildAgentContextFromEvent } from "../../agentFramework.js";
import { runCombinedKnowledgeSearch } from "../../tools/combinedKnowledgeSearchTool.js";
import { summaryStorage } from "../../../storage/summaryStorage.js";
import { getClientRequestVersions, buildCleanSearchContext, buildResolvedClassification } from "../../helpers/index.js";
import type { ArticlesAndSolutionsAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "articles_and_solutions";

interface RerankResult {
  id: number;
  tipo: string;
  matchScore: number;
  matchReason: string;
}

export class ArticlesAndSolutionsAgent {
  static async process(context: OrchestratorContext): Promise<ArticlesAndSolutionsAgentResult> {
    const { conversationId } = context;

    try {
      const rawSearchResults = await this.searchKnowledge(context);

      if (!rawSearchResults || rawSearchResults.length === 0) {
        console.log(`[ArticlesAndSolutionsAgent] No articles/problems found for conversation ${conversationId}`);
        return { success: true, searchResults: [] };
      }

      const rerankedResults = await this.rerankWithAI(context, rawSearchResults);

      await this.saveResults(conversationId, rerankedResults || rawSearchResults);

      console.log(`[ArticlesAndSolutionsAgent] Processed conversation ${conversationId}, results: ${(rerankedResults || rawSearchResults).length}`);

      return {
        success: true,
        searchResults: rerankedResults || rawSearchResults,
      };
    } catch (error: any) {
      console.error(`[ArticlesAndSolutionsAgent] Error processing conversation ${conversationId}:`, error);
      return {
        success: false,
        error: error.message || "Failed to process articles and solutions",
      };
    }
  }

  private static async searchKnowledge(context: OrchestratorContext): Promise<ArticlesAndSolutionsAgentResult["searchResults"]> {
    const { conversationId, summary, classification } = context;

    const conversationContext = await buildCleanSearchContext(summary, classification);
    
    const versions = getClientRequestVersions(summary);
    const articleContext = versions?.clientRequestQuestionVersion;
    const problemContext = versions?.clientRequestProblemVersion;
    
    console.log(`[ArticlesAndSolutionsAgent] Search input for conversation ${conversationId}:`);
    console.log(`  - articleContext: ${articleContext ? 'Question version' : 'fallback'}`);
    console.log(`  - problemContext: ${problemContext ? 'Problem version' : 'fallback'}`);
    
    const searchResponse = await runCombinedKnowledgeSearch({
      productId: classification?.productId,
      conversationContext,
      articleContext,
      problemContext,
      limit: 10,
    });

    if (searchResponse.results.length === 0) {
      return [];
    }

    return searchResponse.results.map(r => ({
      source: r.source,
      id: r.id,
      name: r.question || r.answer || "",
      description: r.answer || "",
      matchScore: r.matchScore,
      matchReason: r.matchReason,
      matchedTerms: r.matchedTerms,
      products: r.products,
    }));
  }

  private static async rerankWithAI(
    context: OrchestratorContext, 
    searchResults: NonNullable<ArticlesAndSolutionsAgentResult["searchResults"]>
  ): Promise<ArticlesAndSolutionsAgentResult["searchResults"] | null> {
    const { event, conversationId, summary, classification } = context;

    try {
      const resolvedClassification = await buildResolvedClassification(classification);

      const agentContext = await buildAgentContextFromEvent(event, {
        overrides: {
          summary,
          classification: resolvedClassification,
          searchResults,
        },
      });

      const result = await runAgent(CONFIG_KEY, agentContext, {
        skipIfDisabled: true,
        defaultModelName: "gpt-4o-mini",
      });

      if (!result.success || !result.parsedContent) {
        console.log(`[ArticlesAndSolutionsAgent] AI reranking failed or disabled, using original results`);
        return null;
      }

      const rerankedData = result.parsedContent.results || result.parsedContent.artigos || result.parsedContent;
      
      if (!Array.isArray(rerankedData)) {
        console.log(`[ArticlesAndSolutionsAgent] AI response not an array, using original results`);
        return null;
      }

      const rerankedResults = (rerankedData as RerankResult[])
        .map((item: RerankResult) => {
          const original = searchResults.find(r => r.id === item.id);
          if (!original) return null;
          
          return {
            ...original,
            matchScore: item.matchScore ?? original.matchScore,
            matchReason: item.matchReason ?? original.matchReason,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

      console.log(`[ArticlesAndSolutionsAgent] Reranked ${rerankedResults.length} results for conversation ${conversationId}`);

      return rerankedResults;
    } catch (error: any) {
      console.error(`[ArticlesAndSolutionsAgent] Error in AI reranking:`, error);
      return null;
    }
  }

  private static async saveResults(
    conversationId: number, 
    results: NonNullable<ArticlesAndSolutionsAgentResult["searchResults"]>
  ): Promise<void> {
    const resultsForStorage = results.map(r => ({
      source: r.source as "article" | "problem",
      id: r.id,
      name: r.name,
      description: r.description,
      matchScore: r.matchScore,
      matchReason: r.matchReason,
      matchedTerms: r.matchedTerms,
      products: r.products,
    }));

    await summaryStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
    console.log(`[ArticlesAndSolutionsAgent] Saved ${resultsForStorage.length} articles/problems for conversation ${conversationId}`);
  }
}
