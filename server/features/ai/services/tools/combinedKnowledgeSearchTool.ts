import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import { runProblemObjectiveSearch } from "./problemObjectiveTool.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { summaryStorage } from "../../storage/summaryStorage.js";

export interface CombinedSearchResult {
  source: "article" | "problem";
  id: number;
  name: string | null;
  description: string;
  resolution?: string;
  matchScore?: number;
  matchReason?: string;
  products?: string[];
}

export interface CombinedSearchParams {
  productId?: number;
  keywords?: string;
  conversationContext?: string;
  limit?: number;
}

export interface CombinedSearchResponse {
  message: string;
  results: CombinedSearchResult[];
  productId?: number;
  articleCount: number;
  problemCount: number;
}

export async function runCombinedKnowledgeSearch(params: CombinedSearchParams): Promise<CombinedSearchResponse> {
  const { productId, keywords, conversationContext, limit = 5 } = params;

  const [articlesResult, problemsResult] = await Promise.all([
    runKnowledgeBaseSearch({
      productId,
      conversationContext,
      keywords,
      limit
    }),
    runProblemObjectiveSearch({
      productId,
      conversationContext,
      keywords,
      limit
    })
  ]);

  const results: CombinedSearchResult[] = [];

  for (const article of articlesResult.articles) {
    results.push({
      source: "article",
      id: article.id,
      name: article.name,
      description: article.description,
      resolution: article.resolution,
      matchScore: article.relevanceScore, // Now 0-100 scale like problems
      matchReason: article.matchReason,
    });
  }

  for (const problem of problemsResult.problems) {
    results.push({
      source: "problem",
      id: problem.id,
      name: problem.name,
      description: problem.description || "",
      matchScore: problem.matchScore,
      matchReason: problem.matchReason,
      products: problem.products,
    });
  }

  // Sort combined results by matchScore descending
  results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  if (results.length === 0) {
    return {
      message: "Nenhum resultado encontrado na base de conhecimento",
      results: [],
      productId,
      articleCount: 0,
      problemCount: 0
    };
  }

  return {
    message: `Encontrados ${articlesResult.articles.length} artigos e ${problemsResult.problems.length} problemas`,
    results,
    productId,
    articleCount: articlesResult.articles.length,
    problemCount: problemsResult.problems.length
  };
}

export function createCombinedKnowledgeSearchTool(): ToolDefinition {
  return createCombinedKnowledgeSearchToolWithContext(undefined);
}

export function createCombinedKnowledgeSearchToolWithContext(conversationId?: number): ToolDefinition {
  return {
    name: "search_knowledge_base_articles_and_problems",
    description: "Busca artigos e problemas objetivos na base de conhecimento. Retorna resultados de ambas as fontes com indicação de origem (source: article | problem).",
    parameters: {
      type: "object",
      properties: {
        conversationContext: {
          type: "string",
          description: "Resumo ou contexto da conversa para busca semântica principal (obrigatório). A busca usa o contexto para encontrar resultados semanticamente relevantes."
        },
        product: {
          type: "string",
          description: "Nome do produto (obrigatório). Ex: 'Cartão de Crédito', 'Conta Digital'"
        },
        subproduct: {
          type: "string",
          description: "Nome do subproduto (opcional). Ex: 'PIX', 'TED', 'Crédito'"
        },
        keywords: {
          type: "string",
          description: "Palavras-chave opcionais para filtrar/priorizar os resultados. Usado como boost sobre os resultados semânticos."
        }
      },
      required: ["conversationContext", "product"]
    },
    handler: async (args: { product: string; subproduct?: string; conversationContext?: string; keywords?: string }) => {
      console.log(`[Combined Knowledge Search Tool] Called with product="${args.product}", subproduct="${args.subproduct || 'none'}"`);
      
      const resolved = await productCatalogStorage.resolveProductId(args.product, args.subproduct);
      
      if (!resolved) {
        console.warn(`[Combined Knowledge Search Tool] Product not resolved: "${args.product}" - search will NOT filter by product`);
      } else {
        console.log(`[Combined Knowledge Search Tool] Resolved to productId=${resolved.id} (${resolved.produto})`);
      }
      
      const result = await runCombinedKnowledgeSearch({
        productId: resolved?.id,
        conversationContext: args.conversationContext,
        keywords: args.keywords,
        limit: 5
      });
      
      if (conversationId && result.results.length > 0) {
        try {
          const saveResult = await summaryStorage.updateArticlesAndProblems(conversationId, result.results);
          if (saveResult.created) {
            console.log(`[Combined Knowledge Search Tool] Created summary with ${result.articleCount} articles and ${result.problemCount} problems for conversation ${conversationId}`);
          } else if (saveResult.updated) {
            console.log(`[Combined Knowledge Search Tool] Updated summary with ${result.articleCount} articles and ${result.problemCount} problems for conversation ${conversationId}`);
          }
        } catch (error) {
          console.error(`[Combined Knowledge Search Tool] Error saving results for conversation ${conversationId}:`, error);
        }
      }
      
      return JSON.stringify(result);
    }
  };
}
