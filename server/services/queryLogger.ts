import { db as originalDb, pool } from "../db";
import { queryLogs, queryStats } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

let loggingEnabled = true;
let logToConsole = false;
let slowQueryThresholdMs = 100;

const pendingLogs: Array<{
  queryHash: string;
  queryNormalized: string;
  durationMs: number;
  rowsAffected?: number;
  source?: string;
}> = [];

let flushTimer: NodeJS.Timeout | null = null;

function normalizeQuery(query: string): string {
  return query
    .replace(/\s+/g, " ")
    .replace(/\$\d+/g, "?")
    .replace(/'[^']*'/g, "'?'")
    .replace(/\d+/g, "?")
    .trim()
    .substring(0, 500);
}

function hashQuery(normalizedQuery: string): string {
  return crypto.createHash("md5").update(normalizedQuery).digest("hex").substring(0, 16);
}

export function setLoggingEnabled(enabled: boolean) {
  loggingEnabled = enabled;
}

export function setLogToConsole(enabled: boolean) {
  logToConsole = enabled;
}

export function setSlowQueryThreshold(ms: number) {
  slowQueryThresholdMs = ms;
}

export function getLoggingConfig() {
  return {
    enabled: loggingEnabled,
    logToConsole,
    slowQueryThresholdMs,
    pendingLogsCount: pendingLogs.length,
  };
}

async function flushLogs() {
  if (pendingLogs.length === 0) return;

  const logsToFlush = pendingLogs.splice(0, pendingLogs.length);
  
  try {
    for (const log of logsToFlush) {
      await originalDb.insert(queryLogs).values({
        queryHash: log.queryHash,
        queryNormalized: log.queryNormalized,
        durationMs: log.durationMs,
        rowsAffected: log.rowsAffected,
        source: log.source,
      });

      await originalDb
        .insert(queryStats)
        .values({
          queryHash: log.queryHash,
          queryNormalized: log.queryNormalized,
          callCount: 1,
          totalDurationMs: log.durationMs,
          avgDurationMs: log.durationMs,
          maxDurationMs: log.durationMs,
          minDurationMs: log.durationMs,
          lastCalledAt: new Date(),
        })
        .onConflictDoUpdate({
          target: queryStats.queryHash,
          set: {
            callCount: sql`${queryStats.callCount} + 1`,
            totalDurationMs: sql`${queryStats.totalDurationMs} + ${log.durationMs}`,
            avgDurationMs: sql`(${queryStats.totalDurationMs} + ${log.durationMs}) / (${queryStats.callCount} + 1)`,
            maxDurationMs: sql`GREATEST(${queryStats.maxDurationMs}, ${log.durationMs})`,
            minDurationMs: sql`LEAST(${queryStats.minDurationMs}, ${log.durationMs})`,
            lastCalledAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.error("[QueryLogger] Failed to flush logs:", error);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs();
  }, 5000);
}

export function logQuery(
  query: string,
  durationMs: number,
  rowsAffected?: number,
  source?: string
) {
  if (!loggingEnabled) return;
  if (query.includes("query_logs") || query.includes("query_stats")) return;

  const normalized = normalizeQuery(query);
  const hash = hashQuery(normalized);

  if (logToConsole || durationMs >= slowQueryThresholdMs) {
    const prefix = durationMs >= slowQueryThresholdMs ? "[SLOW QUERY]" : "[Query]";
    console.log(`${prefix} ${durationMs}ms: ${normalized.substring(0, 100)}...`);
  }

  pendingLogs.push({
    queryHash: hash,
    queryNormalized: normalized,
    durationMs,
    rowsAffected,
    source,
  });

  if (pendingLogs.length >= 50) {
    flushLogs();
  } else {
    scheduleFlush();
  }
}

export async function getQueryStats(options: {
  orderBy?: "callCount" | "avgDuration" | "totalDuration" | "maxDuration";
  limit?: number;
  period?: "1h" | "24h" | "all";
}) {
  const { orderBy = "callCount", limit = 50, period = "all" } = options;

  if (period === "1h" || period === "24h") {
    const interval = period === "1h" ? "1 hour" : "24 hours";
    
    let orderByColumn: string;
    switch (orderBy) {
      case "avgDuration":
        orderByColumn = '"avgDurationMs" DESC';
        break;
      case "totalDuration":
        orderByColumn = '"totalDurationMs" DESC';
        break;
      case "maxDuration":
        orderByColumn = '"maxDurationMs" DESC';
        break;
      default:
        orderByColumn = '"callCount" DESC';
    }

    const results = await originalDb.execute(sql`
      SELECT 
        query_hash as "queryHash",
        query_normalized as "queryNormalized",
        COUNT(*)::int as "callCount",
        SUM(duration_ms)::float as "totalDurationMs",
        AVG(duration_ms)::float as "avgDurationMs",
        MAX(duration_ms)::int as "maxDurationMs",
        MIN(duration_ms)::int as "minDurationMs",
        MAX(created_at) as "lastCalledAt"
      FROM query_logs
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(interval)}'
      GROUP BY query_hash, query_normalized
      ORDER BY ${sql.raw(orderByColumn)}
      LIMIT ${limit}
    `);
    
    return results.rows.map((row: any, idx: number) => ({
      id: idx + 1,
      queryHash: row.queryHash,
      queryNormalized: row.queryNormalized,
      callCount: Number(row.callCount),
      totalDurationMs: Number(row.totalDurationMs),
      avgDurationMs: Number(row.avgDurationMs),
      maxDurationMs: Number(row.maxDurationMs),
      minDurationMs: Number(row.minDurationMs),
      lastCalledAt: row.lastCalledAt,
    }));
  }

  let orderClause;
  switch (orderBy) {
    case "avgDuration":
      orderClause = sql`${queryStats.avgDurationMs} DESC`;
      break;
    case "totalDuration":
      orderClause = sql`${queryStats.totalDurationMs} DESC`;
      break;
    case "maxDuration":
      orderClause = sql`${queryStats.maxDurationMs} DESC`;
      break;
    default:
      orderClause = sql`${queryStats.callCount} DESC`;
  }

  const results = await originalDb.select().from(queryStats).orderBy(orderClause).limit(limit);
  return results;
}

export async function getRecentSlowQueries(thresholdMs: number = 100, limit: number = 50, period?: "1h" | "24h" | "all") {
  let whereClause = sql`${queryLogs.durationMs} >= ${thresholdMs}`;
  
  if (period === "1h") {
    whereClause = sql`${queryLogs.durationMs} >= ${thresholdMs} AND ${queryLogs.createdAt} >= NOW() - INTERVAL '1 hour'`;
  } else if (period === "24h") {
    whereClause = sql`${queryLogs.durationMs} >= ${thresholdMs} AND ${queryLogs.createdAt} >= NOW() - INTERVAL '24 hours'`;
  }

  const results = await originalDb
    .select()
    .from(queryLogs)
    .where(whereClause)
    .orderBy(sql`${queryLogs.createdAt} DESC`)
    .limit(limit);

  return results;
}

export async function getQueryLogsSummary(period?: "1h" | "24h" | "all") {
  let logsWhereClause = sql`${queryLogs.durationMs} >= ${slowQueryThresholdMs}`;

  if (period === "1h" || period === "24h") {
    const interval = period === "1h" ? "1 hour" : "24 hours";
    logsWhereClause = sql`${queryLogs.durationMs} >= ${slowQueryThresholdMs} AND ${queryLogs.createdAt} >= NOW() - INTERVAL '${sql.raw(interval)}'`;

    const statsFromLogs = await originalDb.execute(sql`
      SELECT 
        COUNT(*)::int as "totalQueries",
        COUNT(DISTINCT query_hash)::int as "uniqueQueries",
        COALESCE(AVG(duration_ms), 0)::float as "avgDuration",
        COALESCE(MAX(duration_ms), 0)::int as "maxDuration"
      FROM query_logs
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(interval)}'
    `);

    const slowQueriesCount = await originalDb.execute(sql`
      SELECT COUNT(*)::int as count
      FROM query_logs
      WHERE duration_ms >= ${slowQueryThresholdMs} 
        AND created_at >= NOW() - INTERVAL '${sql.raw(interval)}'
    `);

    const stats = statsFromLogs.rows[0] as any;
    return {
      totalQueries: Number(stats?.totalQueries || 0),
      uniqueQueries: Number(stats?.uniqueQueries || 0),
      avgDurationMs: Number(stats?.avgDuration || 0).toFixed(2),
      maxDurationMs: Number(stats?.maxDuration || 0),
      slowQueriesCount: Number((slowQueriesCount.rows[0] as any)?.count || 0),
      slowQueryThresholdMs,
    };
  }

  const statsQuery = originalDb
    .select({
      totalQueries: sql<number>`COALESCE(SUM(${queryStats.callCount}), 0)`,
      uniqueQueries: sql<number>`COUNT(*)`,
      avgDuration: sql<number>`COALESCE(AVG(${queryStats.avgDurationMs}), 0)`,
      maxDuration: sql<number>`COALESCE(MAX(${queryStats.maxDurationMs}), 0)`,
    })
    .from(queryStats);

  const [totalStats] = await statsQuery;

  const slowQueriesCount = await originalDb
    .select({ count: sql<number>`COUNT(*)` })
    .from(queryLogs)
    .where(logsWhereClause);

  return {
    totalQueries: Number(totalStats?.totalQueries || 0),
    uniqueQueries: Number(totalStats?.uniqueQueries || 0),
    avgDurationMs: Number(totalStats?.avgDuration || 0).toFixed(2),
    maxDurationMs: Number(totalStats?.maxDuration || 0),
    slowQueriesCount: Number(slowQueriesCount[0]?.count || 0),
    slowQueryThresholdMs,
  };
}

export async function clearQueryStats() {
  await originalDb.delete(queryStats);
  await originalDb.delete(queryLogs);
  return { success: true };
}

export async function forceFlush() {
  await flushLogs();
  return { flushed: true };
}
