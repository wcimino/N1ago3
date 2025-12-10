import { db } from "../../../db.js";
import { knowledgeSubjects, ifoodProducts, knowledgeIntents, knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, ilike, or, and, sql, inArray, type SQL } from "drizzle-orm";
import type { KnowledgeSubject, InsertKnowledgeSubject } from "../../../../shared/schema.js";

export const knowledgeSubjectsStorage = {
  async getAll(filters?: {
    search?: string;
    productCatalogId?: number;
  }): Promise<KnowledgeSubject[]> {
    const query = db.select()
      .from(knowledgeSubjects);

    const conditions: SQL[] = [];

    if (filters?.productCatalogId) {
      conditions.push(eq(knowledgeSubjects.productCatalogId, filters.productCatalogId));
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(ilike(knowledgeSubjects.name, searchPattern));
    }

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(knowledgeSubjects.updatedAt));
    }

    return await query.orderBy(desc(knowledgeSubjects.updatedAt));
  },

  async getAllWithProduct(): Promise<(KnowledgeSubject & { productName: string | null })[]> {
    const results = await db.select({
      id: knowledgeSubjects.id,
      productCatalogId: knowledgeSubjects.productCatalogId,
      name: knowledgeSubjects.name,
      synonyms: knowledgeSubjects.synonyms,
      createdAt: knowledgeSubjects.createdAt,
      updatedAt: knowledgeSubjects.updatedAt,
      productName: ifoodProducts.fullName,
    })
      .from(knowledgeSubjects)
      .leftJoin(ifoodProducts, eq(knowledgeSubjects.productCatalogId, ifoodProducts.id))
      .orderBy(desc(knowledgeSubjects.updatedAt));

    return results;
  },

  async getById(id: number): Promise<KnowledgeSubject | null> {
    const [subject] = await db.select()
      .from(knowledgeSubjects)
      .where(eq(knowledgeSubjects.id, id));
    return subject || null;
  },

  async getByProductCatalogId(productCatalogId: number): Promise<KnowledgeSubject[]> {
    return await db.select()
      .from(knowledgeSubjects)
      .where(eq(knowledgeSubjects.productCatalogId, productCatalogId))
      .orderBy(knowledgeSubjects.name);
  },

  async create(data: InsertKnowledgeSubject): Promise<KnowledgeSubject> {
    const normalizedSynonyms = (data.synonyms || []).map(s => s.trim().toLowerCase());
    const [subject] = await db.insert(knowledgeSubjects)
      .values({
        ...data,
        synonyms: normalizedSynonyms,
      })
      .returning();
    return subject;
  },

  async update(id: number, data: Partial<InsertKnowledgeSubject>): Promise<KnowledgeSubject | null> {
    const updateData = { ...data };
    if (updateData.synonyms) {
      updateData.synonyms = updateData.synonyms.map(s => s.trim().toLowerCase());
    }
    const [subject] = await db.update(knowledgeSubjects)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSubjects.id, id))
      .returning();
    return subject || null;
  },

  async delete(id: number): Promise<boolean> {
    const intentsToDelete = await db.select({ id: knowledgeIntents.id })
      .from(knowledgeIntents)
      .where(eq(knowledgeIntents.subjectId, id));
    
    const intentIds = intentsToDelete.map(i => i.id);
    
    if (intentIds.length > 0) {
      await db.delete(knowledgeBase)
        .where(inArray(knowledgeBase.intentId, intentIds));
    }
    
    await db.delete(knowledgeBase)
      .where(eq(knowledgeBase.subjectId, id));
    
    await db.delete(knowledgeIntents)
      .where(eq(knowledgeIntents.subjectId, id));
    
    const result = await db.delete(knowledgeSubjects)
      .where(eq(knowledgeSubjects.id, id))
      .returning();
    return result.length > 0;
  },

  async addSynonym(id: number, synonym: string): Promise<KnowledgeSubject | null> {
    const subject = await this.getById(id);
    if (!subject) return null;

    const normalizedSynonym = synonym.trim().toLowerCase();
    if (subject.synonyms.includes(normalizedSynonym)) {
      return subject;
    }

    const updatedSynonyms = [...subject.synonyms, normalizedSynonym];
    return await this.update(id, { synonyms: updatedSynonyms });
  },

  async removeSynonym(id: number, synonym: string): Promise<KnowledgeSubject | null> {
    const subject = await this.getById(id);
    if (!subject) return null;

    const normalizedSynonym = synonym.trim().toLowerCase();
    const updatedSynonyms = subject.synonyms.filter(s => s !== normalizedSynonym);
    return await this.update(id, { synonyms: updatedSynonyms });
  },

  async findByNameOrSynonym(searchTerm: string, productCatalogId?: number): Promise<KnowledgeSubject[]> {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const searchPattern = `%${normalizedTerm}%`;
    
    const conditions: SQL[] = [
      or(
        ilike(knowledgeSubjects.name, searchPattern),
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${knowledgeSubjects.synonyms}::jsonb) AS s WHERE s ILIKE ${searchPattern})`
      )!
    ];
    
    if (productCatalogId) {
      conditions.push(eq(knowledgeSubjects.productCatalogId, productCatalogId));
    }
    
    return await db.select()
      .from(knowledgeSubjects)
      .where(and(...conditions))
      .orderBy(knowledgeSubjects.name);
  },
};
