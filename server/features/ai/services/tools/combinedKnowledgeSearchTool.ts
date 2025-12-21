import { runProblemObjectiveSearch } from "./problemObjectiveTool.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { caseDemandStorage } from "../../storage/caseDemandStorage.js";
import type { MultiQuerySearchQueries } from "../../../../shared/embeddings/multiQuerySearch.js";

export interface CombinedSearchResult {
  source: "problem";
  id: number;
  question: string | null;
  answer: string | null;
  matchScore?: number;
  matchReason?: string;
  matchedTerms?: string[];
  products?: string[];
  productId?: number;
  productIds?: number[];
  productContext?: string;
}

export type DemandType = "suporte" | "informacoes" | "contratar" | string;

export interface CombinedSearchParams {
  productId?: number;
  productContext?: string;
  conversationContext?: string;
  problemContext?: string;
  searchQueries?: MultiQuerySearchQueries;
  limit?: number;
  demandType?: DemandType;
  summaryProductId?: number;
  summaryProductContext?: string;
}

const PRODUCT_MISMATCH_MULTIPLIER = 0.9;

interface ScoreAdjustmentParams {
  demandType?: DemandType;
  summaryProductContext?: string;
}

function getProductBaseName(productContext: string): string {
  const parts = productContext.split('>').map(p => p.trim());
  return parts[0].toLowerCase();
}

function isProductMatch(resultProductContext: string | undefined, summaryProductContext: string): boolean {
  if (!resultProductContext) return true;
  
  const resultBase = getProductBaseName(resultProductContext);
  const summaryBase = getProductBaseName(summaryProductContext);
  
  return resultBase === summaryBase;
}

function applyScoreAdjustments(
  results: CombinedSearchResult[],
  params: ScoreAdjustmentParams
): CombinedSearchResult[] {
  const { summaryProductContext } = params;

  return results.map(result => {
    const originalScore = result.matchScore || 0;
    let adjustedScore = originalScore;
    const adjustments: string[] = [];

    if (summaryProductContext) {
      let hasProductMismatch = false;
      
      if (result.source === "problem" && result.products && result.products.length > 0) {
        hasProductMismatch = !result.products.some(p => isProductMatch(p, summaryProductContext));
      }
      
      if (hasProductMismatch) {
        adjustedScore *= PRODUCT_MISMATCH_MULTIPLIER;
        adjustments.push('0.9x (Produto diferente)');
      }
    }

    return {
      ...result,
      matchScore: Math.round(adjustedScore * 100) / 100,
      matchReason: adjustments.length > 0 
        ? `${result.matchReason || ""} ${adjustments.join(' ')}`.trim()
        : result.matchReason
    };
  });
}

export interface CombinedSearchResponse {
  message: string;
  results: CombinedSearchResult[];
  productId?: number;
  problemCount: number;
}

const DEFAULT_COMBINED_LIMIT = 10;
const PER_SOURCE_FETCH_LIMIT = 10;

export async function runCombinedKnowledgeSearch(params: CombinedSearchParams): Promise<CombinedSearchResponse> {
  const { productId, conversationContext, problemContext, searchQueries, limit = DEFAULT_COMBINED_LIMIT, summaryProductContext } = params;
  
  let productContext = params.productContext;
  if (!productContext && productId) {
    productContext = await productCatalogStorage.resolveProductContext(productId);
  }

  const effectiveProblemContext = problemContext || conversationContext;

  const problemsResult = await runProblemObjectiveSearch({
    productContext,
    conversationContext: effectiveProblemContext,
    searchQueries,
    limit: PER_SOURCE_FETCH_LIMIT
  });

  const results: CombinedSearchResult[] = [];

  for (const problem of problemsResult.problems) {
    results.push({
      source: "problem",
      id: problem.id,
      question: problem.name,
      answer: problem.description || "",
      matchScore: problem.matchScore,
      matchReason: problem.matchReason,
      matchedTerms: problem.matchedTerms,
      products: problem.products,
      productIds: problem.productIds,
    });
  }

  const adjustedResults = applyScoreAdjustments(results, { summaryProductContext });
  adjustedResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  
  const limitedResults = adjustedResults.slice(0, limit);

  if (limitedResults.length === 0) {
    return {
      message: "Nenhum resultado encontrado na base de conhecimento",
      results: [],
      productId,
      problemCount: 0
    };
  }

  const problemCount = limitedResults.filter(r => r.source === "problem").length;

  return {
    message: `Retornando ${limitedResults.length} resultados (${problemCount} problemas)`,
    results: limitedResults,
    productId,
    problemCount
  };
}

export function createCombinedKnowledgeSearchTool(): ToolDefinition {
  return createCombinedKnowledgeSearchToolWithContext(undefined);
}

export function createCombinedKnowledgeSearchToolWithContext(conversationId?: number): ToolDefinition {
  return {
    name: "search_knowledge_base_articles_and_problems",
    description: "Busca problemas objetivos na base de conhecimento. Retorna resultados com indicação de origem (source: problem).",
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
        }
      },
      required: ["conversationContext", "product"]
    },
    handler: async (args: { product: string; subproduct?: string; conversationContext?: string }) => {
      const productContext = args.subproduct 
        ? `${args.product} > ${args.subproduct}`
        : args.product;
      
      console.log(`[Combined Knowledge Search Tool] Called with product="${args.product}", subproduct="${args.subproduct || 'none'}", productContext="${productContext}" (semantic, no filter)`);
      
      const result = await runCombinedKnowledgeSearch({
        productContext,
        conversationContext: args.conversationContext
      });
      
      if (conversationId && result.results.length > 0) {
        try {
          const resultsForStorage = result.results.map(r => ({
            source: r.source,
            id: r.id,
            name: r.question,
            description: r.answer || "",
            matchScore: r.matchScore,
            matchReason: r.matchReason,
            matchedTerms: r.matchedTerms,
            products: r.products,
          }));
          const saveResult = await caseDemandStorage.updateArticlesAndProblems(conversationId, resultsForStorage);
          if (saveResult.created) {
            console.log(`[Combined Knowledge Search Tool] Created case_demand with ${result.problemCount} problems for conversation ${conversationId}`);
          } else if (saveResult.updated) {
            console.log(`[Combined Knowledge Search Tool] Updated case_demand with ${result.problemCount} problems for conversation ${conversationId}`);
          }
        } catch (error) {
          console.error(`[Combined Knowledge Search Tool] Error saving results for conversation ${conversationId}:`, error);
        }
      }
      
      return JSON.stringify(result);
    }
  };
}
