import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import { runProblemObjectiveSearch } from "./problemObjectiveTool.js";
import { buildSearchContext } from "./searchContext.js";
import type { ToolDefinition } from "../openaiApiService.js";

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
  product: string;
  subproduct?: string;
  keywords?: string;
  limit?: number;
}

export interface CombinedSearchResponse {
  message: string;
  results: CombinedSearchResult[];
  resolvedFilters: {
    product: string | null;
    subproduct: string | null;
  };
  articleCount: number;
  problemCount: number;
}

export async function runCombinedKnowledgeSearch(params: CombinedSearchParams): Promise<CombinedSearchResponse> {
  const ctx = await buildSearchContext(params, 5);

  const [articlesResult, problemsResult] = await Promise.all([
    runKnowledgeBaseSearch({
      product: params.product,
      subproduct: params.subproduct,
      keywords: params.keywords,
      limit: ctx.limit
    }),
    runProblemObjectiveSearch({
      product: params.product,
      subproduct: params.subproduct,
      keywords: params.keywords,
      limit: ctx.limit
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
      resolvedFilters: {
        product: ctx.resolvedProduct || params.product,
        subproduct: ctx.resolvedSubproduct || params.subproduct || null
      },
      articleCount: 0,
      problemCount: 0
    };
  }

  return {
    message: `Encontrados ${articlesResult.articles.length} artigos e ${problemsResult.problems.length} problemas`,
    results,
    resolvedFilters: {
      product: ctx.resolvedProduct,
      subproduct: ctx.resolvedSubproduct
    },
    articleCount: articlesResult.articles.length,
    problemCount: problemsResult.problems.length
  };
}

export function createCombinedKnowledgeSearchTool(): ToolDefinition {
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
      const result = await runCombinedKnowledgeSearch({
        product: args.product,
        subproduct: args.subproduct,
        keywords: args.keywords,
        limit: 5
      });
      return JSON.stringify(result);
    }
  };
}
