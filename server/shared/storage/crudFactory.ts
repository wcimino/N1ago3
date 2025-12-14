import { db } from "../../db.js";
import { eq, desc, asc } from "drizzle-orm";
import { buildFilterConditions, combineConditions, type FilterFieldConfig } from "./filterHelpers.js";
import type { BaseFilters } from "./types.js";

export interface CrudFactoryConfig<TFilters extends BaseFilters = BaseFilters> {
  table: any;
  idColumn: any;
  filterConfig?: FilterFieldConfig<TFilters>[];
  orderByColumn?: any;
  orderDirection?: "asc" | "desc";
  updatedAtKey?: string;
}

export interface CrudOperations<TSelect, TInsert, TFilters extends BaseFilters = BaseFilters> {
  getAll: (filters?: TFilters) => Promise<TSelect[]>;
  getById: (id: number) => Promise<TSelect | null>;
  create: (data: TInsert) => Promise<TSelect>;
  update: (id: number, data: Partial<TInsert>) => Promise<TSelect | null>;
  delete: (id: number) => Promise<boolean>;
}

export function createCrudStorage<
  TSelect,
  TInsert,
  TFilters extends BaseFilters = BaseFilters
>(config: CrudFactoryConfig<TFilters>): CrudOperations<TSelect, TInsert, TFilters> {
  const {
    table,
    idColumn,
    filterConfig = [],
    orderByColumn,
    orderDirection = "desc",
    updatedAtKey,
  } = config;

  const orderBy = orderByColumn
    ? orderDirection === "desc"
      ? desc(orderByColumn)
      : asc(orderByColumn)
    : undefined;

  return {
    async getAll(filters?: TFilters): Promise<TSelect[]> {
      const conditions = buildFilterConditions(filters, filterConfig);
      const whereClause = combineConditions(conditions);

      let query = db.select().from(table);

      if (whereClause) {
        query = query.where(whereClause) as any;
      }
      if (orderBy) {
        query = query.orderBy(orderBy) as any;
      }

      return (await query) as TSelect[];
    },

    async getById(id: number): Promise<TSelect | null> {
      const [result] = await db.select().from(table).where(eq(idColumn, id));
      return (result as TSelect) || null;
    },

    async create(data: TInsert): Promise<TSelect> {
      const results = await db.insert(table).values(data as any).returning() as TSelect[];
      return results[0];
    },

    async update(id: number, data: Partial<TInsert>): Promise<TSelect | null> {
      let updateData: any = { ...data };
      
      if (updatedAtKey) {
        updateData[updatedAtKey] = new Date();
      }

      const results = await db
        .update(table)
        .set(updateData)
        .where(eq(idColumn, id))
        .returning() as TSelect[];

      return results[0] || null;
    },

    async delete(id: number): Promise<boolean> {
      const result = await db.delete(table).where(eq(idColumn, id)).returning() as any[];
      return result.length > 0;
    },
  };
}
