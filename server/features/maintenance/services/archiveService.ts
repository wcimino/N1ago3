import { db } from "../../../db.js";
import { archiveJobs, ArchiveJob } from "../../../../shared/schema.js";
import { sql, desc } from "drizzle-orm";
import { objectStorageClient } from "../../../replit_integrations/object_storage/objectStorage.js";
import parquet from "parquetjs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BATCH_SIZE = 2000;

function getEnvironmentPrefix(): string {
  return process.env.REPLIT_DEPLOYMENT ? "prod" : "dev";
}

export interface ArchiveStats {
  zendeskWebhook: {
    pendingRecords: number;
    pendingDays: number;
    oldestDate: string | null;
  };
  openaiLogs: {
    pendingRecords: number;
    pendingDays: number;
    oldestDate: string | null;
  };
  runningJobs: number;
  completedJobs: number;
  totalArchivedRecords: number;
}

export interface ArchiveProgress {
  tableName: string;
  status: string;
  currentDate: string | null;
  currentHour: number | null;
  recordsArchived: number;
  recordsDeleted: number;
}

interface ArchiveJobInternal {
  tableName: string;
  archiveDate: Date;
  recordsArchived: number;
  recordsDeleted: number;
  filePath: string | null;
  fileSize: number | null;
  status: string;
  errorMessage: string | null;
}

class ArchiveService {
  private isRunning: boolean = false;
  private currentProgress: ArchiveProgress | null = null;

  async getStats(): Promise<ArchiveStats> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const zendeskStats = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        MIN(received_at)::date as oldest_date,
        COUNT(DISTINCT DATE(received_at)) as days
      FROM zendesk_conversations_webhook_raw
      WHERE received_at < ${yesterday}
    `);

    const openaiStats = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        MIN(created_at)::date as oldest_date,
        COUNT(DISTINCT DATE(created_at)) as days
      FROM openai_api_logs
      WHERE created_at < ${yesterday}
    `);

    const jobStats = await db.execute(sql`
      SELECT 
        SUM(CASE WHEN status IN ('running', 'pending') THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'completed' THEN records_archived ELSE 0 END) as total_archived
      FROM archive_jobs
    `);

    const zRow = zendeskStats.rows[0] as any;
    const oRow = openaiStats.rows[0] as any;
    const jRow = jobStats.rows[0] as any;

    return {
      zendeskWebhook: {
        pendingRecords: Number(zRow?.count || 0),
        pendingDays: Number(zRow?.days || 0),
        oldestDate: zRow?.oldest_date || null,
      },
      openaiLogs: {
        pendingRecords: Number(oRow?.count || 0),
        pendingDays: Number(oRow?.days || 0),
        oldestDate: oRow?.oldest_date || null,
      },
      runningJobs: Number(jRow?.running || 0),
      completedJobs: Number(jRow?.completed || 0),
      totalArchivedRecords: Number(jRow?.total_archived || 0),
    };
  }

  async getHistory(limit: number = 50): Promise<ArchiveJob[]> {
    return db
      .select()
      .from(archiveJobs)
      .orderBy(desc(archiveJobs.createdAt))
      .limit(limit);
  }

  getProgress(): ArchiveProgress | null {
    return this.currentProgress;
  }

  isArchiveRunning(): boolean {
    return this.isRunning;
  }

  async startArchive(): Promise<{ message: string }> {
    if (this.isRunning) {
      return { message: "Arquivamento já está em execução" };
    }

    this.isRunning = true;
    this.runArchiveProcess().catch(err => {
      console.error("Archive process error:", err);
      this.isRunning = false;
      this.currentProgress = null;
    });

    return { message: "Arquivamento iniciado" };
  }

  private async runArchiveProcess(): Promise<void> {
    try {
      await this.archiveTable("zendesk_conversations_webhook_raw");
      await this.archiveTable("openai_api_logs");
    } finally {
      this.isRunning = false;
      this.currentProgress = null;
    }
  }

  private async archiveTable(tableName: string): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const dateColumn = tableName === "zendesk_conversations_webhook_raw" ? "received_at" : "created_at";

    const datesResult = await db.execute(sql`
      SELECT DISTINCT DATE(${sql.identifier(dateColumn)}) as archive_date
      FROM ${sql.identifier(tableName)}
      WHERE ${sql.identifier(dateColumn)} < ${yesterday}
      ORDER BY archive_date ASC
    `);

    const dates = (datesResult.rows as any[]).map(r => new Date(r.archive_date));

    for (const archiveDate of dates) {
      let totalArchived = 0;
      let totalDeleted = 0;
      const filePaths: string[] = [];
      let totalFileSize = 0;
      let hadErrors = false;

      for (let hour = 0; hour < 24; hour++) {
        this.currentProgress = {
          tableName,
          status: "running",
          currentDate: archiveDate.toISOString().split("T")[0],
          currentHour: hour,
          recordsArchived: totalArchived,
          recordsDeleted: totalDeleted,
        };

        try {
          const result = await this.archiveHourData(tableName, archiveDate, hour, dateColumn);
          if (result) {
            totalArchived += result.archived;
            totalDeleted += result.deleted;
            if (result.filePath) filePaths.push(result.filePath);
            totalFileSize += result.fileSize || 0;
          }
        } catch (err: any) {
          console.error(`Error archiving ${tableName} for ${archiveDate} hour ${hour}:`, err);
          hadErrors = true;
        }
      }

      if (totalArchived > 0 || hadErrors) {
        await this.createJobRecord({
          tableName,
          archiveDate,
          status: hadErrors ? "partial" : "completed",
          recordsArchived: totalArchived,
          recordsDeleted: totalDeleted,
          filePath: filePaths.length > 0 ? filePaths.join(", ") : null,
          fileSize: totalFileSize,
          errorMessage: hadErrors ? "Some hours failed - check logs" : null,
        });
      }
    }
  }

  private async archiveHourData(
    tableName: string,
    archiveDate: Date,
    hour: number,
    dateColumn: string
  ): Promise<{ archived: number; deleted: number; filePath: string | null; fileSize: number | null } | null> {
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

    const schema = this.getParquetSchema(tableName);
    const dateStr = archiveDate.toISOString().split("T")[0];
    const hourStr = hour.toString().padStart(2, "0");
    const envPrefix = getEnvironmentPrefix();
    const storageFileName = `archives/${envPrefix}/${tableName}/${dateStr}/${hourStr}.parquet`;

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
        if (rows.length === 0) {
          break;
        }

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

        if (this.currentProgress) {
          this.currentProgress.recordsArchived += rows.length;
        }
      }

      await writer.close();

      if (recordsWritten === 0) {
        return null;
      }

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

      await bucket.upload(tempFilePath, {
        destination: objectName,
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

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error("Upload verification failed - file not found in storage");
      }

      const [metadata] = await file.getMetadata();
      const fileSize = Number(metadata.size || 0);

      let deletedCount = 0;
      let deleteLastId = minId - 1;

      while (deletedCount < recordsWritten) {
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
        if (deletedRows.length === 0) {
          break;
        }

        deletedCount += deletedRows.length;
        deleteLastId = deletedRows[deletedRows.length - 1].id;

        if (this.currentProgress) {
          this.currentProgress.recordsDeleted += deletedRows.length;
        }
      }

      return {
        archived: recordsWritten,
        deleted: deletedCount,
        filePath: storageFileName,
        fileSize,
      };

    } finally {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (e) {
        console.error("Failed to delete temp file:", e);
      }
    }
  }

  private getParquetSchema(tableName: string): parquet.ParquetSchema {
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
    } else {
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
    }
  }

  private async createJobRecord(job: ArchiveJobInternal): Promise<void> {
    await db.insert(archiveJobs).values({
      tableName: job.tableName,
      archiveDate: job.archiveDate,
      status: job.status,
      recordsArchived: job.recordsArchived,
      recordsDeleted: job.recordsDeleted,
      filePath: job.filePath,
      fileSize: job.fileSize,
      errorMessage: job.errorMessage,
      startedAt: new Date(),
      completedAt: job.status === "completed" || job.status === "failed" || job.status === "partial" ? new Date() : null,
    });
  }
}

export const archiveService = new ArchiveService();
