import { embedding } from "../../../shared/services/openai/index.js";
import type { 
  EmbeddableArticle, 
  EmbeddingResult, 
  BatchEmbeddingResult,
  UpsertEmbeddingParams
} from "./types.js";

export type EmbeddingContextType = "knowledge_base_article" | "zendesk_article" | "query";

export interface GenerateEmbeddingOptions {
  contextType: EmbeddingContextType;
}

export async function generateEmbedding(
  text: string, 
  options: GenerateEmbeddingOptions
): Promise<EmbeddingResult> {
  const result = await embedding({
    requestType: "embedding_generation",
    input: text,
    contextType: options.contextType,
  });

  if (!result.success || !result.embedding) {
    throw new Error(result.error || "Failed to generate embedding");
  }

  return {
    embedding: result.embedding,
    logId: result.logId,
    tokensUsed: result.tokensTotal ?? null,
  };
}

export async function generateArticleEmbedding<T extends EmbeddableArticle>(
  article: T,
  contextType: EmbeddingContextType
): Promise<EmbeddingResult> {
  const contentText = article.getContentForEmbedding();
  return generateEmbedding(contentText, { contextType });
}

export interface EnrichedQueryParams {
  keywords: string;
  produto?: string;
  subproduto?: string;
  assunto?: string;
  intencao?: string;
  situacao?: string;
  product?: string;
  subproduct?: string;
  subject?: string;
  intent?: string;
  question?: string;
  articleKeywords?: string;
}

export function buildEnrichedQueryText(params: EnrichedQueryParams): string {
  const contextParts: string[] = [];
  
  const produto = params.produto || params.product;
  const subproduto = params.subproduto || params.subproduct;
  const assunto = params.assunto || params.subject;
  const intencao = params.intencao || params.intent;
  
  if (produto) contextParts.push(produto);
  if (subproduto) contextParts.push(subproduto);
  if (assunto) contextParts.push(assunto);
  
  const contentParts: string[] = [];
  if (intencao) contentParts.push(intencao);
  if (params.situacao) contentParts.push(params.situacao);
  if (params.question) contentParts.push(params.question);
  if (params.articleKeywords) {
    contentParts.push(params.articleKeywords);
  }
  contentParts.push(params.keywords);
  
  const context = contextParts.join(" - ");
  const content = contentParts.join(". ");
  
  return context ? `${context}: ${content}` : content;
}

export async function generateEnrichedQueryEmbedding(
  params: EnrichedQueryParams,
  contextType: EmbeddingContextType = "query"
): Promise<EmbeddingResult & { formattedQuery: string }> {
  const formattedQuery = buildEnrichedQueryText(params);
  
  console.log(`[Embedding] Generating enriched query embedding:\n${formattedQuery}`);
  
  const result = await generateEmbedding(formattedQuery, { contextType });
  
  return {
    ...result,
    formattedQuery,
  };
}

export async function batchGenerateEmbeddings<T extends EmbeddableArticle>(
  articles: T[],
  contextType: EmbeddingContextType,
  updateFn: (params: UpsertEmbeddingParams) => Promise<void>,
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
          const result = await generateArticleEmbedding(article, contextType);
          const contentHash = article.getContentHash();
          
          await updateFn({
            articleId: article.id,
            contentHash,
            embedding: result.embedding,
            modelUsed: 'text-embedding-3-small',
            tokensUsed: result.tokensUsed,
            openaiLogId: result.logId,
          });
          
          processed++;
          console.log(`[Embedding] Generated embedding for article ${article.id}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[Embedding] Failed to generate embedding for article ${article.id}: ${errorMsg}`);
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
