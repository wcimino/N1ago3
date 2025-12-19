import { db } from "../../../db.js";
import { archiveJobs, zendeskConversationsWebhookRaw, openaiApiLogs, ArchiveJob } from "../../../../shared/schema.js";
import { sql, eq, and, lt, gte, inArray, desc, asc } from "drizzle-orm";
import { objectStorageClient } from "../../../replit_integrations/object_storage/objectStorage.js";
import parquet from "parquetjs";
import { Writable } from "stream";

const BATCH_SIZE = 2000;

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
      this.currentProgress = {
        tableName,
        status: "running",
        currentDate: archiveDate.toISOString().split("T")[0],
        recordsArchived: 0,
        recordsDeleted: 0,
      };

      try {
        await this.archiveDateData(tableName, archiveDate, dateColumn);
      } catch (err: any) {
        console.error(`Error archiving ${tableName} for ${archiveDate}:`, err);
        await this.createJobRecord({
          tableName,
          archiveDate,
          status: "failed",
          errorMessage: err.message,
          recordsArchived: 0,
          recordsDeleted: 0,
          filePath: null,
          fileSize: null,
        });
      }
    }
  }

  private async archiveDateData(tableName: string, archiveDate: Date, dateColumn: string): Promise<void> {
    const startOfDay = new Date(archiveDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(archiveDate);
    endOfDay.setHours(23, 59, 59, 999);

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${sql.identifier(tableName)}
      WHERE ${sql.identifier(dateColumn)} >= ${startOfDay}
        AND ${sql.identifier(dateColumn)} <= ${endOfDay}
    `);
    const totalRecords = Number((countResult.rows[0] as any).count);

    if (totalRecords === 0) {
      return;
    }

    const allRecords: any[] = [];
    let offset = 0;

    while (offset < totalRecords) {
      const batchResult = await db.execute(sql`
        SELECT *
        FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfDay}
          AND ${sql.identifier(dateColumn)} <= ${endOfDay}
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `);

      allRecords.push(...batchResult.rows);
      offset += BATCH_SIZE;

      if (this.currentProgress) {
        this.currentProgress.recordsArchived = allRecords.length;
      }
    }

    const schema = this.getParquetSchema(tableName);
    const dateStr = archiveDate.toISOString().split("T")[0];
    const fileName = `archives/${tableName}/${dateStr}.parquet`;

    const parquetBuffer = await this.writeParquetToBuffer(schema, allRecords);
    
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateDir) {
      throw new Error("PRIVATE_OBJECT_DIR not configured");
    }

    const fullPath = `${privateDir}/${fileName}`;
    const pathParts = fullPath.startsWith("/") ? fullPath.slice(1).split("/") : fullPath.split("/");
    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join("/");

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(parquetBuffer, {
      contentType: "application/octet-stream",
      metadata: {
        tableName,
        archiveDate: dateStr,
        recordCount: allRecords.length.toString(),
      },
    });

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error("Upload verification failed - file not found in storage");
    }

    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);

    const recordIds = allRecords.map(r => r.id);
    let deletedCount = 0;

    for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
      const batchIds = recordIds.slice(i, i + BATCH_SIZE);
      
      await db.execute(sql`
        DELETE FROM ${sql.identifier(tableName)}
        WHERE id = ANY(${batchIds}::int[])
      `);

      deletedCount += batchIds.length;

      if (this.currentProgress) {
        this.currentProgress.recordsDeleted = deletedCount;
      }
    }

    await this.createJobRecord({
      tableName,
      archiveDate,
      status: "completed",
      recordsArchived: allRecords.length,
      recordsDeleted: deletedCount,
      filePath: fileName,
      fileSize,
      errorMessage: null,
    });
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

  private async writeParquetToBuffer(schema: parquet.ParquetSchema, records: any[]): Promise<Buffer> {
    const chunks: Buffer[] = [];

    const writableStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    const writer = await parquet.ParquetWriter.openStream(schema, writableStream);

    for (const record of records) {
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
    }

    await writer.close();

    return Buffer.concat(chunks);
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
      completedAt: job.status === "completed" || job.status === "failed" ? new Date() : null,
    });
  }
}

export const archiveService = new ArchiveService();
