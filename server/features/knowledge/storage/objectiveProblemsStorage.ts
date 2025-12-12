import { db } from "../../../db";
import { knowledgeBaseObjectiveProblems, type KnowledgeBaseObjectiveProblem, type InsertKnowledgeBaseObjectiveProblem } from "../../../../shared/schema";
import { eq } from "drizzle-orm";

export async function getAllObjectiveProblems(): Promise<KnowledgeBaseObjectiveProblem[]> {
  return db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .orderBy(knowledgeBaseObjectiveProblems.name);
}

export async function getActiveObjectiveProblems(): Promise<KnowledgeBaseObjectiveProblem[]> {
  return db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.isActive, true))
    .orderBy(knowledgeBaseObjectiveProblems.name);
}

export async function getObjectiveProblemById(id: number): Promise<KnowledgeBaseObjectiveProblem | undefined> {
  const results = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.id, id));
  return results[0];
}

export async function createObjectiveProblem(data: InsertKnowledgeBaseObjectiveProblem): Promise<KnowledgeBaseObjectiveProblem> {
  const results = await db
    .insert(knowledgeBaseObjectiveProblems)
    .values(data)
    .returning();
  return results[0];
}

export async function updateObjectiveProblem(id: number, data: Partial<InsertKnowledgeBaseObjectiveProblem>): Promise<KnowledgeBaseObjectiveProblem | undefined> {
  const results = await db
    .update(knowledgeBaseObjectiveProblems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(knowledgeBaseObjectiveProblems.id, id))
    .returning();
  return results[0];
}

export async function deleteObjectiveProblem(id: number): Promise<boolean> {
  const result = await db
    .delete(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.id, id))
    .returning();
  return result.length > 0;
}
