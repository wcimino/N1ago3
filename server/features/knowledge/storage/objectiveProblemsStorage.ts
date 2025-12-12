import { db } from "../../../db";
import { 
  knowledgeBaseObjectiveProblems, 
  knowledgeBaseObjectiveProblemsHasProductsCatalog,
  ifoodProducts,
  type KnowledgeBaseObjectiveProblem, 
  type InsertKnowledgeBaseObjectiveProblem 
} from "../../../../shared/schema";
import { eq, inArray } from "drizzle-orm";

export type ObjectiveProblemWithProducts = KnowledgeBaseObjectiveProblem & {
  productIds: number[];
};

export async function getAllObjectiveProblems(): Promise<ObjectiveProblemWithProducts[]> {
  const problems = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .orderBy(knowledgeBaseObjectiveProblems.name);
  
  return Promise.all(problems.map(async (problem) => {
    const productIds = await getProductIdsForProblem(problem.id);
    return { ...problem, productIds };
  }));
}

export async function getActiveObjectiveProblems(): Promise<ObjectiveProblemWithProducts[]> {
  const problems = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .where(eq(knowledgeBaseObjectiveProblems.isActive, true))
    .orderBy(knowledgeBaseObjectiveProblems.name);
  
  return Promise.all(problems.map(async (problem) => {
    const productIds = await getProductIdsForProblem(problem.id);
    return { ...problem, productIds };
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

async function getProductIdsForProblem(problemId: number): Promise<number[]> {
  const links = await db
    .select({ productId: knowledgeBaseObjectiveProblemsHasProductsCatalog.productId })
    .from(knowledgeBaseObjectiveProblemsHasProductsCatalog)
    .where(eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.objectiveProblemId, problemId));
  
  return links.map(l => l.productId);
}

async function setProductsForProblem(problemId: number, productIds: number[]): Promise<void> {
  await db
    .delete(knowledgeBaseObjectiveProblemsHasProductsCatalog)
    .where(eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.objectiveProblemId, problemId));
  
  if (productIds.length > 0) {
    await db
      .insert(knowledgeBaseObjectiveProblemsHasProductsCatalog)
      .values(productIds.map(productId => ({
        objectiveProblemId: problemId,
        productId,
      })));
  }
}

export async function getAllProducts() {
  return db
    .select()
    .from(ifoodProducts)
    .orderBy(ifoodProducts.fullName);
}
