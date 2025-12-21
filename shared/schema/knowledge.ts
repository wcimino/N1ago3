import { pgTable, serial, text, timestamp, uniqueIndex, index, integer, json } from "drizzle-orm/pg-core";

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

export type ProductCatalog = typeof productsCatalog.$inferSelect;
export type InsertProductCatalog = Omit<typeof productsCatalog.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const caseSolutions = pgTable("case_solutions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  solutionId: integer("solution_id"),
  rootCauseId: integer("root_cause_id"),
  status: text("status").default("pending_info").notNull(),
  providedInputs: json("provided_inputs").$type<Record<string, unknown>>().default({}),
  collectedInputsCustomer: json("collected_inputs_customer").$type<Record<string, unknown>>().default({}),
  collectedInputsSystems: json("collected_inputs_systems").$type<Record<string, unknown>>().default({}),
  pendingInputs: json("pending_inputs").$type<Array<{ key: string; question: string; source: string }>>().default([]),
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
  actionSequence: integer("action_sequence").notNull(),
  status: text("status").default("not_started").notNull(),
  inputUsed: json("input_used").$type<Record<string, unknown>>().default({}),
  output: json("output").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  caseSolutionIdx: index("idx_case_actions_case_solution").on(table.caseSolutionId),
  actionIdx: index("idx_case_actions_action").on(table.actionId),
  statusIdx: index("idx_case_actions_status").on(table.status),
}));

export type CaseSolution = typeof caseSolutions.$inferSelect;
export type InsertCaseSolution = Omit<typeof caseSolutions.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type CaseAction = typeof caseActions.$inferSelect;
export type InsertCaseAction = Omit<typeof caseActions.$inferInsert, "id" | "createdAt">;
