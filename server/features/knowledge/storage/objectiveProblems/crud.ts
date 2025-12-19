import { db } from "../../../../db.js";
import { 
  knowledgeBaseObjectiveProblems, 
  type KnowledgeBaseObjectiveProblem, 
  type InsertKnowledgeBaseObjectiveProblem 
} from "../../../../../shared/schema.js";
import { eq } from "drizzle-orm";
import type { ObjectiveProblemWithProducts } from "./types.js";
import { getProductIdsForProblem, getProductIdsForProblems, setProductsForProblem } from "./products.js";
import { generateAndSaveEmbeddingAsync } from "./embedding.js";

export async function getAllObjectiveProblems(): Promise<ObjectiveProblemWithProducts[]> {
  const problems = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .orderBy(knowledgeBaseObjectiveProblems.name);
  
  const problemIds = problems.map((p: KnowledgeBaseObjectiveProblem) => p.id);
  const productIdsByProblem = await getProductIdsForProblems(problemIds);
  
  return problems.map((problem: KnowledgeBaseObjectiveProblem) => ({
    ...problem,
    productIds: productIdsByProblem.get(problem.id) || [],
  }));
}

export async function getActiveObjectiveProblems(): Promise<ObjectiveProblemWithProducts[]> {
  const problems = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.isActive, true))
    .orderBy(knowledgeBaseObjectiveProblems.name);
  
  const problemIds = problems.map((p: KnowledgeBaseObjectiveProblem) => p.id);
  const productIdsByProblem = await getProductIdsForProblems(problemIds);
  
  return problems.map((problem: KnowledgeBaseObjectiveProblem) => ({
    ...problem,
    productIds: productIdsByProblem.get(problem.id) || [],
  }));
}

export async function getObjectiveProblemById(id: number): Promise<ObjectiveProblemWithProducts | undefined> {
  const results = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.id, id));
  
  if (!results[0]) return undefined;
  
  const productIds = await getProductIdsForProblem(id);
  return { ...results[0], productIds };
}

export async function createObjectiveProblem(
  data: InsertKnowledgeBaseObjectiveProblem, 
  productIds?: number[]
): Promise<ObjectiveProblemWithProducts> {
  const results = await db
    .insert(knowledgeBaseObjectiveProblems)
    .values(data)
    .returning();
  
  const problem = results[0];
  
  if (productIds && productIds.length > 0) {
    await setProductsForProblem(problem.id, productIds);
  }
  
  generateAndSaveEmbeddingAsync(problem);
  
  return { ...problem, productIds: productIds || [] };
}

export async function updateObjectiveProblem(
  id: number, 
  data: Partial<InsertKnowledgeBaseObjectiveProblem>,
  productIds?: number[]
): Promise<ObjectiveProblemWithProducts | undefined> {
  const results = await db
    .update(knowledgeBaseObjectiveProblems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(knowledgeBaseObjectiveProblems.id, id))
    .returning();
  
  if (!results[0]) return undefined;
  
  if (productIds !== undefined) {
    await setProductsForProblem(id, productIds);
  }
  
  generateAndSaveEmbeddingAsync(results[0]);
  
  const currentProductIds = await getProductIdsForProblem(id);
  return { ...results[0], productIds: currentProductIds };
}

export async function deleteObjectiveProblem(id: number): Promise<boolean> {
  const result = await db
    .delete(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.id, id))
    .returning();
  return result.length > 0;
}
