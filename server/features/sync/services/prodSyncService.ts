import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { sql } from "drizzle-orm";
import * as schema from "../../../../shared/schema.js";

neonConfig.webSocketConstructor = ws;

export interface SyncProgress {
  step: string;
  current: number;
  total: number;
  details?: string;
}

export interface SyncResult {
  success: boolean;
  stats: {
    products: number;
    subjects: number;
    intents: number;
    articles: number;
    articleEmbeddings: number;
    problems: number;
    problemEmbeddings: number;
    problemProductLinks: number;
    actions: number;
    solutions: number;
    solutionActionLinks: number;
    rootCauses: number;
    rootCauseProblemLinks: number;
    rootCauseSolutionLinks: number;
  };
  error?: string;
}

export async function syncFromProd(
  prodDatabaseUrl: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const devDatabaseUrl = process.env.DATABASE_URL;

  if (!devDatabaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const prodPool = new Pool({ connectionString: prodDatabaseUrl });
  const prodDb = drizzle({ client: prodPool, schema });

  const devPool = new Pool({ connectionString: devDatabaseUrl });
  const devDb = drizzle({ client: devPool, schema });

  const stats = {
    products: 0,
    subjects: 0,
    intents: 0,
    articles: 0,
    articleEmbeddings: 0,
    problems: 0,
    problemEmbeddings: 0,
    problemProductLinks: 0,
    actions: 0,
    solutions: 0,
    solutionActionLinks: 0,
    rootCauses: 0,
    rootCauseProblemLinks: 0,
    rootCauseSolutionLinks: 0,
  };

  try {
    onProgress?.({ step: "products", current: 0, total: 1, details: "Sincronizando produtos..." });

    const prodProducts = await prodDb.select().from(schema.productsCatalog);
    stats.products = prodProducts.length;

    await devDb.execute(sql`TRUNCATE TABLE products_catalog CASCADE`);

    for (const product of prodProducts) {
      await devDb.execute(sql`
        INSERT INTO products_catalog (id, produto, subproduto, full_name, created_at, updated_at)
        VALUES (${product.id}, ${product.produto}, ${product.subproduto}, ${product.fullName}, ${product.createdAt}, ${product.updatedAt})
      `);
    }
    await devDb.execute(sql`SELECT setval('products_catalog_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM products_catalog), false)`);

    onProgress?.({ step: "subjects", current: 0, total: 1, details: "Sincronizando assuntos..." });

    const prodSubjects = await prodDb.select().from(schema.knowledgeSubjects);
    stats.subjects = prodSubjects.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_subjects CASCADE`);

    for (const subject of prodSubjects) {
      await devDb.execute(sql`
        INSERT INTO knowledge_subjects (id, product_catalog_id, name, synonyms, created_at, updated_at)
        VALUES (${subject.id}, ${subject.productCatalogId}, ${subject.name}, ${JSON.stringify(subject.synonyms)}::jsonb, ${subject.createdAt}, ${subject.updatedAt})
      `);
    }
    await devDb.execute(sql`SELECT setval('knowledge_subjects_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_subjects), false)`);

    onProgress?.({ step: "intents", current: 0, total: 1, details: "Sincronizando intenções..." });

    const prodIntents = await prodDb.select().from(schema.knowledgeIntents);
    stats.intents = prodIntents.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_intents CASCADE`);

    for (const intent of prodIntents) {
      await devDb.execute(sql`
        INSERT INTO knowledge_intents (id, subject_id, name, synonyms, created_at, updated_at)
        VALUES (${intent.id}, ${intent.subjectId}, ${intent.name}, ${JSON.stringify(intent.synonyms)}::jsonb, ${intent.createdAt}, ${intent.updatedAt})
      `);
    }
    await devDb.execute(sql`SELECT setval('knowledge_intents_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_intents), false)`);

    onProgress?.({ step: "articles", current: 0, total: 1, details: "Sincronizando artigos KB..." });

    const prodArticles = await prodDb.select().from(schema.knowledgeBase);
    stats.articles = prodArticles.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base CASCADE`);

    for (const article of prodArticles) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base (id, question, question_normalized, answer, keywords, question_variation, product_id, subject_id, intent_id, is_active, created_at, updated_at)
        VALUES (${article.id}, ${article.question}, ${article.questionNormalized}, ${article.answer}, ${article.keywords}, ${JSON.stringify(article.questionVariation)}::jsonb, ${article.productId}, ${article.subjectId}, ${article.intentId}, ${article.isActive}, ${article.createdAt}, ${article.updatedAt})
      `);
    }
    await devDb.execute(sql`SELECT setval('knowledge_base_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base), false)`);

    onProgress?.({ step: "articleEmbeddings", current: 0, total: 1, details: "Sincronizando embeddings de artigos..." });

    const prodArticleEmbeddings = await prodDb.select().from(schema.knowledgeBaseEmbeddings);
    stats.articleEmbeddings = prodArticleEmbeddings.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_embeddings CASCADE`);

    for (const emb of prodArticleEmbeddings) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_embeddings (id, article_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
        VALUES (${emb.id}, ${emb.articleId}, ${emb.contentHash}, ${emb.embeddingVector}, ${emb.modelUsed}, ${emb.tokensUsed}, ${emb.openaiLogId}, ${emb.createdAt}, ${emb.updatedAt})
      `);
    }
    if (prodArticleEmbeddings.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_embeddings_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_embeddings), false)`);
    }

    onProgress?.({ step: "problems", current: 0, total: 1, details: "Sincronizando problemas..." });

    const prodProblems = await prodDb.select().from(schema.knowledgeBaseObjectiveProblems);
    stats.problems = prodProblems.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_objective_problems CASCADE`);

    for (const problem of prodProblems) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_objective_problems (id, name, problem_normalized, description, synonyms, examples, presented_by, is_active, created_at, updated_at)
        VALUES (${problem.id}, ${problem.name}, ${problem.problemNormalized}, ${problem.description}, ${JSON.stringify(problem.synonyms)}::jsonb, ${JSON.stringify(problem.examples)}::jsonb, ${problem.presentedBy}, ${problem.isActive}, ${problem.createdAt}, ${problem.updatedAt})
      `);
    }
    await devDb.execute(sql`SELECT setval('knowledge_base_objective_problems_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_objective_problems), false)`);

    onProgress?.({ step: "problemEmbeddings", current: 0, total: 1, details: "Sincronizando embeddings de problemas..." });

    const prodProblemEmbeddings = await prodDb.select().from(schema.knowledgeBaseObjectiveProblemsEmbeddings);
    stats.problemEmbeddings = prodProblemEmbeddings.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_objective_problems_embeddings CASCADE`);

    for (const emb of prodProblemEmbeddings) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_objective_problems_embeddings (id, problem_id, content_hash, embedding_vector, model_used, tokens_used, openai_log_id, created_at, updated_at)
        VALUES (${emb.id}, ${emb.problemId}, ${emb.contentHash}, ${emb.embeddingVector}, ${emb.modelUsed}, ${emb.tokensUsed}, ${emb.openaiLogId}, ${emb.createdAt}, ${emb.updatedAt})
      `);
    }
    if (prodProblemEmbeddings.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_objective_problems_embeddings_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_objective_problems_embeddings), false)`);
    }

    onProgress?.({ step: "problemProductLinks", current: 0, total: 1, details: "Sincronizando links problema-produto..." });

    const prodProblemProductLinks = await prodDb.select().from(schema.knowledgeBaseObjectiveProblemsHasProductsCatalog);
    stats.problemProductLinks = prodProblemProductLinks.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_objective_problems_has_products_catalog CASCADE`);

    for (const link of prodProblemProductLinks) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_objective_problems_has_products_catalog (id, objective_problem_id, product_id, created_at)
        VALUES (${link.id}, ${link.objectiveProblemId}, ${link.productId}, ${link.createdAt})
      `);
    }
    if (prodProblemProductLinks.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_objective_problems_has_products_catalog_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_objective_problems_has_products_catalog), false)`);
    }

    onProgress?.({ step: "actions", current: 0, total: 1, details: "Sincronizando ações..." });

    const prodActions = await prodDb.select().from(schema.knowledgeBaseActions);
    stats.actions = prodActions.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_actions CASCADE`);

    for (const action of prodActions) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_actions (id, action_type, description, required_input, message_template, owner_team, sla, is_active, created_at, updated_at)
        VALUES (${action.id}, ${action.actionType}, ${action.description}, ${action.requiredInput}, ${action.messageTemplate}, ${action.ownerTeam}, ${action.sla}, ${action.isActive}, ${action.createdAt}, ${action.updatedAt})
      `);
    }
    if (prodActions.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_actions_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_actions), false)`);
    }

    onProgress?.({ step: "solutions", current: 0, total: 1, details: "Sincronizando soluções..." });

    const prodSolutions = await prodDb.select().from(schema.knowledgeBaseSolutions);
    stats.solutions = prodSolutions.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_solutions CASCADE`);

    for (const solution of prodSolutions) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_solutions (id, name, description, product_id, conditions, is_active, is_fallback, is_article_default, created_at, updated_at)
        VALUES (${solution.id}, ${solution.name}, ${solution.description}, ${solution.productId}, ${JSON.stringify(solution.conditions)}::jsonb, ${solution.isActive}, ${solution.isFallback}, ${solution.isArticleDefault}, ${solution.createdAt}, ${solution.updatedAt})
      `);
    }
    if (prodSolutions.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_solutions_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_solutions), false)`);
    }

    onProgress?.({ step: "solutionActionLinks", current: 0, total: 1, details: "Sincronizando links solução-ação..." });

    const prodSolutionActionLinks = await prodDb.select().from(schema.knowledgeBaseSolutionsHasKnowledgeBaseActions);
    stats.solutionActionLinks = prodSolutionActionLinks.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_solutions_has_knowledge_base_actions CASCADE`);

    for (const link of prodSolutionActionLinks) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_solutions_has_knowledge_base_actions (id, solution_id, action_id, action_sequence, created_at)
        VALUES (${link.id}, ${link.solutionId}, ${link.actionId}, ${link.actionSequence}, ${link.createdAt})
      `);
    }
    if (prodSolutionActionLinks.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_solutions_has_knowledge_base_actions_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_solutions_has_knowledge_base_actions), false)`);
    }

    onProgress?.({ step: "rootCauses", current: 0, total: 1, details: "Sincronizando causas raiz..." });

    const prodRootCauses = await prodDb.select().from(schema.knowledgeBaseRootCauses);
    stats.rootCauses = prodRootCauses.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_root_causes CASCADE`);

    for (const rc of prodRootCauses) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_root_causes (id, name, description, is_active, observed_rate_30d, observed_n_30d, observed_at, created_by, created_at, updated_at)
        VALUES (${rc.id}, ${rc.name}, ${rc.description}, ${rc.isActive}, ${rc.observedRate30d}, ${rc.observedN30d}, ${rc.observedAt}, ${rc.createdBy}, ${rc.createdAt}, ${rc.updatedAt})
      `);
    }
    if (prodRootCauses.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_root_causes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_root_causes), false)`);
    }

    onProgress?.({ step: "rootCauseProblemLinks", current: 0, total: 1, details: "Sincronizando links causa-problema..." });

    const prodRootCauseProblemLinks = await prodDb.select().from(schema.knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems);
    stats.rootCauseProblemLinks = prodRootCauseProblemLinks.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_root_cause_has_knowledge_base_objective_problems CASCADE`);

    for (const link of prodRootCauseProblemLinks) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_root_cause_has_knowledge_base_objective_problems (id, root_cause_id, problem_id, validation_questions, created_at)
        VALUES (${link.id}, ${link.rootCauseId}, ${link.problemId}, ${JSON.stringify(link.validationQuestions)}::jsonb, ${link.createdAt})
      `);
    }
    if (prodRootCauseProblemLinks.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_root_cause_has_knowledge_base_objective_problems_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_root_cause_has_knowledge_base_objective_problems), false)`);
    }

    onProgress?.({ step: "rootCauseSolutionLinks", current: 0, total: 1, details: "Sincronizando links causa-solução..." });

    const prodRootCauseSolutionLinks = await prodDb.select().from(schema.knowledgeBaseRootCauseHasKnowledgeBaseSolutions);
    stats.rootCauseSolutionLinks = prodRootCauseSolutionLinks.length;

    await devDb.execute(sql`TRUNCATE TABLE knowledge_base_root_cause_has_knowledge_base_solutions CASCADE`);

    for (const link of prodRootCauseSolutionLinks) {
      await devDb.execute(sql`
        INSERT INTO knowledge_base_root_cause_has_knowledge_base_solutions (id, root_cause_id, solution_id, created_at)
        VALUES (${link.id}, ${link.rootCauseId}, ${link.solutionId}, ${link.createdAt})
      `);
    }
    if (prodRootCauseSolutionLinks.length > 0) {
      await devDb.execute(sql`SELECT setval('knowledge_base_root_cause_has_knowledge_base_solutions_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM knowledge_base_root_cause_has_knowledge_base_solutions), false)`);
    }

    onProgress?.({ step: "done", current: 1, total: 1, details: "Sincronização concluída!" });

    return { success: true, stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, stats, error: errorMessage };
  } finally {
    await prodPool.end();
    await devPool.end();
  }
}
