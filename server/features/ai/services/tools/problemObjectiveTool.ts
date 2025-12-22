import { 
  searchObjectiveProblems, 
  searchObjectiveProblemsBySimilarity,
  hasObjectiveProblemEmbeddings,
  type ObjectiveProblemSearchResult,
  type SemanticSearchResult 
} from "../../../knowledge/storage/objectiveProblemsStorage.js";
import { generateEmbedding } from "../../../../shared/embeddings/index.js";
import type { ToolDefinition } from "../openaiApiService.js";
import { extractMatchedTerms } from "../../../../shared/utils/matchScoring.js";
import { 
  type MultiQuerySearchQueries,
  generateMultiQueryEmbeddings,
  aggregateMultiQueryResults,
  buildMatchReasonFromQueries,
  type SearchResultWithId
} from "../../../../shared/embeddings/multiQuerySearch.js";

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
  productIds: number[];
}

export interface ProblemSearchResponse {
  message: string;
  problems: ProblemSearchResult[];
}

export interface ProblemSearchParams {
  productContext?: string;
  keywords?: string;
  conversationContext?: string;
  searchQueries?: MultiQuerySearchQueries;
  limit?: number;
}

export async function runProblemObjectiveSearch(params: ProblemSearchParams): Promise<ProblemSearchResponse> {
  const { productContext, conversationContext, searchQueries, limit = 5 } = params;
  
  const hasEmbeddings = await hasObjectiveProblemEmbeddings();
  
  if (productContext) {
    console.log(`[ProblemObjectiveSearch] Using productContext="${productContext}"`);
  }
  
  const hasMultiQuery = searchQueries && (
    searchQueries.verbatimQuery?.trim() || 
    searchQueries.keywordQuery?.trim() || 
    searchQueries.normalizedQuery?.trim()
  );

  if (hasMultiQuery && hasEmbeddings) {
    try {
      console.log(`[ProblemObjectiveSearch] Multi-query semantic search with 3 queries`);
      
      const embeddings = await generateMultiQueryEmbeddings(searchQueries!, productContext);
      console.log(`[ProblemObjectiveSearch] Generated embeddings for queries: ${embeddings.validQueries.join(", ")}`);
      
      const searchLimit = 20;
      const searchPromises: Promise<{ type: string; results: SemanticSearchResult[] }>[] = [];
      
      if (embeddings.verbatimEmbedding) {
        searchPromises.push(
          searchObjectiveProblemsBySimilarity({ queryEmbedding: embeddings.verbatimEmbedding, onlyActive: true, limit: searchLimit })
            .then(results => ({ type: "verbatim", results }))
        );
      }
      if (embeddings.keywordEmbedding) {
        searchPromises.push(
          searchObjectiveProblemsBySimilarity({ queryEmbedding: embeddings.keywordEmbedding, onlyActive: true, limit: searchLimit })
            .then(results => ({ type: "keyword", results }))
        );
      }
      if (embeddings.normalizedEmbedding) {
        searchPromises.push(
          searchObjectiveProblemsBySimilarity({ queryEmbedding: embeddings.normalizedEmbedding, onlyActive: true, limit: searchLimit })
            .then(results => ({ type: "normalized", results }))
        );
      }
      
      const allResults = await Promise.all(searchPromises);
      
      const verbatimResults = allResults.find(r => r.type === "verbatim")?.results || [];
      const keywordResults = allResults.find(r => r.type === "keyword")?.results || [];
      const normalizedResults = allResults.find(r => r.type === "normalized")?.results || [];
      
      console.log(`[ProblemObjectiveSearch] Results - verbatim: ${verbatimResults.length}, keyword: ${keywordResults.length}, normalized: ${normalizedResults.length}`);
      
      const toSearchResult = (p: SemanticSearchResult): SearchResultWithId => ({
        id: p.id,
        similarity: p.similarity,
        name: p.name,
        description: p.description,
        synonyms: p.synonyms,
        examples: p.examples,
        productNames: p.productNames,
        productIds: p.productIds,
      });
      
      const aggregatedResults = aggregateMultiQueryResults(
        verbatimResults.map(toSearchResult),
        keywordResults.map(toSearchResult),
        normalizedResults.map(toSearchResult),
        10
      );
      
      const queryForMatching = [
        searchQueries!.verbatimQuery || "",
        searchQueries!.keywordQuery || "",
        searchQueries!.normalizedQuery || ""
      ].filter(Boolean).join(" ");
      
      const problems: ProblemSearchResult[] = aggregatedResults.map(aggResult => {
        const p = aggResult.result;
        const problemText = [
          p.name || "",
          p.description || "",
          ...(p.synonyms || []),
          ...(p.examples || [])
        ].join(" ");
        return {
          source: "problem" as const,
          id: p.id,
          name: p.name,
          matchScore: aggResult.finalScore,
          matchReason: buildMatchReasonFromQueries(aggResult.queryMatches, aggResult.finalScore, aggResult.isAmbiguous),
          matchedTerms: extractMatchedTerms(queryForMatching, problemText),
          description: p.description || null,
          synonyms: p.synonyms || [],
          examples: p.examples || [],
          products: p.productNames || [],
          productIds: p.productIds || [],
        };
      });
      
      console.log(`[ProblemObjectiveSearch] Multi-query aggregated ${problems.length} problems`);
      
      return {
        message: `Encontrados ${problems.length} problemas objetivos (busca multi-query)`,
        problems
      };
    } catch (error) {
      console.error("[ProblemObjectiveSearch] Multi-query search failed, falling back to single query:", error);
    }
  }
  
  const enrichedContext = productContext && conversationContext
    ? `Produto: ${productContext}. ${conversationContext}`
    : conversationContext;

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
        productIds: p.productIds || [],
      };
    });

    problems = problems
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

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

    let problems: ProblemSearchResult[] = semanticResults.map((p: SemanticSearchResult) => {
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
        productIds: p.productIds || [],
      };
    });

    problems = problems
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return {
      message: `Encontrados ${problems.length} problemas objetivos (busca semântica)`,
      problems
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

  let problems: ProblemSearchResult[] = results.map((p: ObjectiveProblemSearchResult) => {
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
      productIds: p.productIds || [],
    };
  });

  problems = problems
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  return {
    message: `Encontrados ${problems.length} problemas objetivos`,
    problems
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
