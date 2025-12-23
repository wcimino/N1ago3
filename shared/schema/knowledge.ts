import { pgTable, serial, text, timestamp, uniqueIndex, index, integer, jsonb, boolean, uuid } from "drizzle-orm/pg-core";

export const productsCatalog = pgTable("products_catalog", {
  id: serial("id").primaryKey(),
  externalId: uuid("external_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  externalIdIdx: uniqueIndex("idx_products_catalog_external_id").on(table.externalId),
  nameIdx: index("idx_products_catalog_name").on(table.name),
}));

export type ProductCatalog = typeof productsCatalog.$inferSelect;
export type InsertProductCatalog = Omit<typeof productsCatalog.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const subproductsCatalog = pgTable("subproducts_catalog", {
  id: serial("id").primaryKey(),
  externalId: uuid("external_id").notNull(),
  name: text("name").notNull(),
  produtoId: uuid("produto_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  externalIdIdx: uniqueIndex("idx_subproducts_catalog_external_id").on(table.externalId),
  produtoIdIdx: index("idx_subproducts_catalog_produto_id").on(table.produtoId),
  nameIdx: index("idx_subproducts_catalog_name").on(table.name),
}));

export type SubproductCatalog = typeof subproductsCatalog.$inferSelect;
export type InsertSubproductCatalog = Omit<typeof subproductsCatalog.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const caseSolutions = pgTable("case_solutions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  solutionId: integer("solution_id"),
  rootCauseId: integer("root_cause_id"),
  status: text("status").default("pending_info").notNull(),
  providedInputs: jsonb("provided_inputs").$type<Record<string, unknown>>().default({}),
  collectedInputsCustomer: jsonb("collected_inputs_customer").$type<Record<string, unknown>>().default({}),
  collectedInputsSystems: jsonb("collected_inputs_systems").$type<Record<string, unknown>>().default({}),
  pendingInputs: jsonb("pending_inputs").$type<Array<{ key: string; question: string; source: string }>>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index("idx_case_solutions_conversation").on(table.conversationId),
  solutionIdx: index("idx_case_solutions_solution").on(table.solutionId),
  statusIdx: index("idx_case_solutions_status").on(table.status),
  createdAtIdx: index("idx_case_solutions_created_at").on(table.createdAt),
}));

export const caseActions = pgTable("case_actions", {
  id: serial("id").primaryKey(),
  caseSolutionId: integer("case_solution_id").notNull().references(() => caseSolutions.id, { onDelete: "cascade" }),
  actionId: integer("action_id").notNull(),
  externalActionId: text("external_action_id"),
  actionSequence: integer("action_sequence").notNull(),
  status: text("status").default("pending").notNull(),
  inputUsed: jsonb("input_used").$type<Record<string, unknown>>().default({}),
  output: jsonb("output").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseSolutionIdx: index("idx_case_actions_case_solution").on(table.caseSolutionId),
  actionIdx: index("idx_case_actions_action").on(table.actionId),
  externalActionIdx: index("idx_case_actions_external_action").on(table.externalActionId),
  statusIdx: index("idx_case_actions_status").on(table.status),
}));

export type CaseSolution = typeof caseSolutions.$inferSelect;
export type InsertCaseSolution = Omit<typeof caseSolutions.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type CaseAction = typeof caseActions.$inferSelect;
export type InsertCaseAction = Omit<typeof caseActions.$inferInsert, "id" | "createdAt">;

export const scArticleProblemSearchApiLog = pgTable("sc_article_problem_search_api_log", {
  id: serial("id").primaryKey(),
  caseDemandId: integer("case_demand_id"),
  conversationId: integer("conversation_id"),
  request: jsonb("request").$type<Record<string, unknown>>(),
  response: jsonb("response").$type<Record<string, unknown>>(),
  statusCode: integer("status_code"),
  success: boolean("success").default(false).notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseDemandIdx: index("idx_sc_search_log_case_demand").on(table.caseDemandId),
  conversationIdx: index("idx_sc_search_log_conversation").on(table.conversationId),
  createdAtIdx: index("idx_sc_search_log_created_at").on(table.createdAt),
}));

export const scSolutionApiLog = pgTable("sc_solution_api_log", {
  id: serial("id").primaryKey(),
  caseSolutionId: integer("case_solution_id"),
  conversationId: integer("conversation_id"),
  request: jsonb("request").$type<Record<string, unknown>>(),
  response: jsonb("response").$type<Record<string, unknown>>(),
  statusCode: integer("status_code"),
  success: boolean("success").default(false).notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseSolutionIdx: index("idx_sc_solution_log_case_solution").on(table.caseSolutionId),
  conversationIdx: index("idx_sc_solution_log_conversation").on(table.conversationId),
  createdAtIdx: index("idx_sc_solution_log_created_at").on(table.createdAt),
}));

export type ScArticleProblemSearchApiLog = typeof scArticleProblemSearchApiLog.$inferSelect;
export type InsertScArticleProblemSearchApiLog = Omit<typeof scArticleProblemSearchApiLog.$inferInsert, "id" | "createdAt">;
export type ScSolutionApiLog = typeof scSolutionApiLog.$inferSelect;
export type InsertScSolutionApiLog = Omit<typeof scSolutionApiLog.$inferInsert, "id" | "createdAt">;
