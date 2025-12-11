import crypto from "crypto";

export interface EmbeddableArticle {
  id: number;
  getContentForEmbedding(): string;
  getContentHash(): string;
}

export interface EmbeddingResult {
  embedding: number[];
  logId: number;
  tokensUsed: number | null;
}

export interface EmbeddingStats {
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
  outdated: number;
}

export interface UpsertEmbeddingParams {
  articleId: number;
  contentHash: string;
  embedding: number[];
  modelUsed?: string;
  tokensUsed?: number | null;
  openaiLogId?: number;
}

export interface BatchEmbeddingResult {
  success: boolean;
  processed: number;
  errors: string[];
}

export function generateContentHashFromParts(parts: (string | null | undefined)[]): string {
  const content = parts.map(p => p || '').join('');
  return crypto.createHash('md5').update(content).digest('hex');
}

export function embeddingToString(embeddingVector: number[]): string {
  return JSON.stringify(embeddingVector);
}

export function stringToEmbedding(str: string): number[] {
  return JSON.parse(str);
}

export function embeddingToVectorString(embeddingVector: number[]): string {
  return `[${embeddingVector.join(',')}]`;
}

export function stripHtmlTags(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
