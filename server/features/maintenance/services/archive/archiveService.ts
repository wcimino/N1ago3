import { db } from "../../../../db.js";
import { sql } from "drizzle-orm";
import { ArchiveScheduler } from "./scheduler.js";
import * as jobPersistence from "./jobPersistence.js";
import { exportHourToParquet, exportHourWithOutcome, getEnvironmentPrefix } from "./parquetExporter.js";
import { deleteArchivedRecords, deleteByTimeRange, runVacuum } from "./tableCleaner.js";
import { objectStorageClient } from "../../../../replit_integrations/object_storage/objectStorage.js";
import { HourlyMetadata } from "../../../../../shared/schema.js";

interface TableStats {
  pendingRecords: number;
  pendingDays: number;
  oldestDate: string | null;
}

export interface ArchiveStats {
  zendeskWebhook: TableStats;
  openaiLogs: TableStats;
  responsesSuggested: TableStats;
  runningJobs: number;
  completedJobs: number;
  totalArchivedRecords: number;
  inconsistentJobs: number;
}

export interface ArchiveProgress {
  tableName: string;
  status: string;
  currentDate: string | null;
  currentHour: number | null;
  recordsArchived: number;
  recordsDeleted: number;
}

const ARCHIVE_TABLES = [
  { name: "zendesk_conversations_webhook_raw", dateColumn: "received_at" },
  { name: "openai_api_logs", dateColumn: "created_at" },
  { name: "responses_suggested", dateColumn: "created_at" },
];

class ArchiveService {
  private isRunning: boolean = false;
  private currentProgress: ArchiveProgress | null = null;
  private scheduler: ArchiveScheduler;

  constructor() {
    this.scheduler = new ArchiveScheduler({
      onRun: () => this.runArchiveProcess(),
    });
  }

  start(): void {
    console.log("[ArchiveService] Starting service");
    this.scheduler.start();
  }

  stop(): void {
    this.scheduler.stop();
    console.log("[ArchiveService] Service stopped");
  }

  getSchedulerStatus(): { isRunning: boolean; lastRunDate: string | null; nextRunHourUTC: number } {
    const schedulerStatus = this.scheduler.getStatus();
    return {
      isRunning: this.isRunning,
      ...schedulerStatus,
    };
  }

  async getStats(): Promise<ArchiveStats> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const [zendeskStats, openaiStats, responsesStats, jobStats] = await Promise.all([
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
      jobPersistence.getJobStats(),
    ]);

    const zRow = zendeskStats.rows[0] as any;
    const oRow = openaiStats.rows[0] as any;
    const rRow = responsesStats.rows[0] as any;

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
      ...jobStats,
    };
  }

  async getHistory(limit: number = 50) {
    return jobPersistence.getJobHistory(limit);
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
        this.scheduler.setLastRunDate(new Date().toISOString().split("T")[0]);
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

  async forceArchive(tableName: string, dateStr: string): Promise<{ message: string; jobId?: number }> {
    if (this.isRunning) {
      throw new Error("Arquivamento já está em execução. Aguarde a conclusão.");
    }

    const validTables = ARCHIVE_TABLES.map(t => t.name);
    if (!validTables.includes(tableName)) {
      throw new Error(`Tabela inválida. Use: ${validTables.join(", ")}`);
    }

    const archiveDate = new Date(dateStr);
    if (isNaN(archiveDate.getTime())) {
      throw new Error("Data inválida. Use formato YYYY-MM-DD");
    }

    const tableConfig = ARCHIVE_TABLES.find(t => t.name === tableName)!;

    console.log(`[ArchiveService] Starting FORCE archive for ${tableName} on ${dateStr}`);

    this.isRunning = true;

    this.runForceArchiveProcess(tableName, archiveDate, tableConfig.dateColumn)
      .then(async (result) => {
        if (result.isSuccess) {
          const invalidatedCount = await jobPersistence.invalidateExistingJobs(tableName, archiveDate, result.jobId);
          if (invalidatedCount > 0) {
            console.log(`[ArchiveService] Invalidated ${invalidatedCount} previous jobs after successful force archive (kept job ${result.jobId})`);
          }
          console.log(`[ArchiveService] Force archive completed successfully for ${tableName} on ${dateStr}`);
        } else {
          console.warn(`[ArchiveService] Force archive finished with partial status for ${tableName} on ${dateStr} - previous jobs NOT invalidated`);
        }
      })
      .catch(err => {
        console.error(`[ArchiveService] Force archive failed for ${tableName} on ${dateStr}:`, err.message);
      })
      .finally(() => {
        this.isRunning = false;
        this.currentProgress = null;
      });

    return { 
      message: `Arquivamento forçado iniciado para ${tableName} em ${dateStr}` 
    };
  }

  private async runForceArchiveProcess(tableName: string, archiveDate: Date, dateColumn: string): Promise<{ jobId: number; isSuccess: boolean }> {
    const result = await this.archiveDateDataForce(tableName, archiveDate, dateColumn);
    await runVacuum(tableName);
    return result;
  }

  private async runArchiveProcess(): Promise<void> {
    for (const table of ARCHIVE_TABLES) {
      await this.archiveTable(table.name, table.dateColumn);
      await runVacuum(table.name);
    }
  }

  private async archiveTable(tableName: string, dateColumn: string): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const datesResult = await db.execute(sql`
      SELECT DISTINCT DATE(${sql.identifier(dateColumn)}) as archive_date
      FROM ${sql.identifier(tableName)}
      WHERE ${sql.identifier(dateColumn)} < ${yesterday}
      ORDER BY archive_date ASC
    `);

    const dates = (datesResult.rows as any[]).map(r => new Date(r.archive_date));

    for (const archiveDate of dates) {
      await this.archiveDateData(tableName, archiveDate, dateColumn);
    }
  }

  private async archiveDateData(tableName: string, archiveDate: Date, dateColumn: string): Promise<void> {
    const existingJob = await jobPersistence.getExistingJob(tableName, archiveDate);

    let jobId: number;
    let startHour = 0;
    let totalArchived = 0;
    let totalDeleted = 0;
    const filePaths: string[] = [];
    let totalFileSize = 0;
    let hadErrors = false;
    let hourlyMetadata: HourlyMetadata[] = [];

    if (existingJob) {
      jobId = existingJob.id;
      startHour = (existingJob.lastProcessedHour ?? -1) + 1;
      totalArchived = existingJob.recordsArchived;
      totalDeleted = existingJob.recordsDeleted;
      if (existingJob.filePath) {
        filePaths.push(...existingJob.filePath.split(", "));
      }
      totalFileSize = existingJob.fileSize || 0;
      hourlyMetadata = existingJob.hourlyMetadata || [];
      
      if (startHour >= 24) {
        if (existingJob.status === "partial" && existingJob.errorMessage?.includes("discrepancy")) {
          console.log(`[ArchiveService] Job ${jobId} is partial with discrepancy - attempting auto-recovery`);
          const { attemptDeletionRecovery } = await import("./recoveryService.js");
          await attemptDeletionRecovery(tableName, archiveDate, dateColumn, jobId);
        } else {
          console.log(`[ArchiveService] Job ${jobId} already fully processed, skipping`);
        }
        return;
      }
      console.log(`[ArchiveService] Resuming job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]} from hour ${startHour}`);
    } else {
      jobId = await jobPersistence.createJob({
        tableName,
        archiveDate,
        status: "running",
        recordsArchived: 0,
        recordsDeleted: 0,
        filePath: null,
        fileSize: null,
        errorMessage: null,
      });
      console.log(`[ArchiveService] Starting new job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]}`);
    }

    let lastSuccessfulHour = startHour - 1;
    let deletionDiscrepancy = false;
    const discrepancyDetails: string[] = [];

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

          hourlyMetadata.push({
            hour,
            archived: result.archived,
            deleted: result.deleted,
            filePath: result.filePath,
            fileSize: result.fileSize || 0,
            minId: result.minId,
            maxId: result.maxId,
          });

          if (result.archived > 0 && result.deleted < result.archived * 0.5) {
            deletionDiscrepancy = true;
            discrepancyDetails.push(`hour ${hour}: archived ${result.archived}, deleted ${result.deleted}`);
            console.warn(`[ArchiveService] Deletion discrepancy at hour ${hour}: archived ${result.archived} but only deleted ${result.deleted}`);
          }
        }

        lastSuccessfulHour = hour;
        await jobPersistence.updateJobProgress(jobId, hour, totalArchived, totalDeleted, filePaths, totalFileSize, hourlyMetadata);
      } catch (err: any) {
        console.error(`[ArchiveService] Error archiving ${tableName} for ${archiveDate.toISOString().split("T")[0]} hour ${hour}:`, err);
        hadErrors = true;
        await jobPersistence.markJobPartial(jobId, err.message, lastSuccessfulHour >= 0 ? lastSuccessfulHour : null);
        break;
      }
    }

    const discrepancyMessage = deletionDiscrepancy ? discrepancyDetails.join("; ") : null;
    await jobPersistence.completeJob(jobId, hadErrors, totalArchived, totalDeleted, deletionDiscrepancy, discrepancyMessage);
    const finalStatus = hadErrors || deletionDiscrepancy ? "partial" : "completed";
    console.log(`[ArchiveService] Job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]} finished with status: ${finalStatus} (archived: ${totalArchived}, deleted: ${totalDeleted})`);
  }

  private async archiveDateDataForce(tableName: string, archiveDate: Date, dateColumn: string): Promise<{ jobId: number; isSuccess: boolean }> {
    const jobId = await jobPersistence.createJob({
      tableName,
      archiveDate,
      status: "running",
      recordsArchived: 0,
      recordsDeleted: 0,
      filePath: null,
      fileSize: null,
      errorMessage: null,
    });
    console.log(`[ArchiveService] Starting FORCE job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]}`);

    let totalArchived = 0;
    let totalDeleted = 0;
    const hourlyMetadata: HourlyMetadata[] = [];
    let totalFileSize = 0;
    let hadErrors = false;
    let lastSuccessfulHour = -1;
    let deletionDiscrepancy = false;
    const discrepancyDetails: string[] = [];

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
        const result = await this.archiveHourDataForce(tableName, archiveDate, hour, dateColumn);
        if (result) {
          totalArchived += result.archived;
          totalDeleted += result.deleted;
          totalFileSize += result.fileSize || 0;
          
          hourlyMetadata.push({
            hour,
            archived: result.archived,
            deleted: result.deleted,
            filePath: result.filePath,
            fileSize: result.fileSize || 0,
            minId: result.minId,
            maxId: result.maxId,
          });

          if (result.archived > 0 && result.deleted < result.archived * 0.5) {
            deletionDiscrepancy = true;
            discrepancyDetails.push(`hour ${hour}: archived ${result.archived}, deleted ${result.deleted}`);
            console.warn(`[ArchiveService] Deletion discrepancy at hour ${hour}: archived ${result.archived} but only deleted ${result.deleted}`);
          }
        }

        lastSuccessfulHour = hour;
        const filePaths = hourlyMetadata.filter(h => h.filePath).map(h => h.filePath!);
        await jobPersistence.updateJobProgress(jobId, hour, totalArchived, totalDeleted, filePaths, totalFileSize, hourlyMetadata);
      } catch (err: any) {
        console.error(`[ArchiveService] Error in FORCE archive ${tableName} for ${archiveDate.toISOString().split("T")[0]} hour ${hour}:`, err);
        hadErrors = true;
        await jobPersistence.markJobPartial(jobId, err.message, lastSuccessfulHour >= 0 ? lastSuccessfulHour : null);
        throw err;
      }
    }

    const discrepancyMessage = deletionDiscrepancy ? discrepancyDetails.join("; ") : null;
    await jobPersistence.completeJob(jobId, hadErrors, totalArchived, totalDeleted, deletionDiscrepancy, discrepancyMessage);
    const isSuccess = !hadErrors && !deletionDiscrepancy;
    const finalStatus = isSuccess ? "completed" : "partial";
    console.log(`[ArchiveService] FORCE Job ${jobId} for ${tableName} ${archiveDate.toISOString().split("T")[0]} finished with status: ${finalStatus} (archived: ${totalArchived}, deleted: ${totalDeleted})`);
    
    return { jobId, isSuccess };
  }

  private async archiveHourDataForce(
    tableName: string,
    archiveDate: Date,
    hour: number,
    dateColumn: string
  ): Promise<{ archived: number; deleted: number; filePath: string | null; fileSize: number | null; minId?: number; maxId?: number } | null> {
    const startOfHour = new Date(archiveDate);
    startOfHour.setHours(hour, 0, 0, 0);
    const endOfHour = new Date(archiveDate);
    endOfHour.setHours(hour, 59, 59, 999);

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
      console.log(`[ArchiveService] FORCE: Deleting existing file ${storageFileName} before re-export`);
      try {
        await file.delete();
      } catch (delErr: any) {
        console.warn(`[ArchiveService] Could not delete existing file: ${delErr.message}`);
      }
    }

    const exportResult = await exportHourToParquet(
      tableName,
      archiveDate,
      hour,
      dateColumn,
      (count) => {
        if (this.currentProgress) {
          this.currentProgress.recordsArchived += count;
        }
      }
    );

    if (!exportResult) {
      return null;
    }

    const deletedCount = await deleteArchivedRecords(
      tableName,
      exportResult.minId,
      exportResult.maxId,
      exportResult.archived,
      dateColumn,
      startOfHour,
      endOfHour,
      (count) => {
        if (this.currentProgress) {
          this.currentProgress.recordsDeleted += count;
        }
      }
    );

    console.log(`[ArchiveService] FORCE completed ${storageFileName}: ${exportResult.archived} archived, ${deletedCount} deleted`);

    return {
      archived: exportResult.archived,
      deleted: deletedCount,
      filePath: exportResult.filePath,
      fileSize: exportResult.fileSize,
      minId: exportResult.minId,
      maxId: exportResult.maxId,
    };
  }

  private async archiveHourData(
    tableName: string,
    archiveDate: Date,
    hour: number,
    dateColumn: string
  ): Promise<{ archived: number; deleted: number; filePath: string | null; fileSize: number | null; minId?: number; maxId?: number } | null> {
    const startOfHour = new Date(archiveDate);
    startOfHour.setHours(hour, 0, 0, 0);
    const endOfHour = new Date(archiveDate);
    endOfHour.setHours(hour, 59, 59, 999);

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
      const fileSize = Number(metadata.size || 0);

      if (existingRecordCount > 0 && archivedMinId > 0 && archivedMaxId > 0) {
        console.log(`[ArchiveService] File already exists: ${storageFileName}, deleting only archived records`);
        const { deleteByIdRange } = await import("./tableCleaner.js");
        const deletedCount = await deleteByIdRange(tableName, archivedMinId, archivedMaxId, existingRecordCount);
        return {
          archived: existingRecordCount,
          deleted: deletedCount,
          filePath: storageFileName,
          fileSize,
          minId: archivedMinId,
          maxId: archivedMaxId,
        };
      }

      if (fileSize > 0) {
        console.warn(`[ArchiveService] File exists but has no valid metadata: ${storageFileName}, using timestamp fallback for deletion only`);
        const deletedCount = await deleteByTimeRange(
          tableName,
          dateColumn,
          startOfHour,
          endOfHour,
          (count) => {
            if (this.currentProgress) {
              this.currentProgress.recordsDeleted += count;
            }
          }
        );
        return {
          archived: 0,
          deleted: deletedCount,
          filePath: storageFileName,
          fileSize,
        };
      }

      console.warn(`[ArchiveService] File exists but is empty: ${storageFileName}, will re-export`);
    }

    const exportResult = await exportHourToParquet(
      tableName,
      archiveDate,
      hour,
      dateColumn,
      (count) => {
        if (this.currentProgress) {
          this.currentProgress.recordsArchived += count;
        }
      }
    );

    if (!exportResult) {
      return null;
    }

    const deletedCount = await deleteArchivedRecords(
      tableName,
      exportResult.minId,
      exportResult.maxId,
      exportResult.archived,
      dateColumn,
      startOfHour,
      endOfHour,
      (count) => {
        if (this.currentProgress) {
          this.currentProgress.recordsDeleted += count;
        }
      }
    );

    console.log(`[ArchiveService] Completed ${storageFileName}: ${exportResult.archived} archived, ${deletedCount} deleted`);

    return {
      archived: exportResult.archived,
      deleted: deletedCount,
      filePath: exportResult.filePath,
      fileSize: exportResult.fileSize,
      minId: exportResult.minId,
      maxId: exportResult.maxId,
    };
  }

}

export const archiveService = new ArchiveService();
