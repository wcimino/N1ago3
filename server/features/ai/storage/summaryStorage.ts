import { db } from "../../../db.js";
import { conversationsSummary } from "../../../../shared/schema.js";
import { eq, desc, gte, lte, and, isNotNull, sql, type SQL } from "drizzle-orm";
import type { ConversationSummary, InsertConversationSummary } from "../../../../shared/schema.js";

export const summaryStorage = {
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
    const updateSet: Record<string, any> = {
      summary: data.summary,
      clientRequest: data.clientRequest,
      agentActions: data.agentActions,
      currentStatus: data.currentStatus,
      importantInfo: data.importantInfo,
      customerEmotionLevel: data.customerEmotionLevel,
      objectiveProblems: data.objectiveProblems,
      lastEventId: data.lastEventId,
      externalConversationId: data.externalConversationId,
      product: data.product,
      classifiedAt: data.classifiedAt,
      generatedAt: new Date(),
      updatedAt: new Date(),
    };

    if (data.articlesAndObjectiveProblems !== undefined) {
      updateSet.articlesAndObjectiveProblems = data.articlesAndObjectiveProblems;
    }

    const [summary] = await db.insert(conversationsSummary)
      .values({
        ...data,
        productStandard: data.product || null,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: conversationsSummary.conversationId,
        set: updateSet,
      })
      .returning();
    return summary;
  },

  async updateArticlesAndProblems(
    conversationId: number,
    articlesAndObjectiveProblems: Array<{ source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; products?: string[] }>
  ): Promise<{ created: boolean; updated: boolean }> {
    const existing = await db.select({ id: conversationsSummary.id })
      .from(conversationsSummary)
      .where(eq(conversationsSummary.conversationId, conversationId))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(conversationsSummary)
        .set({
          articlesAndObjectiveProblems,
          updatedAt: new Date(),
        })
        .where(eq(conversationsSummary.conversationId, conversationId));
      return { created: false, updated: true };
    } else {
      await db.insert(conversationsSummary)
        .values({
          conversationId,
          summary: "",
          articlesAndObjectiveProblems,
          generatedAt: new Date(),
        });
      return { created: true, updated: false };
    }
  },

  async getSummariesForExport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    product?: string;
    productStandard?: string;
    customerRequestType?: string;
  }): Promise<Array<{
    id: number;
    generatedAt: Date;
    product: string | null;
    productStandard: string | null;
    customerRequestType: string | null;
    summary: string;
    clientRequest: string | null;
    agentActions: string | null;
    currentStatus: string | null;
    importantInfo: string | null;
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
    if (filters.customerRequestType) {
      conditions.push(eq(conversationsSummary.customerRequestType, filters.customerRequestType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: conversationsSummary.id,
        generatedAt: conversationsSummary.generatedAt,
        product: conversationsSummary.product,
        productStandard: conversationsSummary.productStandard,
        customerRequestType: conversationsSummary.customerRequestType,
        summary: conversationsSummary.summary,
        clientRequest: conversationsSummary.clientRequest,
        agentActions: conversationsSummary.agentActions,
        currentStatus: conversationsSummary.currentStatus,
        importantInfo: conversationsSummary.importantInfo,
      })
      .from(conversationsSummary)
      .where(whereClause)
      .orderBy(desc(conversationsSummary.generatedAt));

    return results;
  },
};
