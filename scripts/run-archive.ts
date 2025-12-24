import { db } from "../server/db.js";
import { sql } from "drizzle-orm";
import { exportHourToParquet, getEnvironmentPrefix } from "../server/features/maintenance/services/archive/parquetExporter.js";
import { deleteArchivedRecords, runVacuum } from "../server/features/maintenance/services/archive/tableCleaner.js";
import * as jobPersistence from "../server/features/maintenance/services/archive/jobPersistence.js";

const ARCHIVE_TABLES = [
  { name: "zendesk_conversations_webhook_raw", dateColumn: "received_at", archiveToParquet: true },
  { name: "openai_api_logs", dateColumn: "created_at", archiveToParquet: true },
  { name: "responses_suggested", dateColumn: "created_at", archiveToParquet: true },
  { name: "query_logs", dateColumn: "created_at", archiveToParquet: false },
];

async function getStats() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  console.log("\n=== Archive Stats ===");
  console.log(`Cutoff date: ${yesterday.toISOString()}\n`);

  for (const table of ARCHIVE_TABLES) {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        MIN(${sql.identifier(table.dateColumn)})::date as oldest_date,
        COUNT(DISTINCT DATE(${sql.identifier(table.dateColumn)})) as days
      FROM ${sql.identifier(table.name)}
      WHERE ${sql.identifier(table.dateColumn)} < ${yesterday}
    `);
    const row = result.rows[0] as any;
    console.log(`${table.name}:`);
    console.log(`  - Pending records: ${row?.count || 0}`);
    console.log(`  - Pending days: ${row?.days || 0}`);
    console.log(`  - Oldest date: ${row?.oldest_date || 'N/A'}`);
    console.log();
  }
}

async function runArchive() {
  console.log("\n=== Starting Archive Process ===");
  console.log(`Environment: ${getEnvironmentPrefix()}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  let totalArchived = 0;
  let totalDeleted = 0;

  for (const table of ARCHIVE_TABLES) {
    console.log(`\n--- Processing ${table.name} ---`);

    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE(${sql.identifier(table.dateColumn)}), 'YYYY-MM-DD') as date,
        COUNT(*) as count
      FROM ${sql.identifier(table.name)}
      WHERE ${sql.identifier(table.dateColumn)} < ${yesterday}
      GROUP BY DATE(${sql.identifier(table.dateColumn)})
      ORDER BY date ASC
    `);

    const dates = result.rows as any[];
    console.log(`Found ${dates.length} days to archive`);

    for (const dateRow of dates) {
      const dateStr = dateRow.date as string;
      console.log(`  Processing ${dateStr} (${dateRow.count} records)...`);

      if (table.archiveToParquet) {
        for (let hour = 0; hour < 24; hour++) {
          const startOfHour = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00.000Z`);
          const endOfHour = new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:59:59.999Z`);

          try {
            const exportResult = await exportHourToParquet(
              table.name,
              table.dateColumn,
              startOfHour,
              endOfHour
            );

            if (exportResult && exportResult.count > 0) {
              totalArchived += exportResult.count;

              await jobPersistence.saveJob({
                tableName: table.name,
                dateHour: startOfHour.toISOString(),
                recordCount: exportResult.count,
                minId: exportResult.minId,
                maxId: exportResult.maxId,
                parquetPath: exportResult.parquetPath,
                status: "exported",
              });

              const deletedCount = await deleteArchivedRecords(
                table.name,
                exportResult.minId,
                exportResult.maxId,
                exportResult.count,
                table.dateColumn,
                startOfHour,
                endOfHour
              );
              totalDeleted += deletedCount;

              await jobPersistence.updateJobStatus(
                table.name,
                startOfHour.toISOString(),
                "completed"
              );
            }
          } catch (err: any) {
            console.error(`    Error at hour ${hour}: ${err.message}`);
          }
        }
      } else {
        const deleteDate = new Date(`${dateStr}T00:00:00.000Z`);
        const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
        
        try {
          const deleteResult = await db.execute(sql`
            DELETE FROM ${sql.identifier(table.name)}
            WHERE ${sql.identifier(table.dateColumn)} >= ${deleteDate}
              AND ${sql.identifier(table.dateColumn)} <= ${endOfDay}
          `);
          const deleted = (deleteResult as any).rowCount || 0;
          totalDeleted += deleted;
          console.log(`    Deleted ${deleted} records`);
        } catch (err: any) {
          console.error(`    Error deleting ${dateStr}: ${err.message}`);
        }
      }
    }

    console.log(`  Running VACUUM FULL on ${table.name}...`);
    await runVacuum(table.name);
    console.log(`  VACUUM completed for ${table.name}`);
  }

  console.log("\n=== Archive Process Completed ===");
  console.log(`Total archived: ${totalArchived} records`);
  console.log(`Total deleted: ${totalDeleted} records`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

async function main() {
  const command = process.argv[2] || "stats";

  try {
    if (command === "stats") {
      await getStats();
    } else if (command === "run") {
      await getStats();
      await runArchive();
    } else {
      console.log("Usage: npx tsx scripts/run-archive.ts [stats|run]");
      console.log("  stats - Show pending records to archive");
      console.log("  run   - Execute the archive process");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
