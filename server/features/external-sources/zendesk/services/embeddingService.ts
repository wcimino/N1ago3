import { embedding } from "../../../../../shared/services/openai/index.js";
import { db } from "../../../../db.js";
import { embeddingGenerationLogs } from "../../../../../shared/schema.js";

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

function stripHtmlTags(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateEmbedding(text: string): Promise<{ embedding: number[]; logId: number }> {
  const result = await embedding({
    requestType: "embedding_generation",
    input: text,
    contextType: "zendesk_article",
  });

  if (!result.success || !result.embedding) {
    throw new Error(result.error || "Failed to generate embedding");
  }

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
  const parts: string[] = [];
  
  if (article.categoryName) {
    parts.push(`Categoria: ${article.categoryName}`);
  }
  if (article.sectionName) {
    parts.push(`Seção: ${article.sectionName}`);
  }
  parts.push(`Título: ${article.title}`);
  
  const bodyText = stripHtmlTags(article.body);
  if (bodyText) {
    parts.push(`Conteúdo: ${bodyText}`);
  }

  const combinedText = parts.join("\n\n");
  return generateEmbedding(combinedText);
}

export function embeddingToString(embedding: number[]): string {
  return JSON.stringify(embedding);
}

export function stringToEmbedding(str: string): number[] {
  return JSON.parse(str);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

export interface BatchEmbeddingResult {
  success: boolean;
  processed: number;
  errors: string[];
}

export async function batchGenerateEmbeddings(
  articles: Array<{
    id: number;
    zendeskId?: string;
    title: string;
    body: string | null;
    sectionName?: string | null;
    categoryName?: string | null;
  }>,
  updateFn: (id: number, embedding: string) => Promise<void>,
  options?: { batchSize?: number; delayMs?: number }
): Promise<BatchEmbeddingResult> {
  const batchSize = options?.batchSize || 10;
  const delayMs = options?.delayMs || 100;
  
  let processed = 0;
  const errors: string[] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (article) => {
        const startTime = Date.now();
        try {
          const { embedding: embeddingVector, logId } = await generateArticleEmbedding(article);
          const embeddingStr = embeddingToString(embeddingVector);
          await updateFn(article.id, embeddingStr);
          processed++;
          
          await logEmbeddingGeneration({
            articleId: article.id,
            zendeskId: article.zendeskId,
            status: "success",
            processingTimeMs: Date.now() - startTime,
            openaiLogId: logId,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`Failed to generate embedding for article ${article.id}: ${errorMsg}`);
          errors.push(`Article ${article.id}: ${errorMsg}`);
          
          await logEmbeddingGeneration({
            articleId: article.id,
            zendeskId: article.zendeskId,
            status: "error",
            errorMessage: errorMsg,
            processingTimeMs: Date.now() - startTime,
          });
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
