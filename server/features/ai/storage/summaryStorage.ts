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
      clientRequestVersions: data.clientRequestVersions,
      agentActions: data.agentActions,
      currentStatus: data.currentStatus,
      importantInfo: data.importantInfo,
      customerEmotionLevel: data.customerEmotionLevel,
      objectiveProblems: data.objectiveProblems,
      lastEventId: data.lastEventId,
      externalConversationId: data.externalConversationId,
      productId: data.productId,
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
    articlesAndObjectiveProblems: Array<{ source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; matchedTerms?: string[]; products?: string[] }>
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

  async updateDemandFinderStatus(
    conversationId: number,
    status: "not_started" | "in_progress" | "demand_found" | "demand_not_found" | "error"
  ): Promise<void> {
    await db.update(conversationsSummary)
      .set({
        demandFinderStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(conversationsSummary.conversationId, conversationId));
  },

  async getSummariesForExport(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    productId?: number;
    customerRequestType?: string;
  }): Promise<Array<{
    id: number;
    generatedAt: Date;
    productId: number | null;
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
    if (filters.productId) {
      conditions.push(eq(conversationsSummary.productId, filters.productId));
    }
    if (filters.customerRequestType) {
      conditions.push(eq(conversationsSummary.customerRequestType, filters.customerRequestType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: conversationsSummary.id,
        generatedAt: conversationsSummary.generatedAt,
        productId: conversationsSummary.productId,
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
