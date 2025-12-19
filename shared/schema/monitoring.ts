import { pgTable, serial, text, timestamp, integer, index, real } from "drizzle-orm/pg-core";

export const queryLogs = pgTable("query_logs", {
  id: serial("id").primaryKey(),
  queryHash: text("query_hash").notNull(),
  queryNormalized: text("query_normalized").notNull(),
  durationMs: integer("duration_ms").notNull(),
  rowsAffected: integer("rows_affected"),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  queryHashIdx: index("idx_query_logs_query_hash").on(table.queryHash),
  createdAtIdx: index("idx_query_logs_created_at").on(table.createdAt.desc()),
  durationIdx: index("idx_query_logs_duration").on(table.durationMs.desc()),
}));

export const queryStats = pgTable("query_stats", {
  id: serial("id").primaryKey(),
  queryHash: text("query_hash").notNull().unique(),
  queryNormalized: text("query_normalized").notNull(),
  callCount: integer("call_count").default(0).notNull(),
  totalDurationMs: integer("total_duration_ms").default(0).notNull(),
  avgDurationMs: real("avg_duration_ms").default(0).notNull(),
  maxDurationMs: integer("max_duration_ms").default(0).notNull(),
  minDurationMs: integer("min_duration_ms").default(0).notNull(),
  lastCalledAt: timestamp("last_called_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  callCountIdx: index("idx_query_stats_call_count").on(table.callCount.desc()),
  avgDurationIdx: index("idx_query_stats_avg_duration").on(table.avgDurationMs.desc()),
}));

export type QueryLog = typeof queryLogs.$inferSelect;
export type InsertQueryLog = Omit<typeof queryLogs.$inferInsert, "id" | "createdAt">;
export type QueryStat = typeof queryStats.$inferSelect;
export type InsertQueryStat = Omit<typeof queryStats.$inferInsert, "id" | "createdAt">;
