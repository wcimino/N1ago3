import { embedding } from "../../../../../shared/services/openai/index.js";
import { db } from "../../../../db.js";
import { embeddingGenerationLogs } from "../../../../../shared/schema.js";

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

export interface EnrichedQueryParams {
  keywords: string;
  produto?: string;
  subproduto?: string;
  assunto?: string;
  intencao?: string;
  situacao?: string;
}

export async function generateEnrichedQueryEmbedding(params: EnrichedQueryParams): Promise<{ embedding: number[]; logId: number; formattedQuery: string }> {
  const contextParts: string[] = [];
  
  if (params.produto) {
    contextParts.push(params.produto);
  }
  if (params.subproduto) {
    contextParts.push(params.subproduto);
  }
  if (params.assunto) {
    contextParts.push(params.assunto);
  }
  
  const contentParts: string[] = [];
  if (params.intencao) {
    contentParts.push(params.intencao);
  }
  if (params.situacao) {
    contentParts.push(params.situacao);
  }
  contentParts.push(params.keywords);
  
  const context = contextParts.join(" - ");
  const content = contentParts.join(". ");
  const formattedQuery = context ? `${context}: ${content}` : content;
  
  console.log(`[Embedding] Generating natural query embedding:\n${formattedQuery}`);
  
  const result = await generateEmbedding(formattedQuery);
  
  return {
    ...result,
    formattedQuery,
  };
}

