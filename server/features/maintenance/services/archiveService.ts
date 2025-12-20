import { db } from "../../../db.js";
import { archiveJobs, ArchiveJob } from "../../../../shared/schema.js";
import { sql, desc } from "drizzle-orm";
import { objectStorageClient } from "../../../replit_integrations/object_storage/objectStorage.js";
import parquet from "parquetjs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const BATCH_SIZE = 2000;
const MAX_UPLOAD_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const ARCHIVE_HOUR_UTC = 5; // 2am Brasília (UTC-3) - runs before VacuumService at 6:00 UTC

function getEnvironmentPrefix(): string {
  return process.env.REPLIT_DEPLOYMENT ? "prod" : "dev";
}

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
        console.log(`[Archive] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

interface TableStats {
  pendingRecords: number;
  pendingDays: number;
  oldestDate: string | null;
}

export interface ArchiveStats {
  zendeskWebhook: TableStats;
  openaiLogs: TableStats;
  responsesSuggested: TableStats;
  queryLogs: TableStats;
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
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private lastRunDate: string | null = null;

  start(): void {
    console.log(`[ArchiveService] Starting scheduler for daily archive at ${ARCHIVE_HOUR_UTC}:00 UTC (2am Brasília)`);
    this.checkAndRunCatchUp();
    this.scheduleNextRun();
  }

  stop(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    console.log("[ArchiveService] Scheduler stopped");
  }

  private scheduleNextRun(): void {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(ARCHIVE_HOUR_UTC, 0, 0, 0);

    if (nextRun <= now) {
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();
    const hoursUntilNextRun = (msUntilNextRun / (1000 * 60 * 60)).toFixed(1);

    console.log(`[ArchiveService] Next archive scheduled for ${nextRun.toISOString()} (in ${hoursUntilNextRun} hours)`);

    this.scheduledTimeout = setTimeout(() => {
      this.runScheduledArchive();
    }, msUntilNextRun);
  }

  private async checkAndRunCatchUp(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const result = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM archive_jobs
        WHERE archive_date::date = ${yesterdayStr}::date
          AND status = 'completed'
      `);

      const completedJobs = Number((result.rows[0] as any).count);

      if (completedJobs === 0) {
        const pendingResult = await db.execute(sql`
          SELECT 
            (SELECT COUNT(*) FROM zendesk_conversations_webhook_raw WHERE received_at::date < ${yesterdayStr}::date) +
            (SELECT COUNT(*) FROM openai_api_logs WHERE created_at::date < ${yesterdayStr}::date) as pending
        `);
        const pendingRecords = Number((pendingResult.rows[0] as any).pending);

        if (pendingRecords > 0) {
          console.log(`[ArchiveService] Catch-up: No completed archive for ${yesterdayStr}, ${pendingRecords} records pending. Starting archive...`);
          this.runScheduledArchive();
        } else {
          console.log(`[ArchiveService] Catch-up: No pending records to archive`);
        }
      } else {
        console.log(`[ArchiveService] Catch-up: Archive already completed for ${yesterdayStr}`);
        this.lastRunDate = yesterdayStr;
      }
    } catch (err: any) {
      console.error("[ArchiveService] Catch-up check failed:", err.message);
    }
  }

  private async runScheduledArchive(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    if (this.lastRunDate === today) {
      console.log(`[ArchiveService] Archive already ran today (${today}), skipping`);
      this.scheduleNextRun();
      return;
    }

    if (this.isRunning) {
      console.log("[ArchiveService] Archive already running, skipping scheduled run");
      this.scheduleNextRun();
      return;
    }

    console.log(`[ArchiveService] Starting scheduled archive at ${new Date().toISOString()}`);
    this.isRunning = true;

    try {
      await this.runArchiveProcess();
      this.lastRunDate = today;
      console.log(`[ArchiveService] Scheduled archive completed at ${new Date().toISOString()}`);
    } catch (err: any) {
      console.error("[ArchiveService] Scheduled archive failed:", err.message);
    } finally {
      this.isRunning = false;
      this.currentProgress = null;
      this.scheduleNextRun();
    }
  }

  getSchedulerStatus(): { isRunning: boolean; lastRunDate: string | null; nextRunHourUTC: number } {
    return {
      isRunning: this.isRunning,
      lastRunDate: this.lastRunDate,
      nextRunHourUTC: ARCHIVE_HOUR_UTC,
    };
  }

  async getStats(): Promise<ArchiveStats> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const [zendeskStats, openaiStats, responsesStats, queryLogsStats, jobStats] = await Promise.all([
      db.execute(sql`
        SELECT 
          COUNT(*) as count,
          MIN(received_at)::date as oldest_date,
          COUNT(DISTINCT DATE(received_at)) as days
        FROM zendesk_conversations_webhook_raw
        WHERE received_at < ${yesterday}
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as count,
          MIN(created_at)::date as oldest_date,
          COUNT(DISTINCT DATE(created_at)) as days
        FROM openai_api_logs
        WHERE created_at < ${yesterday}
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as count,
          MIN(created_at)::date as oldest_date,
          COUNT(DISTINCT DATE(created_at)) as days
        FROM responses_suggested
        WHERE created_at < ${yesterday}
      `),
      db.execute(sql`
        SELECT 
          COUNT(*) as count,
          MIN(created_at)::date as oldest_date,
          COUNT(DISTINCT DATE(created_at)) as days
        FROM query_logs
        WHERE created_at < ${yesterday}
      `),
      db.execute(sql`
        SELECT 
          SUM(CASE WHEN status IN ('running', 'pending') THEN 1 ELSE 0 END) as running,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'completed' THEN records_archived ELSE 0 END) as total_archived
        FROM archive_jobs
      `),
    ]);

    const zRow = zendeskStats.rows[0] as any;
    const oRow = openaiStats.rows[0] as any;
    const rRow = responsesStats.rows[0] as any;
    const qRow = queryLogsStats.rows[0] as any;
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
      responsesSuggested: {
        pendingRecords: Number(rRow?.count || 0),
        pendingDays: Number(rRow?.days || 0),
        oldestDate: rRow?.oldest_date || null,
      },
      queryLogs: {
        pendingRecords: Number(qRow?.count || 0),
        pendingDays: Number(qRow?.days || 0),
        oldestDate: qRow?.oldest_date || null,
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
    console.log(`[ArchiveService] Starting manual archive at ${new Date().toISOString()}`);
    
    this.runArchiveProcess()
      .then(() => {
        this.lastRunDate = new Date().toISOString().split("T")[0];
        console.log(`[ArchiveService] Manual archive completed at ${new Date().toISOString()}`);
      })
      .catch(err => {
        console.error("[ArchiveService] Manual archive failed:", err.message);
      })
      .finally(() => {
        this.isRunning = false;
        this.currentProgress = null;
      });

    return { message: "Arquivamento iniciado" };
  }

  private async runArchiveProcess(): Promise<void> {
    await this.archiveTable("zendesk_conversations_webhook_raw");
    await this.runVacuum("zendesk_conversations_webhook_raw");
    
    await this.archiveTable("openai_api_logs");
    await this.runVacuum("openai_api_logs");
    
    await this.archiveTable("responses_suggested");
    await this.runVacuum("responses_suggested");
    
    await this.archiveTable("query_logs");
    await this.runVacuum("query_logs");
  }

  private async runVacuum(tableName: string): Promise<void> {
    try {
      console.log(`[Archive] Running VACUUM on ${tableName}...`);
      await db.execute(sql`VACUUM ${sql.identifier(tableName)}`);
      console.log(`[Archive] VACUUM completed on ${tableName}`);
    } catch (err: any) {
      console.error(`[Archive] VACUUM failed on ${tableName}:`, err.message);
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
      const existingJobResult = await db.execute(sql`
        SELECT id, status, last_processed_hour, records_archived, records_deleted, file_path, file_size
        FROM archive_jobs
        WHERE table_name = ${tableName}
          AND archive_date::date = ${archiveDate}::date
          AND status IN ('running', 'partial')
        ORDER BY id DESC
        LIMIT 1
      `);

      let jobId: number;
      let startHour = 0;
      let totalArchived = 0;
      let totalDeleted = 0;
      const filePaths: string[] = [];
      let totalFileSize = 0;
      let hadErrors = false;

      if (existingJobResult.rows.length > 0) {
        const existingJob = existingJobResult.rows[0] as any;
        jobId = existingJob.id;
        startHour = (existingJob.last_processed_hour ?? -1) + 1;
        totalArchived = existingJob.records_archived || 0;
        totalDeleted = existingJob.records_deleted || 0;
        if (existingJob.file_path) {
          filePaths.push(...existingJob.file_path.split(", "));
        }
        totalFileSize = existingJob.file_size || 0;
        console.log(`[Archive] Resuming job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]} from hour ${startHour}`);
      } else {
        const insertResult = await db.insert(archiveJobs).values({
          tableName,
          archiveDate,
          status: "running",
          recordsArchived: 0,
          recordsDeleted: 0,
          startedAt: new Date(),
        }).returning({ id: archiveJobs.id });
        jobId = insertResult[0].id;
        console.log(`[Archive] Starting new job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]}`);
      }

      let lastSuccessfulHour = startHour - 1;
      
      for (let hour = startHour; hour < 24; hour++) {
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

          lastSuccessfulHour = hour;
          
          await db.execute(sql`
            UPDATE archive_jobs
            SET last_processed_hour = ${hour},
                records_archived = ${totalArchived},
                records_deleted = ${totalDeleted},
                file_path = ${filePaths.length > 0 ? filePaths.join(", ") : null},
                file_size = ${totalFileSize}
            WHERE id = ${jobId}
          `);
        } catch (err: any) {
          console.error(`[Archive] Error archiving ${tableName} for ${archiveDate.toISOString().split("T")[0]} hour ${hour}:`, err);
          hadErrors = true;
          
          await db.execute(sql`
            UPDATE archive_jobs
            SET status = 'partial',
                error_message = ${err.message || 'Unknown error'},
                last_processed_hour = ${lastSuccessfulHour >= 0 ? lastSuccessfulHour : null}
            WHERE id = ${jobId}
          `);
          
          break;
        }
      }

      const finalStatus = hadErrors ? "partial" : "completed";
      await db.execute(sql`
        UPDATE archive_jobs
        SET status = ${finalStatus},
            completed_at = ${new Date()},
            error_message = ${hadErrors ? "Stopped at first error - check logs" : null}
        WHERE id = ${jobId}
      `);
      
      console.log(`[Archive] Job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]} finished with status: ${finalStatus}`);
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
        console.log(`[Archive] File already exists: ${storageFileName}, deleting only archived records (IDs ${archivedMinId}-${archivedMaxId})`);
        
        let deletedCount = 0;
        let deleteLastId = archivedMinId - 1;
        while (deletedCount < existingRecordCount) {
          const deleteResult = await db.execute(sql`
            DELETE FROM ${sql.identifier(tableName)}
            WHERE id IN (
              SELECT id FROM ${sql.identifier(tableName)}
              WHERE id > ${deleteLastId}
                AND id <= ${archivedMaxId}
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
        
        console.log(`[Archive] Cleanup complete for ${storageFileName}: ${deletedCount} records deleted`);
        return {
          archived: existingRecordCount,
          deleted: deletedCount,
          filePath: storageFileName,
          fileSize: Number(metadata.size || 0),
        };
      }
      console.log(`[Archive] File exists but has no valid metadata: ${storageFileName}, skipping`);
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

      await withRetry(async () => {
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
      }, MAX_UPLOAD_RETRIES, `Upload ${storageFileName}`);

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error("Upload verification failed - file not found in storage");
      }

      const [metadata] = await file.getMetadata();
      const fileSize = Number(metadata.size || 0);
      const uploadedRecordCount = Number(metadata.metadata?.recordCount || 0);

      if (uploadedRecordCount !== recordsWritten) {
        throw new Error(`Record count mismatch: wrote ${recordsWritten} but metadata shows ${uploadedRecordCount}`);
      }

      const remainingCountResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM ${sql.identifier(tableName)}
        WHERE ${sql.identifier(dateColumn)} >= ${startOfHour}
          AND ${sql.identifier(dateColumn)} <= ${endOfHour}
          AND id >= ${minId}
          AND id <= ${maxId}
      `);
      const remainingCount = Number((remainingCountResult.rows[0] as any).count);

      if (remainingCount !== recordsWritten) {
        console.warn(`[Archive] Warning: Expected ${recordsWritten} records to delete but found ${remainingCount}`);
      }

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

      console.log(`[Archive] Completed ${storageFileName}: ${recordsWritten} archived, ${deletedCount} deleted`);

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

  private getParquetSchema(tableName: string): any {
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
    } else if (tableName === "query_logs") {
      return new parquet.ParquetSchema({
        id: { type: "INT64" },
        query_hash: { type: "UTF8", optional: true },
        query_normalized: { type: "UTF8", optional: true },
        duration_ms: { type: "INT32", optional: true },
        rows_affected: { type: "INT32", optional: true },
        source: { type: "UTF8", optional: true },
        created_at: { type: "UTF8", optional: true },
      });
    } else {
      throw new Error(`Unknown table for Parquet schema: ${tableName}`);
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
