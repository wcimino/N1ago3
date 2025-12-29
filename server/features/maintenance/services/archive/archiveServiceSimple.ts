import { db } from "../../../../db.js";
import { sql } from "drizzle-orm";
import { archiveJobs, ArchiveProgress } from "../../../../../shared/schema.js";
import { exportDayToParquet } from "./parquetExporter.js";
import { deleteArchivedRecordsByDay, runVacuum } from "./tableCleaner.js";
import { ArchiveScheduler } from "./scheduler.js";

interface TableConfig {
  name: string;
  dateColumn: string;
}

const ARCHIVE_TABLES: TableConfig[] = [
  { name: "zendesk_conversations_webhook_raw", dateColumn: "received_at" },
  { name: "openai_api_logs", dateColumn: "created_at" },
  { name: "responses_suggested", dateColumn: "created_at" },
];

export interface ArchiveStats {
  pendingRecords: number;
  pendingDays: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalArchivedRecords: number;
}

export interface ActiveJobInfo {
  id: number;
  tableName: string;
  archiveDate: string;
  status: string;
  progress: ArchiveProgress | null;
  errorMessage: string | null;
  recordsArchived: number;
  recordsDeleted: number;
}

class SimpleArchiveService {
  private scheduler: ArchiveScheduler;
  private isRunning: boolean = false;

  constructor() {
    this.scheduler = new ArchiveScheduler({
      onRun: () => this.runArchive(),
    });
  }

  async start(): Promise<void> {
    console.log("[SimpleArchiveService] Starting service");
    await this.markOrphanedJobsAsFailed();
    this.scheduler.start();
  }

  private async markOrphanedJobsAsFailed(): Promise<void> {
    try {
      const result = await db.execute(sql`
        UPDATE archive_jobs 
        SET status = 'failed', 
            completed_at = NOW(), 
            error_message = 'Job interrompido - servidor reiniciado durante execução',
            progress = NULL
        WHERE status = 'running'
        RETURNING id, table_name, archive_date
      `);
      
      if (result.rows.length > 0) {
        console.log(`[SimpleArchiveService] Marked ${result.rows.length} orphaned job(s) as failed:`);
        for (const row of result.rows as any[]) {
          console.log(`  - Job ${row.id}: ${row.table_name} ${row.archive_date}`);
        }
      }
    } catch (error: any) {
      console.error("[SimpleArchiveService] Error marking orphaned jobs:", error.message);
    }
  }

  stop(): void {
    this.scheduler.stop();
    console.log("[SimpleArchiveService] Service stopped");
  }

  async getStats(): Promise<ArchiveStats> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    try {
      const [pendingResult, jobStats] = await Promise.all([
        db.execute(sql`
          SELECT COALESCE(SUM(cnt), 0) as total_pending, COALESCE(SUM(days), 0) as total_days
          FROM (
            SELECT COUNT(*) as cnt, COUNT(DISTINCT DATE(received_at)) as days
            FROM zendesk_conversations_webhook_raw WHERE received_at < ${yesterday}
            UNION ALL
            SELECT COUNT(*) as cnt, COUNT(DISTINCT DATE(created_at)) as days
            FROM openai_api_logs WHERE created_at < ${yesterday}
            UNION ALL
            SELECT COUNT(*) as cnt, COUNT(DISTINCT DATE(created_at)) as days
            FROM responses_suggested WHERE created_at < ${yesterday}
          ) t
        `),
        db.execute(sql`
          SELECT 
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'completed' THEN records_archived ELSE 0 END) as total_archived
          FROM archive_jobs
        `),
      ]);

      const pendingRow = pendingResult.rows[0] as any;
      const jobRow = jobStats.rows[0] as any;

      return {
        pendingRecords: Number(pendingRow?.total_pending || 0),
        pendingDays: Number(pendingRow?.total_days || 0),
        runningJobs: Number(jobRow?.running || 0),
        completedJobs: Number(jobRow?.completed || 0),
        failedJobs: Number(jobRow?.failed || 0),
        totalArchivedRecords: Number(jobRow?.total_archived || 0),
      };
    } catch (error: any) {
      console.error("[SimpleArchiveService] Error getting stats:", error.message);
      return {
        pendingRecords: 0,
        pendingDays: 0,
        runningJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        totalArchivedRecords: 0,
      };
    }
  }

  async getActiveJob(): Promise<ActiveJobInfo | null> {
    try {
      const result = await db.execute(sql`
        SELECT id, table_name, archive_date, status, progress, error_message, records_archived, records_deleted
        FROM archive_jobs
        WHERE status = 'running'
        ORDER BY started_at DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) return null;

      const row = result.rows[0] as any;
      return {
        id: row.id,
        tableName: row.table_name,
        archiveDate: row.archive_date?.toISOString?.()?.split("T")[0] || String(row.archive_date),
        status: row.status,
        progress: row.progress ? (typeof row.progress === "string" ? JSON.parse(row.progress) : row.progress) : null,
        errorMessage: row.error_message,
        recordsArchived: Number(row.records_archived || 0),
        recordsDeleted: Number(row.records_deleted || 0),
      };
    } catch (error: any) {
      console.error("[SimpleArchiveService] Error getting active job:", error.message);
      return null;
    }
  }

  async getHistory(limit: number = 20): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, table_name, archive_date, status, records_archived, records_deleted, 
               error_message, started_at, completed_at, created_at
        FROM archive_jobs
        WHERE status != 'invalidated'
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      return result.rows.map((row: any) => ({
        id: row.id,
        tableName: row.table_name,
        archiveDate: row.archive_date,
        status: row.status,
        recordsArchived: Number(row.records_archived || 0),
        recordsDeleted: Number(row.records_deleted || 0),
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      }));
    } catch (error: any) {
      console.error("[SimpleArchiveService] Error getting history:", error.message);
      return [];
    }
  }

  async startArchive(): Promise<{ success: boolean; message: string }> {
    if (this.isRunning) {
      return { success: false, message: "Arquivamento já em execução" };
    }

    const activeJob = await this.getActiveJob();
    if (activeJob) {
      return {
        success: false,
        message: `Arquivamento já em execução (Job #${activeJob.id} - ${activeJob.tableName})`,
      };
    }

    console.log("[SimpleArchiveService] Starting archive process");

    this.runArchive().catch((error) => {
      console.error("[SimpleArchiveService] Archive process failed:", error.message);
    });

    return { success: true, message: "Arquivamento iniciado" };
  }

  private async runArchive(): Promise<void> {
    if (this.isRunning) {
      console.log("[SimpleArchiveService] Already running, skipping");
      return;
    }

    this.isRunning = true;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    try {
      await this.repairPartialJobs();

      for (const table of ARCHIVE_TABLES) {
        try {
          await this.archiveTable(table, yesterday);
        } catch (error: any) {
          console.error(`[SimpleArchiveService] Error archiving ${table.name}:`, error.message);
        }
      }

      this.scheduler.setLastRunDate(new Date().toISOString().split("T")[0]);
      console.log("[SimpleArchiveService] Archive process completed");
    } finally {
      this.isRunning = false;
    }
  }

  private async repairPartialJobs(): Promise<void> {
    const partialJobs = await db.execute(sql`
      SELECT id, table_name, archive_date, records_archived, records_deleted
      FROM archive_jobs
      WHERE status = 'partial'
        OR (records_archived > 0 AND records_deleted = 0 AND status NOT IN ('running', 'invalidated', 'failed'))
      ORDER BY archive_date ASC
      LIMIT 20
    `);

    if (partialJobs.rows.length === 0) {
      console.log("[SimpleArchiveService] No partial jobs found");
      return;
    }

    console.log(`[SimpleArchiveService] Found ${partialJobs.rows.length} partial jobs - marking for manual review`);

    for (const row of partialJobs.rows as any[]) {
      const job = row as { id: number; table_name: string; archive_date: Date; records_archived: number };
      console.log(`[SimpleArchiveService] Job ${job.id} (${job.table_name} ${job.archive_date}): ${job.records_archived} archived, 0 deleted - requires manual intervention`);
      
      await db.execute(sql`
        UPDATE archive_jobs 
        SET status = 'failed', 
            error_message = ${'Arquivamento incompleto: registros exportados mas não deletados. Verifique o arquivo Parquet e delete manualmente os registros correspondentes.'}
        WHERE id = ${job.id}
      `);
    }
  }

  private async archiveTable(table: TableConfig, cutoffDate: Date): Promise<void> {
    const datesResult = await db.execute(sql`
      SELECT DISTINCT DATE(${sql.identifier(table.dateColumn)}) as archive_date
      FROM ${sql.identifier(table.name)}
      WHERE ${sql.identifier(table.dateColumn)} < ${cutoffDate}
      ORDER BY archive_date ASC
      LIMIT 10
    `);

    const dates = (datesResult.rows as any[]).map((r) => new Date(r.archive_date));
    if (dates.length === 0) {
      console.log(`[SimpleArchiveService] No data to archive for ${table.name}`);
      return;
    }

    for (const archiveDate of dates) {
      await this.archiveDay(table, archiveDate);
    }
  }

  private async archiveDay(table: TableConfig, archiveDate: Date): Promise<void> {
    const dateStr = archiveDate.toISOString().split("T")[0];

    const existingJob = await db.execute(sql`
      SELECT id, status, records_archived, records_deleted FROM archive_jobs
      WHERE table_name = ${table.name}
        AND archive_date::date = ${archiveDate}::date
        AND status NOT IN ('invalidated')
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (existingJob.rows.length > 0) {
      const job = existingJob.rows[0] as any;
      if (job.status === 'completed') {
        console.log(`[SimpleArchiveService] Skipping ${table.name} ${dateStr} - already completed`);
        return;
      }
      if (job.status === 'running') {
        console.log(`[SimpleArchiveService] Skipping ${table.name} ${dateStr} - already running`);
        return;
      }
      if (job.status === 'partial' || job.status === 'failed') {
        console.log(`[SimpleArchiveService] Skipping ${table.name} ${dateStr} - has partial/failed job (${job.id}), requires manual intervention`);
        return;
      }
    }

    const jobResult = await db.execute(sql`
      INSERT INTO archive_jobs (table_name, archive_date, status, started_at, records_archived, records_deleted)
      VALUES (${table.name}, ${archiveDate}, 'running', NOW(), 0, 0)
      RETURNING id
    `);
    const jobId = (jobResult.rows[0] as any).id;
    console.log(`[SimpleArchiveService] Created job ${jobId} for ${table.name} ${dateStr}`);

    try {
      await this.updateProgress(jobId, { phase: "exporting", currentTable: table.name, currentDate: dateStr, recordsProcessed: 0 });

      const exportResult = await exportDayToParquet(table.name, archiveDate, table.dateColumn);
      if (!exportResult) {
        await db.execute(sql`
          UPDATE archive_jobs SET status = 'completed', completed_at = NOW(), progress = NULL WHERE id = ${jobId}
        `);
        console.log(`[SimpleArchiveService] Job ${jobId} completed - no records to archive`);
        return;
      }

      await this.updateProgress(jobId, { phase: "deleting", currentTable: table.name, currentDate: dateStr, recordsProcessed: exportResult.archived });

      const deletedCount = await deleteArchivedRecordsByDay(
        table.name,
        exportResult.minId,
        exportResult.maxId,
        exportResult.archived,
        table.dateColumn,
        archiveDate
      );

      await this.updateProgress(jobId, { phase: "vacuuming", currentTable: table.name, currentDate: dateStr, recordsProcessed: exportResult.archived });
      await runVacuum(table.name);

      await db.execute(sql`
        UPDATE archive_jobs
        SET status = 'completed', completed_at = NOW(), records_archived = ${exportResult.archived}, records_deleted = ${deletedCount}, progress = NULL
        WHERE id = ${jobId}
      `);

      console.log(`[SimpleArchiveService] Job ${jobId} completed: ${exportResult.archived} archived, ${deletedCount} deleted`);
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      console.error(`[SimpleArchiveService] Job ${jobId} failed:`, errorMsg);

      await db.execute(sql`
        UPDATE archive_jobs SET status = 'failed', completed_at = NOW(), error_message = ${errorMsg}, progress = NULL
        WHERE id = ${jobId}
      `);
    }
  }

  private async updateProgress(jobId: number, progress: ArchiveProgress): Promise<void> {
    try {
      await db.execute(sql`UPDATE archive_jobs SET progress = ${JSON.stringify(progress)}::jsonb WHERE id = ${jobId}`);
    } catch (error: any) {
      console.warn("[SimpleArchiveService] Failed to update progress:", error.message);
    }
  }

  async retryJob(jobId: number): Promise<{ success: boolean; message: string }> {
    if (this.isRunning) {
      return { success: false, message: "Arquivamento já em execução, aguarde para retentar" };
    }

    const result = await db.execute(sql`SELECT table_name, archive_date, status FROM archive_jobs WHERE id = ${jobId}`);
    if (result.rows.length === 0) {
      return { success: false, message: "Job não encontrado" };
    }

    const job = result.rows[0] as any;
    if (job.status !== "failed") {
      return { success: false, message: "Apenas jobs com status 'failed' podem ser retentados" };
    }

    await db.execute(sql`UPDATE archive_jobs SET status = 'invalidated', error_message = 'Substituído por retry' WHERE id = ${jobId}`);

    const table = ARCHIVE_TABLES.find((t) => t.name === job.table_name);
    if (!table) {
      return { success: false, message: "Tabela não encontrada" };
    }

    this.isRunning = true;
    this.archiveDay(table, new Date(job.archive_date))
      .catch((error) => {
        console.error(`[SimpleArchiveService] Retry failed for job ${jobId}:`, error.message);
      })
      .finally(() => {
        this.isRunning = false;
      });

    return { success: true, message: "Retry iniciado" };
  }

  getSchedulerStatus() {
    return this.scheduler.getStatus();
  }
}

export const simpleArchiveService = new SimpleArchiveService();
