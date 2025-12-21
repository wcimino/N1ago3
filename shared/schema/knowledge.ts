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

export type ProductCatalog = typeof productsCatalog.$inferSelect;
export type InsertProductCatalog = Omit<typeof productsCatalog.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type KnowledgeEnrichmentLog = typeof knowledgeEnrichmentLog.$inferSelect;
export type InsertKnowledgeEnrichmentLog = Omit<typeof knowledgeEnrichmentLog.$inferInsert, "id" | "createdAt">;
export type EmbeddingGenerationLog = typeof embeddingGenerationLogs.$inferSelect;
export type InsertEmbeddingGenerationLog = Omit<typeof embeddingGenerationLogs.$inferInsert, "id" | "createdAt">;
