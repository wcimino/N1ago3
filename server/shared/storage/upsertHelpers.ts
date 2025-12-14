import { db } from "../../db.js";
import { sql } from "drizzle-orm";

export function excluded(column: any): ReturnType<typeof sql.raw> {
  const colName = column.name;
  return sql.raw(`EXCLUDED."${colName}"`);
}

export interface ColumnMapping {
  schemaKey: string;
  column: any;
}

export interface UpsertConfig {
  table: any;
  conflictColumns: any[];
  updateColumns: ColumnMapping[];
  timestampColumn?: ColumnMapping;
}

function buildUpdateSet(config: UpsertConfig): Record<string, any> {
  const updateSet: Record<string, any> = {};

  for (const { schemaKey, column } of config.updateColumns) {
    updateSet[schemaKey] = excluded(column);
  }

  if (config.timestampColumn) {
    updateSet[config.timestampColumn.schemaKey] = new Date();
  }

  return updateSet;
}

export async function upsert<TInsert, TSelect>(
  config: UpsertConfig,
  data: TInsert
): Promise<TSelect> {
  const updateSet = buildUpdateSet(config);

  const result = await db
    .insert(config.table)
    .values(data as any)
    .onConflictDoUpdate({
      target: config.conflictColumns,
      set: updateSet,
    })
    .returning() as TSelect[];

  return result[0];
}

export async function upsertMany<TInsert, TSelect>(
  config: UpsertConfig,
  data: TInsert[]
): Promise<TSelect[]> {
  if (data.length === 0) return [];

  const updateSet = buildUpdateSet(config);

  const result = await db
    .insert(config.table)
    .values(data as any)
    .onConflictDoUpdate({
      target: config.conflictColumns,
      set: updateSet,
    })
    .returning() as TSelect[];

  return result;
}

export async function upsertWithCustomSet<TInsert, TSelect>(
  table: any,
  conflictColumns: any[],
  data: TInsert,
  updateSet: Record<string, any>
): Promise<TSelect> {
  const result = await db
    .insert(table)
    .values(data as any)
    .onConflictDoUpdate({
      target: conflictColumns,
      set: updateSet,
    })
    .returning() as TSelect[];

  return result[0];
}

export async function insertOrIgnore<TInsert>(
  table: any,
  conflictColumns: any[],
  data: TInsert
): Promise<boolean> {
  const result = await db
    .insert(table)
    .values(data as any)
    .onConflictDoNothing({ target: conflictColumns })
    .returning() as any[];

  return result.length > 0;
}

export async function insertManyOrIgnore<TInsert>(
  table: any,
  conflictColumns: any[],
  data: TInsert[]
): Promise<number> {
  if (data.length === 0) return 0;

  const result = await db
    .insert(table)
    .values(data as any)
    .onConflictDoNothing({ target: conflictColumns })
    .returning() as any[];

  return result.length;
}

export function createColumnMapping(schemaKey: string, column: any): ColumnMapping {
  return { schemaKey, column };
}

export function cm(schemaKey: string, column: any): ColumnMapping {
  return { schemaKey, column };
}
