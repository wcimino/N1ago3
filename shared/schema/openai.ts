import { pgTable, serial, text, timestamp, json, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const openaiApiConfig = pgTable("openai_api_config", {
  id: serial("id").primaryKey(),
  configType: text("config_type").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  triggerEventTypes: json("trigger_event_types").$type<string[]>().default([]).notNull(),
  triggerAuthorTypes: json("trigger_author_types").$type<string[]>().default([]).notNull(),
  promptSystem: text("prompt_system"),
  promptTemplate: text("prompt_template").notNull(),
  responseFormat: text("response_format"),
  modelName: text("model_name").default("gpt-4o-mini").notNull(),
  useKnowledgeBaseTool: boolean("use_knowledge_base_tool").default(false).notNull(),
  useProductCatalogTool: boolean("use_product_catalog_tool").default(false).notNull(),
  useSubjectIntentTool: boolean("use_subject_intent_tool").default(false).notNull(),
  useZendeskKnowledgeBaseTool: boolean("use_zendesk_knowledge_base_tool").default(false).notNull(),
  useObjectiveProblemTool: boolean("use_objective_problem_tool").default(false).notNull(),
  useCombinedKnowledgeSearchTool: boolean("use_combined_knowledge_search_tool").default(false).notNull(),
  useKnowledgeSuggestionTool: boolean("use_knowledge_suggestion_tool").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  configTypeIdx: uniqueIndex("idx_openai_api_config_type").on(table.configType),
}));

export const openaiApiConfigGeneral = pgTable("openai_api_config_general", {
  id: serial("id").primaryKey(),
  configType: text("config_type").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  configTypeIdx: uniqueIndex("idx_openai_api_config_general_type").on(table.configType),
}));

export const openaiApiLogs = pgTable("openai_api_logs", {
  id: serial("id").primaryKey(),
  requestType: text("request_type").notNull(),
  modelName: text("model_name").notNull(),
  promptSystem: text("prompt_system"),
  promptUser: text("prompt_user").notNull(),
  responseRaw: json("response_raw"),
  responseContent: text("response_content"),
  tokensPrompt: integer("tokens_prompt"),
  tokensCompletion: integer("tokens_completion"),
  tokensTotal: integer("tokens_total"),
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  contextType: text("context_type"),
  contextId: text("context_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("idx_openai_api_logs_created_at").on(table.createdAt.desc()),
}));

export type OpenaiApiConfig = typeof openaiApiConfig.$inferSelect;
export type InsertOpenaiApiConfig = Omit<typeof openaiApiConfig.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type OpenaiApiConfigGeneral = typeof openaiApiConfigGeneral.$inferSelect;
export type InsertOpenaiApiConfigGeneral = Omit<typeof openaiApiConfigGeneral.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type OpenaiApiLog = typeof openaiApiLogs.$inferSelect;
export type InsertOpenaiApiLog = Omit<typeof openaiApiLogs.$inferInsert, "id" | "createdAt">;
