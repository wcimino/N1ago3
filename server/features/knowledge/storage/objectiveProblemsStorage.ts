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

export interface SearchObjectiveProblemsParams {
  keywords?: string;
  productId?: number;
  onlyActive?: boolean;
  limit?: number;
}

export interface ObjectiveProblemSearchResult {
  id: number;
  name: string;
  description: string;
  synonyms: string[];
  examples: string[];
  matchScore: number;
  matchReason: string;
  productIds: number[];
  productNames: string[];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function calculateMatchScore(
  problem: KnowledgeBaseObjectiveProblem,
  searchTerms: string[]
): { score: number; reason: string } {
  let maxScore = 0;
  let bestReason = "";

  for (const term of searchTerms) {
    const normalizedTerm = normalizeText(term);
    const normalizedName = normalizeText(problem.name);
    
    if (normalizedName === normalizedTerm) {
      if (100 > maxScore) {
        maxScore = 100;
        bestReason = `Nome exato: '${problem.name}'`;
      }
    } else if (normalizedName.includes(normalizedTerm)) {
      if (80 > maxScore) {
        maxScore = 80;
        bestReason = `Nome contém: '${term}'`;
      }
    }

    const synonyms = problem.synonyms || [];
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeText(synonym);
      if (normalizedSynonym === normalizedTerm) {
        if (90 > maxScore) {
          maxScore = 90;
          bestReason = `Sinônimo exato: '${synonym}'`;
        }
      } else if (normalizedSynonym.includes(normalizedTerm)) {
        if (70 > maxScore) {
          maxScore = 70;
          bestReason = `Sinônimo contém: '${term}' em '${synonym}'`;
        }
      }
    }

    const examples = problem.examples || [];
    for (const example of examples) {
      if (normalizeText(example).includes(normalizedTerm)) {
        if (60 > maxScore) {
          maxScore = 60;
          bestReason = `Exemplo contém: '${term}'`;
        }
        break;
      }
    }

    if (normalizeText(problem.description).includes(normalizedTerm)) {
      if (40 > maxScore) {
        maxScore = 40;
        bestReason = `Descrição contém: '${term}'`;
      }
    }
  }

  return { score: maxScore, reason: bestReason };
}

export async function searchObjectiveProblems(
  params: SearchObjectiveProblemsParams
): Promise<ObjectiveProblemSearchResult[]> {
  const { keywords, productId, onlyActive = true, limit = 10 } = params;

  let problems = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .where(onlyActive ? eq(knowledgeBaseObjectiveProblems.isActive, true) : undefined)
    .orderBy(knowledgeBaseObjectiveProblems.name);

  if (productId) {
    const problemIdsWithProduct = await db
      .select({ problemId: knowledgeBaseObjectiveProblemsHasProductsCatalog.objectiveProblemId })
      .from(knowledgeBaseObjectiveProblemsHasProductsCatalog)
      .where(eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.productId, productId));
    
    const validProblemIds = new Set(problemIdsWithProduct.map(p => p.problemId));
    problems = problems.filter(p => validProblemIds.has(p.id));
  }

  const allProducts = await db.select().from(ifoodProducts);
  const productMap = new Map(allProducts.map(p => [p.id, p.fullName]));

  const searchTerms = keywords 
    ? keywords.split(/\s+/).filter(t => t.length >= 2)
    : [];

  const results: ObjectiveProblemSearchResult[] = await Promise.all(
    problems.map(async (problem) => {
      const productIds = await getProductIdsForProblem(problem.id);
      const productNames = productIds.map(id => productMap.get(id) || "").filter(Boolean);
      
      let matchScore = 0;
      let matchReason = "Listado";
      
      if (searchTerms.length > 0) {
        const scoreResult = calculateMatchScore(problem, searchTerms);
        matchScore = scoreResult.score;
        matchReason = scoreResult.reason || "Sem match direto";
      } else {
        matchScore = 100;
        matchReason = "Listagem completa";
      }

      return {
        id: problem.id,
        name: problem.name,
        description: problem.description,
        synonyms: problem.synonyms || [],
        examples: problem.examples || [],
        matchScore,
        matchReason,
        productIds,
        productNames,
      };
    })
  );

  const filteredResults = searchTerms.length > 0
    ? results.filter(r => r.matchScore > 0)
    : results;

  return filteredResults
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
