import { db } from "../../../db.js";
import { knowledgeBase, knowledgeIntents, knowledgeSubjects, ifoodProducts } from "../../../../shared/schema.js";
import { eq, desc, ilike, or, and, type SQL } from "drizzle-orm";
import type { KnowledgeBaseArticle, InsertKnowledgeBaseArticle, KnowledgeIntent } from "../../../../shared/schema.js";

export interface IntentWithArticle {
  intent: {
    id: number;
    name: string;
    subjectId: number;
    subjectName: string;
    productName: string;
  };
  article: KnowledgeBaseArticle | null;
}

export const knowledgeBaseStorage = {
  async getAllArticles(filters?: {
    search?: string;
    productStandard?: string;
    subproductStandard?: string;
    category1?: string;
    category2?: string;
    intent?: string;
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
          ilike(knowledgeBase.category1, searchPattern),
          ilike(knowledgeBase.category2, searchPattern),
          ilike(knowledgeBase.intent, searchPattern),
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

    if (filters?.category1) {
      conditions.push(eq(knowledgeBase.category1, filters.category1));
    }

    if (filters?.category2) {
      conditions.push(eq(knowledgeBase.category2, filters.category2));
    }

    if (filters?.intent) {
      conditions.push(eq(knowledgeBase.intent, filters.intent));
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

  async createArticle(data: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle> {
    const [article] = await db.insert(knowledgeBase)
      .values(data)
      .returning();
    return article;
  },

  async updateArticle(id: number, data: Partial<InsertKnowledgeBaseArticle>): Promise<KnowledgeBaseArticle | null> {
    const [article] = await db.update(knowledgeBase)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, id))
      .returning();
    return article || null;
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

  async getDistinctIntents(): Promise<string[]> {
    const results = await db.selectDistinct({ intent: knowledgeBase.intent })
      .from(knowledgeBase)
      .orderBy(knowledgeBase.intent);
    return results.map(r => r.intent);
  },

  async getDistinctSubproducts(): Promise<string[]> {
    const results = await db.selectDistinct({ subproductStandard: knowledgeBase.subproductStandard })
      .from(knowledgeBase)
      .orderBy(knowledgeBase.subproductStandard);
    return results.filter(r => r.subproductStandard).map(r => r.subproductStandard!);
  },

  async getDistinctCategories1(): Promise<string[]> {
    const results = await db.selectDistinct({ category1: knowledgeBase.category1 })
      .from(knowledgeBase)
      .orderBy(knowledgeBase.category1);
    return results.filter(r => r.category1).map(r => r.category1!);
  },

  async getDistinctCategories2(): Promise<string[]> {
    const results = await db.selectDistinct({ category2: knowledgeBase.category2 })
      .from(knowledgeBase)
      .orderBy(knowledgeBase.category2);
    return results.filter(r => r.category2).map(r => r.category2!);
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
        subjectId: knowledgeSubjects.id,
        subjectName: knowledgeSubjects.name,
        productName: ifoodProducts.produto,
        subproductName: ifoodProducts.subproduto,
      })
      .from(knowledgeIntents)
      .innerJoin(knowledgeSubjects, eq(knowledgeIntents.subjectId, knowledgeSubjects.id))
      .innerJoin(ifoodProducts, eq(knowledgeSubjects.productCatalogId, ifoodProducts.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const intentsQuery = await query
      .orderBy(desc(knowledgeIntents.updatedAt))
      .limit(filters?.limit || 100);

    const results: IntentWithArticle[] = [];
    
    for (const intent of intentsQuery) {
      const [article] = await db
        .select()
        .from(knowledgeBase)
        .where(eq(knowledgeBase.intentId, intent.intentId))
        .limit(1);

      results.push({
        intent: {
          id: intent.intentId,
          name: intent.intentName,
          subjectId: intent.subjectId,
          subjectName: intent.subjectName,
          productName: intent.productName,
        },
        article: article || null,
      });
    }

    return results;
  },
};
