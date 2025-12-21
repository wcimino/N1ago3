import { runProblemObjectiveSearch } from "./problemObjectiveTool.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
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

