import { db } from "../../../db.js";
import { learningAttempts, type LearningAttempt, type InsertLearningAttempt, type LearningAttemptResult } from "../../../../shared/schema.js";
import { eq, desc, and, gte, sql, SQL } from "drizzle-orm";

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
    const sinceCondition = since
      ? sql`AND created_at >= ${since}`
      : sql``;

    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE result = 'suggestion_created') as suggestion_created,
        COUNT(*) FILTER (WHERE result = 'insufficient_messages') as insufficient_messages,
        COUNT(*) FILTER (WHERE result = 'skipped_by_agent') as skipped_by_agent,
        COUNT(*) FILTER (WHERE result = 'processing_error') as processing_error
      FROM learning_attempts
      WHERE 1=1 ${sinceCondition}
    `);

    const row = result.rows[0] as {
      total: string;
      suggestion_created: string;
      insufficient_messages: string;
      skipped_by_agent: string;
      processing_error: string;
    };

    return {
      total: parseInt(row.total || "0", 10),
      suggestionCreated: parseInt(row.suggestion_created || "0", 10),
      insufficientMessages: parseInt(row.insufficient_messages || "0", 10),
      skippedByAgent: parseInt(row.skipped_by_agent || "0", 10),
      processingError: parseInt(row.processing_error || "0", 10),
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
