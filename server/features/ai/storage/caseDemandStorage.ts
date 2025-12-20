import { db } from "../../../db.js";
import { caseDemand } from "../../../../shared/schema.js";
import { eq, and, notInArray, desc } from "drizzle-orm";
import type { CaseDemand, InsertCaseDemand } from "../../../../shared/schema.js";

// Terminal statuses - demand cycle is finished
const TERMINAL_DEMAND_STATUSES = ["demand_found", "demand_not_found", "completed"] as const;

type ArticleOrProblem = { source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; matchedTerms?: string[]; products?: string[] };

type SolutionCenterResult = { type: "article" | "problem"; id: string; name: string; score: number };

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

  async getActiveByConversationId(conversationId: number): Promise<CaseDemand | null> {
    const [demand] = await db.select()
      .from(caseDemand)
      .where(
        and(
          eq(caseDemand.conversationId, conversationId),
          notInArray(caseDemand.status, TERMINAL_DEMAND_STATUSES as unknown as string[])
        )
      )
      .orderBy(desc(caseDemand.createdAt))
      .limit(1);
    return demand || null;
  },

  async getLatestByConversationId(conversationId: number): Promise<CaseDemand | null> {
    const [demand] = await db.select()
      .from(caseDemand)
      .where(eq(caseDemand.conversationId, conversationId))
      .orderBy(desc(caseDemand.createdAt))
      .limit(1);
    return demand || null;
  },

  async createNewDemand(conversationId: number): Promise<CaseDemand> {
    const [demand] = await db.insert(caseDemand)
      .values({
        conversationId,
        status: "not_started",
        interactionCount: 0,
      })
      .returning();
    return demand;
  },

  async ensureActiveDemand(conversationId: number): Promise<CaseDemand> {
    const existing = await this.getActiveByConversationId(conversationId);
    if (existing) {
      return existing;
    }
    return this.createNewDemand(conversationId);
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
    const existing = await this.getActiveByConversationId(conversationId);
    const articlesAndObjectiveProblemsTopMatch = calculateTopMatch(articlesAndObjectiveProblems);
    
    if (existing) {
      await db.update(caseDemand)
        .set({
          articlesAndObjectiveProblems,
          articlesAndObjectiveProblemsTopMatch,
          updatedAt: new Date(),
        })
        .where(eq(caseDemand.id, existing.id));
      return { created: false, updated: true };
    } else {
      await db.insert(caseDemand)
        .values({
          conversationId,
          articlesAndObjectiveProblems,
          articlesAndObjectiveProblemsTopMatch,
        });
      return { created: true, updated: false };
    }
  },

  async updateStatus(
    conversationId: number,
    status: "not_started" | "in_progress" | "demand_found" | "demand_not_found" | "error"
  ): Promise<void> {
    const existing = await this.getActiveByConversationId(conversationId);
    
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

  async getInteractionCount(conversationId: number): Promise<number> {
    const existing = await this.getActiveByConversationId(conversationId);
    if (!existing) {
      return 0;
    }
    return existing.interactionCount || 0;
  },

  async incrementInteractionCount(conversationId: number): Promise<number> {
    const existing = await this.getActiveByConversationId(conversationId);
    
    if (!existing) {
      console.warn(`[caseDemandStorage] No active demand found for conversation ${conversationId}, cannot increment interaction count`);
      return 0;
    }
    
    const newCount = (existing.interactionCount || 0) + 1;
    await db.update(caseDemand)
      .set({
        interactionCount: newCount,
        updatedAt: new Date(),
      })
      .where(eq(caseDemand.id, existing.id));
    return newCount;
  },

  async updateSolutionCenterResults(
    conversationId: number,
    solutionCenterArticlesAndProblems: SolutionCenterResult[]
  ): Promise<{ created: boolean; updated: boolean }> {
    const existing = await this.getActiveByConversationId(conversationId);
    
    if (existing) {
      await db.update(caseDemand)
        .set({
          solutionCenterArticlesAndProblems,
          updatedAt: new Date(),
        })
        .where(eq(caseDemand.id, existing.id));
      return { created: false, updated: true };
    } else {
      await db.insert(caseDemand)
        .values({
          conversationId,
          solutionCenterArticlesAndProblems,
        });
      return { created: true, updated: false };
    }
  },
};
