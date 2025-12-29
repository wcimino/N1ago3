import { db } from "../../../../db.js";
import { sql } from "drizzle-orm";

const BATCH_SIZE = 2000;

export async function deleteArchivedRecords(
  tableName: string,
  minId: number,
  maxId: number,
  expectedCount: number,
  dateColumn: string,
  startOfHour: Date,
  endOfHour: Date,
  onProgress?: (deletedCount: number) => void
): Promise<number> {
  const remainingCountResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
      AND ${sql.identifier(dateColumn)} <= ${endOfHour}
      AND id >= ${minId}
      AND id <= ${maxId}
  `);
  const remainingCount = Number((remainingCountResult.rows[0] as any).count);

  if (remainingCount !== expectedCount) {
    console.warn(`[TableCleaner] Warning: Expected ${expectedCount} records to delete but found ${remainingCount}`);
  }

  let deletedCount = 0;
  let deleteLastId = minId - 1;

  while (deletedCount < expectedCount) {
    const deleteResult = await db.execute(sql`
      DELETE FROM ${sql.identifier(tableName)}
      WHERE id IN (
        SELECT id FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
          AND ${sql.identifier(dateColumn)} <= ${endOfHour}
          AND id > ${deleteLastId}
          AND id <= ${maxId}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `);

    const deletedRows = deleteResult.rows as any[];
    if (deletedRows.length === 0) break;

    deletedCount += deletedRows.length;
    deleteLastId = deletedRows[deletedRows.length - 1].id;
    onProgress?.(deletedRows.length);
  }

  console.log(`[TableCleaner] Deleted ${deletedCount} records from ${tableName}`);
  return deletedCount;
}

export async function deleteByIdRange(
  tableName: string,
  minId: number,
  maxId: number,
  expectedCount: number
): Promise<number> {
  let deletedCount = 0;
  let deleteLastId = minId - 1;

  while (deletedCount < expectedCount) {
    const deleteResult = await db.execute(sql`
      DELETE FROM ${sql.identifier(tableName)}
      WHERE id IN (
        SELECT id FROM ${sql.identifier(tableName)}
        WHERE id > ${deleteLastId}
          AND id <= ${maxId}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `);
    const deletedRows = deleteResult.rows as any[];
    if (deletedRows.length === 0) break;
    deletedCount += deletedRows.length;
    deleteLastId = deletedRows[deletedRows.length - 1].id;
  }

  console.log(`[TableCleaner] Cleanup complete: ${deletedCount} records deleted`);
  return deletedCount;
}

export async function deleteByTimeRange(
  tableName: string,
  dateColumn: string,
  startOfHour: Date,
  endOfHour: Date,
  onProgress?: (deletedCount: number) => void
): Promise<number> {
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
      AND ${sql.identifier(dateColumn)} <= ${endOfHour}
  `);
  const expectedCount = Number((countResult.rows[0] as any).count);

  if (expectedCount === 0) {
    console.log(`[TableCleaner] No records to delete in time range for ${tableName}`);
    return 0;
  }

  console.log(`[TableCleaner] Deleting ${expectedCount} records from ${tableName} by time range (fallback mode)`);

  let deletedCount = 0;
  let lastId = 0;

  while (deletedCount < expectedCount) {
    const deleteResult = await db.execute(sql`
      DELETE FROM ${sql.identifier(tableName)}
      WHERE id IN (
        SELECT id FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
          AND ${sql.identifier(dateColumn)} <= ${endOfHour}
          AND id > ${lastId}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `);

    const deletedRows = deleteResult.rows as any[];
    if (deletedRows.length === 0) break;

    deletedCount += deletedRows.length;
    lastId = deletedRows[deletedRows.length - 1].id;
    onProgress?.(deletedRows.length);
  }

  console.log(`[TableCleaner] Fallback delete complete: ${deletedCount} records deleted from ${tableName}`);
  return deletedCount;
}

export async function deleteArchivedRecordsByDay(
  tableName: string,
  minId: number,
  maxId: number,
  expectedCount: number,
  dateColumn: string,
  archiveDate: Date
): Promise<number> {
  const startOfDay = new Date(archiveDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(archiveDate);
  endOfDay.setHours(23, 59, 59, 999);

  const remainingCountResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${startOfDay}
      AND ${sql.identifier(dateColumn)} <= ${endOfDay}
      AND id >= ${minId}
      AND id <= ${maxId}
  `);
  const remainingCount = Number((remainingCountResult.rows[0] as any).count);

  if (remainingCount !== expectedCount) {
    console.warn(`[TableCleaner] Warning: Expected ${expectedCount} records to delete but found ${remainingCount}`);
  }

  let deletedCount = 0;
  let deleteLastId = minId - 1;

  while (deletedCount < expectedCount) {
    const deleteResult = await db.execute(sql`
      DELETE FROM ${sql.identifier(tableName)}
      WHERE id IN (
        SELECT id FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfDay}
          AND ${sql.identifier(dateColumn)} <= ${endOfDay}
          AND id > ${deleteLastId}
          AND id <= ${maxId}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `);

    const deletedRows = deleteResult.rows as any[];
    if (deletedRows.length === 0) break;

    deletedCount += deletedRows.length;
    deleteLastId = deletedRows[deletedRows.length - 1].id;
  }

  console.log(`[TableCleaner] Deleted ${deletedCount} records from ${tableName} for day`);
  return deletedCount;
}

export async function runVacuum(tableName: string): Promise<void> {
  try {
    console.log(`[TableCleaner] Running VACUUM on ${tableName}...`);
    await db.execute(sql`VACUUM ${sql.identifier(tableName)}`);
    console.log(`[TableCleaner] VACUUM completed on ${tableName}`);
  } catch (err: any) {
    console.error(`[TableCleaner] VACUUM failed on ${tableName}:`, err.message);
  }
}
