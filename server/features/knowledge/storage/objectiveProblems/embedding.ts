import { db } from "../../../../db.js";
import { 
  type KnowledgeBaseObjectiveProblem 
} from "../../../../../shared/schema.js";
import { sql } from "drizzle-orm";
import { 
  generateEmbedding,
  generateContentHashFromParts 
} from "../../../../shared/embeddings/index.js";
import type { ProblemWithProductNames, ObjectiveProblemStats } from "./types.js";
import { getProductNamesForProblem } from "./products.js";

function generateProblemContentForEmbedding(problem: ProblemWithProductNames): string {
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

  const productNames = problem.productNames || [];
  if (productNames.length > 0) {
    parts.push(`Produtos: ${productNames.join(", ")}`);
  }

  return parts.join("\n\n");
}

function generateProblemContentHash(problem: ProblemWithProductNames): string {
  const synonyms = problem.synonyms || [];
  const examples = problem.examples || [];
  const productNames = problem.productNames || [];
  
  return generateContentHashFromParts([
    problem.name,
    problem.description,
    synonyms.join(","),
    examples.join(","),
    productNames.join(","),
  ]);
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

export function generateAndSaveEmbeddingAsync(problem: KnowledgeBaseObjectiveProblem): void {
  (async () => {
    try {
      console.log(`[ObjectiveProblem Embedding] Generating embedding for problem ${problem.id}...`);
      
      const productNames = await getProductNamesForProblem(problem.id);
      const problemWithProducts: ProblemWithProductNames = { ...problem, productNames };
      
      const contentText = generateProblemContentForEmbedding(problemWithProducts);
      const { embedding, logId, tokensUsed } = await generateEmbedding(contentText, { 
        contextType: "knowledge_base_article" 
      });
      const contentHash = generateProblemContentHash(problemWithProducts);
      
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

async function generateAndSaveEmbeddingSync(problem: KnowledgeBaseObjectiveProblem): Promise<void> {
  const productNames = await getProductNamesForProblem(problem.id);
  const problemWithProducts: ProblemWithProductNames = { ...problem, productNames };
  
  const contentText = generateProblemContentForEmbedding(problemWithProducts);
  const { embedding, logId, tokensUsed } = await generateEmbedding(contentText, { 
    contextType: "knowledge_base_article" 
  });
  const contentHash = generateProblemContentHash(problemWithProducts);
  
  await upsertProblemEmbedding({
    problemId: problem.id,
    contentHash,
    embedding,
    modelUsed: 'text-embedding-3-small',
    tokensUsed,
    openaiLogId: logId,
  });
}

export async function hasObjectiveProblemEmbeddings(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM knowledge_base_objective_problems_embeddings 
    WHERE embedding_vector IS NOT NULL
  `);
  const count = (result.rows as any[])[0]?.count || 0;
  return count > 0;
}

export async function getObjectiveProblemStats(): Promise<ObjectiveProblemStats> {
  const result = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM knowledge_base_objective_problems) as total_problems,
      (SELECT COUNT(*) FROM knowledge_base_objective_problems WHERE is_active = true) as active_problems,
      (SELECT COUNT(*) FROM knowledge_base_objective_problems p 
       INNER JOIN knowledge_base_objective_problems_embeddings e ON p.id = e.problem_id 
       WHERE e.embedding_vector IS NOT NULL) as with_embedding
  `);
  
  const row = (result.rows as any[])[0] || {};
  const totalProblems = Number(row.total_problems || 0);
  const activeProblems = Number(row.active_problems || 0);
  const withEmbedding = Number(row.with_embedding || 0);
  
  return {
    totalProblems,
    activeProblems,
    withEmbedding,
    withoutEmbedding: Math.max(0, totalProblems - withEmbedding),
  };
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
