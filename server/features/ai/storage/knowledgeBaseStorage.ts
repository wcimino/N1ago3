import { db } from "../../../db.js";
import { knowledgeBase, knowledgeBaseEmbeddings, knowledgeIntents, knowledgeSubjects, ifoodProducts } from "../../../../shared/schema.js";
import { eq, desc, asc, ilike, or, and, isNull, sql, type SQL } from "drizzle-orm";
import type { KnowledgeBaseArticle, InsertKnowledgeBaseArticle, KnowledgeIntent, KnowledgeBaseEmbedding } from "../../../../shared/schema.js";
import { generateContentHash, generateArticleEmbedding, embeddingToString } from "../services/knowledgeBaseEmbeddingService.js";

export interface SearchArticleResult extends KnowledgeBaseArticle {
  relevanceScore: number;
}

function normalizeForFts(search: string): string {
  return search
    .toLowerCase()
    .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length >= 2)
    .join(' ');
}

export interface IntentWithArticle {
  intent: {
    id: number;
    name: string;
    synonyms: string[];
    subjectId: number;
    subjectName: string;
    subjectSynonyms: string[];
    productName: string;
    subproductName: string | null;
  };
  article: KnowledgeBaseArticle | null;
}

export const knowledgeBaseStorage = {
  async getAllArticles(filters?: {
    search?: string;
    productStandard?: string;
    subproductStandard?: string;
    subjectId?: number;
    intentId?: number;
    limit?: number;
  }): Promise<KnowledgeBaseArticle[]> {
    const conditions: SQL[] = [];

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(knowledgeBase.name, searchPattern),
          ilike(knowledgeBase.productStandard, searchPattern),
          ilike(knowledgeBase.subproductStandard, searchPattern),
          ilike(knowledgeBase.description, searchPattern),
          ilike(knowledgeBase.resolution, searchPattern)
        )!
      );
    }

    if (filters?.productStandard) {
      conditions.push(eq(knowledgeBase.productStandard, filters.productStandard));
    }

    if (filters?.subproductStandard) {
      conditions.push(eq(knowledgeBase.subproductStandard, filters.subproductStandard));
    }

    if (filters?.subjectId) {
      conditions.push(eq(knowledgeBase.subjectId, filters.subjectId));
    }

    if (filters?.intentId) {
      conditions.push(eq(knowledgeBase.intentId, filters.intentId));
    }

    let query = db.select().from(knowledgeBase);
    
    if (conditions.length > 0) {
      const baseQuery = query.where(and(...conditions)).orderBy(desc(knowledgeBase.updatedAt));
      if (filters?.limit) {
        return await baseQuery.limit(filters.limit);
      }
      return await baseQuery;
    }

    const baseQuery = query.orderBy(desc(knowledgeBase.updatedAt));
    if (filters?.limit) {
      return await baseQuery.limit(filters.limit);
    }
    return await baseQuery;
  },

  async searchArticlesWithRelevance(
    keywords: string,
    options: {
      productStandard?: string;
      subjectId?: number;
      intentId?: number;
      limit?: number;
    } = {}
  ): Promise<SearchArticleResult[]> {
    const { productStandard, subjectId, intentId, limit = 5 } = options;
    const normalizedSearch = normalizeForFts(keywords);
    
    if (!normalizedSearch.trim()) {
      return [];
    }
    
    const searchTerms = normalizedSearch.split(/\s+/).filter(t => t.length >= 2);
    
    const conditions: SQL[] = [];
    
    if (productStandard) {
      conditions.push(eq(knowledgeBase.productStandard, productStandard));
    }
    if (subjectId) {
      conditions.push(eq(knowledgeBase.subjectId, subjectId));
    }
    if (intentId) {
      conditions.push(eq(knowledgeBase.intentId, intentId));
    }
    
    const likeConditions = searchTerms.slice(0, 3).flatMap(term => [
      ilike(knowledgeBase.description, `%${term}%`),
      ilike(knowledgeBase.resolution, `%${term}%`),
      ilike(knowledgeBase.name, `%${term}%`)
    ]).filter((c): c is SQL => c !== undefined);
    
    const ftsCondition = sql`(
      to_tsvector('portuguese', 
        COALESCE(${knowledgeBase.description}, '') || ' ' || 
        COALESCE(${knowledgeBase.resolution}, '') || ' ' ||
        COALESCE(${knowledgeBase.name}, '')
      )
      @@ plainto_tsquery('portuguese', ${normalizedSearch})
      OR ${or(...likeConditions)}
    )`;
    conditions.push(ftsCondition);
    
    const whereClause = and(...conditions);
    
    const firstTerm = searchTerms[0] || '';
    
    const results = await db
      .select({
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        productStandard: knowledgeBase.productStandard,
        subproductStandard: knowledgeBase.subproductStandard,
        subjectId: knowledgeBase.subjectId,
        intentId: knowledgeBase.intentId,
        description: knowledgeBase.description,
        resolution: knowledgeBase.resolution,
        internalActions: knowledgeBase.internalActions,
        observations: knowledgeBase.observations,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
        relevanceScore: sql<number>`(
          COALESCE(
            ts_rank_cd(
              setweight(to_tsvector('portuguese', COALESCE(${knowledgeBase.description}, '')), 'A') ||
              setweight(to_tsvector('portuguese', COALESCE(${knowledgeBase.resolution}, '')), 'A') ||
              setweight(to_tsvector('portuguese', COALESCE(${knowledgeBase.name}, '')), 'B'),
              plainto_tsquery('portuguese', ${normalizedSearch})
            ), 0
          ) * 10 +
          CASE WHEN LOWER(${knowledgeBase.description}) ILIKE ${'%' + firstTerm + '%'} THEN 5 ELSE 0 END +
          CASE WHEN LOWER(${knowledgeBase.resolution}) ILIKE ${'%' + firstTerm + '%'} THEN 5 ELSE 0 END
        )`.as('relevance_score'),
      })
      .from(knowledgeBase)
      .where(whereClause)
      .orderBy(sql`relevance_score DESC`, desc(knowledgeBase.updatedAt))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      relevanceScore: Number(r.relevanceScore) || 0,
    }));
  },

  async getArticleById(id: number): Promise<KnowledgeBaseArticle | null> {
    const [article] = await db.select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id));
    return article || null;
  },

  async createArticle(data: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle> {
    // Validação: apenas 1 artigo por intenção
    if (data.intentId) {
      const existingArticle = await db.select({ id: knowledgeBase.id })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.intentId, data.intentId))
        .limit(1);
      
      if (existingArticle.length > 0) {
        throw new Error(`Já existe um artigo associado à intenção ${data.intentId}. Apenas 1 artigo por intenção é permitido.`);
      }
    }
    
    const [article] = await db.insert(knowledgeBase)
      .values(data)
      .returning();
    
    this.generateAndSaveEmbeddingAsync(article);
    
    return article;
  },

  async updateArticle(id: number, data: Partial<InsertKnowledgeBaseArticle>): Promise<KnowledgeBaseArticle | null> {
    // Validação: apenas 1 artigo por intenção (ao mudar intentId)
    if (data.intentId !== undefined && data.intentId !== null) {
      const existingArticle = await db.select({ id: knowledgeBase.id })
        .from(knowledgeBase)
        .where(and(
          eq(knowledgeBase.intentId, data.intentId),
          sql`${knowledgeBase.id} != ${id}`
        ))
        .limit(1);
      
      if (existingArticle.length > 0) {
        throw new Error(`Já existe um artigo associado à intenção ${data.intentId}. Apenas 1 artigo por intenção é permitido.`);
      }
    }
    
    const [article] = await db.update(knowledgeBase)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, id))
      .returning();
    
    if (article) {
      this.generateAndSaveEmbeddingAsync(article);
    }
    
    return article || null;
  },

  generateAndSaveEmbeddingAsync(article: KnowledgeBaseArticle): void {
    (async () => {
      try {
        console.log(`[KnowledgeBase Embedding] Generating embedding for article ${article.id}...`);
        const { embedding, logId, tokensUsed } = await generateArticleEmbedding(article);
        const contentHash = generateContentHash(article);
        
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

  async deleteArticle(id: number): Promise<boolean> {
    const result = await db.delete(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .returning();
    return result.length > 0;
  },

  async getDistinctProducts(): Promise<string[]> {
    const results = await db.selectDistinct({ productStandard: knowledgeBase.productStandard })
      .from(knowledgeBase)
      .orderBy(knowledgeBase.productStandard);
    return results.map(r => r.productStandard);
  },

  async getDistinctSubproducts(): Promise<string[]> {
    const results = await db.selectDistinct({ subproductStandard: knowledgeBase.subproductStandard })
      .from(knowledgeBase)
      .orderBy(knowledgeBase.subproductStandard);
    return results.filter(r => r.subproductStandard).map(r => r.subproductStandard!);
  },

  async getIntentsWithArticles(filters?: {
    product?: string;
    subproduct?: string;
    limit?: number;
  }): Promise<IntentWithArticle[]> {
    const conditions: SQL[] = [];
    
    if (filters?.product) {
      conditions.push(eq(ifoodProducts.produto, filters.product));
    }
    
    if (filters?.subproduct) {
      conditions.push(eq(ifoodProducts.subproduto, filters.subproduct));
    }

    let query = db
      .select({
        intentId: knowledgeIntents.id,
        intentName: knowledgeIntents.name,
        intentSynonyms: knowledgeIntents.synonyms,
        intentUpdatedAt: knowledgeIntents.updatedAt,
        subjectId: knowledgeSubjects.id,
        subjectName: knowledgeSubjects.name,
        subjectSynonyms: knowledgeSubjects.synonyms,
        productName: ifoodProducts.produto,
        subproductName: ifoodProducts.subproduto,
        articleId: knowledgeBase.id,
      })
      .from(knowledgeIntents)
      .innerJoin(knowledgeSubjects, eq(knowledgeIntents.subjectId, knowledgeSubjects.id))
      .innerJoin(ifoodProducts, eq(knowledgeSubjects.productCatalogId, ifoodProducts.id))
      .leftJoin(knowledgeBase, eq(knowledgeBase.intentId, knowledgeIntents.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const intentsQuery = await query
      .orderBy(
        desc(isNull(knowledgeBase.id)),
        asc(knowledgeIntents.updatedAt)
      )
      .limit(filters?.limit || 100);

    const results: IntentWithArticle[] = [];
    
    for (const intent of intentsQuery) {
      let article: KnowledgeBaseArticle | null = null;
      
      if (intent.articleId) {
        const [foundArticle] = await db
          .select()
          .from(knowledgeBase)
          .where(eq(knowledgeBase.id, intent.articleId))
          .limit(1);
        article = foundArticle || null;
      }

      results.push({
        intent: {
          id: intent.intentId,
          name: intent.intentName,
          synonyms: intent.intentSynonyms || [],
          subjectId: intent.subjectId,
          subjectName: intent.subjectName,
          subjectSynonyms: intent.subjectSynonyms || [],
          productName: intent.productName,
          subproductName: intent.subproductName,
        },
        article,
      });
    }

    return results;
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

  async getArticlesWithoutEmbedding(limit: number = 100): Promise<KnowledgeBaseArticle[]> {
    const results = await db.execute(sql`
      SELECT a.* 
      FROM knowledge_base a
      LEFT JOIN knowledge_base_embeddings e ON a.id = e.article_id
      WHERE e.id IS NULL
      ORDER BY a.updated_at DESC
      LIMIT ${limit}
    `);
    
    return results.rows as unknown as KnowledgeBaseArticle[];
  },

  async getArticlesWithChangedContent(limit: number = 100): Promise<KnowledgeBaseArticle[]> {
    const results = await db.execute(sql`
      SELECT a.* 
      FROM knowledge_base a
      INNER JOIN knowledge_base_embeddings e ON a.id = e.article_id
      WHERE e.content_hash != md5(
        COALESCE(a.product_standard, '') || 
        COALESCE(a.subproduct_standard, '') || 
        COALESCE(a.intent, '') || 
        COALESCE(a.description, '') || 
        COALESCE(a.resolution, '')
      )
      ORDER BY a.updated_at DESC
      LIMIT ${limit}
    `);
    
    return results.rows as unknown as KnowledgeBaseArticle[];
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
        (SELECT count(*)::int FROM knowledge_base a INNER JOIN knowledge_base_embeddings e ON a.id = e.article_id 
         WHERE e.content_hash != md5(
           COALESCE(a.product_standard, '') || 
           COALESCE(a.subproduct_standard, '') || 
           COALESCE(a.intent, '') || 
           COALESCE(a.description, '') || 
           COALESCE(a.resolution, '')
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

  async searchBySimilarity(
    queryEmbedding: number[],
    options: { 
      productStandard?: string;
      subjectId?: number;
      intentId?: number;
      limit?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const { limit = 5 } = options;
    
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    const conditions: SQL[] = [];
    conditions.push(sql`e.embedding_vector IS NOT NULL`);
    
    if (options.productStandard) {
      conditions.push(sql`a.product_standard = ${options.productStandard}`);
    }
    if (options.subjectId) {
      conditions.push(sql`a.subject_id = ${options.subjectId}`);
    }
    if (options.intentId) {
      conditions.push(sql`a.intent_id = ${options.intentId}`);
    }
    
    const whereClause = and(...conditions);
    
    const results = await db.execute(sql`
      SELECT 
        a.id,
        a.name,
        a.product_standard as "productStandard",
        a.subproduct_standard as "subproductStandard",
        a.subject_id as "subjectId",
        a.intent_id as "intentId",
        a.description,
        a.resolution,
        a.observations,
        a.created_at as "createdAt",
        a.updated_at as "updatedAt",
        ROUND((1 - (e.embedding_vector::vector <=> ${embeddingString}::vector)) * 100) as similarity
      FROM knowledge_base a
      INNER JOIN knowledge_base_embeddings e ON a.id = e.article_id
      WHERE ${whereClause}
      ORDER BY e.embedding_vector::vector <=> ${embeddingString}::vector
      LIMIT ${limit}
    `);
    
    return (results.rows as unknown as SemanticSearchResult[]).map(row => ({
      id: row.id,
      name: row.name,
      productStandard: row.productStandard,
      subproductStandard: row.subproductStandard,
      subjectId: row.subjectId,
      intentId: row.intentId,
      description: row.description,
      resolution: row.resolution,
      observations: row.observations,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      similarity: Number(row.similarity),
    }));
  },

  async hasEmbeddings(): Promise<boolean> {
    const stats = await this.getEmbeddingStats();
    return stats.withEmbedding > 0;
  },

  async getIntentWithArticleByArticleId(articleId: number): Promise<IntentWithArticle | null> {
    const article = await this.getArticleById(articleId);
    if (!article) return null;

    if (!article.intentId) {
      return null;
    }

    const result = await db
      .select({
        intentId: knowledgeIntents.id,
        intentName: knowledgeIntents.name,
        intentSynonyms: knowledgeIntents.synonyms,
        subjectId: knowledgeSubjects.id,
        subjectName: knowledgeSubjects.name,
        subjectSynonyms: knowledgeSubjects.synonyms,
        productName: ifoodProducts.produto,
        subproductName: ifoodProducts.subproduto,
      })
      .from(knowledgeIntents)
      .innerJoin(knowledgeSubjects, eq(knowledgeIntents.subjectId, knowledgeSubjects.id))
      .innerJoin(ifoodProducts, eq(knowledgeSubjects.productCatalogId, ifoodProducts.id))
      .where(eq(knowledgeIntents.id, article.intentId))
      .limit(1);

    if (result.length === 0) return null;

    const intent = result[0];
    return {
      intent: {
        id: intent.intentId,
        name: intent.intentName,
        synonyms: intent.intentSynonyms || [],
        subjectId: intent.subjectId,
        subjectName: intent.subjectName,
        subjectSynonyms: intent.subjectSynonyms || [],
        productName: intent.productName,
        subproductName: intent.subproductName,
      },
      article,
    };
  },
};

export interface SemanticSearchResult {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  subjectId: number | null;
  intentId: number | null;
  description: string;
  resolution: string;
  observations: string | null;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
}
