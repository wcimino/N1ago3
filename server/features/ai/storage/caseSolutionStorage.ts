import { db } from "../../../db.js";
import { caseSolutions, caseActions, knowledgeBaseSolutions, knowledgeBaseRootCauses, knowledgeBaseActions, knowledgeBaseSolutionsHasKnowledgeBaseActions, knowledgeBase, caseDemand } from "../../../../shared/schema.js";
import { eq, desc, and, sql } from "drizzle-orm";
import type { CaseSolution, InsertCaseSolution, CaseAction, InsertCaseAction } from "../../../../shared/schema.js";

export interface CaseSolutionWithDetails extends CaseSolution {
  solution?: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  rootCause?: {
    id: number;
    name: string;
    description: string;
  } | null;
  actions?: CaseAction[];
}

export const caseSolutionStorage = {
  async create(data: InsertCaseSolution): Promise<CaseSolution> {
    const [result] = await db.insert(caseSolutions)
      .values(data)
      .returning();
    return result;
  },

  async getById(id: number): Promise<CaseSolution | null> {
    const [result] = await db.select()
      .from(caseSolutions)
      .where(eq(caseSolutions.id, id));
    return result || null;
  },

  async getByConversationId(conversationId: number): Promise<CaseSolution | null> {
    const [result] = await db.select()
      .from(caseSolutions)
      .where(eq(caseSolutions.conversationId, conversationId))
      .orderBy(desc(caseSolutions.createdAt))
      .limit(1);
    return result || null;
  },

  async getActiveByConversationId(conversationId: number): Promise<CaseSolution | null> {
    const [result] = await db.select()
      .from(caseSolutions)
      .where(and(
        eq(caseSolutions.conversationId, conversationId),
        sql`${caseSolutions.status} NOT IN ('completed', 'failed', 'cancelled')`
      ))
      .orderBy(desc(caseSolutions.createdAt))
      .limit(1);
    return result || null;
  },

  async getByIdWithDetails(id: number): Promise<CaseSolutionWithDetails | null> {
    const caseSolution = await this.getById(id);
    if (!caseSolution) return null;

    let solution: { id: number; name: string; description: string | null } | null = null;
    if (caseSolution.solutionId) {
      const [s] = await db.select({
        id: knowledgeBaseSolutions.id,
        name: knowledgeBaseSolutions.name,
        description: knowledgeBaseSolutions.description,
      })
        .from(knowledgeBaseSolutions)
        .where(eq(knowledgeBaseSolutions.id, caseSolution.solutionId));
      solution = s || null;
    }

    let rootCause: { id: number; name: string; description: string } | null = null;
    if (caseSolution.rootCauseId) {
      const [rc] = await db.select({
        id: knowledgeBaseRootCauses.id,
        name: knowledgeBaseRootCauses.name,
        description: knowledgeBaseRootCauses.description,
      })
        .from(knowledgeBaseRootCauses)
        .where(eq(knowledgeBaseRootCauses.id, caseSolution.rootCauseId));
      rootCause = rc || null;
    }

    const actions = await db.select()
      .from(caseActions)
      .where(eq(caseActions.caseSolutionId, id))
      .orderBy(caseActions.actionSequence);

    return {
      ...caseSolution,
      solution,
      rootCause,
      actions,
    };
  },

  async updateStatus(id: number, status: string): Promise<CaseSolution | null> {
    const [result] = await db.update(caseSolutions)
      .set({ status, updatedAt: new Date() })
      .where(eq(caseSolutions.id, id))
      .returning();
    return result || null;
  },

  async updateCollectedInputsCustomer(id: number, inputs: Record<string, unknown>): Promise<CaseSolution | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const merged = {
      ...(current.collectedInputsCustomer as Record<string, unknown> || {}),
      ...inputs,
    };

    const [result] = await db.update(caseSolutions)
      .set({ collectedInputsCustomer: merged, updatedAt: new Date() })
      .where(eq(caseSolutions.id, id))
      .returning();
    return result || null;
  },

  async updateCollectedInputsSystems(id: number, inputs: Record<string, unknown>): Promise<CaseSolution | null> {
    const current = await this.getById(id);
    if (!current) return null;

    const merged = {
      ...(current.collectedInputsSystems as Record<string, unknown> || {}),
      ...inputs,
    };

    const [result] = await db.update(caseSolutions)
      .set({ collectedInputsSystems: merged, updatedAt: new Date() })
      .where(eq(caseSolutions.id, id))
      .returning();
    return result || null;
  },

  async updatePendingInputs(id: number, pendingInputs: Array<{ key: string; question: string; source: string }>): Promise<CaseSolution | null> {
    const [result] = await db.update(caseSolutions)
      .set({ pendingInputs, updatedAt: new Date() })
      .where(eq(caseSolutions.id, id))
      .returning();
    return result || null;
  },

  async createWithActions(data: InsertCaseSolution): Promise<CaseSolutionWithDetails> {
    const caseSolution = await this.create(data);

    if (caseSolution.solutionId) {
      const [solutionDetails] = await db.select({
        isArticleDefault: knowledgeBaseSolutions.isArticleDefault,
      })
        .from(knowledgeBaseSolutions)
        .where(eq(knowledgeBaseSolutions.id, caseSolution.solutionId));

      let articleMessageTemplate: string | null = null;
      let sourceArticleId: number | null = null;

      if (solutionDetails?.isArticleDefault) {
        const [demand] = await db.select({
          topMatch: caseDemand.articlesAndObjectiveProblemsTopMatch,
        })
          .from(caseDemand)
          .where(eq(caseDemand.conversationId, caseSolution.conversationId))
          .orderBy(desc(caseDemand.updatedAt))
          .limit(1);

        const topMatch = demand?.topMatch as { source: string; id: number } | null;
        if (topMatch?.source === "article" && topMatch.id) {
          const [article] = await db.select({
            id: knowledgeBase.id,
            answer: knowledgeBase.answer,
          })
            .from(knowledgeBase)
            .where(eq(knowledgeBase.id, topMatch.id));

          if (article?.answer) {
            articleMessageTemplate = article.answer;
            sourceArticleId = article.id;
            console.log(`[CaseSolutionStorage] isArticleDefault solution: using article ${sourceArticleId} answer as messageTemplate`);
          } else {
            console.log(`[CaseSolutionStorage] isArticleDefault solution: article ${topMatch.id} found but has no answer`);
          }
        } else {
          console.log(`[CaseSolutionStorage] isArticleDefault solution: no article top match found for conversation ${caseSolution.conversationId}`);
        }
      }

      const solutionActions = await db.select({
        actionId: knowledgeBaseSolutionsHasKnowledgeBaseActions.actionId,
        actionSequence: knowledgeBaseSolutionsHasKnowledgeBaseActions.actionSequence,
      })
        .from(knowledgeBaseSolutionsHasKnowledgeBaseActions)
        .where(eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.solutionId, caseSolution.solutionId))
        .orderBy(knowledgeBaseSolutionsHasKnowledgeBaseActions.actionSequence);

      for (const sa of solutionActions) {
        const inputUsed: Record<string, unknown> = {};
        if (articleMessageTemplate) {
          inputUsed.messageTemplate = articleMessageTemplate;
          inputUsed.sourceArticleId = sourceArticleId;
        }

        await db.insert(caseActions)
          .values({
            caseSolutionId: caseSolution.id,
            actionId: sa.actionId,
            actionSequence: sa.actionSequence,
            status: "not_started",
            inputUsed: Object.keys(inputUsed).length > 0 ? inputUsed : {},
          });
      }
    }

    return this.getByIdWithDetails(caseSolution.id) as Promise<CaseSolutionWithDetails>;
  },
};
