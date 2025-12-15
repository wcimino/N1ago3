import { runAgentAndSaveSuggestion, buildAgentContextFromEvent } from "../../agentFramework.js";
import { productCatalogStorage } from "../../../../products/storage/productCatalogStorage.js";
import { runCombinedKnowledgeSearch } from "../../tools/combinedKnowledgeSearchTool.js";
import { summaryStorage } from "../../../storage/summaryStorage.js";
import type { DemandFinderAgentResult, OrchestratorContext } from "../types.js";

const CONFIG_KEY = "demand_finder";

export class DemandFinderAgent {
  static async process(context: OrchestratorContext): Promise<DemandFinderAgentResult> {
    const { event, conversationId, summary, classification } = context;

    try {
      // Passo 1: Buscar artigos/problemas e gravar no banco
      const searchResults = await this.searchAndSaveKnowledge(context);

      // Passo 2: Montar prompt e chamar OpenAI
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

  /**
   * Passo 1: Busca artigos e problemas na base de conhecimento e grava no banco
   */
  private static async searchAndSaveKnowledge(context: OrchestratorContext): Promise<DemandFinderAgentResult["searchResults"]> {
    const { conversationId, summary, classification } = context;

    // Monta contexto de busca
    const conversationContext = summary || "";
    
    // Busca artigos e problemas (productId é resolvido automaticamente para productContext)
    const searchResponse = await runCombinedKnowledgeSearch({
      productId: classification?.productId,
      conversationContext,
      limit: 5,
    });

    if (searchResponse.results.length === 0) {
      console.log(`[DemandFinderAgent] No articles/problems found for conversation ${conversationId}`);
      return [];
    }

    // Formata para salvar no banco
    const resultsForStorage = searchResponse.results.map(r => ({
      source: r.source,
      id: r.id,
      name: r.question,
      description: r.answer || "",
      matchScore: r.matchScore,
      matchReason: r.matchReason,
      matchedTerms: r.matchedTerms,
      products: r.products,
    }));

    // Grava no banco
    await summaryStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
    console.log(`[DemandFinderAgent] Saved ${resultsForStorage.length} articles/problems for conversation ${conversationId}`);

    return resultsForStorage;
  }

  /**
   * Passo 2: Monta prompt e chama OpenAI, salvando sugestão
   */
  private static async runAgent(context: OrchestratorContext): Promise<{ suggestedResponse?: string; suggestionId?: number }> {
    const { event, conversationId, summary, classification } = context;

    // Resolve classificação para nomes legíveis
    let resolvedClassification: { product?: string | null; subproduct?: string | null; customerRequestType?: string | null } | undefined;
    if (classification?.productId) {
      const product = await productCatalogStorage.getById(classification.productId);
      if (product) {
        resolvedClassification = {
          product: product.produto,
          subproduct: product.subproduto,
          customerRequestType: classification.customerRequestType,
        };
      }
    } else if (classification?.customerRequestType) {
      resolvedClassification = {
        customerRequestType: classification.customerRequestType,
      };
    }

    // Monta contexto do agente
    const agentContext = await buildAgentContextFromEvent(event, {
      overrides: {
        summary,
        classification: resolvedClassification,
      },
    });

    // Chama OpenAI e salva sugestão
    const result = await runAgentAndSaveSuggestion(CONFIG_KEY, agentContext, {
      skipIfDisabled: true,
      defaultModelName: "gpt-4o-mini",
      suggestionField: "suggestedAnswerToCustomer",
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
