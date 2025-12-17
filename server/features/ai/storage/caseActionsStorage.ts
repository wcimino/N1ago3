import { db } from "../../../db.js";
import { caseActions, knowledgeBaseActions } from "../../../../shared/schema.js";
import { eq, and, asc } from "drizzle-orm";
import type { CaseAction, InsertCaseAction } from "../../../../shared/schema.js";

export interface CaseActionWithDetails extends CaseAction {
  action?: {
    id: number;
    actionType: string;
    description: string;
    requiredInput: string | null;
    messageTemplate: string | null;
    ownerTeam: string | null;
    sla: string | null;
  } | null;
}

export const caseActionsStorage = {
  async create(data: InsertCaseAction): Promise<CaseAction> {
    const [result] = await db.insert(caseActions)
      .values(data)
      .returning();
    return result;
  },

  async getById(id: number): Promise<CaseAction | null> {
    const [result] = await db.select()
      .from(caseActions)
      .where(eq(caseActions.id, id));
    return result || null;
  },

  async getByCaseSolutionId(caseSolutionId: number): Promise<CaseAction[]> {
    return db.select()
      .from(caseActions)
      .where(eq(caseActions.caseSolutionId, caseSolutionId))
      .orderBy(asc(caseActions.actionSequence));
  },

  async getByCaseSolutionIdWithDetails(caseSolutionId: number): Promise<CaseActionWithDetails[]> {
    const actions = await this.getByCaseSolutionId(caseSolutionId);
    
    const result: CaseActionWithDetails[] = [];
    for (const action of actions) {
      const [actionDetails] = await db.select({
        id: knowledgeBaseActions.id,
        actionType: knowledgeBaseActions.actionType,
        description: knowledgeBaseActions.description,
        requiredInput: knowledgeBaseActions.requiredInput,
        messageTemplate: knowledgeBaseActions.messageTemplate,
        ownerTeam: knowledgeBaseActions.ownerTeam,
        sla: knowledgeBaseActions.sla,
      })
        .from(knowledgeBaseActions)
        .where(eq(knowledgeBaseActions.id, action.actionId));
      
      result.push({
        ...action,
        action: actionDetails || null,
      });
    }
    
    return result;
  },

  async getNextPendingAction(caseSolutionId: number): Promise<CaseActionWithDetails | null> {
    const [action] = await db.select()
      .from(caseActions)
      .where(and(
        eq(caseActions.caseSolutionId, caseSolutionId),
        eq(caseActions.status, "not_started")
      ))
      .orderBy(asc(caseActions.actionSequence))
      .limit(1);
    
    if (!action) return null;

    const [actionDetails] = await db.select({
      id: knowledgeBaseActions.id,
      actionType: knowledgeBaseActions.actionType,
      description: knowledgeBaseActions.description,
      requiredInput: knowledgeBaseActions.requiredInput,
      messageTemplate: knowledgeBaseActions.messageTemplate,
      ownerTeam: knowledgeBaseActions.ownerTeam,
      sla: knowledgeBaseActions.sla,
    })
      .from(knowledgeBaseActions)
      .where(eq(knowledgeBaseActions.id, action.actionId));

    return {
      ...action,
      action: actionDetails || null,
    };
  },

  async updateStatus(id: number, status: string): Promise<CaseAction | null> {
    const updates: Partial<CaseAction> = { status };
    
    if (status === "in_progress") {
      updates.startedAt = new Date();
    } else if (status === "done" || status === "error") {
      updates.completedAt = new Date();
    }

    const [result] = await db.update(caseActions)
      .set(updates)
      .where(eq(caseActions.id, id))
      .returning();
    return result || null;
  },

  async updateInputAndOutput(id: number, data: { inputUsed?: Record<string, unknown>; output?: Record<string, unknown>; errorMessage?: string }): Promise<CaseAction | null> {
    const [result] = await db.update(caseActions)
      .set(data)
      .where(eq(caseActions.id, id))
      .returning();
    return result || null;
  },

  async startAction(id: number, inputUsed: Record<string, unknown>): Promise<CaseAction | null> {
    const [result] = await db.update(caseActions)
      .set({
        status: "in_progress",
        inputUsed,
        startedAt: new Date(),
      })
      .where(eq(caseActions.id, id))
      .returning();
    return result || null;
  },

  async completeAction(id: number, output: Record<string, unknown>): Promise<CaseAction | null> {
    const [result] = await db.update(caseActions)
      .set({
        status: "done",
        output,
        completedAt: new Date(),
      })
      .where(eq(caseActions.id, id))
      .returning();
    return result || null;
  },

  async failAction(id: number, errorMessage: string): Promise<CaseAction | null> {
    const [result] = await db.update(caseActions)
      .set({
        status: "error",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(caseActions.id, id))
      .returning();
    return result || null;
  },
};
