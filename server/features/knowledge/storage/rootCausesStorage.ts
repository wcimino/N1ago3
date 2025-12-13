import { db } from "../../../db.js";
import {
  knowledgeBaseRootCauses,
  knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems,
  knowledgeBaseRootCauseHasKnowledgeBaseSolutions,
  knowledgeBaseObjectiveProblems,
  knowledgeBaseSolutions,
} from "../../../../shared/schema.js";
import { eq, desc, ilike, and, type SQL } from "drizzle-orm";
import type {
  KnowledgeBaseRootCause,
  InsertKnowledgeBaseRootCause,
  KnowledgeBaseObjectiveProblem,
  KnowledgeBaseSolution,
} from "../../../../shared/schema.js";

export const rootCausesStorage = {
  async getAll(filters?: {
    search?: string;
    isActive?: boolean;
  }): Promise<KnowledgeBaseRootCause[]> {
    const conditions: SQL[] = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(knowledgeBaseRootCauses.isActive, filters.isActive));
    }

    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(ilike(knowledgeBaseRootCauses.name, searchPattern));
    }

    const query = db.select().from(knowledgeBaseRootCauses);

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(knowledgeBaseRootCauses.updatedAt));
    }

    return await query.orderBy(desc(knowledgeBaseRootCauses.updatedAt));
  },

  async getById(id: number): Promise<KnowledgeBaseRootCause | null> {
    const [rootCause] = await db.select()
      .from(knowledgeBaseRootCauses)
      .where(eq(knowledgeBaseRootCauses.id, id));
    return rootCause || null;
  },

  async getByIdWithRelations(id: number): Promise<(KnowledgeBaseRootCause & {
    problems: KnowledgeBaseObjectiveProblem[];
    solutions: KnowledgeBaseSolution[];
  }) | null> {
    const rootCause = await this.getById(id);
    if (!rootCause) return null;

    const problems = await db.select({
      id: knowledgeBaseObjectiveProblems.id,
      name: knowledgeBaseObjectiveProblems.name,
      description: knowledgeBaseObjectiveProblems.description,
      synonyms: knowledgeBaseObjectiveProblems.synonyms,
      examples: knowledgeBaseObjectiveProblems.examples,
      presentedBy: knowledgeBaseObjectiveProblems.presentedBy,
      isActive: knowledgeBaseObjectiveProblems.isActive,
      createdAt: knowledgeBaseObjectiveProblems.createdAt,
      updatedAt: knowledgeBaseObjectiveProblems.updatedAt,
    })
      .from(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems)
      .innerJoin(
        knowledgeBaseObjectiveProblems,
        eq(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.problemId, knowledgeBaseObjectiveProblems.id)
      )
      .where(eq(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.rootCauseId, id));

    const solutions = await db.select({
      id: knowledgeBaseSolutions.id,
      name: knowledgeBaseSolutions.name,
      description: knowledgeBaseSolutions.description,
      productId: knowledgeBaseSolutions.productId,
      isActive: knowledgeBaseSolutions.isActive,
      createdAt: knowledgeBaseSolutions.createdAt,
      updatedAt: knowledgeBaseSolutions.updatedAt,
    })
      .from(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
      .innerJoin(
        knowledgeBaseSolutions,
        eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.solutionId, knowledgeBaseSolutions.id)
      )
      .where(eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.rootCauseId, id));

    return {
      ...rootCause,
      problems,
      solutions,
    };
  },

  async create(data: InsertKnowledgeBaseRootCause): Promise<KnowledgeBaseRootCause> {
    const [rootCause] = await db.insert(knowledgeBaseRootCauses)
      .values(data)
      .returning();
    return rootCause;
  },

  async update(id: number, data: Partial<InsertKnowledgeBaseRootCause>): Promise<KnowledgeBaseRootCause | null> {
    const [rootCause] = await db.update(knowledgeBaseRootCauses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBaseRootCauses.id, id))
      .returning();
    return rootCause || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(knowledgeBaseRootCauses)
      .where(eq(knowledgeBaseRootCauses.id, id))
      .returning();
    return result.length > 0;
  },

  async addProblem(rootCauseId: number, problemId: number): Promise<void> {
    await db.insert(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems)
      .values({ rootCauseId, problemId })
      .onConflictDoNothing();
  },

  async removeProblem(rootCauseId: number, problemId: number): Promise<boolean> {
    const result = await db.delete(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems)
      .where(and(
        eq(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.rootCauseId, rootCauseId),
        eq(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.problemId, problemId)
      ))
      .returning();
    return result.length > 0;
  },

  async setProblems(rootCauseId: number, problemIds: number[]): Promise<void> {
    await db.delete(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems)
      .where(eq(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.rootCauseId, rootCauseId));

    if (problemIds.length > 0) {
      await db.insert(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems)
        .values(problemIds.map(problemId => ({ rootCauseId, problemId })));
    }
  },

  async addSolution(rootCauseId: number, solutionId: number): Promise<void> {
    await db.insert(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
      .values({ rootCauseId, solutionId })
      .onConflictDoNothing();
  },

  async removeSolution(rootCauseId: number, solutionId: number): Promise<boolean> {
    const result = await db.delete(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
      .where(and(
        eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.rootCauseId, rootCauseId),
        eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.solutionId, solutionId)
      ))
      .returning();
    return result.length > 0;
  },

  async setSolutions(rootCauseId: number, solutionIds: number[]): Promise<void> {
    await db.delete(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
      .where(eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.rootCauseId, rootCauseId));

    if (solutionIds.length > 0) {
      await db.insert(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
        .values(solutionIds.map(solutionId => ({ rootCauseId, solutionId })));
    }
  },

  async getProblemIds(rootCauseId: number): Promise<number[]> {
    const results = await db.select({ problemId: knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.problemId })
      .from(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems)
      .where(eq(knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.rootCauseId, rootCauseId));
    return results.map(r => r.problemId);
  },

  async getSolutionIds(rootCauseId: number): Promise<number[]> {
    const results = await db.select({ solutionId: knowledgeBaseRootCauseHasKnowledgeBaseSolutions.solutionId })
      .from(knowledgeBaseRootCauseHasKnowledgeBaseSolutions)
      .where(eq(knowledgeBaseRootCauseHasKnowledgeBaseSolutions.rootCauseId, rootCauseId));
    return results.map(r => r.solutionId);
  },
};
