import { db } from "../../../db.js";
import { caseSolutions, caseActions } from "../../../../shared/schema/knowledge.js";
import { eq, and, desc } from "drizzle-orm";
import type { CaseSolution, InsertCaseSolution, CaseAction, InsertCaseAction } from "../../../../shared/schema/knowledge.js";

export type CaseSolutionStatus = "pending_info" | "pending_action" | "in_progress" | "resolved" | "escalated" | "error";
export type CaseActionStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export const caseSolutionStorage = {
  async getById(id: number): Promise<CaseSolution | null> {
    const [solution] = await db.select()
      .from(caseSolutions)
      .where(eq(caseSolutions.id, id))
      .limit(1);
    return solution || null;
  },

  async getByConversationId(conversationId: number): Promise<CaseSolution[]> {
    return db.select()
      .from(caseSolutions)
      .where(eq(caseSolutions.conversationId, conversationId))
      .orderBy(desc(caseSolutions.createdAt));
  },

  async getActiveByConversationId(conversationId: number): Promise<CaseSolution | null> {
    const [solution] = await db.select()
      .from(caseSolutions)
      .where(
        and(
          eq(caseSolutions.conversationId, conversationId),
          eq(caseSolutions.status, "pending_info")
        )
      )
      .orderBy(desc(caseSolutions.createdAt))
      .limit(1);
    
    if (solution) return solution;

    const [inProgress] = await db.select()
      .from(caseSolutions)
      .where(
        and(
          eq(caseSolutions.conversationId, conversationId),
          eq(caseSolutions.status, "in_progress")
        )
      )
      .orderBy(desc(caseSolutions.createdAt))
      .limit(1);
    
    return inProgress || null;
  },

  async getLatestByConversationId(conversationId: number): Promise<CaseSolution | null> {
    const [solution] = await db.select()
      .from(caseSolutions)
      .where(eq(caseSolutions.conversationId, conversationId))
      .orderBy(desc(caseSolutions.createdAt))
      .limit(1);
    return solution || null;
  },

  async create(data: InsertCaseSolution): Promise<CaseSolution> {
    const [solution] = await db.insert(caseSolutions)
      .values(data)
      .returning();
    return solution;
  },

  async createForConversation(
    conversationId: number,
    options: {
      solutionId?: number;
      rootCauseId?: number;
      articleId?: number;
    }
  ): Promise<CaseSolution> {
    const [solution] = await db.insert(caseSolutions)
      .values({
        conversationId,
        solutionId: options.solutionId || null,
        rootCauseId: options.rootCauseId || null,
        status: "pending_info",
        providedInputs: options.articleId ? { articleId: options.articleId } : {},
      })
      .returning();
    return solution;
  },

  async updateStatus(id: number, status: CaseSolutionStatus): Promise<void> {
    await db.update(caseSolutions)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(caseSolutions.id, id));
  },

  async updateProvidedInputs(
    id: number,
    providedInputs: Record<string, unknown>
  ): Promise<void> {
    const existing = await this.getById(id);
    const merged = { ...(existing?.providedInputs || {}), ...providedInputs };
    
    await db.update(caseSolutions)
      .set({
        providedInputs: merged,
        updatedAt: new Date(),
      })
      .where(eq(caseSolutions.id, id));
  },

  async updateCollectedInputs(
    id: number,
    customerInputs?: Record<string, unknown>,
    systemInputs?: Record<string, unknown>
  ): Promise<void> {
    const existing = await this.getById(id);
    const updates: Partial<CaseSolution> = { updatedAt: new Date() };
    
    if (customerInputs) {
      updates.collectedInputsCustomer = { 
        ...(existing?.collectedInputsCustomer || {}), 
        ...customerInputs 
      };
    }
    if (systemInputs) {
      updates.collectedInputsSystems = { 
        ...(existing?.collectedInputsSystems || {}), 
        ...systemInputs 
      };
    }
    
    await db.update(caseSolutions)
      .set(updates)
      .where(eq(caseSolutions.id, id));
  },

  async getActions(caseSolutionId: number): Promise<CaseAction[]> {
    return db.select()
      .from(caseActions)
      .where(eq(caseActions.caseSolutionId, caseSolutionId))
      .orderBy(caseActions.actionSequence);
  },

  async getNextPendingAction(caseSolutionId: number): Promise<CaseAction | null> {
    const [action] = await db.select()
      .from(caseActions)
      .where(
        and(
          eq(caseActions.caseSolutionId, caseSolutionId),
          eq(caseActions.status, "pending")
        )
      )
      .orderBy(caseActions.actionSequence)
      .limit(1);
    return action || null;
  },

  async createAction(data: InsertCaseAction): Promise<CaseAction> {
    const [action] = await db.insert(caseActions)
      .values(data)
      .returning();
    return action;
  },

  async createFallbackAction(caseSolutionId: number): Promise<CaseAction> {
    const FALLBACK_ACTION_ID = -1;
    
    const [action] = await db.insert(caseActions)
      .values({
        caseSolutionId,
        actionId: FALLBACK_ACTION_ID,
        actionSequence: 1,
        status: "pending",
        inputUsed: { type: "transfer_to_human", reason: "No solution found - fallback" },
      })
      .returning();
    return action;
  },

  async updateActionStatus(
    actionId: number,
    status: CaseActionStatus,
    options?: {
      output?: Record<string, unknown>;
      errorMessage?: string;
    }
  ): Promise<void> {
    const updates: Partial<CaseAction> = { status };
    
    if (status === "in_progress") {
      updates.startedAt = new Date();
    }
    if (status === "completed" || status === "failed") {
      updates.completedAt = new Date();
    }
    if (options?.output) {
      updates.output = options.output;
    }
    if (options?.errorMessage) {
      updates.errorMessage = options.errorMessage;
    }
    
    await db.update(caseActions)
      .set(updates)
      .where(eq(caseActions.id, actionId));
  },

  async hasCompletedAllActions(caseSolutionId: number): Promise<boolean> {
    const actions = await this.getActions(caseSolutionId);
    if (actions.length === 0) return false;
    return actions.every(a => a.status === "completed" || a.status === "skipped");
  },

  async hasPendingActions(caseSolutionId: number): Promise<boolean> {
    const pendingAction = await this.getNextPendingAction(caseSolutionId);
    return pendingAction !== null;
  },

  async getInteractionCount(caseSolutionId: number): Promise<number> {
    const solution = await this.getById(caseSolutionId);
    return solution?.interactionCount ?? 0;
  },

  async incrementInteractionCount(caseSolutionId: number): Promise<number> {
    const current = await this.getInteractionCount(caseSolutionId);
    const newCount = current + 1;
    
    await db.update(caseSolutions)
      .set({
        interactionCount: newCount,
        updatedAt: new Date(),
      })
      .where(eq(caseSolutions.id, caseSolutionId));
    
    return newCount;
  },
};
