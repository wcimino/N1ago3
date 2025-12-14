import { pgTable, serial, text, timestamp, integer, boolean, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

export const routingRules = pgTable("routing_rules", {
  id: serial("id").primaryKey(),
  ruleType: text("rule_type").notNull(),
  target: text("target").notNull(),
  allocateCount: integer("allocate_count"),
  allocatedCount: integer("allocated_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  authFilter: text("auth_filter").default("all").notNull(),
  matchText: text("match_text"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  ruleTypeIdx: index("idx_routing_rules_rule_type").on(table.ruleType),
  isActiveIdx: index("idx_routing_rules_is_active").on(table.isActive),
}));

export const routingProcessedEvents = pgTable("routing_processed_events", {
  id: serial("id").primaryKey(),
  externalConversationId: text("external_conversation_id").notNull(),
  ruleId: integer("rule_id").notNull(),
  ruleType: text("rule_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  conversationRuleTypeUnique: uniqueIndex("idx_routing_processed_conversation_rule_type").on(table.externalConversationId, table.ruleType),
  expiresAtIdx: index("idx_routing_processed_expires_at").on(table.expiresAt),
  ruleIdIdx: index("idx_routing_processed_rule_id").on(table.ruleId),
}));

export type RoutingRule = typeof routingRules.$inferSelect;
export type InsertRoutingRule = Omit<typeof routingRules.$inferInsert, "id" | "createdAt" | "updatedAt" | "allocatedCount">;
export type RoutingProcessedEvent = typeof routingProcessedEvents.$inferSelect;
export type InsertRoutingProcessedEvent = Omit<typeof routingProcessedEvents.$inferInsert, "id" | "processedAt">;
