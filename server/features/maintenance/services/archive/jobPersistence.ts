import { db } from "../../../../db.js";
import { archiveJobs, ArchiveJob } from "../../../../../shared/schema.js";
import { sql, desc } from "drizzle-orm";

export interface JobRecord {
  id?: number;
  tableName: string;
  archiveDate: Date;
  status: string;
  recordsArchived: number;
  recordsDeleted: number;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  lastProcessedHour?: number | null;
}

export interface ExistingJob {
  id: number;
  status: string;
  lastProcessedHour: number | null;
  recordsArchived: number;
  recordsDeleted: number;
  filePath: string | null;
  fileSize: number | null;
}

export async function createJob(job: JobRecord): Promise<number> {
  const insertResult = await db.insert(archiveJobs).values({
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
  }).returning({ id: archiveJobs.id });
  return insertResult[0].id;
}

export async function getExistingJob(tableName: string, archiveDate: Date): Promise<ExistingJob | null> {
  const result = await db.execute(sql`
    SELECT id, status, last_processed_hour, records_archived, records_deleted, file_path, file_size
    FROM archive_jobs
    WHERE table_name = ${tableName}
      AND archive_date::date = ${archiveDate}::date
      AND status IN ('running', 'partial')
    ORDER BY id DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;
  return {
    id: row.id,
    status: row.status,
    lastProcessedHour: row.last_processed_hour,
    recordsArchived: row.records_archived || 0,
    recordsDeleted: row.records_deleted || 0,
    filePath: row.file_path,
    fileSize: row.file_size || 0,
  };
}

export async function updateJobProgress(
  jobId: number,
  hour: number,
  recordsArchived: number,
  recordsDeleted: number,
  filePaths: string[],
  totalFileSize: number
): Promise<void> {
  await db.execute(sql`
    UPDATE archive_jobs
    SET last_processed_hour = ${hour},
        records_archived = ${recordsArchived},
        records_deleted = ${recordsDeleted},
        file_path = ${filePaths.length > 0 ? filePaths.join(", ") : null},
        file_size = ${totalFileSize}
    WHERE id = ${jobId}
  `);
}

export async function markJobPartial(jobId: number, errorMessage: string, lastSuccessfulHour: number | null): Promise<void> {
  await db.execute(sql`
    UPDATE archive_jobs
    SET status = 'partial',
        error_message = ${errorMessage || 'Unknown error'},
        last_processed_hour = ${lastSuccessfulHour !== null && lastSuccessfulHour >= 0 ? lastSuccessfulHour : null}
    WHERE id = ${jobId}
  `);
}

export async function completeJob(jobId: number, hadErrors: boolean): Promise<void> {
  const finalStatus = hadErrors ? "partial" : "completed";
  await db.execute(sql`
    UPDATE archive_jobs
    SET status = ${finalStatus},
        completed_at = ${new Date()},
        error_message = ${hadErrors ? "Stopped at first error - check logs" : null}
    WHERE id = ${jobId}
  `);
}

export async function getJobHistory(limit: number = 50): Promise<ArchiveJob[]> {
  return db
    .select()
    .from(archiveJobs)
    .orderBy(desc(archiveJobs.createdAt))
    .limit(limit);
}

export async function getJobStats(): Promise<{
  runningJobs: number;
  completedJobs: number;
  totalArchivedRecords: number;
}> {
  const result = await db.execute(sql`
    SELECT 
      SUM(CASE WHEN status IN ('running', 'pending') THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'completed' THEN records_archived ELSE 0 END) as total_archived
    FROM archive_jobs
  `);
  const row = result.rows[0] as any;
  return {
    runningJobs: Number(row?.running || 0),
    completedJobs: Number(row?.completed || 0),
    totalArchivedRecords: Number(row?.total_archived || 0),
  };
}
