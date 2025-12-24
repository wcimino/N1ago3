import { pgTable, serial, text, timestamp, integer, index, jsonb } from "drizzle-orm/pg-core";

export interface HourlyMetadata {
  hour: number;
  archived: number;
  deleted: number;
  filePath: string | null;
  fileSize: number;
  minId?: number;
  maxId?: number;
}

export const archiveJobs = pgTable("archive_jobs", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  archiveDate: timestamp("archive_date").notNull(),
  status: text("status").notNull().default("pending"),
  recordsArchived: integer("records_archived").default(0).notNull(),
  recordsDeleted: integer("records_deleted").default(0).notNull(),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  lastProcessedHour: integer("last_processed_hour"),
  hourlyMetadata: jsonb("hourly_metadata").$type<HourlyMetadata[]>(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tableNameIdx: index("idx_archive_jobs_table_name").on(table.tableName),
  statusIdx: index("idx_archive_jobs_status").on(table.status),
  archiveDateIdx: index("idx_archive_jobs_archive_date").on(table.archiveDate),
}));

export type ArchiveJob = typeof archiveJobs.$inferSelect;
export type InsertArchiveJob = typeof archiveJobs.$inferInsert;
