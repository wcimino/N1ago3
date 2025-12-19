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
  finalScore: number;
  isAmbiguous: boolean;
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

  const embeddingPromises: Promise<void>[] = [];

  if (queries.verbatimQuery?.trim()) {
    validQueries.push("verbatim");
    embeddingPromises.push(
      generateEmbedding(queries.verbatimQuery, { contextType: "query" })
        .then(result => { embeddings.verbatimEmbedding = result.embedding; })
    );
  }

  if (queries.keywordQuery?.trim()) {
    validQueries.push("keyword");
    embeddingPromises.push(
      generateEmbedding(queries.keywordQuery, { contextType: "query" })
        .then(result => { embeddings.keywordEmbedding = result.embedding; })
    );
  }

  if (queries.normalizedQuery?.trim()) {
    validQueries.push("normalized");
    embeddingPromises.push(
      generateEmbedding(queries.normalizedQuery, { contextType: "query" })
        .then(result => { embeddings.normalizedEmbedding = result.embedding; })
    );
  }

  await Promise.all(embeddingPromises);

  return { ...embeddings, validQueries };
}

const WEIGHT_VERBATIM = 0.35;
const WEIGHT_KEYWORD = 0.35;
const WEIGHT_NORMALIZED = 0.30;
const INCONSISTENCY_PENALTY_LAMBDA = 0.15;
const MIN_PER_QUERY_THRESHOLD = 48;
const MAX_GAP_THRESHOLD = 18;

function calculateConsistencyAwareScore(
  queryMatches: { verbatim?: number; keyword?: number; normalized?: number }
): { finalScore: number; isAmbiguous: boolean; maxScore: number } {
  const scores: number[] = [];
  
  if (queryMatches.verbatim !== undefined) scores.push(queryMatches.verbatim);
  if (queryMatches.keyword !== undefined) scores.push(queryMatches.keyword);
  if (queryMatches.normalized !== undefined) scores.push(queryMatches.normalized);
  
  if (scores.length === 0) {
    return { finalScore: 0, isAmbiguous: true, maxScore: 0 };
  }
  
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const gap = maxScore - minScore;
  
  const sV = (queryMatches.verbatim ?? 0) / 100;
  const sK = (queryMatches.keyword ?? 0) / 100;
  const sN = (queryMatches.normalized ?? 0) / 100;
  
  const base = WEIGHT_VERBATIM * sV + WEIGHT_KEYWORD * sK + WEIGHT_NORMALIZED * sN;
  const penalty = INCONSISTENCY_PENALTY_LAMBDA * (gap / 100);
  const finalScore = Math.round((base - penalty) * 100);
  
  const isAmbiguous = minScore < MIN_PER_QUERY_THRESHOLD && gap > MAX_GAP_THRESHOLD;
  
  return { finalScore: Math.max(0, finalScore), isAmbiguous, maxScore };
}

export function aggregateMultiQueryResults<T extends SearchResultWithId>(
  verbatimResults: T[],
  keywordResults: T[],
  normalizedResults: T[],
  limit: number = 10,
  minScore: number = 50
): AggregatedSearchResult<T>[] {
  const resultMap = new Map<number, { result: T; bestSimilarity: number; queryMatches: { verbatim?: number; keyword?: number; normalized?: number } }>();

  for (const result of verbatimResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.queryMatches.verbatim = result.similarity;
      if (result.similarity > existing.bestSimilarity) {
        existing.bestSimilarity = result.similarity;
        existing.result = result;
      }
    } else {
      resultMap.set(result.id, {
        result,
        bestSimilarity: result.similarity,
        queryMatches: { verbatim: result.similarity }
      });
    }
  }

  for (const result of keywordResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.queryMatches.keyword = result.similarity;
      if (result.similarity > existing.bestSimilarity) {
        existing.bestSimilarity = result.similarity;
        existing.result = result;
      }
    } else {
      resultMap.set(result.id, {
        result,
        bestSimilarity: result.similarity,
        queryMatches: { keyword: result.similarity }
      });
    }
  }

  for (const result of normalizedResults) {
    const existing = resultMap.get(result.id);
    if (existing) {
      existing.queryMatches.normalized = result.similarity;
      if (result.similarity > existing.bestSimilarity) {
        existing.bestSimilarity = result.similarity;
        existing.result = result;
      }
    } else {
      resultMap.set(result.id, {
        result,
        bestSimilarity: result.similarity,
        queryMatches: { normalized: result.similarity }
      });
    }
  }

  const aggregatedResults: AggregatedSearchResult<T>[] = [];
  
  for (const { result, queryMatches } of resultMap.values()) {
    const { finalScore, isAmbiguous, maxScore } = calculateConsistencyAwareScore(queryMatches);
    
    if (finalScore >= minScore) {
      aggregatedResults.push({
        result,
        maxScore,
        finalScore,
        isAmbiguous,
        queryMatches
      });
    }
  }

  aggregatedResults.sort((a, b) => b.finalScore - a.finalScore);

  return aggregatedResults.slice(0, limit);
}

export function buildMatchReasonFromQueries(
  queryMatches: { verbatim?: number; keyword?: number; normalized?: number },
  finalScore: number,
  isAmbiguous: boolean = false
): string {
  const parts: string[] = [];
  
  if (queryMatches.verbatim !== undefined) {
    parts.push(`V:${queryMatches.verbatim}%`);
  }
  if (queryMatches.keyword !== undefined) {
    parts.push(`K:${queryMatches.keyword}%`);
  }
  if (queryMatches.normalized !== undefined) {
    parts.push(`N:${queryMatches.normalized}%`);
  }

  const ambiguousFlag = isAmbiguous ? " [AMBIGUOUS]" : "";
  return `Score: ${finalScore}% (${parts.join(", ")})${ambiguousFlag}`;
}
