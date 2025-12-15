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

    // Monta contexto de busca LIMPO (apenas campos relevantes)
    const conversationContext = await this.buildCleanSearchContext(summary, classification);
    
    console.log(`[DemandFinderAgent] Search input for conversation ${conversationId}:\n${conversationContext}`);
    
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

  /**
   * Monta contexto de busca limpo com apenas os campos relevantes:
   * - Produto (nome completo)
   * - Solicitação (clientRequest do summary)
   * - Tipo (customerRequestType)
   */
  private static async buildCleanSearchContext(
    summary: string | null | undefined,
    classification: OrchestratorContext["classification"]
  ): Promise<string> {
    const parts: string[] = [];

    // 1. Produto (resolver productId para nome legível)
    if (classification?.productId) {
      const product = await productCatalogStorage.getById(classification.productId);
      if (product) {
        const productFullName = product.subproduto 
          ? `${product.produto} > ${product.subproduto}`
          : product.produto;
        parts.push(`Produto: ${productFullName}`);
      }
    }

    // 2. Solicitação (extrair clientRequest do summary JSON, com fallback para importantInfo)
    if (summary) {
      try {
        const summaryData = JSON.parse(summary);
        const solicitation = summaryData.clientRequest || summaryData.importantInfo;
        if (solicitation) {
          parts.push(`Solicitação: ${solicitation}`);
        }
      } catch {
        // Se não for JSON válido, usa o summary como está (fallback)
        if (summary.trim()) {
          parts.push(`Solicitação: ${summary}`);
        }
      }
    }

    // 3. Tipo de solicitação
    if (classification?.customerRequestType) {
      parts.push(`Tipo: ${classification.customerRequestType}`);
    }

    return parts.join("\n");
  }
}
