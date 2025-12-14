import { pgTable, serial, text, timestamp, json, integer, boolean, numeric, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

export const productsCatalog = pgTable("products_catalog", {
  id: serial("id").primaryKey(),
  produto: text("produto").notNull(),
  subproduto: text("subproduto"),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  produtoIdx: index("idx_ifood_products_produto").on(table.produto),
  fullNameIdx: uniqueIndex("idx_ifood_products_full_name").on(table.fullName),
}));

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  question: text("question"),
  answer: text("answer"),
  keywords: text("keywords"),
  questionVariation: json("question_variation").$type<string[]>().default([]),
  productId: integer("product_id").references(() => productsCatalog.id, { onDelete: "set null" }),
  subjectId: integer("subject_id"),
  intentId: integer("intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("idx_knowledge_base_product_id").on(table.productId),
  subjectIdx: index("idx_knowledge_base_subject").on(table.subjectId),
  intentIdIdx: index("idx_knowledge_base_intent_id").on(table.intentId),
}));

export const knowledgeBaseEmbeddings = pgTable("knowledge_base_embeddings", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  embeddingVector: text("embedding_vector"),
  modelUsed: text("model_used").notNull().default("text-embedding-3-small"),
  tokensUsed: integer("tokens_used"),
  openaiLogId: integer("openai_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  articleIdUnique: uniqueIndex("idx_knowledge_base_embeddings_article_id").on(table.articleId),
  contentHashIdx: index("idx_knowledge_base_embeddings_content_hash").on(table.contentHash),
}));

export const knowledgeBaseObjectiveProblems = pgTable("knowledge_base_objective_problems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  synonyms: json("synonyms").$type<string[]>().default([]),
  examples: json("examples").$type<string[]>().default([]),
  presentedBy: text("presented_by").notNull().default("customer"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  presentedByIdx: index("idx_kb_objective_problems_presented_by").on(table.presentedBy),
  isActiveIdx: index("idx_kb_objective_problems_is_active").on(table.isActive),
}));

export const knowledgeBaseObjectiveProblemsHasProductsCatalog = pgTable("knowledge_base_objective_problems_has_products_catalog", {
  id: serial("id").primaryKey(),
  objectiveProblemId: integer("objective_problem_id").notNull().references(() => knowledgeBaseObjectiveProblems.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsCatalog.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueLink: uniqueIndex("idx_kb_objective_problems_products_unique").on(table.objectiveProblemId, table.productId),
  problemIdx: index("idx_kb_objective_problems_products_problem").on(table.objectiveProblemId),
  productIdx: index("idx_kb_objective_problems_products_product").on(table.productId),
}));

export const knowledgeBaseObjectiveProblemsEmbeddings = pgTable("knowledge_base_objective_problems_embeddings", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id").notNull().references(() => knowledgeBaseObjectiveProblems.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  embeddingVector: text("embedding_vector"),
  modelUsed: text("model_used").notNull().default("text-embedding-3-small"),
  tokensUsed: integer("tokens_used"),
  openaiLogId: integer("openai_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  problemIdUnique: uniqueIndex("idx_kb_objective_problems_embeddings_problem_id").on(table.problemId),
  contentHashIdx: index("idx_kb_objective_problems_embeddings_content_hash").on(table.contentHash),
}));

export const knowledgeSuggestions = pgTable("knowledge_suggestions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  suggestionType: text("suggestion_type").default("create").notNull(),
  name: text("name"),
  productStandard: text("product_standard"),
  subproductStandard: text("subproduct_standard"),
  description: text("description"),
  resolution: text("resolution"),
  internalActions: text("internal_actions"),
  observations: text("observations"),
  question: text("question"),
  answer: text("answer"),
  keywords: text("keywords"),
  questionVariation: json("question_variation").$type<string[]>().default([]),
  confidenceScore: integer("confidence_score"),
  qualityFlags: json("quality_flags"),
  similarArticleId: integer("similar_article_id"),
  similarityScore: integer("similarity_score"),
  updateReason: text("update_reason"),
  status: text("status").default("pending").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  conversationHandler: text("conversation_handler"),
  extractedFromMessages: json("extracted_from_messages"),
  rawExtraction: json("raw_extraction"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("idx_knowledge_suggestions_status").on(table.status),
  conversationIdx: index("idx_knowledge_suggestions_conversation").on(table.conversationId),
  productIdx: index("idx_knowledge_suggestions_product").on(table.productStandard),
  createdAtIdx: index("idx_knowledge_suggestions_created_at").on(table.createdAt),
}));

export const learningAttempts = pgTable("learning_attempts", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  externalConversationId: text("external_conversation_id"),
  result: text("result").notNull(),
  resultReason: text("result_reason"),
  suggestionId: integer("suggestion_id"),
  messageCount: integer("message_count"),
  openaiLogId: integer("openai_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index("idx_learning_attempts_conversation").on(table.conversationId),
  resultIdx: index("idx_learning_attempts_result").on(table.result),
  createdAtIdx: index("idx_learning_attempts_created_at").on(table.createdAt),
}));

export const knowledgeSubjects = pgTable("knowledge_subjects", {
  id: serial("id").primaryKey(),
  productCatalogId: integer("product_catalog_id").notNull().references(() => productsCatalog.id),
  name: text("name").notNull(),
  synonyms: json("synonyms").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productCatalogIdx: index("idx_knowledge_subjects_product_catalog").on(table.productCatalogId),
  nameIdx: index("idx_knowledge_subjects_name").on(table.name),
}));

export const knowledgeIntents = pgTable("knowledge_intents", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => knowledgeSubjects.id),
  name: text("name").notNull(),
  synonyms: json("synonyms").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  subjectIdx: index("idx_knowledge_intents_subject").on(table.subjectId),
  nameIdx: index("idx_knowledge_intents_name").on(table.name),
}));

export const knowledgeBaseStatistics = pgTable("knowledge_base_statistics", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  keywords: text("keywords"),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  articleIdIdx: index("idx_knowledge_base_statistics_article_id").on(table.articleId),
  createdAtIdx: index("idx_knowledge_base_statistics_created_at").on(table.createdAt),
  conversationIdIdx: index("idx_knowledge_base_statistics_conversation_id").on(table.conversationId),
}));

export const knowledgeEnrichmentLog = pgTable("knowledge_enrichment_log", {
  id: serial("id").primaryKey(),
  intentId: integer("intent_id").notNull(),
  articleId: integer("article_id"),
  action: text("action").notNull(),
  outcomeReason: text("outcome_reason"),
  suggestionId: integer("suggestion_id"),
  sourceArticles: json("source_articles").$type<Array<{ id: string; title: string; similarityScore: number }>>(),
  confidenceScore: integer("confidence_score"),
  productStandard: text("product_standard"),
  outcomePayload: json("outcome_payload"),
  openaiLogId: integer("openai_log_id"),
  triggerRunId: text("trigger_run_id"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  actionProductIdx: index("idx_knowledge_enrichment_log_action_product").on(table.action, table.productStandard, table.processedAt),
  intentIdx: index("idx_knowledge_enrichment_log_intent").on(table.intentId, table.processedAt),
  triggerRunIdx: index("idx_knowledge_enrichment_log_trigger_run").on(table.triggerRunId),
}));

export const embeddingGenerationLogs = pgTable("embedding_generation_logs", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id"),
  zendeskId: text("zendesk_id"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("idx_embedding_logs_status").on(table.status),
  createdAtIdx: index("idx_embedding_logs_created_at").on(table.createdAt),
  articleIdIdx: index("idx_embedding_logs_article_id").on(table.articleId),
}));

export const knowledgeBaseActions = pgTable("knowledge_base_actions", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  requiredInput: text("required_input"),
  messageTemplate: text("message_template"),
  ownerTeam: text("owner_team"),
  sla: text("sla"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  actionTypeIdx: index("idx_kb_actions_action_type").on(table.actionType),
  isActiveIdx: index("idx_kb_actions_is_active").on(table.isActive),
}));

export const knowledgeBaseSolutions = pgTable("knowledge_base_solutions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  productId: integer("product_id").references(() => productsCatalog.id),
  conditions: json("conditions").$type<Record<string, unknown>>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdx: index("idx_kb_solutions_product").on(table.productId),
  isActiveIdx: index("idx_kb_solutions_is_active").on(table.isActive),
}));

export const knowledgeBaseSolutionsHasKnowledgeBaseActions = pgTable("knowledge_base_solutions_has_knowledge_base_actions", {
  id: serial("id").primaryKey(),
  solutionId: integer("solution_id").notNull().references(() => knowledgeBaseSolutions.id, { onDelete: "cascade" }),
  actionId: integer("action_id").notNull().references(() => knowledgeBaseActions.id, { onDelete: "cascade" }),
  actionSequence: integer("action_sequence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  solutionIdx: index("idx_kb_solutions_has_actions_solution").on(table.solutionId),
  actionIdx: index("idx_kb_solutions_has_actions_action").on(table.actionId),
  uniqueSolutionAction: uniqueIndex("idx_kb_solutions_has_actions_unique").on(table.solutionId, table.actionId),
}));

export const knowledgeBaseRootCauses = pgTable("knowledge_base_root_causes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  observedRate30d: numeric("observed_rate_30d", { precision: 6, scale: 5 }),
  observedN30d: bigint("observed_n_30d", { mode: "number" }),
  observedAt: timestamp("observed_at"),
  createdBy: text("created_by").default("system").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("idx_kb_root_causes_is_active").on(table.isActive),
}));

export interface ValidationQuestion {
  question: string;
  order: number;
}

export const knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems = pgTable("knowledge_base_root_cause_has_knowledge_base_objective_problems", {
  id: serial("id").primaryKey(),
  rootCauseId: integer("root_cause_id").notNull().references(() => knowledgeBaseRootCauses.id, { onDelete: "cascade" }),
  problemId: integer("problem_id").notNull().references(() => knowledgeBaseObjectiveProblems.id, { onDelete: "cascade" }),
  validationQuestions: json("validation_questions").$type<ValidationQuestion[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  rootCauseIdx: index("idx_kb_root_cause_problems_root_cause").on(table.rootCauseId),
  problemIdx: index("idx_kb_root_cause_problems_problem").on(table.problemId),
  uniqueLink: uniqueIndex("idx_kb_root_cause_problems_unique").on(table.rootCauseId, table.problemId),
}));

export const knowledgeBaseRootCauseHasKnowledgeBaseSolutions = pgTable("knowledge_base_root_cause_has_knowledge_base_solutions", {
  id: serial("id").primaryKey(),
  rootCauseId: integer("root_cause_id").notNull().references(() => knowledgeBaseRootCauses.id, { onDelete: "cascade" }),
  solutionId: integer("solution_id").notNull().references(() => knowledgeBaseSolutions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  rootCauseIdx: index("idx_kb_root_cause_solutions_root_cause").on(table.rootCauseId),
  solutionIdx: index("idx_kb_root_cause_solutions_solution").on(table.solutionId),
  uniqueLink: uniqueIndex("idx_kb_root_cause_solutions_unique").on(table.rootCauseId, table.solutionId),
}));

export type ProductCatalog = typeof productsCatalog.$inferSelect;
export type InsertProductCatalog = Omit<typeof productsCatalog.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseArticle = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBaseArticle = Omit<typeof knowledgeBase.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseEmbedding = typeof knowledgeBaseEmbeddings.$inferSelect;
export type InsertKnowledgeBaseEmbedding = Omit<typeof knowledgeBaseEmbeddings.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseObjectiveProblem = typeof knowledgeBaseObjectiveProblems.$inferSelect;
export type InsertKnowledgeBaseObjectiveProblem = typeof knowledgeBaseObjectiveProblems.$inferInsert;
export type KnowledgeBaseObjectiveProblemsHasProductsCatalog = typeof knowledgeBaseObjectiveProblemsHasProductsCatalog.$inferSelect;
export type InsertKnowledgeBaseObjectiveProblemsHasProductsCatalog = Omit<typeof knowledgeBaseObjectiveProblemsHasProductsCatalog.$inferInsert, "id" | "createdAt">;
export type KnowledgeBaseObjectiveProblemsEmbedding = typeof knowledgeBaseObjectiveProblemsEmbeddings.$inferSelect;
export type InsertKnowledgeBaseObjectiveProblemsEmbedding = typeof knowledgeBaseObjectiveProblemsEmbeddings.$inferInsert;
export type KnowledgeSuggestion = typeof knowledgeSuggestions.$inferSelect;
export type InsertKnowledgeSuggestion = Omit<typeof knowledgeSuggestions.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type LearningAttempt = typeof learningAttempts.$inferSelect;
export type InsertLearningAttempt = Omit<typeof learningAttempts.$inferInsert, "id" | "createdAt">;
export type LearningAttemptResult = "suggestion_created" | "insufficient_messages" | "skipped_by_agent" | "processing_error";
export type KnowledgeSubject = typeof knowledgeSubjects.$inferSelect;
export type InsertKnowledgeSubject = Omit<typeof knowledgeSubjects.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeIntent = typeof knowledgeIntents.$inferSelect;
export type InsertKnowledgeIntent = Omit<typeof knowledgeIntents.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseStatistic = typeof knowledgeBaseStatistics.$inferSelect;
export type InsertKnowledgeBaseStatistic = Omit<typeof knowledgeBaseStatistics.$inferInsert, "id" | "createdAt">;
export type KnowledgeEnrichmentLog = typeof knowledgeEnrichmentLog.$inferSelect;
export type InsertKnowledgeEnrichmentLog = Omit<typeof knowledgeEnrichmentLog.$inferInsert, "id" | "createdAt">;
export type EmbeddingGenerationLog = typeof embeddingGenerationLogs.$inferSelect;
export type InsertEmbeddingGenerationLog = Omit<typeof embeddingGenerationLogs.$inferInsert, "id" | "createdAt">;
export type KnowledgeBaseAction = typeof knowledgeBaseActions.$inferSelect;
export type InsertKnowledgeBaseAction = Omit<typeof knowledgeBaseActions.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseSolution = typeof knowledgeBaseSolutions.$inferSelect;
export type InsertKnowledgeBaseSolution = Omit<typeof knowledgeBaseSolutions.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseSolutionHasAction = typeof knowledgeBaseSolutionsHasKnowledgeBaseActions.$inferSelect;
export type InsertKnowledgeBaseSolutionHasAction = Omit<typeof knowledgeBaseSolutionsHasKnowledgeBaseActions.$inferInsert, "id" | "createdAt">;
export type KnowledgeBaseRootCause = typeof knowledgeBaseRootCauses.$inferSelect;
export type InsertKnowledgeBaseRootCause = Omit<typeof knowledgeBaseRootCauses.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeBaseRootCauseHasProblem = typeof knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.$inferSelect;
export type InsertKnowledgeBaseRootCauseHasProblem = Omit<typeof knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.$inferInsert, "id" | "createdAt">;
export type KnowledgeBaseRootCauseHasSolution = typeof knowledgeBaseRootCauseHasKnowledgeBaseSolutions.$inferSelect;
export type InsertKnowledgeBaseRootCauseHasSolution = Omit<typeof knowledgeBaseRootCauseHasKnowledgeBaseSolutions.$inferInsert, "id" | "createdAt">;
