import { db } from "../../../db.js";
import { knowledgeIntents, knowledgeSubjects, knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, asc } from "drizzle-orm";
import type { KnowledgeIntent, InsertKnowledgeIntent } from "../../../../shared/schema.js";
import { createCrudStorage, normalizeSynonymsInData, withSynonymsMixin } from "../../../shared/storage/index.js";

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

const synonymsMixin = withSynonymsMixin<KnowledgeIntent, typeof knowledgeIntents>({
  baseCrud,
  table: knowledgeIntents,
  columns: {
    name: knowledgeIntents.name,
    synonyms: knowledgeIntents.synonyms,
  },
  parentIdColumn: knowledgeIntents.subjectId,
});

export const knowledgeIntentsStorage = {
  ...baseCrud,
  ...synonymsMixin,

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
};
