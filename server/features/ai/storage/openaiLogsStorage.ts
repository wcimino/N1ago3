import { db } from "../../../db.js";
import { openaiApiConfig, openaiApiLogs, responsesSuggested } from "../../../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import type { OpenaiApiConfig, InsertOpenaiApiConfig, OpenaiApiLog, InsertOpenaiApiLog, SuggestedResponse } from "../../../../shared/schema.js";

export const openaiLogsStorage = {
  async getOpenaiApiConfig(configType: string): Promise<OpenaiApiConfig | null> {
    const [config] = await db.select()
      .from(openaiApiConfig)
      .where(eq(openaiApiConfig.configType, configType));
    return config || null;
  },

  async upsertOpenaiApiConfig(configType: string, data: Omit<InsertOpenaiApiConfig, 'configType'>): Promise<OpenaiApiConfig> {
    const existing = await this.getOpenaiApiConfig(configType);
    
    if (existing) {
      const [updated] = await db.update(openaiApiConfig)
        .set({
          enabled: data.enabled,
          triggerEventTypes: data.triggerEventTypes,
          triggerAuthorTypes: data.triggerAuthorTypes,
          promptTemplate: data.promptTemplate,
          modelName: data.modelName,
          useKnowledgeBaseTool: data.useKnowledgeBaseTool ?? existing.useKnowledgeBaseTool,
          useProductCatalogTool: data.useProductCatalogTool ?? existing.useProductCatalogTool,
          updatedAt: new Date(),
        })
        .where(eq(openaiApiConfig.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(openaiApiConfig)
      .values({ ...data, configType })
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

  async saveSuggestedResponse(
    conversationId: number,
    data: { suggestedResponse: string; lastEventId: number; openaiLogId: number; externalConversationId?: string | null }
  ): Promise<SuggestedResponse> {
    const [response] = await db.insert(responsesSuggested)
      .values({
        conversationId,
        suggestedResponse: data.suggestedResponse,
        lastEventId: data.lastEventId,
        openaiLogId: data.openaiLogId,
        externalConversationId: data.externalConversationId || null,
      })
      .returning();
    return response;
  },

  async getSuggestedResponse(conversationId: number): Promise<SuggestedResponse | null> {
    const [response] = await db.select()
      .from(responsesSuggested)
      .where(eq(responsesSuggested.conversationId, conversationId))
      .orderBy(desc(responsesSuggested.createdAt))
      .limit(1);
    return response || null;
  },

  async getLatestSuggestedResponses(limit: number = 50): Promise<SuggestedResponse[]> {
    return db.select()
      .from(responsesSuggested)
      .orderBy(desc(responsesSuggested.createdAt))
      .limit(limit);
  },

  async getAllSuggestedResponses(conversationId: number): Promise<SuggestedResponse[]> {
    return db.select()
      .from(responsesSuggested)
      .where(eq(responsesSuggested.conversationId, conversationId))
      .orderBy(responsesSuggested.createdAt);
  },
};
