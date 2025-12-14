import { db } from "../../../db.js";
import { knowledgeIntents, knowledgeSubjects, knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, ilike, or, and, sql, asc, type SQL } from "drizzle-orm";
import type { KnowledgeIntent, InsertKnowledgeIntent } from "../../../../shared/schema.js";
import { createCrudStorage, normalizeSynonymsInData } from "../../../shared/storage/index.js";

interface IntentFilters {
  search?: string;
  subjectId?: number;
}

const baseCrud = createCrudStorage<KnowledgeIntent, InsertKnowledgeIntent, IntentFilters>({
  table: knowledgeIntents,
  idColumn: knowledgeIntents.id,
  filterConfig: [
    { filterKey: "search", column: knowledgeIntents.name, type: "ilike" },
    { filterKey: "subjectId", column: knowledgeIntents.subjectId, type: "eq" },
  ],
  orderByColumn: knowledgeIntents.updatedAt,
  orderDirection: "desc",
  updatedAtKey: "updatedAt",
  hooks: {
    beforeCreate: (data) => normalizeSynonymsInData(data),
    beforeUpdate: (data) => normalizeSynonymsInData(data),
    beforeDelete: async (id) => {
      await db.delete(knowledgeBase)
        .where(eq(knowledgeBase.intentId, id));
    },
  },
});

export const knowledgeIntentsStorage = {
  ...baseCrud,

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

  async getBySubjectId(subjectId: number): Promise<KnowledgeIntent[]> {
    return await db.select()
      .from(knowledgeIntents)
      .where(eq(knowledgeIntents.subjectId, subjectId))
      .orderBy(asc(knowledgeIntents.name));
  },

  async addSynonym(id: number, synonym: string): Promise<KnowledgeIntent | null> {
    const intent = await baseCrud.getById(id);
    if (!intent) return null;

    const normalizedSynonym = synonym.trim().toLowerCase();
    if (intent.synonyms.includes(normalizedSynonym)) {
      return intent;
    }

    const updatedSynonyms = [...intent.synonyms, normalizedSynonym];
    return await baseCrud.update(id, { synonyms: updatedSynonyms });
  },

  async removeSynonym(id: number, synonym: string): Promise<KnowledgeIntent | null> {
    const intent = await baseCrud.getById(id);
    if (!intent) return null;

    const normalizedSynonym = synonym.trim().toLowerCase();
    const updatedSynonyms = intent.synonyms.filter(s => s !== normalizedSynonym);
    return await baseCrud.update(id, { synonyms: updatedSynonyms });
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
      .orderBy(asc(knowledgeIntents.name));
  },
};
