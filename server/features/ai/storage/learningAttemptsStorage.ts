import { db } from "../../../db.js";
import { learningAttempts, type LearningAttempt, type InsertLearningAttempt, type LearningAttemptResult } from "../../../../shared/schema.js";
import { eq, desc, and, gte, SQL } from "drizzle-orm";

export const learningAttemptsStorage = {
  async create(data: InsertLearningAttempt): Promise<LearningAttempt> {
    const [attempt] = await db.insert(learningAttempts)
      .values(data)
      .returning();
    return attempt;
  },

  async getAll(filters?: {
    result?: LearningAttemptResult;
    since?: Date;
    limit?: number;
    offset?: number;
  }): Promise<LearningAttempt[]> {
    const conditions: SQL[] = [];

    if (filters?.result) {
      conditions.push(eq(learningAttempts.result, filters.result));
    }

    if (filters?.since) {
      conditions.push(gte(learningAttempts.createdAt, filters.since));
    }

    let query = db.select().from(learningAttempts);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return await query
      .orderBy(desc(learningAttempts.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);
  },

  async getStats(since?: Date): Promise<{
    total: number;
    suggestionCreated: number;
    insufficientMessages: number;
    skippedByAgent: number;
    processingError: number;
  }> {
    const results = await this.getAll({ since, limit: 10000 });
    
    return {
      total: results.length,
      suggestionCreated: results.filter(r => r.result === "suggestion_created").length,
      insufficientMessages: results.filter(r => r.result === "insufficient_messages").length,
      skippedByAgent: results.filter(r => r.result === "skipped_by_agent").length,
      processingError: results.filter(r => r.result === "processing_error").length,
    };
  },

  async getByConversationId(conversationId: number): Promise<LearningAttempt | null> {
    const [attempt] = await db.select()
      .from(learningAttempts)
      .where(eq(learningAttempts.conversationId, conversationId))
      .orderBy(desc(learningAttempts.createdAt))
      .limit(1);
    return attempt || null;
  },
};
