import { pgTable, serial, text, timestamp, json, integer, index } from "drizzle-orm/pg-core";

export const externalDataSyncLogs = pgTable("external_data_sync_logs", {
  id: serial("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
  recordsProcessed: integer("records_processed").default(0).notNull(),
  recordsCreated: integer("records_created").default(0).notNull(),
  recordsUpdated: integer("records_updated").default(0).notNull(),
  recordsDeleted: integer("records_deleted").default(0).notNull(),
  recordsFailed: integer("records_failed").default(0).notNull(),
  errorMessage: text("error_message"),
  errorDetails: json("error_details"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceTypeIdx: index("idx_external_data_sync_logs_source_type").on(table.sourceType),
  statusIdx: index("idx_external_data_sync_logs_status").on(table.status),
  startedAtIdx: index("idx_external_data_sync_logs_started_at").on(table.startedAt),
}));

export type ExternalDataSyncLog = typeof externalDataSyncLogs.$inferSelect;
export type InsertExternalDataSyncLog = Omit<typeof externalDataSyncLogs.$inferInsert, "id" | "createdAt">;
