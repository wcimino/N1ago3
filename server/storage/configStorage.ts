import { db } from "../db.js";
import { conversationsSummary, openaiSummaryConfig, openaiApiLogs } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import type { ConversationSummary, InsertConversationSummary, OpenaiSummaryConfig, InsertOpenaiSummaryConfig, OpenaiApiLog, InsertOpenaiApiLog } from "../../shared/schema.js";

export const configStorage = {
  async getConversationSummary(conversationId: number): Promise<ConversationSummary | null> {
    const [summary] = await db.select()
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId));
    return summary || null;
  },

  async getConversationSummaryByExternalId(externalConversationId: string): Promise<ConversationSummary | null> {
    const [summary] = await db.select()
      .from(conversationsSummary)
      .where(eq(conversationsSummary.externalConversationId, externalConversationId));
    return summary || null;
  },

  async upsertConversationSummary(data: InsertConversationSummary): Promise<ConversationSummary> {
    const [summary] = await db.insert(conversationsSummary)
      .values({
        ...data,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: conversationsSummary.conversationId,
        set: {
          summary: data.summary,
          lastEventId: data.lastEventId,
          externalConversationId: data.externalConversationId,
          generatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return summary;
  },

  async getOpenaiSummaryConfig(): Promise<OpenaiSummaryConfig | null> {
    const [config] = await db.select()
      .from(openaiSummaryConfig)
      .limit(1);
    return config || null;
  },

  async upsertOpenaiSummaryConfig(data: InsertOpenaiSummaryConfig): Promise<OpenaiSummaryConfig> {
    const existing = await this.getOpenaiSummaryConfig();
    
    if (existing) {
      const [updated] = await db.update(openaiSummaryConfig)
        .set({
          enabled: data.enabled,
          triggerEventTypes: data.triggerEventTypes,
          triggerAuthorTypes: data.triggerAuthorTypes,
          promptTemplate: data.promptTemplate,
          modelName: data.modelName,
          updatedAt: new Date(),
        })
        .where(eq(openaiSummaryConfig.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(openaiSummaryConfig)
      .values(data)
      .returning();
    return created;
  },

  async saveOpenaiApiLog(data: InsertOpenaiApiLog): Promise<OpenaiApiLog> {
    const [log] = await db.insert(openaiApiLogs)
      .values(data)
      .returning();
    return log;
  },

  async getOpenaiApiLogs(limit: number = 100, requestType?: string): Promise<OpenaiApiLog[]> {
    if (requestType) {
      return db.select()
        .from(openaiApiLogs)
        .where(eq(openaiApiLogs.requestType, requestType))
        .orderBy(desc(openaiApiLogs.createdAt))
        .limit(limit);
    }
    
    return db.select()
      .from(openaiApiLogs)
      .orderBy(desc(openaiApiLogs.createdAt))
      .limit(limit);
  },

  async getOpenaiApiLogById(id: number): Promise<OpenaiApiLog | null> {
    const [log] = await db.select()
      .from(openaiApiLogs)
      .where(eq(openaiApiLogs.id, id));
    return log || null;
  },
};
