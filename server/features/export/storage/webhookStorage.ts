import { db } from "../../../db.js";
import { zendeskConversationsWebhookRaw } from "../../../../shared/schema.js";
import { eq, desc, sql, and } from "drizzle-orm";
import type { InsertZendeskConversationsWebhookRaw, ZendeskConversationsWebhookRaw } from "../../../../shared/schema.js";

export const webhookStorage = {
  async createWebhookLog(data: InsertZendeskConversationsWebhookRaw) {
    const [log] = await db.insert(zendeskConversationsWebhookRaw).values(data).returning();
    return log;
  },

  async updateWebhookLogStatus(id: number, status: string, errorMessage?: string) {
    await db.update(zendeskConversationsWebhookRaw)
      .set({
        processingStatus: status,
        processedAt: new Date(),
        errorMessage: errorMessage || null,
      })
      .where(eq(zendeskConversationsWebhookRaw.id, id));
  },

  async getWebhookLogs(limit = 50, offset = 0, status?: string, sunshineId?: string) {
    const conditions: any[] = [];
    
    if (status) {
      conditions.push(eq(zendeskConversationsWebhookRaw.processingStatus, status));
    }
    
    if (sunshineId) {
      conditions.push(sql`${zendeskConversationsWebhookRaw.payload}::text LIKE ${'%' + sunshineId + '%'}`);
    }
    
    let query = db.select().from(zendeskConversationsWebhookRaw).orderBy(desc(zendeskConversationsWebhookRaw.receivedAt));
    
    if (conditions.length > 0) {
      for (const condition of conditions) {
        query = query.where(condition) as typeof query;
      }
    }
    
    const logs = await query.limit(limit).offset(offset);
    
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(zendeskConversationsWebhookRaw);
    for (const condition of conditions) {
      countQuery = countQuery.where(condition) as typeof countQuery;
    }
    const [{ count }] = await countQuery;
    
    return { logs, total: Number(count) };
  },

  async getWebhookLogById(id: number) {
    const [log] = await db.select().from(zendeskConversationsWebhookRaw).where(eq(zendeskConversationsWebhookRaw.id, id));
    return log;
  },

  async getWebhookLogsStats() {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stats = await db.select({
      status: zendeskConversationsWebhookRaw.processingStatus,
      count: sql<number>`count(*)`,
    })
      .from(zendeskConversationsWebhookRaw)
      .where(sql`${zendeskConversationsWebhookRaw.receivedAt} >= ${last24h}`)
      .groupBy(zendeskConversationsWebhookRaw.processingStatus);
    
    const [{ total }] = await db.select({ total: sql<number>`count(*)` })
      .from(zendeskConversationsWebhookRaw)
      .where(sql`${zendeskConversationsWebhookRaw.receivedAt} >= ${last24h}`);
    
    return {
      total: Number(total),
      byStatus: Object.fromEntries(stats.map((s: { status: string; count: number }) => [s.status, Number(s.count)])),
    };
  },

  async getWebhookRawById(id: number, source: string): Promise<ZendeskConversationsWebhookRaw | null> {
    if (source !== "zendesk") {
      console.warn(`[WebhookStorage] Unknown source: ${source}, only zendesk is supported`);
      return null;
    }
    const [raw] = await db.select().from(zendeskConversationsWebhookRaw).where(eq(zendeskConversationsWebhookRaw.id, id));
    return raw || null;
  },

  async updateWebhookRawStatus(id: number, source: string, status: string, errorMessage?: string) {
    if (source !== "zendesk") {
      console.warn(`[WebhookStorage] Unknown source: ${source}, only zendesk is supported`);
      return;
    }
    if (status === "error") {
      await db.update(zendeskConversationsWebhookRaw)
        .set({
          processingStatus: status,
          processedAt: new Date(),
          errorMessage: errorMessage || null,
          retryCount: sql`${zendeskConversationsWebhookRaw.retryCount} + 1`,
        })
        .where(eq(zendeskConversationsWebhookRaw.id, id));
    } else {
      await db.update(zendeskConversationsWebhookRaw)
        .set({
          processingStatus: status,
          processedAt: new Date(),
          errorMessage: errorMessage || null,
        })
        .where(eq(zendeskConversationsWebhookRaw.id, id));
    }
  },

  async updateWebhookRawStatusWithEventsCount(id: number, source: string, status: string, eventsCount: number) {
    if (source !== "zendesk") {
      console.warn(`[WebhookStorage] Unknown source: ${source}, only zendesk is supported`);
      return;
    }
    await db.update(zendeskConversationsWebhookRaw)
      .set({
        processingStatus: status,
        processedAt: new Date(),
        errorMessage: null,
        eventsCreatedCount: eventsCount,
      })
      .where(eq(zendeskConversationsWebhookRaw.id, id));
  },

  async getPendingWebhookRaws(source: string, limit = 100): Promise<ZendeskConversationsWebhookRaw[]> {
    if (source !== "zendesk") {
      console.warn(`[WebhookStorage] Unknown source: ${source}, only zendesk is supported`);
      return [];
    }
    return await db.select()
      .from(zendeskConversationsWebhookRaw)
      .where(
        and(
          eq(zendeskConversationsWebhookRaw.processingStatus, "pending"),
          sql`${zendeskConversationsWebhookRaw.retryCount} < 5`
        )
      )
      .orderBy(zendeskConversationsWebhookRaw.receivedAt)
      .limit(limit);
  },

  async getStuckProcessingWebhookRaws(source: string, stuckMinutes = 5, limit = 50): Promise<ZendeskConversationsWebhookRaw[]> {
    if (source !== "zendesk") {
      console.warn(`[WebhookStorage] Unknown source: ${source}, only zendesk is supported`);
      return [];
    }
    return await db.select()
      .from(zendeskConversationsWebhookRaw)
      .where(
        and(
          eq(zendeskConversationsWebhookRaw.processingStatus, "processing"),
          sql`${zendeskConversationsWebhookRaw.receivedAt} < NOW() - INTERVAL '${sql.raw(String(stuckMinutes))} minutes'`,
          sql`${zendeskConversationsWebhookRaw.retryCount} < 5`,
          sql`COALESCE(${zendeskConversationsWebhookRaw.eventsCreatedCount}, 0) = 0`
        )
      )
      .orderBy(zendeskConversationsWebhookRaw.receivedAt)
      .limit(limit);
  },

  async resetStuckWebhook(id: number, source: string) {
    if (source !== "zendesk") {
      console.warn(`[WebhookStorage] Unknown source: ${source}, only zendesk is supported`);
      return;
    }
    await db.update(zendeskConversationsWebhookRaw)
      .set({
        processingStatus: "pending",
        retryCount: sql`${zendeskConversationsWebhookRaw.retryCount} + 1`,
      })
      .where(eq(zendeskConversationsWebhookRaw.id, id));
  },

};
