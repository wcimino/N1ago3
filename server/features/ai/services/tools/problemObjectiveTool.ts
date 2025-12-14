import { 
  searchObjectiveProblems, 
  searchObjectiveProblemsBySimilarity,
  hasObjectiveProblemEmbeddings,
  type ObjectiveProblemSearchResult,
  type SemanticSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { generateEmbedding } from "../../../../shared/embeddings/index.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { productCatalogStorage } from "../../../products/storage/productCatalogStorage.js";

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
  keywords?: string;
  conversationContext?: string;
  limit?: number;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function applyKeywordsBoostToProblems(
  problems: ProblemSearchResult[],
  keywordsStr: string,
  limit: number
): ProblemSearchResult[] {
  const searchTerms = keywordsStr
    .split(/\s+/)
    .filter(t => t.length >= 2);

  if (searchTerms.length === 0) {
    return problems.slice(0, limit);
  }

  const boostedProblems = problems.map(problem => {
    // Normalize problem content to match normalized keywords (accent-insensitive)
    const problemContent = normalizeText([
      problem.name,
      problem.description || "",
      ...problem.synonyms,
      ...problem.examples,
      ...problem.products
    ].join(" "));

    let keywordBoost = 0;
    const matchedKeywords: string[] = [];

    for (const term of searchTerms) {
      const normalizedTerm = normalizeText(term);
      if (problemContent.includes(normalizedTerm)) {
        keywordBoost += 5;
        matchedKeywords.push(term);
      }
    }

    const boostedScore = Math.min(100, problem.matchScore + keywordBoost);
    const matchReason = matchedKeywords.length > 0
      ? `${problem.matchReason} + keywords: ${matchedKeywords.join(", ")}`
      : problem.matchReason;

    return {
      ...problem,
      matchScore: boostedScore,
      matchReason
    };
  });

  return boostedProblems
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

export async function runProblemObjectiveSearch(params: ProblemSearchParams): Promise<ProblemSearchResponse> {
  const { productId, conversationContext, limit = 10 } = params;
  
  const hasEmbeddings = await hasObjectiveProblemEmbeddings();
  
  // Hybrid approach: conversationContext for main semantic search, keywords for boost/filter
  if (conversationContext && conversationContext.trim().length > 0 && hasEmbeddings) {
    console.log(`[ProblemObjectiveSearch] Hybrid search: using conversationContext for embedding`);
    
    const { embedding } = await generateEmbedding(conversationContext, { contextType: "query" });
    
    const semanticResults = await searchObjectiveProblemsBySimilarity({
      queryEmbedding: embedding,
      productId,
      onlyActive: true,
      limit: params.keywords ? limit * 2 : limit,
    });

    if (semanticResults.length === 0) {
      return {
        message: "Nenhum problema objetivo encontrado",
        problems: []
      };
    }

    let problems: ProblemSearchResult[] = semanticResults.map((p: SemanticSearchResult) => ({
      source: "problem" as const,
      id: p.id,
      name: p.name,
      matchScore: p.similarity,
      matchReason: `Similaridade semântica (contexto): ${p.similarity}%`,
      description: p.description,
      synonyms: p.synonyms || [],
      examples: p.examples || [],
      products: p.productNames || [],
    }));

    // Apply keywords as boost/filter if provided
    if (params.keywords && params.keywords.trim().length > 0) {
      problems = applyKeywordsBoostToProblems(problems, params.keywords, limit);
      console.log(`[ProblemObjectiveSearch] After keywords boost/filter: ${problems.length} problems`);
    }

    return {
      message: `Encontrados ${problems.length} problemas objetivos (busca híbrida)`,
      problems
    };
  }
  
  // Fallback: use keywords for semantic search (original behavior)
  if (params.keywords && hasEmbeddings) {
    console.log(`[ProblemObjectiveSearch] Semantic search (keywords): "${params.keywords}"`);
    
    const { embedding } = await generateEmbedding(params.keywords, { contextType: "query" });
    
    const semanticResults = await searchObjectiveProblemsBySimilarity({
      queryEmbedding: embedding,
      productId,
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

  // Fallback: text-based search
  const results = await searchObjectiveProblems({
    keywords: params.keywords,
    productId,
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
        conversationContext: {
          type: "string",
          description: "Resumo ou contexto da conversa para busca semântica principal (obrigatório). A busca usa o contexto para encontrar problemas semanticamente relevantes."
        },
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
          description: "Palavras-chave opcionais para filtrar/priorizar os resultados. Usado como boost sobre os resultados semânticos."
        }
      },
      required: ["conversationContext", "product"]
    },
    handler: async (args: { product: string; subproduct?: string; conversationContext?: string; keywords?: string }) => {
      const resolved = await productCatalogStorage.resolveProductId(args.product, args.subproduct);
      
      const result = await runProblemObjectiveSearch({
        productId: resolved?.id,
        conversationContext: args.conversationContext,
        keywords: args.keywords
      });
      return JSON.stringify(result);
    }
  };
}
