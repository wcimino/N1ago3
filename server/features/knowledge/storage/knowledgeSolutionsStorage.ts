import { db } from "../../../db.js";
import { knowledgeBaseSolutions, knowledgeBaseSolutionsHasKnowledgeBaseActions, knowledgeBaseActions } from "../../../../shared/schema.js";
import { eq, desc, ilike, and, asc, type SQL } from "drizzle-orm";
import type { KnowledgeBaseSolution, InsertKnowledgeBaseSolution, KnowledgeBaseAction, InsertKnowledgeBaseSolutionHasAction } from "../../../../shared/schema.js";

export const knowledgeSolutionsStorage = {
  async getAll(filters?: {
    search?: string;
    productId?: number;
    isActive?: boolean;
  }): Promise<KnowledgeBaseSolution[]> {
    const conditions: SQL[] = [];

    if (filters?.productId) {
      conditions.push(eq(knowledgeBaseSolutions.productId, filters.productId));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(knowledgeBaseSolutions.isActive, filters.isActive));
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(ilike(knowledgeBaseSolutions.name, searchPattern));
    }

    const query = db.select().from(knowledgeBaseSolutions);

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(knowledgeBaseSolutions.updatedAt));
    }

    return await query.orderBy(desc(knowledgeBaseSolutions.updatedAt));
  },

  async getById(id: number): Promise<KnowledgeBaseSolution | null> {
    const [solution] = await db.select()
      .from(knowledgeBaseSolutions)
      .where(eq(knowledgeBaseSolutions.id, id));
    return solution || null;
  },

  async getByIdWithActions(id: number): Promise<(KnowledgeBaseSolution & { actions: (KnowledgeBaseAction & { actionSequence: number })[] }) | null> {
    const solution = await this.getById(id);
    if (!solution) return null;

    const actionsWithSequence = await db.select({
      id: knowledgeBaseActions.id,
      actionType: knowledgeBaseActions.actionType,
      description: knowledgeBaseActions.description,
      requiredInput: knowledgeBaseActions.requiredInput,
      messageTemplate: knowledgeBaseActions.messageTemplate,
      ownerTeam: knowledgeBaseActions.ownerTeam,
      sla: knowledgeBaseActions.sla,
      isActive: knowledgeBaseActions.isActive,
      createdAt: knowledgeBaseActions.createdAt,
      updatedAt: knowledgeBaseActions.updatedAt,
      actionSequence: knowledgeBaseSolutionsHasKnowledgeBaseActions.actionSequence,
    })
      .from(knowledgeBaseSolutionsHasKnowledgeBaseActions)
      .innerJoin(knowledgeBaseActions, eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.actionId, knowledgeBaseActions.id))
      .where(eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.solutionId, id))
      .orderBy(asc(knowledgeBaseSolutionsHasKnowledgeBaseActions.actionSequence));

    return {
      ...solution,
      actions: actionsWithSequence,
    };
  },

  async create(data: InsertKnowledgeBaseSolution): Promise<KnowledgeBaseSolution> {
    const [solution] = await db.insert(knowledgeBaseSolutions)
      .values(data)
      .returning();
    return solution;
  },

  async update(id: number, data: Partial<InsertKnowledgeBaseSolution>): Promise<KnowledgeBaseSolution | null> {
    const [solution] = await db.update(knowledgeBaseSolutions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBaseSolutions.id, id))
      .returning();
    return solution || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(knowledgeBaseSolutions)
      .where(eq(knowledgeBaseSolutions.id, id))
      .returning();
    return result.length > 0;
  },

  async addAction(solutionId: number, actionId: number, actionSequence: number): Promise<void> {
    await db.insert(knowledgeBaseSolutionsHasKnowledgeBaseActions)
      .values({ solutionId, actionId, actionSequence })
      .onConflictDoUpdate({
        target: [knowledgeBaseSolutionsHasKnowledgeBaseActions.solutionId, knowledgeBaseSolutionsHasKnowledgeBaseActions.actionId],
        set: { actionSequence },
      });
  },

  async removeAction(solutionId: number, actionId: number): Promise<boolean> {
    const result = await db.delete(knowledgeBaseSolutionsHasKnowledgeBaseActions)
      .where(and(
        eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.solutionId, solutionId),
        eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.actionId, actionId)
      ))
      .returning();
    return result.length > 0;
  },

  async reorderActions(solutionId: number, actionIds: number[]): Promise<void> {
    for (let i = 0; i < actionIds.length; i++) {
      await db.update(knowledgeBaseSolutionsHasKnowledgeBaseActions)
        .set({ actionSequence: i + 1 })
        .where(and(
          eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.solutionId, solutionId),
          eq(knowledgeBaseSolutionsHasKnowledgeBaseActions.actionId, actionIds[i])
        ));
    }
  },

  async getUniqueProductIds(): Promise<number[]> {
    const results = await db.selectDistinct({ productId: knowledgeBaseSolutions.productId })
      .from(knowledgeBaseSolutions);
    return results.map(r => r.productId).filter((p): p is number => p !== null);
  },
};
