import { db } from "../../../db.js";
import { knowledgeSuggestions, knowledgeBase } from "../../../../shared/schema.js";
import { eq, desc, and, type SQL } from "drizzle-orm";
import type { KnowledgeSuggestion, InsertKnowledgeSuggestion, InsertKnowledgeBaseArticle } from "../../../../shared/schema.js";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "merged";

export const knowledgeSuggestionsStorage = {
  async getAllSuggestions(filters?: {
    status?: SuggestionStatus;
    productStandard?: string;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeSuggestion[]> {
    const conditions: SQL[] = [];

    if (filters?.status) {
      conditions.push(eq(knowledgeSuggestions.status, filters.status));
    }

    if (filters?.productStandard) {
      conditions.push(eq(knowledgeSuggestions.productStandard, filters.productStandard));
    }

    let query = db.select().from(knowledgeSuggestions);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const results = await query
      .orderBy(desc(knowledgeSuggestions.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return results;
  },

  async getSuggestionById(id: number): Promise<KnowledgeSuggestion | null> {
    const [suggestion] = await db.select()
      .from(knowledgeSuggestions)
      .where(eq(knowledgeSuggestions.id, id));
    return suggestion || null;
  },

  async createSuggestion(data: InsertKnowledgeSuggestion): Promise<KnowledgeSuggestion> {
    const [suggestion] = await db.insert(knowledgeSuggestions)
      .values(data)
      .returning();
    return suggestion;
  },

  async updateSuggestion(id: number, data: Partial<InsertKnowledgeSuggestion>): Promise<KnowledgeSuggestion | null> {
    const [suggestion] = await db.update(knowledgeSuggestions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSuggestions.id, id))
      .returning();
    return suggestion || null;
  },

  async approveSuggestion(id: number, reviewedBy: string): Promise<KnowledgeSuggestion | null> {
    const suggestion = await this.getSuggestionById(id);
    if (!suggestion) return null;

    const [article] = await db.insert(knowledgeBase)
      .values({
        productStandard: suggestion.productStandard || "Não classificado",
        subproductStandard: suggestion.subproductStandard,
        category1: suggestion.category1,
        category2: suggestion.category2,
        intent: suggestion.category1 || "Geral",
        description: suggestion.description || "",
        resolution: suggestion.resolution || "",
        observations: suggestion.observations 
          ? `${suggestion.observations}\n\n[Fonte: Extraído de conversa]`
          : "[Fonte: Extraído de conversa]",
      })
      .returning();

    const [updated] = await db.update(knowledgeSuggestions)
      .set({
        status: "approved",
        reviewedBy,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSuggestions.id, id))
      .returning();

    return updated || null;
  },

  async rejectSuggestion(id: number, reviewedBy: string, reason?: string): Promise<KnowledgeSuggestion | null> {
    const [suggestion] = await db.update(knowledgeSuggestions)
      .set({
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSuggestions.id, id))
      .returning();
    return suggestion || null;
  },

  async mergeSuggestion(id: number, targetArticleId: number, reviewedBy: string): Promise<KnowledgeSuggestion | null> {
    const suggestion = await this.getSuggestionById(id);
    if (!suggestion) return null;

    await db.update(knowledgeBase)
      .set({
        description: suggestion.description || undefined,
        resolution: suggestion.resolution || undefined,
        observations: suggestion.observations || undefined,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBase.id, targetArticleId));

    const [updated] = await db.update(knowledgeSuggestions)
      .set({
        status: "merged",
        reviewedBy,
        reviewedAt: new Date(),
        similarArticleId: targetArticleId,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSuggestions.id, id))
      .returning();

    return updated || null;
  },

  async getStatusCounts(): Promise<Record<SuggestionStatus, number>> {
    const results = await db.select()
      .from(knowledgeSuggestions);
    
    const counts: Record<SuggestionStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      merged: 0,
    };

    for (const suggestion of results) {
      const status = suggestion.status as SuggestionStatus;
      if (status in counts) {
        counts[status]++;
      }
    }

    return counts;
  },

  async getSuggestionByConversation(conversationId: number): Promise<KnowledgeSuggestion | null> {
    const [suggestion] = await db.select()
      .from(knowledgeSuggestions)
      .where(eq(knowledgeSuggestions.conversationId, conversationId));
    return suggestion || null;
  },
};
