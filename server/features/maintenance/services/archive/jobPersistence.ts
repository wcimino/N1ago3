import { db } from "../../../../db.js";
import { archiveJobs, ArchiveJob, HourlyMetadata } from "../../../../../shared/schema.js";
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
  hourlyMetadata?: HourlyMetadata[] | null;
}

export interface ExistingJob {
  id: number;
  status: string;
  lastProcessedHour: number | null;
  recordsArchived: number;
  recordsDeleted: number;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  hourlyMetadata: HourlyMetadata[] | null;
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
    SELECT id, status, last_processed_hour, records_archived, records_deleted, file_path, file_size, error_message, hourly_metadata
    FROM archive_jobs
    WHERE table_name = ${tableName}
      AND archive_date::date = ${archiveDate}::date
      AND status IN ('running', 'partial')
    ORDER BY id DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;
  let hourlyMetadata: HourlyMetadata[] | null = null;
  if (row.hourly_metadata) {
    try {
      hourlyMetadata = typeof row.hourly_metadata === 'string' 
        ? JSON.parse(row.hourly_metadata) 
        : row.hourly_metadata;
    } catch {
      hourlyMetadata = null;
    }
  }
  
  return {
    id: row.id,
    status: row.status,
    lastProcessedHour: row.last_processed_hour,
    recordsArchived: row.records_archived || 0,
    recordsDeleted: row.records_deleted || 0,
    filePath: row.file_path,
    fileSize: row.file_size || 0,
    errorMessage: row.error_message || null,
    hourlyMetadata,
  };
}

export async function updateJobProgress(
  jobId: number,
  hour: number,
  recordsArchived: number,
  recordsDeleted: number,
  filePaths: string[],
  totalFileSize: number,
  hourlyMetadata?: HourlyMetadata[]
): Promise<void> {
  const filePathStr = filePaths.length > 0 ? filePaths.join(", ") : null;
  const metadataJson = hourlyMetadata && hourlyMetadata.length > 0 
    ? JSON.stringify(hourlyMetadata) 
    : null;
  
  await db.execute(sql`
    UPDATE archive_jobs
    SET last_processed_hour = ${hour},
        records_archived = ${recordsArchived},
        records_deleted = ${recordsDeleted},
        file_path = ${filePathStr},
        file_size = ${totalFileSize},
        hourly_metadata = ${metadataJson}::jsonb
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

export async function completeJob(
  jobId: number, 
  hadErrors: boolean, 
  totalArchived?: number, 
  totalDeleted?: number,
  deletionDiscrepancy?: boolean,
  discrepancyDetails?: string | null
): Promise<void> {
  let finalStatus = hadErrors ? "partial" : "completed";
  let errorMessage: string | null = hadErrors ? "Stopped at first error - check logs" : null;

  if (deletionDiscrepancy && !hadErrors) {
    finalStatus = "partial";
    errorMessage = discrepancyDetails 
      ? `Per-hour deletion discrepancy: ${discrepancyDetails}` 
      : "Deletion discrepancy detected";
  } else if (!hadErrors && totalArchived !== undefined && totalDeleted !== undefined) {
    if (totalArchived > 0 && totalDeleted === 0) {
      finalStatus = "partial";
      errorMessage = "Archived records but deletion failed - records still in database";
    }
  }

  await db.execute(sql`
    UPDATE archive_jobs
    SET status = ${finalStatus},
        completed_at = ${new Date()},
        error_message = ${errorMessage}
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

export async function invalidateExistingJobs(tableName: string, archiveDate: Date, excludeJobId?: number): Promise<number> {
  const result = await db.execute(sql`
    UPDATE archive_jobs
    SET status = 'invalidated',
        error_message = 'Invalidated by force archive'
    WHERE table_name = ${tableName}
      AND archive_date::date = ${archiveDate}::date
      AND status IN ('running', 'partial', 'completed')
      ${excludeJobId ? sql`AND id != ${excludeJobId}` : sql``}
    RETURNING id
  `);
  const count = result.rows.length;
  if (count > 0) {
    console.log(`[JobPersistence] Invalidated ${count} existing jobs for ${tableName} on ${archiveDate.toISOString().split("T")[0]}${excludeJobId ? ` (excluding job ${excludeJobId})` : ''}`);
  }
  return count;
}

export async function getInconsistentJobs(limit: number = 50): Promise<ArchiveJob[]> {
  const result = await db.execute(sql`
    SELECT *
    FROM archive_jobs
    WHERE (
      (status = 'completed' AND records_archived > 0 AND records_deleted = 0)
      OR (status = 'partial' AND records_archived > 0 AND records_deleted < records_archived * 0.5)
    )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return (result.rows as any[]).map(row => {
    let hourlyMetadata: HourlyMetadata[] | null = null;
    if (row.hourly_metadata) {
      try {
        hourlyMetadata = typeof row.hourly_metadata === 'string' 
          ? JSON.parse(row.hourly_metadata) 
          : row.hourly_metadata;
      } catch {
        hourlyMetadata = null;
      }
    }
    return {
      id: row.id,
      tableName: row.table_name,
      archiveDate: row.archive_date,
      status: row.status,
      recordsArchived: Number(row.records_archived ?? 0),
      recordsDeleted: Number(row.records_deleted ?? 0),
      filePath: row.file_path ?? null,
      fileSize: Number(row.file_size ?? 0),
      errorMessage: row.error_message ?? null,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
      lastProcessedHour: row.last_processed_hour ?? null,
      hourlyMetadata,
    };
  });
}

export async function getJobStats(): Promise<{
  runningJobs: number;
  completedJobs: number;
  totalArchivedRecords: number;
  inconsistentJobs: number;
}> {
  const result = await db.execute(sql`
    SELECT 
      SUM(CASE WHEN status IN ('running', 'pending') THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'completed' THEN records_archived ELSE 0 END) as total_archived,
      SUM(CASE WHEN (status = 'completed' AND records_archived > 0 AND records_deleted = 0) OR (status = 'partial' AND records_archived > 0 AND records_deleted < records_archived * 0.5) THEN 1 ELSE 0 END) as inconsistent
    FROM archive_jobs
  `);
  const row = result.rows[0] as any;
  return {
    runningJobs: Number(row?.running || 0),
    completedJobs: Number(row?.completed || 0),
    totalArchivedRecords: Number(row?.total_archived || 0),
    inconsistentJobs: Number(row?.inconsistent || 0),
  };
}
