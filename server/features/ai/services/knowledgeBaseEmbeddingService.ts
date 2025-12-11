import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";
import {
  generateEmbedding as baseGenerateEmbedding,
  batchGenerateEmbeddings as baseBatchGenerateEmbeddings,
  type EmbeddingResult,
  type BatchEmbeddingResult,
  type UpsertEmbeddingParams,
} from "../../../shared/embeddings/index.js";
import {
  KnowledgeBaseEmbeddableArticle,
  generateKBContentHash,
  generateKBContentForEmbedding,
} from "../../../shared/embeddings/adapters/knowledgeBaseAdapter.js";

export { 
  embeddingToString, 
  stringToEmbedding 
} from "../../../shared/embeddings/types.js";

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  return baseGenerateEmbedding(text, { contextType: "knowledge_base_article" });
}

export async function generateArticleEmbedding(article: {
  productStandard: string;
  subproductStandard?: string | null;
  description: string;
  resolution: string;
}): Promise<EmbeddingResult> {
  const contentText = generateKBContentForEmbedding(article);
  return baseGenerateEmbedding(contentText, { contextType: "knowledge_base_article" });
}

export function generateContentHash(article: {
  productStandard: string;
  subproductStandard?: string | null;
  description: string;
  resolution: string;
}): string {
  return generateKBContentHash(article);
}

export async function generateKBEmbedding(text: string): Promise<EmbeddingResult> {
  return baseGenerateEmbedding(text, { contextType: "knowledge_base_article" });
}

export async function batchGenerateEmbeddings(
  articles: KnowledgeBaseArticle[],
  updateFn: (articleId: number, embeddingStr: string, contentHash: string, logId: number, tokensUsed: number | null) => Promise<void>,
  options?: { batchSize?: number; delayMs?: number }
): Promise<BatchEmbeddingResult> {
  const embeddableArticles = KnowledgeBaseEmbeddableArticle.fromArticles(articles);
  
  const wrappedUpdateFn = async (params: UpsertEmbeddingParams): Promise<void> => {
    const embeddingStr = JSON.stringify(params.embedding);
    await updateFn(
      params.articleId, 
      embeddingStr, 
      params.contentHash, 
      params.openaiLogId || 0, 
      params.tokensUsed ?? null
    );
  };
  
  return baseBatchGenerateEmbeddings(
    embeddableArticles,
    "knowledge_base_article",
    wrappedUpdateFn,
    options
  );
}
