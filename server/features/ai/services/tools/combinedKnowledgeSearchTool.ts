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
  limit?: number;
}

export interface CombinedSearchResponse {
  message: string;
  results: CombinedSearchResult[];
  productId: number;
  articleCount: number;
  problemCount: number;
}

export async function runCombinedKnowledgeSearch(params: CombinedSearchParams): Promise<CombinedSearchResponse> {
  const { productId, keywords, limit = 5 } = params;

  const [articlesResult, problemsResult] = await Promise.all([
    runKnowledgeBaseSearch({
      productId,
      keywords,
      limit
    }),
    runProblemObjectiveSearch({
      productId,
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
      matchScore: article.relevanceScore,
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
        product: {
          type: "string",
          description: "Nome do produto (obrigatório). Ex: 'Cartão de Crédito', 'Conta Digital'"
        },
        subproduct: {
          type: "string",
          description: "Nome do subproduto para filtrar (ex: 'Gold', 'Platinum')"
        },
        keywords: {
          type: "string",
          description: "Palavras-chave ou descrição do problema para busca"
        }
      },
      required: ["product"]
    },
    handler: async (args: { product: string; subproduct?: string; keywords?: string }) => {
      const resolved = await productCatalogStorage.resolveProductId(args.product, args.subproduct);
      
      const result = await runCombinedKnowledgeSearch({
        productId: resolved?.id,
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
