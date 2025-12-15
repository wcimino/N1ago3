import { db, pool } from "../../../../db.js";
import { zendeskArticles, type ZendeskArticle, type ZendeskArticleEmbedding } from "../../../../../shared/schema.js";
import { sql } from "drizzle-orm";
import { generateZendeskContentHash } from "../../../../shared/embeddings/index.js";

export function generateContentHash(article: {
  title: string;
  body: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
}): string {
  return generateZendeskContentHash(article);
}

export async function getArticlesPendingEmbedding(limit: number = 1): Promise<ZendeskArticle[]> {
  const results = await db.execute(sql`
    SELECT a.* 
    FROM zendesk_articles a
    LEFT JOIN zendesk_article_embeddings e ON a.id = e.article_id
    WHERE e.id IS NULL 
       OR e.content_hash != md5(COALESCE(a.title, '') || COALESCE(a.body, '') || COALESCE(a.section_name, '') || COALESCE(a.category_name, ''))
    ORDER BY a.zendesk_updated_at DESC
    LIMIT ${limit}
  `);
  
  return results.rows as unknown as ZendeskArticle[];
}

export async function upsertEmbedding(params: {
  articleId: number;
  embedding: number[];
  modelUsed?: string;
  tokensUsed?: number;
  openaiLogId?: number;
}): Promise<void> {
  const embeddingString = `[${params.embedding.join(',')}]`;
  
  try {
    await pool.query(`
      INSERT INTO zendesk_article_embeddings (article_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
      SELECT 
        $1,
        md5(COALESCE(a.title, '') || COALESCE(a.body, '') || COALESCE(a.section_name, '') || COALESCE(a.category_name, '')),
        $2::vector,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      FROM zendesk_articles a
      WHERE a.id = $1
      ON CONFLICT (article_id) DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        embedding_vector = EXCLUDED.embedding_vector,
        model_used = EXCLUDED.model_used,
        tokens_used = EXCLUDED.tokens_used,
        openai_log_id = EXCLUDED.openai_log_id,
        updated_at = NOW()
      RETURNING id
    `, [
      params.articleId,
      embeddingString,
      params.modelUsed || 'text-embedding-3-small',
      params.tokensUsed || null,
      params.openaiLogId || null
    ]);
  } catch (error) {
    console.error(`[ZendeskArticles] Failed to upsert embedding for article ${params.articleId}:`, error);
    throw error;
  }
}

export async function getArticlesWithEmbedding(): Promise<Array<ZendeskArticle & { embeddingData: ZendeskArticleEmbedding }>> {
  const results = await db.execute(sql`
    SELECT 
      a.*,
      e.id as embedding_id,
      e.content_hash,
      e.model_used,
      e.tokens_used,
      e.openai_log_id,
      e.created_at as embedding_created_at,
      e.updated_at as embedding_updated_at
    FROM zendesk_articles a
    INNER JOIN zendesk_article_embeddings e ON a.id = e.article_id
  `);
  
  return results.rows as unknown as Array<ZendeskArticle & { embeddingData: ZendeskArticleEmbedding }>;
}

export async function getEmbeddingStats(): Promise<{
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
  outdated: number;
}> {
  const [result] = await db.execute(sql`
    SELECT 
      (SELECT count(*)::int FROM zendesk_articles) as total,
      (SELECT count(*)::int FROM zendesk_article_embeddings) as with_embedding,
      (SELECT count(*)::int FROM zendesk_articles a LEFT JOIN zendesk_article_embeddings e ON a.id = e.article_id WHERE e.id IS NULL) as without_embedding,
      (SELECT count(*)::int FROM zendesk_articles a INNER JOIN zendesk_article_embeddings e ON a.id = e.article_id WHERE e.content_hash != md5(COALESCE(a.title, '') || COALESCE(a.body, '') || COALESCE(a.section_name, '') || COALESCE(a.category_name, ''))) as outdated
  `).then(r => r.rows);
  
  const stats = result as any;
  return {
    total: stats?.total ?? 0,
    withEmbedding: stats?.with_embedding ?? 0,
    withoutEmbedding: stats?.without_embedding ?? 0,
    outdated: stats?.outdated ?? 0,
  };
}
