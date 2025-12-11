import { db } from "../../../../db.js";
import { embeddingGenerationLogs } from "../../../../../shared/schema.js";
import type { ZendeskArticle } from "../../../../../shared/schema.js";
import {
  generateEmbedding as baseGenerateEmbedding,
  generateEnrichedQueryEmbedding as baseGenerateEnrichedQueryEmbedding,
  batchGenerateEmbeddings as baseBatchGenerateEmbeddings,
  type EmbeddingResult,
  type EnrichedQueryParams,
  type BatchEmbeddingResult,
  type UpsertEmbeddingParams,
} from "../../../../shared/embeddings/index.js";
import {
  ZendeskEmbeddableArticle,
  generateZendeskContentForEmbedding,
} from "../../../../shared/embeddings/adapters/zendeskAdapter.js";

export {
  embeddingToString,
  stringToEmbedding,
  cosineSimilarity,
  stripHtmlTags,
} from "../../../../shared/embeddings/types.js";

export type { EnrichedQueryParams };

let isEmbeddingProcessing = false;

export function getIsEmbeddingProcessing(): boolean {
  return isEmbeddingProcessing;
}

export function setIsEmbeddingProcessing(value: boolean): void {
  isEmbeddingProcessing = value;
}

export async function logEmbeddingGeneration(params: {
  articleId: number;
  zendeskId?: string;
  status: "success" | "error";
  errorMessage?: string;
  processingTimeMs?: number;
  openaiLogId?: number;
}): Promise<void> {
  try {
    await db.insert(embeddingGenerationLogs).values({
      articleId: params.articleId,
      zendeskId: params.zendeskId || null,
      status: params.status,
      errorMessage: params.errorMessage || null,
      processingTimeMs: params.processingTimeMs || null,
    });
  } catch (error) {
    console.error("Failed to log embedding generation:", error);
  }
}

export async function generateEmbedding(text: string): Promise<{ embedding: number[]; logId: number }> {
  const result = await baseGenerateEmbedding(text, { contextType: "zendesk_article" });
  return {
    embedding: result.embedding,
    logId: result.logId,
  };
}

export async function generateArticleEmbedding(article: {
  title: string;
  body: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
}): Promise<{ embedding: number[]; logId: number }> {
  const contentText = generateZendeskContentForEmbedding(article);
  const result = await baseGenerateEmbedding(contentText, { contextType: "zendesk_article" });
  return {
    embedding: result.embedding,
    logId: result.logId,
  };
}

export async function generateEnrichedQueryEmbedding(
  params: EnrichedQueryParams
): Promise<{ embedding: number[]; logId: number; formattedQuery: string }> {
  const result = await baseGenerateEnrichedQueryEmbedding(params, "zendesk_article");
  return {
    embedding: result.embedding,
    logId: result.logId,
    formattedQuery: result.formattedQuery,
  };
}

export async function batchGenerateEmbeddings(
  articles: ZendeskArticle[],
  updateFn: (params: UpsertEmbeddingParams) => Promise<void>,
  options?: { batchSize?: number; delayMs?: number }
): Promise<BatchEmbeddingResult> {
  const embeddableArticles = ZendeskEmbeddableArticle.fromArticles(articles);
  
  return baseBatchGenerateEmbeddings(
    embeddableArticles,
    "zendesk_article",
    updateFn,
    options
  );
}
