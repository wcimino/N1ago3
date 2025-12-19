import { db } from "../../../db.js";
import { knowledgeSuggestions } from "../../../../shared/schema.js";
import { eq, desc, and, type SQL } from "drizzle-orm";
import type { KnowledgeSuggestion, InsertKnowledgeSuggestion } from "../../../../shared/schema.js";
import { knowledgeBaseStorage } from "./knowledgeBaseStorage.js";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "merged" | "no_improvement";

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

    if (suggestion.suggestionType === "update" && suggestion.similarArticleId) {
      const existingArticle = await knowledgeBaseStorage.getArticleById(suggestion.similarArticleId);
      const updateData: Record<string, string | string[] | null | undefined> = {};
      if (suggestion.question) updateData.question = suggestion.question;
      if (suggestion.answer) updateData.answer = suggestion.answer;
      if (suggestion.keywords) updateData.keywords = suggestion.keywords;
      if (suggestion.questionVariation && suggestion.questionVariation.length > 0) {
        const existingVariations = existingArticle?.questionVariation || [];
        const newVariations = suggestion.questionVariation.filter(
          v => !existingVariations.includes(v)
        );
        updateData.questionVariation = [...existingVariations, ...newVariations];
      }
      
      const rawExtraction = suggestion.rawExtraction as { questionNormalized?: string[] } | null;
      if (rawExtraction?.questionNormalized && Array.isArray(rawExtraction.questionNormalized) && rawExtraction.questionNormalized.length > 0) {
        updateData.questionNormalized = JSON.stringify(rawExtraction.questionNormalized);
      }
      
      if (Object.keys(updateData).length > 0) {
        await knowledgeBaseStorage.updateArticle(suggestion.similarArticleId, updateData);
      }
    } else {
      const rawExtraction = suggestion.rawExtraction as { questionNormalized?: string[] } | null;
      const questionNormalized = rawExtraction?.questionNormalized && Array.isArray(rawExtraction.questionNormalized) 
        ? JSON.stringify(rawExtraction.questionNormalized) 
        : null;
      
      await knowledgeBaseStorage.createArticle({
        question: suggestion.question || null,
        answer: suggestion.answer || null,
        keywords: suggestion.keywords || null,
        questionVariation: suggestion.questionVariation || [],
        questionNormalized,
      });
    }

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

    const existingArticle = await knowledgeBaseStorage.getArticleById(targetArticleId);
    const updateData: Record<string, string | string[] | null | undefined> = {};
    if (suggestion.question) updateData.question = suggestion.question;
    if (suggestion.answer) updateData.answer = suggestion.answer;
    if (suggestion.keywords) updateData.keywords = suggestion.keywords;
    if (suggestion.questionVariation && suggestion.questionVariation.length > 0) {
      const existingVariations = existingArticle?.questionVariation || [];
      const newVariations = suggestion.questionVariation.filter(
        v => !existingVariations.includes(v)
      );
      updateData.questionVariation = [...existingVariations, ...newVariations];
    }
    
    const rawExtraction = suggestion.rawExtraction as { questionNormalized?: string[] } | null;
    if (rawExtraction?.questionNormalized && Array.isArray(rawExtraction.questionNormalized) && rawExtraction.questionNormalized.length > 0) {
      updateData.questionNormalized = JSON.stringify(rawExtraction.questionNormalized);
    }

    if (Object.keys(updateData).length > 0) {
      await knowledgeBaseStorage.updateArticle(targetArticleId, updateData);
    }

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
      no_improvement: 0,
    };

    for (const suggestion of results) {
      const status = suggestion.status as SuggestionStatus;
      if (status in counts) {
        counts[status]++;
      }
    }

    return counts;
  },

  async markNoImprovement(id: number, reviewedBy: string): Promise<KnowledgeSuggestion | null> {
    const [suggestion] = await db.update(knowledgeSuggestions)
      .set({
        status: "no_improvement",
        reviewedBy,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSuggestions.id, id))
      .returning();
    return suggestion || null;
  },

  async getSuggestionByConversation(conversationId: number): Promise<KnowledgeSuggestion | null> {
    const [suggestion] = await db.select()
      .from(knowledgeSuggestions)
      .where(eq(knowledgeSuggestions.conversationId, conversationId));
    return suggestion || null;
  },
};
