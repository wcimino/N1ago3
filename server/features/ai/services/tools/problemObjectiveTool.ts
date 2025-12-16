import { 
  searchObjectiveProblems, 
  searchObjectiveProblemsBySimilarity,
  hasObjectiveProblemEmbeddings,
  type ObjectiveProblemSearchResult,
  type SemanticSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { generateEmbedding } from "../../../../shared/embeddings/index.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { normalizeText, extractMatchedTerms } from "../../../../shared/utils/matchScoring.js";

export interface ProblemSearchResult {
  source: "problem";
  id: number;
  name: string;
  matchScore: number;
  matchReason: string;
  matchedTerms?: string[];
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
  productContext?: string;
  keywords?: string;
  conversationContext?: string;
  limit?: number;
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

    let keywordMultiplier = 1.0;
    const matchedKeywords: string[] = [];

    for (const term of searchTerms) {
      const normalizedTerm = normalizeText(term);
      if (problemContent.includes(normalizedTerm)) {
        keywordMultiplier *= 1.02;
        matchedKeywords.push(term);
      }
    }

    const boostedScore = Math.min(100, problem.matchScore * keywordMultiplier);
    const matchReason = matchedKeywords.length > 0
      ? `${problem.matchReason} + keywords(x${keywordMultiplier.toFixed(2)}): ${matchedKeywords.join(", ")}`
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
  const { productContext, conversationContext, limit = 5 } = params;
  
  const hasEmbeddings = await hasObjectiveProblemEmbeddings();
  
  const enrichedContext = productContext && conversationContext
    ? `Produto: ${productContext}. ${conversationContext}`
    : conversationContext;
  
  if (productContext) {
    console.log(`[ProblemObjectiveSearch] Using productContext="${productContext}"`);
  }
  
  // Hybrid approach: conversationContext for main semantic search, keywords for boost/filter
  if (enrichedContext && enrichedContext.trim().length > 0 && hasEmbeddings) {
    console.log(`[ProblemObjectiveSearch] Hybrid search: using enrichedContext for embedding`);
    
    const { embedding } = await generateEmbedding(enrichedContext, { contextType: "query" });
    
    const semanticResults = await searchObjectiveProblemsBySimilarity({
      queryEmbedding: embedding,
      onlyActive: true,
      limit: params.keywords ? limit * 2 : limit,
    });

    if (semanticResults.length === 0) {
      return {
        message: "Nenhum problema objetivo encontrado",
        problems: []
      };
    }

    let problems: ProblemSearchResult[] = semanticResults.map((p: SemanticSearchResult) => {
      const problemText = [
        p.name,
        p.description || "",
        ...(p.synonyms || []),
        ...(p.examples || [])
      ].join(" ");
      const queryForMatching = conversationContext + (params.keywords ? " " + params.keywords : "");
      return {
        source: "problem" as const,
        id: p.id,
        name: p.name,
        matchScore: p.similarity,
        matchReason: `Similaridade semântica (contexto): ${p.similarity}%`,
        matchedTerms: extractMatchedTerms(queryForMatching, problemText),
        description: p.description,
        synonyms: p.synonyms || [],
        examples: p.examples || [],
        products: p.productNames || [],
      };
    });

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
    const enrichedKeywords = productContext 
      ? `Produto: ${productContext}. ${params.keywords}`
      : params.keywords;
    console.log(`[ProblemObjectiveSearch] Semantic search (keywords): "${params.keywords}"`);
    
    const { embedding } = await generateEmbedding(enrichedKeywords, { contextType: "query" });
    
    const semanticResults = await searchObjectiveProblemsBySimilarity({
      queryEmbedding: embedding,
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
      problems: semanticResults.map((p: SemanticSearchResult) => {
        const problemText = [
          p.name,
          p.description || "",
          ...(p.synonyms || []),
          ...(p.examples || [])
        ].join(" ");
        return {
          source: "problem" as const,
          id: p.id,
          name: p.name,
          matchScore: p.similarity,
          matchReason: `Similaridade semântica: ${p.similarity}%`,
          matchedTerms: extractMatchedTerms(params.keywords || "", problemText),
          description: p.description,
          synonyms: p.synonyms || [],
          examples: p.examples || [],
          products: p.productNames || [],
        };
      })
    };
  }

  // Fallback: text-based search
  const results = await searchObjectiveProblems({
    keywords: params.keywords,
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
    problems: results.map((p: ObjectiveProblemSearchResult) => {
      const problemText = [
        p.name,
        p.description || "",
        ...(p.synonyms || []),
        ...(p.examples || [])
      ].join(" ");
      return {
        source: "problem" as const,
        id: p.id,
        name: p.name,
        matchScore: p.matchScore,
        matchReason: p.matchReason,
        matchedTerms: extractMatchedTerms(params.keywords || "", problemText),
        description: p.description,
        synonyms: p.synonyms || [],
        examples: p.examples || [],
        products: p.productNames || [],
      };
    })
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
      const productContext = args.subproduct 
        ? `${args.product} > ${args.subproduct}`
        : args.product;
      
      console.log(`[ProblemObjectiveTool] Called with product="${args.product}", subproduct="${args.subproduct || 'none'}", productContext="${productContext}"`);
      
      const result = await runProblemObjectiveSearch({
        productContext,
        conversationContext: args.conversationContext,
        keywords: args.keywords
      });
      return JSON.stringify(result);
    }
  };
}
