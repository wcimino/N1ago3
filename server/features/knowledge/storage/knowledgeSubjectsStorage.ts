import { db } from "../../../db.js";
import { knowledgeSubjects, productsCatalog, knowledgeIntents, knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, inArray, asc } from "drizzle-orm";
import type { KnowledgeSubject, InsertKnowledgeSubject } from "../../../../shared/schema.js";
import { createCrudStorage, normalizeSynonymsInData, withSynonymsMixin } from "../../../shared/storage/index.js";

interface SubjectFilters {
  search?: string;
  productCatalogId?: number;
}

const baseCrud = createCrudStorage<KnowledgeSubject, InsertKnowledgeSubject, SubjectFilters>({
  table: knowledgeSubjects,
  idColumn: knowledgeSubjects.id,
  filterConfig: [
    { filterKey: "search", column: knowledgeSubjects.name, type: "ilike" },
    { filterKey: "productCatalogId", column: knowledgeSubjects.productCatalogId, type: "eq" },
  ],
  orderByColumn: knowledgeSubjects.updatedAt,
  orderDirection: "desc",
  updatedAtKey: "updatedAt",
  hooks: {
    beforeCreate: (data) => normalizeSynonymsInData(data),
    beforeUpdate: (data) => normalizeSynonymsInData(data),
    beforeDelete: async (id) => {
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
    },
  },
});

const synonymsMixin = withSynonymsMixin<KnowledgeSubject, typeof knowledgeSubjects>({
  baseCrud,
  table: knowledgeSubjects,
  columns: {
    name: knowledgeSubjects.name,
    synonyms: knowledgeSubjects.synonyms,
  },
  parentIdColumn: knowledgeSubjects.productCatalogId,
});

export const knowledgeSubjectsStorage = {
  ...baseCrud,
  ...synonymsMixin,

  async getAllWithProduct(): Promise<(KnowledgeSubject & { productName: string | null })[]> {
    const results = await db.select({
      id: knowledgeSubjects.id,
      productCatalogId: knowledgeSubjects.productCatalogId,
      name: knowledgeSubjects.name,
      synonyms: knowledgeSubjects.synonyms,
      createdAt: knowledgeSubjects.createdAt,
      updatedAt: knowledgeSubjects.updatedAt,
      productName: productsCatalog.fullName,
    })
      .from(knowledgeSubjects)
      .leftJoin(productsCatalog, eq(knowledgeSubjects.productCatalogId, productsCatalog.id))
      .orderBy(desc(knowledgeSubjects.updatedAt));

    return results;
  },

  async getByProductCatalogId(productCatalogId: number): Promise<KnowledgeSubject[]> {
    return await db.select()
      .from(knowledgeSubjects)
      .where(eq(knowledgeSubjects.productCatalogId, productCatalogId))
      .orderBy(asc(knowledgeSubjects.name));
  },
};
