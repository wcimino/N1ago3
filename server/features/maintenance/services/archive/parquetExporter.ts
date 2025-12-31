import parquet from "parquetjs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { getParquetSchema, getSchemaFields, serializeValue } from "./schemaRegistry.js";
import {
  buildStoragePath,
  checkExistingFile,
  deleteFileIfInvalid,
  uploadWithVerification,
  getEnvironmentPrefix,
} from "./storageUploader.js";
import {
  createDayRange,
  createHourRange,
  countRecordsInRange,
  iterateBatches,
} from "./batchQueryBuilder.js";

export { getParquetSchema, getEnvironmentPrefix };

export interface ExportResult {
  archived: number;
  deleted: number;
  filePath: string | null;
  fileSize: number | null;
  minId: number;
  maxId: number;
}

export interface DayExportResult {
  archived: number;
  filePath: string;
  fileSize: number;
  minId: number;
  maxId: number;
}

export type ExportOutcome =
  | { status: "empty" }
  | { status: "existing"; archived: number; filePath: string; fileSize: number; minId: number; maxId: number }
  | { status: "exported"; archived: number; filePath: string; fileSize: number; minId: number; maxId: number };

interface WriterState {
  recordsWritten: number;
  minId: number;
  maxId: number;
}

async function writeRecordsToParquet(
  writer: parquet.ParquetWriter,
  tableName: string,
  dateColumn: string,
  range: { start: Date; end: Date },
  onProgress?: (recordsWritten: number) => void
): Promise<WriterState> {
  const fields = getSchemaFields(tableName);
  let recordsWritten = 0;
  let minId = Number.MAX_SAFE_INTEGER;
  let maxId = 0;

  for await (const batch of iterateBatches(tableName, dateColumn, range)) {
    for (const record of batch as any[]) {
      const row: Record<string, unknown> = {};
      for (const field of fields) {
        row[field] = serializeValue(record[field]);
      }
      await writer.appendRow(row);
      recordsWritten++;

      if (record.id < minId) minId = record.id;
      if (record.id > maxId) maxId = record.id;
    }

    onProgress?.(batch.length);
  }

  return { recordsWritten, minId, maxId };
}

async function withTempFile<T>(
  prefix: string,
  fn: (tempFilePath: string) => Promise<T>
): Promise<T> {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `${prefix}_${Date.now()}.parquet`);

  try {
    return await fn(tempFilePath);
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      console.error("[ParquetExporter] Failed to delete temp file:", e);
    }
  }
}

export async function exportDayToParquet(
  tableName: string,
  archiveDate: Date,
  dateColumn: string
): Promise<DayExportResult | null> {
  const range = createDayRange(archiveDate);
  const totalRecords = await countRecordsInRange(tableName, dateColumn, range);

  if (totalRecords === 0) {
    const dateStr = archiveDate.toISOString().split("T")[0];
    console.log(`[ParquetExporter] No records to export for ${tableName} on ${dateStr}`);
    return null;
  }

  const dateStr = archiveDate.toISOString().split("T")[0];
  const storageFileName = buildStoragePath(tableName, dateStr);

  const existing = await checkExistingFile(storageFileName);
  if (existing) {
    console.log(`[ParquetExporter] File already exists: ${storageFileName}`);
    return {
      archived: existing.recordCount,
      filePath: storageFileName,
      fileSize: existing.fileSize,
      minId: existing.minId,
      maxId: existing.maxId,
    };
  }

  await deleteFileIfInvalid(storageFileName);

  return withTempFile(`archive_${tableName}_${dateStr}_day`, async (tempFilePath) => {
    const schema = getParquetSchema(tableName);
    const writer = await parquet.ParquetWriter.openFile(schema, tempFilePath);

    const { recordsWritten, minId, maxId } = await writeRecordsToParquet(
      writer,
      tableName,
      dateColumn,
      range
    );

    await writer.close();

    if (recordsWritten === 0) {
      return null;
    }

    const fileSize = await uploadWithVerification(tempFilePath, storageFileName, {
      tableName,
      archiveDate: dateStr,
      recordCount: recordsWritten,
      minId,
      maxId,
    });

    console.log(`[ParquetExporter] Exported ${storageFileName}: ${recordsWritten} records`);

    return {
      archived: recordsWritten,
      filePath: storageFileName,
      fileSize,
      minId,
      maxId,
    };
  });
}

export async function exportHourToParquet(
  tableName: string,
  archiveDate: Date,
  hour: number,
  dateColumn: string,
  onProgress?: (recordsWritten: number) => void
): Promise<ExportResult | null> {
  const range = createHourRange(archiveDate, hour);
  const totalRecords = await countRecordsInRange(tableName, dateColumn, range);

  if (totalRecords === 0) {
    return null;
  }

  const dateStr = archiveDate.toISOString().split("T")[0];
  const hourStr = hour.toString().padStart(2, "0");
  const storageFileName = buildStoragePath(tableName, dateStr, hourStr);

  const existing = await checkExistingFile(storageFileName);
  if (existing) {
    console.log(`[ParquetExporter] File already exists: ${storageFileName}`);
    return {
      archived: existing.recordCount,
      deleted: 0,
      filePath: storageFileName,
      fileSize: existing.fileSize,
      minId: existing.minId,
      maxId: existing.maxId,
    };
  }

  await deleteFileIfInvalid(storageFileName);

  return withTempFile(`archive_${tableName}_${dateStr}_${hourStr}`, async (tempFilePath) => {
    const schema = getParquetSchema(tableName);
    const writer = await parquet.ParquetWriter.openFile(schema, tempFilePath);

    const { recordsWritten, minId, maxId } = await writeRecordsToParquet(
      writer,
      tableName,
      dateColumn,
      range,
      onProgress
    );

    await writer.close();

    if (recordsWritten === 0) {
      return null;
    }

    const fileSize = await uploadWithVerification(tempFilePath, storageFileName, {
      tableName,
      archiveDate: dateStr,
      hour: hourStr,
      recordCount: recordsWritten,
      minId,
      maxId,
    });

    console.log(`[ParquetExporter] Exported ${storageFileName}: ${recordsWritten} records`);

    return {
      archived: recordsWritten,
      deleted: 0,
      filePath: storageFileName,
      fileSize,
      minId,
      maxId,
    };
  });
}

export async function exportHourWithOutcome(
  tableName: string,
  archiveDate: Date,
  hour: number,
  dateColumn: string
): Promise<ExportOutcome> {
  const range = createHourRange(archiveDate, hour);
  const totalRecords = await countRecordsInRange(tableName, dateColumn, range);

  if (totalRecords === 0) {
    return { status: "empty" };
  }

  const dateStr = archiveDate.toISOString().split("T")[0];
  const hourStr = hour.toString().padStart(2, "0");
  const storageFileName = buildStoragePath(tableName, dateStr, hourStr);

  const existing = await checkExistingFile(storageFileName);
  if (existing) {
    return {
      status: "existing",
      archived: existing.recordCount,
      filePath: storageFileName,
      fileSize: existing.fileSize,
      minId: existing.minId,
      maxId: existing.maxId,
    };
  }

  await deleteFileIfInvalid(storageFileName);

  return withTempFile(`archive_${tableName}_${dateStr}_${hourStr}`, async (tempFilePath) => {
    const schema = getParquetSchema(tableName);
    const writer = await parquet.ParquetWriter.openFile(schema, tempFilePath);

    const { recordsWritten, minId, maxId } = await writeRecordsToParquet(
      writer,
      tableName,
      dateColumn,
      range
    );

    await writer.close();

    if (recordsWritten === 0) {
      return { status: "empty" as const };
    }

    const fileSize = await uploadWithVerification(tempFilePath, storageFileName, {
      tableName,
      archiveDate: dateStr,
      hour: hourStr,
      recordCount: recordsWritten,
      minId,
      maxId,
    });

    console.log(`[ParquetExporter] Exported ${storageFileName}: ${recordsWritten} records`);

    return {
      status: "exported" as const,
      archived: recordsWritten,
      filePath: storageFileName,
      fileSize,
      minId,
      maxId,
    };
  });
}
