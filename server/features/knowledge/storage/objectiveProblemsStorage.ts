import { db } from "../../../db.js";
import { 
  knowledgeBaseObjectiveProblems, 
  knowledgeBaseObjectiveProblemsHasProductsCatalog,
  knowledgeBaseObjectiveProblemsEmbeddings,
  ifoodProducts,
  type KnowledgeBaseObjectiveProblem, 
  type InsertKnowledgeBaseObjectiveProblem 
} from "../../../../shared/schema.js";
import { eq, inArray, sql } from "drizzle-orm";
import { 
  generateEmbedding,
  generateContentHashFromParts 
} from "../../../shared/embeddings/index.js";

export type ObjectiveProblemWithProducts = KnowledgeBaseObjectiveProblem & {
  productIds: number[];
};

export async function getAllObjectiveProblems(): Promise<ObjectiveProblemWithProducts[]> {
  const problems = await db
    .select()
    .from(knowledgeBaseObjectiveProblems)
    .orderBy(knowledgeBaseObjectiveProblems.name);
  
  return Promise.all(problems.map(async (problem: KnowledgeBaseObjectiveProblem) => {
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
  
  return Promise.all(problems.map(async (problem: KnowledgeBaseObjectiveProblem) => {
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

async function getProductIdsForProblem(problemId: number): Promise<number[]> {
  const links = await db
    .select({ productId: knowledgeBaseObjectiveProblemsHasProductsCatalog.productId })
    .from(knowledgeBaseObjectiveProblemsHasProductsCatalog)
    .where(eq(knowledgeBaseObjectiveProblemsHasProductsCatalog.objectiveProblemId, problemId));
  
  return links.map((l: typeof links[number]) => l.productId);
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

function generateProblemContentForEmbedding(problem: KnowledgeBaseObjectiveProblem): string {
  const parts: string[] = [];
  
  parts.push(`Problema: ${problem.name}`);
  parts.push(`Descrição: ${problem.description}`);
  
  const synonyms = problem.synonyms || [];
  if (synonyms.length > 0) {
    parts.push(`Sinônimos: ${synonyms.join(", ")}`);
  }
  
  const examples = problem.examples || [];
  if (examples.length > 0) {
    parts.push(`Exemplos: ${examples.join("; ")}`);
  }

  return parts.join("\n\n");
}

function generateProblemContentHash(problem: KnowledgeBaseObjectiveProblem): string {
  const synonyms = problem.synonyms || [];
  const examples = problem.examples || [];
  
  return generateContentHashFromParts([
    problem.name,
    problem.description,
    synonyms.join(","),
    examples.join(","),
  ]);
}

export function generateAndSaveEmbeddingAsync(problem: KnowledgeBaseObjectiveProblem): void {
  (async () => {
    try {
      console.log(`[ObjectiveProblem Embedding] Generating embedding for problem ${problem.id}...`);
      
      const contentText = generateProblemContentForEmbedding(problem);
      const { embedding, logId, tokensUsed } = await generateEmbedding(contentText, { 
        contextType: "knowledge_base_article" 
      });
      const contentHash = generateProblemContentHash(problem);
      
      await upsertProblemEmbedding({
        problemId: problem.id,
        contentHash,
        embedding,
        modelUsed: 'text-embedding-3-small',
        tokensUsed,
        openaiLogId: logId,
      });
      
      console.log(`[ObjectiveProblem Embedding] Embedding generated and saved for problem ${problem.id}`);
    } catch (error) {
      console.error(`[ObjectiveProblem Embedding] Failed to generate embedding for problem ${problem.id}:`, error);
    }
  })();
}

async function upsertProblemEmbedding(params: {
  problemId: number;
  contentHash: string;
  embedding: number[];
  modelUsed?: string;
  tokensUsed?: number | null;
  openaiLogId?: number;
}): Promise<void> {
  const embeddingString = `[${params.embedding.join(',')}]`;
  
  await db.execute(sql`
    INSERT INTO knowledge_base_objective_problems_embeddings (problem_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
    VALUES (
      ${params.problemId},
      ${params.contentHash},
      ${embeddingString}::vector,
      ${params.modelUsed || 'text-embedding-3-small'},
      ${params.tokensUsed || null},
      ${params.openaiLogId || null},
      NOW(),
      NOW()
    )
    ON CONFLICT (problem_id) DO UPDATE SET
      content_hash = EXCLUDED.content_hash,
      embedding_vector = EXCLUDED.embedding_vector,
      model_used = EXCLUDED.model_used,
      tokens_used = EXCLUDED.tokens_used,
      openai_log_id = EXCLUDED.openai_log_id,
      updated_at = NOW()
  `);
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
    
    const validProblemIds = new Set(problemIdsWithProduct.map((p: typeof problemIdsWithProduct[number]) => p.problemId));
    problems = problems.filter((p: KnowledgeBaseObjectiveProblem) => validProblemIds.has(p.id));
  }

  const allProducts = await db.select().from(ifoodProducts);
  const productMap = new Map(allProducts.map((p: typeof allProducts[number]) => [p.id, p.fullName]));

  const searchTerms = keywords 
    ? keywords.split(/\s+/).filter((t: string) => t.length >= 2)
    : [];

  const results: ObjectiveProblemSearchResult[] = await Promise.all(
    problems.map(async (problem: KnowledgeBaseObjectiveProblem) => {
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

export interface SemanticSearchParams {
  queryEmbedding: number[];
  productId?: number;
  onlyActive?: boolean;
  limit?: number;
}

export interface SemanticSearchResult {
  id: number;
  name: string;
  description: string;
  synonyms: string[];
  examples: string[];
  similarity: number;
  productIds: number[];
  productNames: string[];
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
  
  const allProducts = await db.select().from(ifoodProducts);
  const productMap = new Map(allProducts.map((prod: typeof allProducts[number]) => [prod.id, prod.fullName]));
  
  const enrichedResults = await Promise.all(
    (results.rows as any[]).map(async (row) => {
      const productIds = await getProductIdsForProblem(row.id);
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
    })
  );
  
  return enrichedResults;
}

export async function hasObjectiveProblemEmbeddings(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM knowledge_base_objective_problems_embeddings 
    WHERE embedding_vector IS NOT NULL
  `);
  const count = (result.rows as any[])[0]?.count || 0;
  return count > 0;
}

export async function getProblemsWithoutEmbeddings(): Promise<KnowledgeBaseObjectiveProblem[]> {
  const results = await db.execute(sql`
    SELECT p.* FROM knowledge_base_objective_problems p
    LEFT JOIN knowledge_base_objective_problems_embeddings e ON p.id = e.problem_id
    WHERE e.id IS NULL
    ORDER BY p.id
  `);
  return results.rows as unknown as KnowledgeBaseObjectiveProblem[];
}

export async function generateAllMissingEmbeddings(): Promise<{ processed: number; errors: string[] }> {
  const problemsWithoutEmbeddings = await getProblemsWithoutEmbeddings();
  
  console.log(`[ObjectiveProblem Embedding] Found ${problemsWithoutEmbeddings.length} problems without embeddings`);
  
  let processed = 0;
  const errors: string[] = [];
  
  for (const problem of problemsWithoutEmbeddings) {
    try {
      await generateAndSaveEmbeddingSync(problem);
      processed++;
      console.log(`[ObjectiveProblem Embedding] Generated embedding for problem ${problem.id} (${processed}/${problemsWithoutEmbeddings.length})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Problem ${problem.id}: ${errorMsg}`);
      console.error(`[ObjectiveProblem Embedding] Failed for problem ${problem.id}: ${errorMsg}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return { processed, errors };
}

async function generateAndSaveEmbeddingSync(problem: KnowledgeBaseObjectiveProblem): Promise<void> {
  const contentText = generateProblemContentForEmbedding(problem);
  const { embedding, logId, tokensUsed } = await generateEmbedding(contentText, { 
    contextType: "knowledge_base_article" 
  });
  const contentHash = generateProblemContentHash(problem);
  
  await upsertProblemEmbedding({
    problemId: problem.id,
    contentHash,
    embedding,
    modelUsed: 'text-embedding-3-small',
    tokensUsed,
    openaiLogId: logId,
  });
}
