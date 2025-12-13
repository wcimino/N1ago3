import { 
  searchObjectiveProblems, 
  searchObjectiveProblemsBySimilarity,
  hasObjectiveProblemEmbeddings,
  type ObjectiveProblemSearchResult,
  type SemanticSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { generateEmbedding } from "../../../../shared/embeddings/index.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { buildSearchContext } from "./searchContext.js";

export interface ProblemSearchResult {
  source: "problem";
  id: number;
  name: string;
  matchScore: number;
  matchReason: string;
  description: string | null;
  synonyms: string[];
  examples: string[];
  products: string[];
}

export interface ProblemSearchResponse {
  message: string;
  problems: ProblemSearchResult[];
}

export interface ProblemSearchParams {
  productId?: number;
  product?: string;
  subproduct?: string;
  keywords?: string;
  limit?: number;
}

export async function runProblemObjectiveSearch(params: ProblemSearchParams): Promise<ProblemSearchResponse> {
  let resolvedProductId = params.productId;
  const limit = params.limit ?? 10;
  
  if (!resolvedProductId && params.product) {
    const ctx = await buildSearchContext({ product: params.product, subproduct: params.subproduct }, limit);
    resolvedProductId = ctx.productId;
  }
  
  const hasEmbeddings = await hasObjectiveProblemEmbeddings();
  
  if (params.keywords && hasEmbeddings) {
    console.log(`[ProblemObjectiveSearch] Semantic search: "${params.keywords}"`);
    
    const { embedding } = await generateEmbedding(params.keywords, { contextType: "query" });
    
    const semanticResults = await searchObjectiveProblemsBySimilarity({
      queryEmbedding: embedding,
      productId: resolvedProductId,
      onlyActive: true,
      limit,
    });

    if (semanticResults.length === 0) {
      return {
        message: "Nenhum problema objetivo encontrado",
        problems: []
      };
    }

    return {
      message: `Encontrados ${semanticResults.length} problemas objetivos (busca semântica)`,
      problems: semanticResults.map((p: SemanticSearchResult) => ({
        source: "problem" as const,
        id: p.id,
        name: p.name,
        matchScore: p.similarity,
        matchReason: `Similaridade semântica: ${p.similarity}%`,
        description: p.description,
        synonyms: p.synonyms || [],
        examples: p.examples || [],
        products: p.productNames || [],
      }))
    };
  }

  const results = await searchObjectiveProblems({
    keywords: params.keywords,
    productId: resolvedProductId,
    onlyActive: true,
    limit,
  });

  if (results.length === 0) {
    return {
      message: "Nenhum problema objetivo encontrado",
      problems: []
    };
  }

  return {
    message: `Encontrados ${results.length} problemas objetivos`,
    problems: results.map((p: ObjectiveProblemSearchResult) => ({
      source: "problem" as const,
      id: p.id,
      name: p.name,
      matchScore: p.matchScore,
      matchReason: p.matchReason,
      description: p.description,
      synonyms: p.synonyms || [],
      examples: p.examples || [],
      products: p.productNames || [],
    }))
  };
}

export function createProblemObjectiveTool(): ToolDefinition {
  return {
    name: "search_knowledge_base_problem_objective",
    description: "Busca problemas objetivos na base de conhecimento para identificar o problema real do cliente.",
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
          description: "Descrição do problema do cliente para busca semântica"
        }
      },
      required: ["product"]
    },
    handler: async (args: { product: string; subproduct?: string; keywords?: string }) => {
      const result = await runProblemObjectiveSearch(args);
      return JSON.stringify(result);
    }
  };
}
