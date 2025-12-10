import crypto from "crypto";
import { embedding } from "../../../../shared/services/openai/index.js";
import type { KnowledgeBaseArticle } from "../../../../shared/schema.js";

export async function generateEmbedding(text: string): Promise<{ embedding: number[]; logId: number; tokensUsed: number | null }> {
  const result = await embedding({
    requestType: "embedding_generation",
    input: text,
    contextType: "knowledge_base_article",
  });

  if (!result.success || !result.embedding) {
    throw new Error(result.error || "Failed to generate embedding");
  }

  return {
    embedding: result.embedding,
    logId: result.logId,
    tokensUsed: result.tokensTotal,
  };
}

export async function generateArticleEmbedding(article: {
  productStandard: string;
  subproductStandard?: string | null;
  intent: string;
  description: string;
  resolution: string;
}): Promise<{ embedding: number[]; logId: number; tokensUsed: number | null }> {
  const parts: string[] = [];
  
  parts.push(`Produto: ${article.productStandard}`);
  
  if (article.subproductStandard) {
    parts.push(`Subproduto: ${article.subproductStandard}`);
  }
  
  parts.push(`Intenção: ${article.intent}`);
  parts.push(`Descrição: ${article.description}`);
  parts.push(`Resolução: ${article.resolution}`);

  const combinedText = parts.join("\n\n");
  return generateEmbedding(combinedText);
}

export function generateContentHash(article: {
  productStandard: string;
  subproductStandard?: string | null;
  intent: string;
  description: string;
  resolution: string;
}): string {
  const content = [
    article.productStandard || '',
    article.subproductStandard || '',
    article.intent || '',
    article.description || '',
    article.resolution || '',
  ].join('');
  return crypto.createHash('md5').update(content).digest('hex');
}

export function embeddingToString(embeddingVector: number[]): string {
  return JSON.stringify(embeddingVector);
}

export function stringToEmbedding(str: string): number[] {
  return JSON.parse(str);
}

export interface BatchEmbeddingResult {
  success: boolean;
  processed: number;
  errors: string[];
}

export async function batchGenerateEmbeddings(
  articles: KnowledgeBaseArticle[],
  updateFn: (articleId: number, embeddingStr: string, contentHash: string, logId: number, tokensUsed: number | null) => Promise<void>,
  options?: { batchSize?: number; delayMs?: number }
): Promise<BatchEmbeddingResult> {
  const batchSize = options?.batchSize || 5;
  const delayMs = options?.delayMs || 200;
  
  let processed = 0;
  const errors: string[] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (article) => {
        try {
          const { embedding: embeddingVector, logId, tokensUsed } = await generateArticleEmbedding(article);
          const embeddingStr = embeddingToString(embeddingVector);
          const contentHash = generateContentHash(article);
          await updateFn(article.id, embeddingStr, contentHash, logId, tokensUsed);
          processed++;
          console.log(`[KnowledgeBase Embedding] Generated embedding for article ${article.id}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[KnowledgeBase Embedding] Failed to generate embedding for article ${article.id}: ${errorMsg}`);
          errors.push(`Article ${article.id}: ${errorMsg}`);
        }
      })
    );

    if (i + batchSize < articles.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
  };
}
