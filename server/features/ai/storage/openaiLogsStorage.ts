import { db } from "../../../db.js";
import { openaiApiConfig, openaiApiLogs, responsesSuggested } from "../../../../shared/schema.js";
import { eq, desc, gte, sql, and } from "drizzle-orm";
import type { OpenaiApiConfig, InsertOpenaiApiConfig, OpenaiApiLog, InsertOpenaiApiLog, SuggestedResponse } from "../../../../shared/schema.js";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfDay as dateFnsStartOfDay } from "date-fns";

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
          promptSystem: data.promptSystem,
          promptTemplate: data.promptTemplate,
          responseFormat: data.responseFormat,
          modelName: data.modelName,
          useKnowledgeBaseTool: data.useKnowledgeBaseTool ?? existing.useKnowledgeBaseTool,
          useProductCatalogTool: data.useProductCatalogTool ?? existing.useProductCatalogTool,
          useZendeskKnowledgeBaseTool: data.useZendeskKnowledgeBaseTool ?? existing.useZendeskKnowledgeBaseTool,
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
    data: { 
      suggestedResponse: string; 
      lastEventId: number; 
      openaiLogId: number; 
      externalConversationId?: string | null; 
      inResponseTo?: string | null;
      articlesUsed?: Array<{ id: number; name: string; product: string; url?: string }>;
    }
  ): Promise<SuggestedResponse> {
    const [response] = await db.insert(responsesSuggested)
      .values({
        conversationId,
        suggestedResponse: data.suggestedResponse,
        lastEventId: data.lastEventId,
        openaiLogId: data.openaiLogId,
        externalConversationId: data.externalConversationId || null,
        inResponseTo: data.inResponseTo || null,
        status: "created",
        articlesUsed: data.articlesUsed || null,
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

  async getOpenaiApiStats(timezone: string = "America/Sao_Paulo"): Promise<{
    last_hour: { total_calls: number; total_tokens: number; estimated_cost: number };
    today: { total_calls: number; total_tokens: number; estimated_cost: number };
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Calculate start of day in the provided timezone
    const nowInTimezone = toZonedTime(now, timezone);
    const startOfDayInTimezone = dateFnsStartOfDay(nowInTimezone);
    const startOfDay = fromZonedTime(startOfDayInTimezone, timezone);

    const MODEL_PRICING: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
      'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
      'gpt-4-turbo': { input: 10.00 / 1_000_000, output: 30.00 / 1_000_000 },
      'gpt-4': { input: 30.00 / 1_000_000, output: 60.00 / 1_000_000 },
      'gpt-3.5-turbo': { input: 0.50 / 1_000_000, output: 1.50 / 1_000_000 },
    };

    const lastHourLogs = await db.select({
      modelName: openaiApiLogs.modelName,
      tokensPrompt: openaiApiLogs.tokensPrompt,
      tokensCompletion: openaiApiLogs.tokensCompletion,
    })
      .from(openaiApiLogs)
      .where(gte(openaiApiLogs.createdAt, oneHourAgo));

    const todayLogs = await db.select({
      modelName: openaiApiLogs.modelName,
      tokensPrompt: openaiApiLogs.tokensPrompt,
      tokensCompletion: openaiApiLogs.tokensCompletion,
    })
      .from(openaiApiLogs)
      .where(gte(openaiApiLogs.createdAt, startOfDay));

    function calculateStats(logs: { modelName: string; tokensPrompt: number | null; tokensCompletion: number | null }[]) {
      let totalTokens = 0;
      let estimatedCost = 0;

      for (const log of logs) {
        const prompt = log.tokensPrompt || 0;
        const completion = log.tokensCompletion || 0;
        totalTokens += prompt + completion;

        const pricing = MODEL_PRICING[log.modelName] || MODEL_PRICING['gpt-4o-mini'];
        estimatedCost += (prompt * pricing.input) + (completion * pricing.output);
      }

      return {
        total_calls: logs.length,
        total_tokens: totalTokens,
        estimated_cost: Math.round(estimatedCost * 100) / 100,
      };
    }

    return {
      last_hour: calculateStats(lastHourLogs),
      today: calculateStats(todayLogs),
    };
  },
};
