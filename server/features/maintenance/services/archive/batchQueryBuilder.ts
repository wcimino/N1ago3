import { db } from "../../../../db.js";
import { sql } from "drizzle-orm";

const BATCH_SIZE = 2000;

export interface TimeRange {
  start: Date;
  end: Date;
}

export function createDayRange(date: Date): TimeRange {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function createHourRange(date: Date, hour: number): TimeRange {
  const start = new Date(date);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(hour, 59, 59, 999);
  return { start, end };
}

export async function countRecordsInRange(
  tableName: string,
  dateColumn: string,
  range: TimeRange
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${range.start}
      AND ${sql.identifier(dateColumn)} <= ${range.end}
  `);
  return Number((result.rows[0] as any).count);
}

export interface BatchResult<T> {
  rows: T[];
  lastId: number;
  hasMore: boolean;
}

export async function fetchBatch<T = Record<string, unknown>>(
  tableName: string,
  dateColumn: string,
  range: TimeRange,
  lastId: number,
  batchSize: number = BATCH_SIZE
): Promise<BatchResult<T>> {
  const result = await db.execute(sql`
    SELECT *
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${range.start}
      AND ${sql.identifier(dateColumn)} <= ${range.end}
      AND id > ${lastId}
    ORDER BY id ASC
    LIMIT ${batchSize}
  `);

  const rows = result.rows as T[];
  const newLastId = rows.length > 0 ? (rows[rows.length - 1] as any).id : lastId;

  return {
    rows,
    lastId: newLastId,
    hasMore: rows.length === batchSize,
  };
}

export async function* iterateBatches<T = Record<string, unknown>>(
  tableName: string,
  dateColumn: string,
  range: TimeRange,
  batchSize: number = BATCH_SIZE
): AsyncGenerator<T[], void, unknown> {
  let lastId = 0;

  while (true) {
    const batch = await fetchBatch<T>(tableName, dateColumn, range, lastId, batchSize);

    if (batch.rows.length === 0) {
      break;
    }

    yield batch.rows;
    lastId = batch.lastId;

    if (!batch.hasMore) {
      break;
    }
  }
}

export async function deleteRecordsByIdRange(
  tableName: string,
  minId: number,
  maxId: number
): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM ${sql.identifier(tableName)}
    WHERE id >= ${minId} AND id <= ${maxId}
  `);
  return result.rowCount || 0;
}
