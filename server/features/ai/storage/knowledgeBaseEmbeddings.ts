import { db } from "../../../db.js";
import { knowledgeBase, knowledgeBaseEmbeddings } from "../../../../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import type { KnowledgeBaseArticle, KnowledgeBaseEmbedding } from "../../../../shared/schema.js";
import { generateContentHash, generateArticleEmbedding } from "../services/knowledgeBaseEmbeddingService.js";
import type { KnowledgeBaseArticleWithProduct } from "../../../shared/embeddings/adapters/knowledgeBaseAdapter.js";

export const knowledgeBaseEmbeddingsStorage = {
  generateAndSaveEmbeddingAsync(article: KnowledgeBaseArticle): void {
    (async () => {
      try {
        console.log(`[KnowledgeBase Embedding] Generating embedding for article ${article.id}...`);
        
        const articleWithProduct = await getArticleByIdWithProductInternal(article.id);
        if (!articleWithProduct) {
          console.error(`[KnowledgeBase Embedding] Article ${article.id} not found`);
          return;
        }
        
        const { embedding, logId, tokensUsed } = await generateArticleEmbedding(articleWithProduct);
        const contentHash = generateContentHash(articleWithProduct);
        
        await this.upsertEmbedding({
          articleId: article.id,
          contentHash,
          embedding,
          modelUsed: 'text-embedding-3-small',
          tokensUsed,
          openaiLogId: logId,
        });
        
        console.log(`[KnowledgeBase Embedding] Embedding generated and saved for article ${article.id}`);
      } catch (error) {
        console.error(`[KnowledgeBase Embedding] Failed to generate embedding for article ${article.id}:`, error);
      }
    })();
  },

  async upsertEmbedding(params: {
    articleId: number;
    contentHash: string;
    embedding: number[];
    modelUsed?: string;
    tokensUsed?: number | null;
    openaiLogId?: number;
  }): Promise<void> {
    const embeddingString = `[${params.embedding.join(',')}]`;
    
    await db.execute(sql`
      INSERT INTO knowledge_base_embeddings (article_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
      VALUES (
        ${params.articleId},
        ${params.contentHash},
        ${embeddingString}::vector,
        ${params.modelUsed || 'text-embedding-3-small'},
        ${params.tokensUsed || null},
        ${params.openaiLogId || null},
        NOW(),
        NOW()
      )
      ON CONFLICT (article_id) DO UPDATE SET
        content_hash = EXCLUDED.content_hash,
        embedding_vector = EXCLUDED.embedding_vector,
        model_used = EXCLUDED.model_used,
        tokens_used = EXCLUDED.tokens_used,
        openai_log_id = EXCLUDED.openai_log_id,
        updated_at = NOW()
    `);
  },

  async getArticlesWithoutEmbedding(limit: number = 100): Promise<KnowledgeBaseArticleWithProduct[]> {
    const results = await db.execute(sql`
      SELECT 
        a.id,
        a.question,
        a.answer,
        a.keywords,
        a.question_variation,
        a.question_normalized,
        COALESCE(p.full_name, '') as product_full_name
      FROM knowledge_base a
      LEFT JOIN products_catalog p ON a.product_id = p.id
      LEFT JOIN knowledge_base_embeddings e ON a.id = e.article_id
      WHERE e.id IS NULL
      ORDER BY a.updated_at DESC
      LIMIT ${limit}
    `);
    
    return results.rows.map((row: any) => {
      let parsedNormalized: string[] = [];
      if (row.question_normalized) {
        try {
          const parsed = JSON.parse(row.question_normalized);
          if (Array.isArray(parsed)) parsedNormalized = parsed;
        } catch { }
      }
      return {
        id: row.id,
        question: row.question,
        answer: row.answer,
        keywords: row.keywords,
        questionVariation: row.question_variation || [],
        questionNormalized: parsedNormalized,
        productFullName: row.product_full_name,
      };
    });
  },

  async getArticlesWithChangedContent(limit: number = 100): Promise<KnowledgeBaseArticleWithProduct[]> {
    const results = await db.execute(sql`
      SELECT 
        a.id,
        a.question,
        a.answer,
        a.keywords,
        a.question_variation,
        a.question_normalized,
        COALESCE(p.full_name, '') as product_full_name
      FROM knowledge_base a
      LEFT JOIN products_catalog p ON a.product_id = p.id
      INNER JOIN knowledge_base_embeddings e ON a.id = e.article_id
      WHERE e.content_hash != md5(
        COALESCE(a.question_normalized, '[]') || 
        COALESCE(a.keywords, '')
      )
      ORDER BY a.updated_at DESC
      LIMIT ${limit}
    `);
    
    return results.rows.map((row: any) => {
      let parsedNormalized: string[] = [];
      if (row.question_normalized) {
        try {
          const parsed = JSON.parse(row.question_normalized);
          if (Array.isArray(parsed)) parsedNormalized = parsed;
        } catch { }
      }
      return {
        id: row.id,
        question: row.question,
        answer: row.answer,
        keywords: row.keywords,
        questionVariation: row.question_variation || [],
        questionNormalized: parsedNormalized,
        productFullName: row.product_full_name,
      };
    });
  },

  async getEmbeddingStats(): Promise<{
    total: number;
    withEmbedding: number;
    withoutEmbedding: number;
    outdated: number;
  }> {
    const [result] = await db.execute(sql`
      SELECT 
        (SELECT count(*)::int FROM knowledge_base) as total,
        (SELECT count(*)::int FROM knowledge_base_embeddings) as with_embedding,
        (SELECT count(*)::int FROM knowledge_base a LEFT JOIN knowledge_base_embeddings e ON a.id = e.article_id WHERE e.id IS NULL) as without_embedding,
        (SELECT count(*)::int FROM knowledge_base a 
         INNER JOIN knowledge_base_embeddings e ON a.id = e.article_id 
         WHERE e.content_hash != md5(
           COALESCE(a.question_normalized, '[]') || 
           COALESCE(a.keywords, '')
         )) as outdated
    `).then(r => r.rows);
    
    const stats = result as any;
    return {
      total: stats?.total ?? 0,
      withEmbedding: stats?.with_embedding ?? 0,
      withoutEmbedding: stats?.without_embedding ?? 0,
      outdated: stats?.outdated ?? 0,
    };
  },

  async getEmbeddingByArticleId(articleId: number): Promise<KnowledgeBaseEmbedding | null> {
    const [embedding] = await db.select()
      .from(knowledgeBaseEmbeddings)
      .where(eq(knowledgeBaseEmbeddings.articleId, articleId));
    return embedding || null;
  },

  async hasEmbeddings(): Promise<boolean> {
    const stats = await this.getEmbeddingStats();
    return stats.withEmbedding > 0;
  },
};

async function getArticleByIdWithProductInternal(id: number): Promise<KnowledgeBaseArticleWithProduct | null> {
  const results = await db.execute(sql`
    SELECT 
      a.id,
      a.question,
      a.answer,
      a.keywords,
      a.question_variation,
      a.question_normalized,
      COALESCE(p.full_name, '') as product_full_name
    FROM knowledge_base a
    LEFT JOIN products_catalog p ON a.product_id = p.id
    WHERE a.id = ${id}
  `);
  
  if (results.rows.length === 0) return null;
  
  const row = results.rows[0] as any;
  let parsedNormalized: string[] = [];
  if (row.question_normalized) {
    try {
      const parsed = JSON.parse(row.question_normalized);
      if (Array.isArray(parsed)) parsedNormalized = parsed;
    } catch { }
  }
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    keywords: row.keywords,
    questionVariation: row.question_variation || [],
    questionNormalized: parsedNormalized,
    productFullName: row.product_full_name,
  };
}
