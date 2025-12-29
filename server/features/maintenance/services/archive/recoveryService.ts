import { db } from "../../../../db.js";
import { sql } from "drizzle-orm";
import { getEnvironmentPrefix, exportHourWithOutcome } from "./parquetExporter.js";

export async function attemptDeletionRecovery(
  tableName: string,
  archiveDate: Date,
  dateColumn: string,
  jobId: number
): Promise<void> {
  const dateStr = archiveDate.toISOString().split("T")[0];
  const envPrefix = getEnvironmentPrefix();
  const privateDir = process.env.PRIVATE_OBJECT_DIR;

  if (!privateDir) {
    console.error(`[RecoveryService] Recovery failed: PRIVATE_OBJECT_DIR not configured`);
    return;
  }

  let totalRecovered = 0;
  let totalAuthoritativeArchived = 0;
  let hoursWithValidExport = 0;
  const failedHours: { hour: number; reason: string }[] = [];

  for (let hour = 0; hour < 24; hour++) {
    try {
      const outcome = await exportHourWithOutcome(tableName, archiveDate, hour, dateColumn);

      let deleted = 0;
      let hourArchived = 0;
      let hourValid = false;

      switch (outcome.status) {
        case "empty":
          hourValid = true;
          console.log(`[RecoveryService] Recovery: hour ${hour} has no data`);
          break;

        case "existing":
          hourValid = true;
          hourArchived = outcome.archived;
          const { deleteByIdRange } = await import("./tableCleaner.js");
          deleted = await deleteByIdRange(tableName, outcome.minId, outcome.maxId, outcome.archived);
          break;

        case "exported":
          hourValid = true;
          hourArchived = outcome.archived;
          const { deleteByIdRange: deleteByIdRangeFn } = await import("./tableCleaner.js");
          deleted = await deleteByIdRangeFn(tableName, outcome.minId, outcome.maxId, outcome.archived);
          break;
      }

      if (hourValid) {
        hoursWithValidExport++;
        totalAuthoritativeArchived += hourArchived;
      }
      if (deleted > 0) {
        totalRecovered += deleted;
        console.log(`[RecoveryService] Recovery hour ${hour}: deleted ${deleted} records`);
      }
    } catch (err: any) {
      failedHours.push({ hour, reason: err.message });
      console.warn(`[RecoveryService] Recovery error at hour ${hour}:`, err.message);
    }
  }

  console.log(`[RecoveryService] Auto-recovery for job ${jobId}: ${totalRecovered} deleted, authoritative archived: ${totalAuthoritativeArchived}, valid hours: ${hoursWithValidExport}/24`);

  const jobResult = await db.execute(sql`
    SELECT records_deleted, records_archived FROM archive_jobs WHERE id = ${jobId}
  `);
  const currentDeleted = Number((jobResult.rows[0] as any)?.records_deleted || 0);
  const finalDeleted = currentDeleted + totalRecovered;

  if (failedHours.length > 0) {
    const failedDetails = failedHours.map(f => `hour ${f.hour}: ${f.reason}`).join("; ");
    await db.execute(sql`
      UPDATE archive_jobs
      SET records_deleted = ${finalDeleted},
          error_message = ${`Recovery failed - ${failedDetails}`}
      WHERE id = ${jobId}
    `);
    console.warn(`[RecoveryService] Job ${jobId} had recovery errors: ${failedDetails}`);
  } else if (hoursWithValidExport === 24) {
    await db.execute(sql`
      UPDATE archive_jobs
      SET records_deleted = ${finalDeleted},
          records_archived = ${totalAuthoritativeArchived}
      WHERE id = ${jobId}
    `);

    if (finalDeleted >= totalAuthoritativeArchived) {
      await db.execute(sql`
        UPDATE archive_jobs
        SET status = 'completed',
            error_message = NULL,
            completed_at = ${new Date()}
        WHERE id = ${jobId}
      `);
      console.log(`[RecoveryService] Job ${jobId} promoted to completed (archived: ${totalAuthoritativeArchived}, deleted: ${finalDeleted})`);
    } else {
      const gap = totalAuthoritativeArchived - finalDeleted;
      console.warn(`[RecoveryService] Job ${jobId} remains partial - gap of ${gap} records`);
      await db.execute(sql`
        UPDATE archive_jobs
        SET error_message = ${`Recovery incomplete: ${gap} records still pending deletion`}
        WHERE id = ${jobId}
      `);
    }
  } else {
    await db.execute(sql`
      UPDATE archive_jobs
      SET records_deleted = ${finalDeleted},
          error_message = ${`Recovery incomplete: only ${hoursWithValidExport}/24 hours verified`}
      WHERE id = ${jobId}
    `);
    console.warn(`[RecoveryService] Job ${jobId} incomplete: only ${hoursWithValidExport}/24 hours verified`);
  }
}
