import { generateEmbedding } from "./index.js";

export interface MultiQuerySearchQueries {
  verbatimQuery?: string;
  keywordQuery?: string;
  normalizedQuery?: string;
}

export interface SearchResultWithId {
  id: number;
  similarity: number;
  [key: string]: any;
}

export interface AggregatedSearchResult<T extends SearchResultWithId> {
  result: T;
  maxScore: number;
  queryMatches: {
    verbatim?: number;
    keyword?: number;
    normalized?: number;
  };
}

export async function generateMultiQueryEmbeddings(
  queries: MultiQuerySearchQueries,
  productContext?: string
): Promise<{
  verbatimEmbedding?: number[];
  keywordEmbedding?: number[];
  normalizedEmbedding?: number[];
  validQueries: string[];
}> {
  const embeddings: {
    verbatimEmbedding?: number[];
    keywordEmbedding?: number[];
    normalizedEmbedding?: number[];
  } = {};
  const validQueries: string[] = [];

  const enrichQuery = (query: string) => 
    productContext ? `Produto: ${productContext}. ${query}` : query;

  const embeddingPromises: Promise<void>[] = [];

  if (queries.verbatimQuery?.trim()) {
    validQueries.push("verbatim");
    embeddingPromises.push(
      generateEmbedding(enrichQuery(queries.verbatimQuery), { contextType: "query" })
        .then(result => { embeddings.verbatimEmbedding = result.embedding; })
    );
  }

  if (queries.keywordQuery?.trim()) {
    validQueries.push("keyword");
    embeddingPromises.push(
      generateEmbedding(enrichQuery(queries.keywordQuery), { contextType: "query" })
        .then(result => { embeddings.keywordEmbedding = result.embedding; })
    );
  }

  if (queries.normalizedQuery?.trim()) {
    validQueries.push("normalized");
    embeddingPromises.push(
      generateEmbedding(enrichQuery(queries.normalizedQuery), { contextType: "query" })
        .then(result => { embeddings.normalizedEmbedding = result.embedding; })
    );
  }

  await Promise.all(embeddingPromises);

  return { ...embeddings, validQueries };
}

export function aggregateMultiQueryResults<T extends SearchResultWithId>(
  verbatimResults: T[],
  keywordResults: T[],
  normalizedResults: T[],
  limit: number = 10,
  minScore: number = 50
): AggregatedSearchResult<T>[] {
  const resultMap = new Map<number, AggregatedSearchResult<T>>();

  for (const result of verbatimResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.queryMatches.verbatim = result.similarity;
      if (result.similarity > existing.maxScore) {
        existing.maxScore = result.similarity;
        existing.result = result;
      }
    } else {
      resultMap.set(result.id, {
        result,
        maxScore: result.similarity,
        queryMatches: { verbatim: result.similarity }
      });
    }
  }

  for (const result of keywordResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.queryMatches.keyword = result.similarity;
      if (result.similarity > existing.maxScore) {
        existing.maxScore = result.similarity;
        existing.result = result;
      }
    } else {
      resultMap.set(result.id, {
        result,
        maxScore: result.similarity,
        queryMatches: { keyword: result.similarity }
      });
    }
  }

  for (const result of normalizedResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.queryMatches.normalized = result.similarity;
      if (result.similarity > existing.maxScore) {
        existing.maxScore = result.similarity;
        existing.result = result;
      }
    } else {
      resultMap.set(result.id, {
        result,
        maxScore: result.similarity,
        queryMatches: { normalized: result.similarity }
      });
    }
  }

  const aggregatedResults = Array.from(resultMap.values())
    .filter(item => item.maxScore >= minScore)
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, limit);

  return aggregatedResults;
}

export function buildMatchReasonFromQueries(
  queryMatches: { verbatim?: number; keyword?: number; normalized?: number },
  maxScore: number
): string {
  const parts: string[] = [];
  
  if (queryMatches.verbatim !== undefined) {
    parts.push(`verbatim: ${queryMatches.verbatim}%`);
  }
  if (queryMatches.keyword !== undefined) {
    parts.push(`keyword: ${queryMatches.keyword}%`);
  }
  if (queryMatches.normalized !== undefined) {
    parts.push(`normalized: ${queryMatches.normalized}%`);
  }

  return `Multi-query max: ${maxScore}% (${parts.join(", ")})`;
}
