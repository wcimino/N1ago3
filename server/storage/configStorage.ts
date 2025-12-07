import { db } from "../db.js";
import { conversationsSummary, openaiApiConfig, openaiApiLogs, responsesSuggested } from "../../shared/schema.js";
import { eq, desc, sql, gte, lte, and, isNotNull, type SQL } from "drizzle-orm";
import type { ConversationSummary, InsertConversationSummary, OpenaiApiConfig, InsertOpenaiApiConfig, OpenaiApiLog, InsertOpenaiApiLog, SuggestedResponse, InsertSuggestedResponse } from "../../shared/schema.js";

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
        productStandard: data.product || null,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: conversationsSummary.conversationId,
        set: {
          summary: data.summary,
          lastEventId: data.lastEventId,
          externalConversationId: data.externalConversationId,
          product: data.product,
          intent: data.intent,
          confidence: data.confidence,
          classifiedAt: data.classifiedAt,
          generatedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return summary;
  },

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

  async updateConversationClassification(
    conversationId: number, 
    data: { product: string | null; intent: string | null; confidence: number | null }
  ): Promise<void> {
    await db.update(conversationsSummary)
      .set({
        product: data.product,
        intent: data.intent,
        confidence: data.confidence,
        classifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId));
  },

  async getTopProductsByPeriod(
    period: "lastHour" | "last24Hours",
    limit: number = 5
  ): Promise<{ product: string; count: number }[]> {
    const now = new Date();
    let since: Date;

    if (period === "lastHour") {
      since = new Date(now.getTime() - 60 * 60 * 1000);
    } else {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const results = await db
      .select({
        product: conversationsSummary.product,
        count: sql<number>`count(*)::int`,
      })
      .from(conversationsSummary)
      .where(
        and(
          isNotNull(conversationsSummary.product),
          gte(conversationsSummary.classifiedAt, since)
        )
      )
      .groupBy(conversationsSummary.product)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return results.filter(r => r.product !== null) as { product: string; count: number }[];
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

  async getUniqueProductsAndIntents(): Promise<{ products: string[]; productStandards: string[]; intents: string[] }> {
    const productsResult = await db
      .selectDistinct({ product: conversationsSummary.product })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.product));
    
    const productStandardsResult = await db
      .selectDistinct({ productStandard: conversationsSummary.productStandard })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.productStandard));
    
    const intentsResult = await db
      .selectDistinct({ intent: conversationsSummary.intent })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.intent));

    return {
      products: productsResult.map(r => r.product).filter((p): p is string => p !== null).sort(),
      productStandards: productStandardsResult.map(r => r.productStandard).filter((ps): ps is string => ps !== null).sort(),
      intents: intentsResult.map(r => r.intent).filter((i): i is string => i !== null).sort(),
    };
  },

  async getProductStandards(): Promise<Array<{ product: string; productStandard: string | null }>> {
    const results = await db
      .select({
        product: conversationsSummary.product,
        productStandard: sql<string | null>`MAX(${conversationsSummary.productStandard})`,
      })
      .from(conversationsSummary)
      .where(isNotNull(conversationsSummary.product))
      .groupBy(conversationsSummary.product)
      .orderBy(conversationsSummary.product);

    return results.filter(r => r.product !== null) as Array<{ product: string; productStandard: string | null }>;
  },

  async updateProductStandard(product: string, productStandard: string): Promise<number> {
    const result = await db
      .update(conversationsSummary)
      .set({ 
        productStandard,
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.product, product));
    
    return result.rowCount ?? 0;
  },

  async getSummariesForExport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    product?: string;
    productStandard?: string;
    intent?: string;
  }): Promise<Array<{
    id: number;
    generatedAt: Date;
    product: string | null;
    productStandard: string | null;
    intent: string | null;
    summary: string;
  }>> {
    const conditions: SQL<unknown>[] = [];

    if (filters.dateFrom) {
      conditions.push(gte(conversationsSummary.generatedAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(conversationsSummary.generatedAt, filters.dateTo));
    }
    if (filters.product) {
      conditions.push(eq(conversationsSummary.product, filters.product));
    }
    if (filters.productStandard) {
      conditions.push(eq(conversationsSummary.productStandard, filters.productStandard));
    }
    if (filters.intent) {
      conditions.push(eq(conversationsSummary.intent, filters.intent));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: conversationsSummary.id,
        generatedAt: conversationsSummary.generatedAt,
        product: conversationsSummary.product,
        productStandard: conversationsSummary.productStandard,
        intent: conversationsSummary.intent,
        summary: conversationsSummary.summary,
      })
      .from(conversationsSummary)
      .where(whereClause)
      .orderBy(desc(conversationsSummary.generatedAt));

    return results;
  },
};
