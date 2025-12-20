import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL;
const DEV_DATABASE_URL = process.env.DATABASE_URL;

if (!PROD_DATABASE_URL) {
  console.error("PROD_DATABASE_URL environment variable is required");
  console.log("\nUsage:");
  console.log("  PROD_DATABASE_URL='postgres://...' npx tsx scripts/sync-kb-problems-from-prod.ts");
  process.exit(1);
}

if (!DEV_DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function syncKbProblems() {
  console.log("Connecting to production database...");
  const prodPool = new Pool({ connectionString: PROD_DATABASE_URL });
  const prodDb = drizzle({ client: prodPool, schema });

  console.log("Connecting to development database...");
  const devPool = new Pool({ connectionString: DEV_DATABASE_URL });
  const devDb = drizzle({ client: devPool, schema });

  try {
    console.log("\n--- Syncing Knowledge Base Objective Problems ---\n");

    const prodProblems = await prodDb
      .select()
      .from(schema.knowledgeBaseObjectiveProblems);
    
    console.log(`Found ${prodProblems.length} problems in production`);

    if (prodProblems.length === 0) {
      console.log("No problems to sync");
      return;
    }

    console.log("Clearing development kb_problems table...");
    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_objective_problems_embeddings CASCADE`);
    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_objective_problems_has_products_catalog CASCADE`);
    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_root_cause_has_knowledge_base_objective_problems CASCADE`);
    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_objective_problems CASCADE`);

    console.log("Inserting problems into development...");
    
    for (const problem of prodProblems) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_objective_problems 
        (id, name, problem_normalized, description, synonyms, examples, presented_by, is_active, created_at, updated_at)
        VALUES (
          ${problem.id},
          ${problem.name},
          ${problem.problemNormalized},
          ${problem.description},
          ${JSON.stringify(problem.synonyms)}::jsonb,
          ${JSON.stringify(problem.examples)}::jsonb,
          ${problem.presentedBy},
          ${problem.isActive},
          ${problem.createdAt},
          ${problem.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          problem_normalized = EXCLUDED.problem_normalized,
          description = EXCLUDED.description,
          synonyms = EXCLUDED.synonyms,
          examples = EXCLUDED.examples,
          presented_by = EXCLUDED.presented_by,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `);
    }

    await devDb.execute(sql`
      SELECT setval('knowledge_base_objective_problems_id_seq', 
        (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_objective_problems), false)
    `);

    console.log(`\nSuccessfully synced ${prodProblems.length} problems to development!`);

    console.log("\n--- Syncing Problems <-> Products links ---\n");
    
    const prodLinks = await prodDb
      .select()
      .from(schema.knowledgeBaseObjectiveProblemsHasProductsCatalog);
    
    console.log(`Found ${prodLinks.length} problem-product links in production`);

    for (const link of prodLinks) {
      try {
        await devDb.execute(sql`
          INSERT INTO knowledge_base_objective_problems_has_products_catalog 
          (id, objective_problem_id, product_id, created_at)
          VALUES (
            ${link.id},
            ${link.objectiveProblemId},
            ${link.productId},
            ${link.createdAt}
          )
          ON CONFLICT DO NOTHING
        `);
      } catch (err) {
        console.log(`Skipped link ${link.id} (product ${link.productId} may not exist in dev)`);
      }
    }

    console.log("\n--- Syncing Problem Embeddings ---\n");
    
    const prodEmbeddings = await prodDb
      .select()
      .from(schema.knowledgeBaseObjectiveProblemsEmbeddings);
    
    console.log(`Found ${prodEmbeddings.length} embeddings in production`);

    for (const emb of prodEmbeddings) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_objective_problems_embeddings 
        (id, problem_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
        VALUES (
          ${emb.id},
          ${emb.problemId},
          ${emb.contentHash},
          ${emb.embeddingVector},
          ${emb.modelUsed},
          ${emb.tokensUsed},
          ${emb.openaiLogId},
          ${emb.createdAt},
          ${emb.updatedAt}
        )
        ON CONFLICT (problem_id) DO UPDATE SET
          content_hash = EXCLUDED.content_hash,
          embedding_vector = EXCLUDED.embedding_vector,
          model_used = EXCLUDED.model_used,
          tokens_used = EXCLUDED.tokens_used,
          updated_at = EXCLUDED.updated_at
      `);
    }

    if (prodEmbeddings.length > 0) {
      await devDb.execute(sql`
        SELECT setval('knowledge_base_objective_problems_embeddings_id_seq', 
          (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_objective_problems_embeddings), false)
      `);
    }

    console.log("\n=== Sync completed successfully! ===\n");

  } catch (error) {
    console.error("Error during sync:", error);
    throw error;
  } finally {
    await prodPool.end();
    await devPool.end();
  }
}

syncKbProblems()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
