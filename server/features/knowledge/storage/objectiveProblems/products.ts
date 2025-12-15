import { db } from "../../../../db.js";
import { 
  knowledgeBaseObjectiveProblemsHasProductsCatalog,
  productsCatalog 
} from "../../../../../shared/schema.js";
import { eq } from "drizzle-orm";

export async function getProductIdsForProblem(problemId: number): Promise<number[]> {
  const links = await db
    .select({ productId: knowledgeBaseObjectiveProblemsHasProductsCatalog.productId })
    .from(knowledgeBaseObjectiveProblemsHasProductsCatalog)
    .where(eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.objectiveProblemId, problemId));
  
  return links.map((l: typeof links[number]) => l.productId);
}

export async function setProductsForProblem(problemId: number, productIds: number[]): Promise<void> {
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

export async function getProductNamesForProblem(problemId: number): Promise<string[]> {
  const links = await db
    .select({ fullName: productsCatalog.fullName })
    .from(knowledgeBaseObjectiveProblemsHasProductsCatalog)
    .innerJoin(productsCatalog, eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.productId, productsCatalog.id))
    .where(eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.objectiveProblemId, problemId));
  
  return links.map((l: typeof links[number]) => l.fullName);
}

export async function getAllProducts() {
  return db
    .select()
    .from(productsCatalog)
    .orderBy(productsCatalog.fullName);
}
