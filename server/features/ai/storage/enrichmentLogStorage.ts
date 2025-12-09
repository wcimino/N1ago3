import { db } from "../../../db.js";
import { knowledgeEnrichmentLog, type KnowledgeEnrichmentLog, type InsertKnowledgeEnrichmentLog } from "../../../../shared/schema.js";
import { eq, desc, and, gte, sql, SQL } from "drizzle-orm";

export const enrichmentLogStorage = {
  async create(data: InsertKnowledgeEnrichmentLog): Promise<KnowledgeEnrichmentLog> {
    const [log] = await db.insert(knowledgeEnrichmentLog)
      .values(data)
      .returning();
    return log;
  },

  async getAll(filters?: {
    action?: string;
    productStandard?: string;
    triggerRunId?: string;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeEnrichmentLog[]> {
    const conditions: SQL[] = [];

    if (filters?.action) {
      conditions.push(eq(knowledgeEnrichmentLog.action, filters.action));
    }

    if (filters?.productStandard) {
      conditions.push(eq(knowledgeEnrichmentLog.productStandard, filters.productStandard));
    }

    if (filters?.triggerRunId) {
      conditions.push(eq(knowledgeEnrichmentLog.triggerRunId, filters.triggerRunId));
    }

    if (filters?.since) {
      conditions.push(gte(knowledgeEnrichmentLog.processedAt, filters.since));
    }

    let query = db.select().from(knowledgeEnrichmentLog);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query
      .orderBy(desc(knowledgeEnrichmentLog.processedAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);
  },

  async getStats(filters?: {
    productStandard?: string;
    since?: Date;
  }): Promise<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
  }> {
    const conditions: SQL[] = [];
    
    if (filters?.productStandard) {
      conditions.push(eq(knowledgeEnrichmentLog.productStandard, filters.productStandard));
    }

    if (filters?.since) {
      conditions.push(gte(knowledgeEnrichmentLog.processedAt, filters.since));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : sql`1=1`;

    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE action = 'create') as created,
        COUNT(*) FILTER (WHERE action = 'update') as updated,
        COUNT(*) FILTER (WHERE action = 'skip') as skipped
      FROM knowledge_enrichment_log
      WHERE ${whereClause}
    `);

    const row = result.rows[0] as {
      total: string;
      created: string;
      updated: string;
      skipped: string;
    };

    return {
      total: parseInt(row.total || "0", 10),
      created: parseInt(row.created || "0", 10),
      updated: parseInt(row.updated || "0", 10),
      skipped: parseInt(row.skipped || "0", 10),
    };
  },

  async getByIntentId(intentId: number): Promise<KnowledgeEnrichmentLog[]> {
    return await db.select()
      .from(knowledgeEnrichmentLog)
      .where(eq(knowledgeEnrichmentLog.intentId, intentId))
      .orderBy(desc(knowledgeEnrichmentLog.processedAt));
  },

  async getByTriggerRunId(triggerRunId: string): Promise<KnowledgeEnrichmentLog[]> {
    return await db.select()
      .from(knowledgeEnrichmentLog)
      .where(eq(knowledgeEnrichmentLog.triggerRunId, triggerRunId))
      .orderBy(desc(knowledgeEnrichmentLog.processedAt));
  },
};
