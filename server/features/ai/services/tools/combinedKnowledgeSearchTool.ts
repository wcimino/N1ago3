import { runKnowledgeBaseSearch } from "../knowledgeBaseSearchHelper.js";
import { 
  searchObjectiveProblems, 
  searchObjectiveProblemsBySimilarity,
  hasObjectiveProblemEmbeddings,
  type ObjectiveProblemSearchResult,
  type SemanticSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";
import { generateEmbedding } from "../../../../shared/embeddings/index.js";
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
  const limit = params.limit || 5;
  let productId: number | undefined;
  let resolvedProduct: string | null = null;
  let resolvedSubproduct: string | null = null;

  if (params.product) {
    const resolved = await productCatalogStorage.resolveProductId(params.product, params.subproduct);
    if (resolved) {
      productId = resolved.id;
      resolvedProduct = resolved.produto;
      resolvedSubproduct = resolved.subproduto;
    }
  }

  const [articlesResult, problemsResult] = await Promise.all([
    runKnowledgeBaseSearch({
      product: params.product,
      subproduct: params.subproduct,
      keywords: params.keywords,
      limit
    }),
    searchProblems(params.keywords, productId, limit)
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

  for (const problem of problemsResult) {
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
        product: resolvedProduct || params.product,
        subproduct: resolvedSubproduct || params.subproduct || null
      },
      articleCount: 0,
      problemCount: 0
    };
  }

  return {
    message: `Encontrados ${articlesResult.articles.length} artigos e ${problemsResult.length} problemas`,
    results,
    resolvedFilters: {
      product: resolvedProduct,
      subproduct: resolvedSubproduct
    },
    articleCount: articlesResult.articles.length,
    problemCount: problemsResult.length
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

interface ProblemResult {
  id: number;
  name: string;
  description: string | null;
  matchScore: number;
  matchReason: string;
  products: string[];
}

async function searchProblems(keywords: string | undefined, productId: number | undefined, limit: number = 5): Promise<ProblemResult[]> {
  const hasEmbeddings = await hasObjectiveProblemEmbeddings();
  
  if (keywords && hasEmbeddings) {
    const { embedding } = await generateEmbedding(keywords, { contextType: "query" });
    
    const semanticResults = await searchObjectiveProblemsBySimilarity({
      queryEmbedding: embedding,
      productId,
      onlyActive: true,
      limit,
    });

    return semanticResults.map((p: SemanticSearchResult) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      matchScore: p.similarity,
      matchReason: `Similaridade semântica: ${p.similarity}%`,
      products: p.productNames || [],
    }));
  }

  const results = await searchObjectiveProblems({
    keywords,
    productId,
    onlyActive: true,
    limit,
  });

  return results.map((p: ObjectiveProblemSearchResult) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    matchScore: p.matchScore,
    matchReason: p.matchReason,
    products: p.productNames || [],
  }));
}
