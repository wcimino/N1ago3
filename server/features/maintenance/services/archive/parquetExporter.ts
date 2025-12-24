import parquet from "parquetjs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "../../../../db.js";
import { sql } from "drizzle-orm";
import { objectStorageClient } from "../../../../replit_integrations/object_storage/objectStorage.js";

const BATCH_SIZE = 2000;
const MAX_UPLOAD_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_UPLOAD_RETRIES,
  operationName: string = "operation"
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[ParquetExporter] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

export function getEnvironmentPrefix(): string {
  return process.env.REPLIT_DEPLOYMENT ? "prod" : "dev";
}

export function getParquetSchema(tableName: string): any {
  if (tableName === "zendesk_conversations_webhook_raw") {
    return new parquet.ParquetSchema({
      id: { type: "INT64" },
      source: { type: "UTF8", optional: true },
      received_at: { type: "UTF8", optional: true },
      source_ip: { type: "UTF8", optional: true },
      headers: { type: "UTF8", optional: true },
      payload: { type: "UTF8", optional: true },
      raw_body: { type: "UTF8", optional: true },
      processing_status: { type: "UTF8", optional: true },
      error_message: { type: "UTF8", optional: true },
      processed_at: { type: "UTF8", optional: true },
      retry_count: { type: "INT32", optional: true },
      events_created_count: { type: "INT32", optional: true },
    });
  } else if (tableName === "openai_api_logs") {
    return new parquet.ParquetSchema({
      id: { type: "INT64" },
      request_type: { type: "UTF8", optional: true },
      model_name: { type: "UTF8", optional: true },
      prompt_system: { type: "UTF8", optional: true },
      prompt_user: { type: "UTF8", optional: true },
      response_raw: { type: "UTF8", optional: true },
      response_content: { type: "UTF8", optional: true },
      tokens_prompt: { type: "INT32", optional: true },
      tokens_completion: { type: "INT32", optional: true },
      tokens_total: { type: "INT32", optional: true },
      duration_ms: { type: "INT32", optional: true },
      success: { type: "BOOLEAN", optional: true },
      error_message: { type: "UTF8", optional: true },
      context_type: { type: "UTF8", optional: true },
      context_id: { type: "UTF8", optional: true },
      created_at: { type: "UTF8", optional: true },
    });
  } else if (tableName === "responses_suggested") {
    return new parquet.ParquetSchema({
      id: { type: "INT64" },
      conversation_id: { type: "INT32", optional: true },
      external_conversation_id: { type: "UTF8", optional: true },
      suggested_response: { type: "UTF8", optional: true },
      last_event_id: { type: "INT32", optional: true },
      openai_log_id: { type: "INT32", optional: true },
      used_at: { type: "UTF8", optional: true },
      dismissed: { type: "BOOLEAN", optional: true },
      created_at: { type: "UTF8", optional: true },
      in_response_to: { type: "UTF8", optional: true },
      status: { type: "UTF8", optional: true },
      articles_used: { type: "UTF8", optional: true },
    });
  } else {
    throw new Error(`Unknown table for Parquet schema: ${tableName}`);
  }
}

export interface ExportResult {
  archived: number;
  deleted: number;
  filePath: string | null;
  fileSize: number | null;
  minId: number;
  maxId: number;
}

export type ExportOutcome =
  | { status: "empty" }
  | { status: "existing"; archived: number; filePath: string; fileSize: number; minId: number; maxId: number }
  | { status: "exported"; archived: number; filePath: string; fileSize: number; minId: number; maxId: number };

export async function exportHourToParquet(
  tableName: string,
  archiveDate: Date,
  hour: number,
  dateColumn: string,
  onProgress?: (recordsWritten: number) => void
): Promise<ExportResult | null> {
  const startOfHour = new Date(archiveDate);
  startOfHour.setHours(hour, 0, 0, 0);
  const endOfHour = new Date(archiveDate);
  endOfHour.setHours(hour, 59, 59, 999);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
      AND ${sql.identifier(dateColumn)} <= ${endOfHour}
  `);
  const totalRecords = Number((countResult.rows[0] as any).count);

  if (totalRecords === 0) {
    return null;
  }

  const schema = getParquetSchema(tableName);
  const dateStr = archiveDate.toISOString().split("T")[0];
  const hourStr = hour.toString().padStart(2, "0");
  const envPrefix = getEnvironmentPrefix();
  const storageFileName = `archives/${envPrefix}/${tableName}/${dateStr}/${hourStr}.parquet`;

  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error("PRIVATE_OBJECT_DIR not configured");
  }

  const fullPath = `${privateDir}/${storageFileName}`;
  const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [existingFile] = await file.exists();
  if (existingFile) {
    const [metadata] = await file.getMetadata();
    const existingRecordCount = Number(metadata.metadata?.recordCount || 0);
    const archivedMinId = Number(metadata.metadata?.minId || 0);
    const archivedMaxId = Number(metadata.metadata?.maxId || 0);

    if (existingRecordCount > 0 && archivedMinId > 0 && archivedMaxId > 0) {
      console.log(`[ParquetExporter] File already exists: ${storageFileName}`);
      return {
        archived: existingRecordCount,
        deleted: 0,
        filePath: storageFileName,
        fileSize: Number(metadata.size || 0),
        minId: archivedMinId,
        maxId: archivedMaxId,
      };
    }
    console.log(`[ParquetExporter] File exists but has no valid metadata: ${storageFileName}, skipping`);
    return null;
  }

  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `archive_${tableName}_${dateStr}_${hourStr}_${Date.now()}.parquet`);
  const writer = await parquet.ParquetWriter.openFile(schema, tempFilePath);

  let lastId = 0;
  let recordsWritten = 0;
  let minId = Number.MAX_SAFE_INTEGER;
  let maxId = 0;

  try {
    while (true) {
      const batchResult = await db.execute(sql`
        SELECT *
        FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
          AND ${sql.identifier(dateColumn)} <= ${endOfHour}
          AND id > ${lastId}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      `);

      const rows = batchResult.rows as any[];
      if (rows.length === 0) break;

      for (const record of rows) {
        const row: any = {};
        for (const field of Object.keys((schema as any).schema)) {
          let value = record[field];
          if (value === undefined || value === null) {
            row[field] = null;
          } else if (typeof value === "object" && !(value instanceof Date)) {
            row[field] = JSON.stringify(value);
          } else if (value instanceof Date) {
            row[field] = value.toISOString();
          } else {
            row[field] = value;
          }
        }
        await writer.appendRow(row);
        recordsWritten++;

        if (record.id < minId) minId = record.id;
        if (record.id > maxId) maxId = record.id;
      }

      lastId = rows[rows.length - 1].id;
      onProgress?.(rows.length);
    }

    await writer.close();

    if (recordsWritten === 0) {
      return null;
    }

    const tmpObjectName = `${objectName}.tmp`;
    const tmpFile = bucket.file(tmpObjectName);

    await withRetry(async () => {
      await bucket.upload(tempFilePath, {
        destination: tmpObjectName,
        contentType: "application/octet-stream",
        metadata: {
          metadata: {
            tableName,
            archiveDate: dateStr,
            hour: hourStr,
            recordCount: recordsWritten.toString(),
            minId: minId.toString(),
            maxId: maxId.toString(),
          },
        },
      });
    }, MAX_UPLOAD_RETRIES, `Upload ${storageFileName}.tmp`);

    const [tmpExists] = await tmpFile.exists();
    if (!tmpExists) {
      throw new Error("Upload verification failed - temp file not found in storage");
    }

    const [tmpMetadata] = await tmpFile.getMetadata();
    const uploadedRecordCount = Number(tmpMetadata.metadata?.recordCount || 0);

    if (uploadedRecordCount !== recordsWritten) {
      await tmpFile.delete().catch(() => {});
      throw new Error(`Record count mismatch: wrote ${recordsWritten} but metadata shows ${uploadedRecordCount}`);
    }

    await withRetry(async () => {
      await tmpFile.copy(file);
      await tmpFile.delete();
    }, MAX_UPLOAD_RETRIES, `Rename ${storageFileName}.tmp to final`);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("Rename verification failed - final file not found in storage");
    }

    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);

    console.log(`[ParquetExporter] Exported ${storageFileName}: ${recordsWritten} records`);

    return {
      archived: recordsWritten,
      deleted: 0,
      filePath: storageFileName,
      fileSize,
      minId,
      maxId,
    };
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

export async function exportHourWithOutcome(
  tableName: string,
  archiveDate: Date,
  hour: number,
  dateColumn: string
): Promise<ExportOutcome> {
  const startOfHour = new Date(archiveDate);
  startOfHour.setHours(hour, 0, 0, 0);
  const endOfHour = new Date(archiveDate);
  endOfHour.setHours(hour, 59, 59, 999);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${sql.identifier(tableName)}
    WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
      AND ${sql.identifier(dateColumn)} <= ${endOfHour}
  `);
  const totalRecords = Number((countResult.rows[0] as any).count);

  if (totalRecords === 0) {
    return { status: "empty" };
  }

  const schema = getParquetSchema(tableName);
  const dateStr = archiveDate.toISOString().split("T")[0];
  const hourStr = hour.toString().padStart(2, "0");
  const envPrefix = getEnvironmentPrefix();
  const storageFileName = `archives/${envPrefix}/${tableName}/${dateStr}/${hourStr}.parquet`;

  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) {
    throw new Error("PRIVATE_OBJECT_DIR not configured");
  }

  const fullPath = `${privateDir}/${storageFileName}`;
  const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [existingFile] = await file.exists();
  if (existingFile) {
    const [metadata] = await file.getMetadata();
    const existingRecordCount = Number(metadata.metadata?.recordCount || 0);
    const archivedMinId = Number(metadata.metadata?.minId || 0);
    const archivedMaxId = Number(metadata.metadata?.maxId || 0);

    if (existingRecordCount > 0 && archivedMinId > 0 && archivedMaxId > 0) {
      return {
        status: "existing",
        archived: existingRecordCount,
        filePath: storageFileName,
        fileSize: Number(metadata.size || 0),
        minId: archivedMinId,
        maxId: archivedMaxId,
      };
    }
    console.log(`[ParquetExporter] Deleting file with invalid metadata: ${storageFileName}`);
    await file.delete().catch(() => {});
  }

  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `archive_${tableName}_${dateStr}_${hourStr}_${Date.now()}.parquet`);
  const writer = await parquet.ParquetWriter.openFile(schema, tempFilePath);

  let lastId = 0;
  let recordsWritten = 0;
  let minId = Number.MAX_SAFE_INTEGER;
  let maxId = 0;

  try {
    while (true) {
      const batchResult = await db.execute(sql`
        SELECT *
        FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
          AND ${sql.identifier(dateColumn)} <= ${endOfHour}
          AND id > ${lastId}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
      `);

      const rows = batchResult.rows as any[];
      if (rows.length === 0) break;

      for (const record of rows) {
        const row: any = {};
        for (const field of Object.keys((schema as any).schema)) {
          let value = record[field];
          if (value === undefined || value === null) {
            row[field] = null;
          } else if (typeof value === "object" && !(value instanceof Date)) {
            row[field] = JSON.stringify(value);
          } else if (value instanceof Date) {
            row[field] = value.toISOString();
          } else {
            row[field] = value;
          }
        }
        await writer.appendRow(row);
        recordsWritten++;

        if (record.id < minId) minId = record.id;
        if (record.id > maxId) maxId = record.id;
      }

      lastId = rows[rows.length - 1].id;
    }

    await writer.close();

    if (recordsWritten === 0) {
      return { status: "empty" };
    }

    const tmpObjectName = `${objectName}.tmp`;
    const tmpFile = bucket.file(tmpObjectName);

    await withRetry(async () => {
      await bucket.upload(tempFilePath, {
        destination: tmpObjectName,
        contentType: "application/octet-stream",
        metadata: {
          metadata: {
            tableName,
            archiveDate: dateStr,
            hour: hourStr,
            recordCount: recordsWritten.toString(),
            minId: minId.toString(),
            maxId: maxId.toString(),
          },
        },
      });
    }, MAX_UPLOAD_RETRIES, `Upload ${storageFileName}.tmp`);

    const [tmpExists] = await tmpFile.exists();
    if (!tmpExists) {
      throw new Error("Upload verification failed - temp file not found in storage");
    }

    const [tmpMetadata] = await tmpFile.getMetadata();
    const uploadedRecordCount = Number(tmpMetadata.metadata?.recordCount || 0);

    if (uploadedRecordCount !== recordsWritten) {
      await tmpFile.delete().catch(() => {});
      throw new Error(`Record count mismatch: wrote ${recordsWritten} but metadata shows ${uploadedRecordCount}`);
    }

    await withRetry(async () => {
      await tmpFile.copy(file);
      await tmpFile.delete();
    }, MAX_UPLOAD_RETRIES, `Rename ${storageFileName}.tmp to final`);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("Rename verification failed - final file not found in storage");
    }

    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);

    console.log(`[ParquetExporter] Exported ${storageFileName}: ${recordsWritten} records`);

    return {
      status: "exported",
      archived: recordsWritten,
      filePath: storageFileName,
      fileSize,
      minId,
      maxId,
    };
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
