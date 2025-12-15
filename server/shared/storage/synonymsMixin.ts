import { db } from "../../db.js";
import { eq, ilike, or, and, sql, asc, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";

type WithSynonyms = { synonyms: string[] };

interface SynonymsColumns {
  name: PgColumn;
  synonyms: PgColumn;
}

interface BaseCrud<T extends WithSynonyms> {
  getById(id: number): Promise<T | null>;
  update(id: number, data: Partial<T>): Promise<T | null>;
}

interface WithSynonymsMixinConfig<T extends WithSynonyms> {
  baseCrud: BaseCrud<T>;
  table: PgTable;
  columns: SynonymsColumns;
  parentIdColumn?: PgColumn;
}

export interface SynonymsMethods<T extends WithSynonyms> {
  addSynonym(id: number, synonym: string): Promise<T | null>;
  removeSynonym(id: number, synonym: string): Promise<T | null>;
  findByNameOrSynonym(searchTerm: string, parentId?: number): Promise<T[]>;
}

export function withSynonymsMixin<T extends WithSynonyms>(
  config: WithSynonymsMixinConfig<T>
): SynonymsMethods<T> {
  const { baseCrud, table, columns, parentIdColumn } = config;

  return {
    async addSynonym(id: number, synonym: string): Promise<T | null> {
      const entity = await baseCrud.getById(id);
      if (!entity) return null;

      const normalizedSynonym = synonym.trim().toLowerCase();
      if (entity.synonyms.includes(normalizedSynonym)) {
        return entity;
      }

      const updatedSynonyms = [...entity.synonyms, normalizedSynonym];
      return await baseCrud.update(id, { synonyms: updatedSynonyms } as Partial<T>);
    },

    async removeSynonym(id: number, synonym: string): Promise<T | null> {
      const entity = await baseCrud.getById(id);
      if (!entity) return null;

      const normalizedSynonym = synonym.trim().toLowerCase();
      const updatedSynonyms = entity.synonyms.filter(s => s !== normalizedSynonym);
      return await baseCrud.update(id, { synonyms: updatedSynonyms } as Partial<T>);
    },

    async findByNameOrSynonym(searchTerm: string, parentId?: number): Promise<T[]> {
      const normalizedTerm = searchTerm.trim().toLowerCase();
      const searchPattern = `%${normalizedTerm}%`;

      const conditions: SQL[] = [
        or(
          ilike(columns.name, searchPattern),
          sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(${columns.synonyms}::jsonb) AS s WHERE s ILIKE ${searchPattern})`
        )!
      ];

      if (parentId !== undefined && parentIdColumn) {
        conditions.push(eq(parentIdColumn, parentId));
      }

      return await db.select()
        .from(table)
        .where(and(...conditions))
        .orderBy(asc(columns.name)) as T[];
    },
  };
}
