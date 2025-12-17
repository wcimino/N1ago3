import { db } from "../../../db.js";
import { caseDemand } from "../../../../shared/schema.js";
import { eq } from "drizzle-orm";
import type { CaseDemand, InsertCaseDemand } from "../../../../shared/schema.js";

type ArticleOrProblem = { source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; matchedTerms?: string[]; products?: string[] };

function calculateTopMatch(items: ArticleOrProblem[]): ArticleOrProblem | null {
  if (!items || items.length === 0) return null;
  
  return items.reduce((best, current) => {
    const currentScore = current.matchScore ?? 0;
    const bestScore = best.matchScore ?? 0;
    return currentScore > bestScore ? current : best;
  }, items[0]);
}

export const caseDemandStorage = {
  async getByConversationId(conversationId: number): Promise<CaseDemand[]> {
    return db.select()
      .from(caseDemand)
      .where(eq(caseDemand.conversationId, conversationId));
  },

  async getFirstByConversationId(conversationId: number): Promise<CaseDemand | null> {
    const [demand] = await db.select()
      .from(caseDemand)
      .where(eq(caseDemand.conversationId, conversationId))
      .limit(1);
    return demand || null;
  },

  async create(data: InsertCaseDemand): Promise<CaseDemand> {
    const [demand] = await db.insert(caseDemand)
      .values(data)
      .returning();
    return demand;
  },

  async updateArticlesAndProblems(
    conversationId: number,
    articlesAndObjectiveProblems: ArticleOrProblem[]
  ): Promise<{ created: boolean; updated: boolean }> {
    const existing = await this.getFirstByConversationId(conversationId);
    const topMatch = calculateTopMatch(articlesAndObjectiveProblems);
    
    if (existing) {
      await db.update(caseDemand)
        .set({
          articlesAndObjectiveProblems,
          topMatch,
          updatedAt: new Date(),
        })
        .where(eq(caseDemand.id, existing.id));
      return { created: false, updated: true };
    } else {
      await db.insert(caseDemand)
        .values({
          conversationId,
          articlesAndObjectiveProblems,
          topMatch,
        });
      return { created: true, updated: false };
    }
  },

  async updateStatus(
    conversationId: number,
    status: "not_started" | "in_progress" | "demand_found" | "demand_not_found" | "error"
  ): Promise<void> {
    const existing = await this.getFirstByConversationId(conversationId);
    
    if (existing) {
      await db.update(caseDemand)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(caseDemand.id, existing.id));
    } else {
      await db.insert(caseDemand)
        .values({
          conversationId,
          status,
        });
    }
  },

  async incrementInteractionCount(conversationId: number): Promise<void> {
    const existing = await this.getFirstByConversationId(conversationId);
    
    if (existing) {
      await db.update(caseDemand)
        .set({
          interactionCount: (existing.interactionCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(caseDemand.id, existing.id));
    } else {
      await db.insert(caseDemand)
        .values({
          conversationId,
          interactionCount: 1,
        });
    }
  },
};
