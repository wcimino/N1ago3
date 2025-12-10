import { db } from "../../../db.js";
import { knowledgeIntents, knowledgeSubjects, knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, ilike, or, and, sql, type SQL } from "drizzle-orm";
import type { KnowledgeIntent, InsertKnowledgeIntent } from "../../../../shared/schema.js";

export const knowledgeIntentsStorage = {
  async getAll(filters?: {
    search?: string;
    subjectId?: number;
  }): Promise<KnowledgeIntent[]> {
    const query = db.select()
      .from(knowledgeIntents);

    const conditions: SQL[] = [];

    if (filters?.subjectId) {
      conditions.push(eq(knowledgeIntents.subjectId, filters.subjectId));
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(ilike(knowledgeIntents.name, searchPattern));
    }

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(knowledgeIntents.updatedAt));
    }

    return await query.orderBy(desc(knowledgeIntents.updatedAt));
  },

  async getAllWithSubject(): Promise<(KnowledgeIntent & { subjectName: string | null })[]> {
    const results = await db.select({
      id: knowledgeIntents.id,
      subjectId: knowledgeIntents.subjectId,
      name: knowledgeIntents.name,
      synonyms: knowledgeIntents.synonyms,
      createdAt: knowledgeIntents.createdAt,
      updatedAt: knowledgeIntents.updatedAt,
      subjectName: knowledgeSubjects.name,
    })
      .from(knowledgeIntents)
      .leftJoin(knowledgeSubjects, eq(knowledgeIntents.subjectId, knowledgeSubjects.id))
      .orderBy(desc(knowledgeIntents.updatedAt));

    return results;
  },

  async getById(id: number): Promise<KnowledgeIntent | null> {
    const [intent] = await db.select()
      .from(knowledgeIntents)
      .where(eq(knowledgeIntents.id, id));
    return intent || null;
  },

  async getBySubjectId(subjectId: number): Promise<KnowledgeIntent[]> {
    return await db.select()
      .from(knowledgeIntents)
      .where(eq(knowledgeIntents.subjectId, subjectId))
      .orderBy(knowledgeIntents.name);
  },

  async create(data: InsertKnowledgeIntent): Promise<KnowledgeIntent> {
    const normalizedSynonyms = (data.synonyms || []).map(s => s.trim().toLowerCase());
    const [intent] = await db.insert(knowledgeIntents)
      .values({
        ...data,
        synonyms: normalizedSynonyms,
      })
      .returning();
    return intent;
  },

  async update(id: number, data: Partial<InsertKnowledgeIntent>): Promise<KnowledgeIntent | null> {
    const updateData = { ...data };
    if (updateData.synonyms) {
      updateData.synonyms = updateData.synonyms.map(s => s.trim().toLowerCase());
    }
    const [intent] = await db.update(knowledgeIntents)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeIntents.id, id))
      .returning();
    return intent || null;
  },

  async delete(id: number): Promise<boolean> {
    await db.delete(knowledgeBase)
      .where(eq(knowledgeBase.intentId, id));
    
    const result = await db.delete(knowledgeIntents)
      .where(eq(knowledgeIntents.id, id))
      .returning();
    return result.length > 0;
  },

  async addSynonym(id: number, synonym: string): Promise<KnowledgeIntent | null> {
    const intent = await this.getById(id);
    if (!intent) return null;

    const normalizedSynonym = synonym.trim().toLowerCase();
    if (intent.synonyms.includes(normalizedSynonym)) {
      return intent;
    }

    const updatedSynonyms = [...intent.synonyms, normalizedSynonym];
    return await this.update(id, { synonyms: updatedSynonyms });
  },

  async removeSynonym(id: number, synonym: string): Promise<KnowledgeIntent | null> {
    const intent = await this.getById(id);
    if (!intent) return null;

    const normalizedSynonym = synonym.trim().toLowerCase();
    const updatedSynonyms = intent.synonyms.filter(s => s !== normalizedSynonym);
    return await this.update(id, { synonyms: updatedSynonyms });
  },

  async findByNameOrSynonym(searchTerm: string, subjectId?: number): Promise<KnowledgeIntent[]> {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const searchPattern = `%${normalizedTerm}%`;
    
    const conditions: SQL[] = [
      or(
        ilike(knowledgeIntents.name, searchPattern),
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${knowledgeIntents.synonyms}::jsonb) AS s WHERE s ILIKE ${searchPattern})`
      )!
    ];
    
    if (subjectId) {
      conditions.push(eq(knowledgeIntents.subjectId, subjectId));
    }
    
    return await db.select()
      .from(knowledgeIntents)
      .where(and(...conditions))
      .orderBy(knowledgeIntents.name);
  },
};
