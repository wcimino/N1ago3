import { db } from "../../../../db.js";
import { 
  knowledgeBaseObjectiveProblems,
  knowledgeBaseObjectiveProblemsHasProductsCatalog,
  productsCatalog,
  type KnowledgeBaseObjectiveProblem 
} from "../../../../../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import { calculateMatchScore, parseSearchTerms, type MatchField } from "../../../../shared/utils/matchScoring.js";
import type { 
  SearchObjectiveProblemsParams, 
  ObjectiveProblemSearchResult,
  SemanticSearchParams,
  SemanticSearchResult
} from "./types.js";
import { getProductIdsForProblems } from "./products.js";

function calculateProblemMatchScore(
  problem: KnowledgeBaseObjectiveProblem,
  searchTerms: string[]
): { score: number; reason: string } {
  const fields: MatchField[] = [
    { name: "Nome", value: problem.name, weight: 'contains_name' },
    { name: "Descrição", value: problem.description || "", weight: 'contains_low' },
  ];

  const synonyms = problem.synonyms || [];
  for (const synonym of synonyms) {
    fields.push({ name: "Sinônimo", value: synonym, weight: 'contains_secondary' });
  }

  const examples = problem.examples || [];
  for (const example of examples) {
    fields.push({ name: "Exemplo", value: example, weight: 'contains_tertiary' });
  }

  const result = calculateMatchScore(fields, searchTerms);
  return { score: result.score, reason: result.reason };
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
    
    const validProblemIds = new Set(problemIdsWithProduct.map((p: typeof problemIdsWithProduct[number]) => p.problemId));
    problems = problems.filter((p: KnowledgeBaseObjectiveProblem) => validProblemIds.has(p.id));
  }

  const allProducts = await db.select().from(productsCatalog);
  const productMap = new Map(allProducts.map((p: typeof allProducts[number]) => [p.id, p.fullName]));

  const searchTerms = keywords 
    ? parseSearchTerms(keywords)
    : [];

  const problemIds = problems.map((p: KnowledgeBaseObjectiveProblem) => p.id);
  const productIdsByProblem = await getProductIdsForProblems(problemIds);

  const results: ObjectiveProblemSearchResult[] = problems.map((problem: KnowledgeBaseObjectiveProblem) => {
    const productIds = productIdsByProblem.get(problem.id) || [];
    const productNames = productIds.map(id => productMap.get(id) || "").filter(Boolean);
    
    let matchScore = 0;
    let matchReason = "Listado";
    
    if (searchTerms.length > 0) {
      const scoreResult = calculateProblemMatchScore(problem, searchTerms);
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
  });

  const filteredResults = searchTerms.length > 0
    ? results.filter(r => r.matchScore > 0)
    : results;

  return filteredResults
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

export async function searchObjectiveProblemsBySimilarity(
  params: SemanticSearchParams
): Promise<SemanticSearchResult[]> {
  const { queryEmbedding, productId, onlyActive = true, limit = 10 } = params;
  
  const embeddingString = `[${queryEmbedding.join(',')}]`;
  
  let results;
  
  if (productId && onlyActive) {
    results = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.synonyms,
        p.examples,
        ROUND((1 - (e.embedding_vector::vector <=> ${embeddingString}::vector)) * 100) as similarity
      FROM knowledge_base_objective_problems p
      INNER JOIN knowledge_base_objective_problems_embeddings e ON p.id = e.problem_id
      WHERE e.embedding_vector IS NOT NULL
        AND p.is_active = true
        AND EXISTS (
          SELECT 1 FROM knowledge_base_objective_problems_has_products_catalog pc 
          WHERE pc.objective_problem_id = p.id AND pc.product_id = ${productId}
        )
      ORDER BY e.embedding_vector::vector <=> ${embeddingString}::vector
      LIMIT ${limit}
    `);
  } else if (productId) {
    results = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.synonyms,
        p.examples,
        ROUND((1 - (e.embedding_vector::vector <=> ${embeddingString}::vector)) * 100) as similarity
      FROM knowledge_base_objective_problems p
      INNER JOIN knowledge_base_objective_problems_embeddings e ON p.id = e.problem_id
      WHERE e.embedding_vector IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM knowledge_base_objective_problems_has_products_catalog pc 
          WHERE pc.objective_problem_id = p.id AND pc.product_id = ${productId}
        )
      ORDER BY e.embedding_vector::vector <=> ${embeddingString}::vector
      LIMIT ${limit}
    `);
  } else if (onlyActive) {
    results = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.synonyms,
        p.examples,
        ROUND((1 - (e.embedding_vector::vector <=> ${embeddingString}::vector)) * 100) as similarity
      FROM knowledge_base_objective_problems p
      INNER JOIN knowledge_base_objective_problems_embeddings e ON p.id = e.problem_id
      WHERE e.embedding_vector IS NOT NULL
        AND p.is_active = true
      ORDER BY e.embedding_vector::vector <=> ${embeddingString}::vector
      LIMIT ${limit}
    `);
  } else {
    results = await db.execute(sql`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.synonyms,
        p.examples,
        ROUND((1 - (e.embedding_vector::vector <=> ${embeddingString}::vector)) * 100) as similarity
      FROM knowledge_base_objective_problems p
      INNER JOIN knowledge_base_objective_problems_embeddings e ON p.id = e.problem_id
      WHERE e.embedding_vector IS NOT NULL
      ORDER BY e.embedding_vector::vector <=> ${embeddingString}::vector
      LIMIT ${limit}
    `);
  }
  
  const allProducts = await db.select().from(productsCatalog);
  const productMap = new Map(allProducts.map((prod: typeof allProducts[number]) => [prod.id, prod.fullName]));
  
  const rows = results.rows as any[];
  const problemIds = rows.map((row) => row.id);
  const productIdsByProblem = await getProductIdsForProblems(problemIds);

  const enrichedResults = rows.map((row) => {
    const productIds = productIdsByProblem.get(row.id) || [];
    const productNames = productIds.map(id => productMap.get(id) || "").filter(Boolean);
    
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      synonyms: row.synonyms || [],
      examples: row.examples || [],
      similarity: Number(row.similarity),
      productIds,
      productNames,
    };
  });
  
  return enrichedResults;
}
