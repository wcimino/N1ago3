import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import { runProblemObjectiveSearch } from "./problemObjectiveTool.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { caseDemandStorage } from "../../storage/caseDemandStorage.js";

export interface CombinedSearchResult {
  source: "article" | "problem";
  id: number;
  question: string | null;
  answer: string | null;
  matchScore?: number;
  matchReason?: string;
  matchedTerms?: string[];
  products?: string[];
}

export type DemandType = "suporte" | "informacoes" | "contratar" | string;

export interface CombinedSearchParams {
  productId?: number;
  productContext?: string;
  keywords?: string;
  conversationContext?: string;
  articleContext?: string;
  problemContext?: string;
  limit?: number;
  demandType?: DemandType;
}

const DEMAND_TYPE_PENALTY = 0.20;

function isArticleFavoredDemandType(demandType: string): boolean {
  const normalized = demandType.toLowerCase().trim();
  return normalized === "informacoes" || 
         normalized === "contratar" || 
         normalized === "informacoes/contratar" ||
         normalized.includes("informacoes") || 
         normalized.includes("contratar");
}

function isProblemFavoredDemandType(demandType: string): boolean {
  const normalized = demandType.toLowerCase().trim();
  return normalized === "suporte" || normalized.includes("suporte");
}

function applyDemandTypeBoost(
  results: CombinedSearchResult[],
  demandType?: DemandType
): CombinedSearchResult[] {
  if (!demandType) {
    return results;
  }

  const favorArticles = isArticleFavoredDemandType(demandType);
  const favorProblems = isProblemFavoredDemandType(demandType);

  return results.map(result => {
    const originalScore = result.matchScore || 0;
    let adjustedScore = originalScore;
    let boostApplied = false;

    if (result.source === "problem") {
      if (favorProblems) {
        boostApplied = true;
      } else {
        adjustedScore = originalScore * (1 - DEMAND_TYPE_PENALTY);
      }
    } else if (result.source === "article") {
      if (favorArticles) {
        boostApplied = true;
      } else {
        adjustedScore = originalScore * (1 - DEMAND_TYPE_PENALTY);
      }
    }

    return {
      ...result,
      matchScore: adjustedScore,
      matchReason: boostApplied 
        ? result.matchReason 
        : `${result.matchReason || ""} (penalidade por tipo de demanda: ${demandType})`.trim()
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
  const { productId, keywords, conversationContext, articleContext, problemContext, limit = 5, demandType } = params;
  
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
      keywords,
      limit
    }),
    runProblemObjectiveSearch({
      productContext,
      conversationContext: effectiveProblemContext,
      keywords,
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

  const adjustedResults = applyDemandTypeBoost(results, demandType);
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
        },
        keywords: {
          type: "string",
          description: "Palavras-chave opcionais para filtrar/priorizar os resultados. Usado como boost sobre os resultados semânticos."
        }
      },
      required: ["conversationContext", "product"]
    },
    handler: async (args: { product: string; subproduct?: string; conversationContext?: string; keywords?: string }) => {
      const productContext = args.subproduct 
        ? `${args.product} > ${args.subproduct}`
        : args.product;
      
      console.log(`[Combined Knowledge Search Tool] Called with product="${args.product}", subproduct="${args.subproduct || 'none'}", productContext="${productContext}" (semantic, no filter)`);
      
      const result = await runCombinedKnowledgeSearch({
        productContext,
        conversationContext: args.conversationContext,
        keywords: args.keywords,
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
