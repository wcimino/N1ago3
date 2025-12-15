import { db } from "../../../db.js";
import { knowledgeBase, knowledgeIntents, knowledgeSubjects, productsCatalog } from "../../../../shared/schema.js";
import { eq, desc, asc, ilike, or, and, isNull, sql, type SQL } from "drizzle-orm";
import type { KnowledgeBaseArticle, InsertKnowledgeBaseArticle } from "../../../../shared/schema.js";
import type { KnowledgeBaseArticleWithProduct } from "../../../shared/embeddings/adapters/knowledgeBaseAdapter.js";
import type { IntentWithArticle } from "./knowledgeBaseTypes.js";
import { knowledgeBaseEmbeddingsStorage } from "./knowledgeBaseEmbeddings.js";

export const knowledgeBaseArticlesCrud = {
  async getAllArticles(filters?: {
    search?: string;
    productId?: number;
    subjectId?: number;
    intentId?: number;
    limit?: number;
  }): Promise<KnowledgeBaseArticle[]> {
    const conditions: SQL[] = [];

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(knowledgeBase.question, searchPattern),
          ilike(knowledgeBase.answer, searchPattern),
          ilike(knowledgeBase.keywords, searchPattern)
        )!
      );
    }

    if (filters?.productId) {
      conditions.push(eq(knowledgeBase.productId, filters.productId));
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

  async getArticleById(id: number): Promise<KnowledgeBaseArticle | null> {
    const [article] = await db.select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id));
    return article || null;
  },

  async getArticleByIdWithProduct(id: number): Promise<KnowledgeBaseArticleWithProduct | null> {
    const results = await db.execute(sql`
      SELECT 
        a.id,
        a.question,
        a.answer,
        a.keywords,
        a.question_variation,
        COALESCE(p.full_name, '') as product_full_name
      FROM knowledge_base a
      LEFT JOIN products_catalog p ON a.product_id = p.id
      WHERE a.id = ${id}
    `);
    
    if (results.rows.length === 0) return null;
    
    const row = results.rows[0] as any;
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      keywords: row.keywords,
      questionVariation: row.question_variation || [],
      productFullName: row.product_full_name,
    };
  },

  async createArticle(data: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle> {
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
    
    knowledgeBaseEmbeddingsStorage.generateAndSaveEmbeddingAsync(article);
    
    return article;
  },

  async updateArticle(id: number, data: Partial<InsertKnowledgeBaseArticle>): Promise<KnowledgeBaseArticle | null> {
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
      knowledgeBaseEmbeddingsStorage.generateAndSaveEmbeddingAsync(article);
    }
    
    return article || null;
  },

  async deleteArticle(id: number): Promise<boolean> {
    const result = await db.delete(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .returning();
    return result.length > 0;
  },

  async getDistinctProductIds(): Promise<number[]> {
    const results = await db.selectDistinct({ productId: knowledgeBase.productId })
      .from(knowledgeBase)
      .where(sql`${knowledgeBase.productId} IS NOT NULL`)
      .orderBy(knowledgeBase.productId);
    return results.map(r => r.productId!);
  },

  async getIntentsWithArticles(filters?: {
    product?: string;
    subproduct?: string;
    limit?: number;
  }): Promise<IntentWithArticle[]> {
    const conditions: SQL[] = [];
    
    if (filters?.product) {
      conditions.push(eq(productsCatalog.produto, filters.product));
    }
    
    if (filters?.subproduct) {
      conditions.push(eq(productsCatalog.subproduto, filters.subproduct));
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
        productName: productsCatalog.produto,
        subproductName: productsCatalog.subproduto,
        articleId: knowledgeBase.id,
      })
      .from(knowledgeIntents)
      .innerJoin(knowledgeSubjects, eq(knowledgeIntents.subjectId, knowledgeSubjects.id))
      .innerJoin(productsCatalog, eq(knowledgeSubjects.productCatalogId, productsCatalog.id))
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
        productName: productsCatalog.produto,
        subproductName: productsCatalog.subproduto,
      })
      .from(knowledgeIntents)
      .innerJoin(knowledgeSubjects, eq(knowledgeIntents.subjectId, knowledgeSubjects.id))
      .innerJoin(productsCatalog, eq(knowledgeSubjects.productCatalogId, productsCatalog.id))
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
