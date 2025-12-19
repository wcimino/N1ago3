import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import { runProblemObjectiveSearch } from "./problemObjectiveTool.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { caseDemandStorage } from "../../storage/caseDemandStorage.js";
import type { MultiQuerySearchQueries } from "../../../../shared/embeddings/multiQuerySearch.js";

export interface CombinedSearchResult {
  source: "article" | "problem";
  id: number;
  question: string | null;
  answer: string | null;
  matchScore?: number;
  matchReason?: string;
  matchedTerms?: string[];
  products?: string[];
  productId?: number;
}

export type DemandType = "suporte" | "informacoes" | "contratar" | string;

export interface CombinedSearchParams {
  productId?: number;
  productContext?: string;
  conversationContext?: string;
  articleContext?: string;
  problemContext?: string;
  searchQueries?: MultiQuerySearchQueries;
  limit?: number;
  demandType?: DemandType;
  summaryProductId?: number;
}

const REQUEST_TYPE_MULTIPLIER = 0.9;
const PRODUCT_MISMATCH_MULTIPLIER = 0.9;

function isArticlePenalized(requestType: string): boolean {
  const normalized = requestType.toLowerCase().trim();
  return normalized.includes("suporte");
}

function isProblemPenalized(requestType: string): boolean {
  const normalized = requestType.toLowerCase().trim();
  return normalized.includes("informações") || 
         normalized.includes("informacoes") || 
         normalized.includes("contratar");
}

interface ScoreAdjustmentParams {
  demandType?: DemandType;
  summaryProductId?: number;
}

function applyScoreAdjustments(
  results: CombinedSearchResult[],
  params: ScoreAdjustmentParams
): CombinedSearchResult[] {
  const { demandType, summaryProductId } = params;

  return results.map(result => {
    const originalScore = result.matchScore || 0;
    let adjustedScore = originalScore;
    const adjustments: string[] = [];

    if (demandType) {
      if (result.source === "article" && isArticlePenalized(demandType)) {
        adjustedScore *= REQUEST_TYPE_MULTIPLIER;
        adjustments.push('0.9x (Quer Suporte → Artigo)');
      }
      
      if (result.source === "problem" && isProblemPenalized(demandType)) {
        adjustedScore *= REQUEST_TYPE_MULTIPLIER;
        adjustments.push('0.9x (Quer informações/contratar → Problema)');
      }
    }

    if (summaryProductId && result.productId && summaryProductId !== result.productId) {
      adjustedScore *= PRODUCT_MISMATCH_MULTIPLIER;
      adjustments.push('0.9x (Produto diferente)');
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
  articleCount: number;
  problemCount: number;
}

export async function runCombinedKnowledgeSearch(params: CombinedSearchParams): Promise<CombinedSearchResponse> {
  const { productId, conversationContext, articleContext, problemContext, searchQueries, limit = 5, demandType, summaryProductId } = params;
  
  let productContext = params.productContext;
  if (!productContext && productId) {
    productContext = await productCatalogStorage.resolveProductContext(productId);
  }

  const effectiveArticleContext = articleContext || conversationContext;
  const effectiveProblemContext = problemContext || conversationContext;

  const [articlesResult, problemsResult] = await Promise.all([
    runKnowledgeBaseSearch({
      productContext,
      conversationContext: effectiveArticleContext,
      searchQueries,
      limit
    }),
    runProblemObjectiveSearch({
      productContext,
      conversationContext: effectiveProblemContext,
      searchQueries,
      limit
    })
  ]);

  const results: CombinedSearchResult[] = [];

  for (const article of articlesResult.articles) {
    results.push({
      source: "article",
      id: article.id,
      question: article.question,
      answer: article.answer,
      matchScore: article.relevanceScore,
      matchReason: article.matchReason,
      matchedTerms: article.matchedTerms,
      productId: article.productId ?? undefined,
    });
  }

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
    });
  }

  const adjustedResults = applyScoreAdjustments(results, { demandType, summaryProductId });
  adjustedResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  if (adjustedResults.length === 0) {
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
    results: adjustedResults,
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
        conversationContext: args.conversationContext,
        limit: 5
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
            console.log(`[Combined Knowledge Search Tool] Created case_demand with ${result.articleCount} articles and ${result.problemCount} problems for conversation ${conversationId}`);
          } else if (saveResult.updated) {
            console.log(`[Combined Knowledge Search Tool] Updated case_demand with ${result.articleCount} articles and ${result.problemCount} problems for conversation ${conversationId}`);
          }
        } catch (error) {
          console.error(`[Combined Knowledge Search Tool] Error saving results for conversation ${conversationId}:`, error);
        }
      }
      
      return JSON.stringify(result);
    }
  };
}
