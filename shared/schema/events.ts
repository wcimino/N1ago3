import { pgTable, serial, text, timestamp, json, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { productsCatalog } from "./knowledge";

export const eventsStandard = pgTable("events_standard", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  eventSubtype: text("event_subtype"),
  source: text("source").notNull(),
  sourceEventId: text("source_event_id"),
  sourceRawId: integer("source_raw_id"),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  userId: integer("user_id"),
  externalUserId: text("external_user_id"),
  authorType: text("author_type").notNull(),
  authorId: text("author_id"),
  authorName: text("author_name"),
  contentText: text("content_text"),
  contentPayload: json("content_payload"),
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  metadata: json("metadata"),
  channelType: text("channel_type"),
  processingStatus: text("processing_status").default("processed").notNull(),
}, (table) => ({
  occurredAtIdx: index("idx_events_standard_occurred_at").on(table.occurredAt.desc()),
  conversationEventIdx: index("idx_events_standard_conversation_event").on(table.conversationId, table.eventType),
  sourceIdx: index("idx_events_standard_source").on(table.source),
  eventTypeIdx: index("idx_events_standard_event_type").on(table.eventType),
  sourceEventIdIdx: index("idx_events_standard_source_event_id").on(table.source, table.sourceEventId),
}));

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  externalConversationId: text("external_conversation_id").notNull().unique(),
  externalAppId: text("external_app_id"),
  userId: text("user_id"),
  userExternalId: text("user_external_id"),
  status: text("status").default("active").notNull(),
  externalStatus: text("external_status"),
  closedAt: timestamp("closed_at"),
  closedReason: text("closed_reason"),
  currentHandler: text("current_handler"),
  currentHandlerName: text("current_handler_name"),
  autopilotEnabled: boolean("autopilot_enabled").default(true).notNull(),
  handledByN1ago: boolean("handled_by_n1ago").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadataJson: json("metadata_json"),
}, (table) => ({
  userIdIdx: index("idx_conversations_user_id").on(table.userId),
  updatedAtIdx: index("idx_conversations_updated_at").on(table.updatedAt.desc()),
  statusIdx: index("idx_conversations_status").on(table.status),
  handledByN1agoIdx: index("idx_conversations_handled_by_n1ago").on(table.handledByN1ago),
}));

export const eventTypeMappings = pgTable("event_type_mappings", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  showInList: boolean("show_in_list").default(true).notNull(),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sourceEventTypeUnique: uniqueIndex("idx_event_type_mappings_unique").on(table.source, table.eventType),
}));

export const conversationsSummary = pgTable("conversations_summary", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  externalConversationId: text("external_conversation_id"),
  summary: text("summary").notNull(),
  clientRequest: text("client_request"),
  agentActions: text("agent_actions"),
  currentStatus: text("current_status"),
  orchestratorStatus: text("orchestrator_status").default("new"),
  importantInfo: text("important_info"),
  lastEventId: integer("last_event_id"),
  productId: integer("product_id"),
  productConfidence: integer("product_confidence"),
  productConfidenceReason: text("product_confidence_reason"),
  classifiedAt: timestamp("classified_at"),
  customerEmotionLevel: integer("customer_emotion_level"),
  customerRequestType: text("customer_request_type"),
  customerRequestTypeConfidence: integer("customer_request_type_confidence"),
  customerRequestTypeReason: text("customer_request_type_reason"),
  objectiveProblems: json("objective_problems").$type<Array<{ id: number; name: string; matchScore?: number; matchedTerms?: string[] }>>(),
  clientRequestVersions: json("client_request_versions").$type<{ clientRequestStandardVersion?: string; clientRequestQuestionVersion?: string; clientRequestProblemVersion?: string }>(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: uniqueIndex("idx_conversations_summary_conversation_id").on(table.conversationId),
}));

export const caseDemand = pgTable("case_demand", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  articlesAndObjectiveProblems: json("articles_and_objective_problems").$type<Array<{ source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; matchedTerms?: string[]; products?: string[] }>>(),
  articlesAndObjectiveProblemsTopMatch: json("articles_and_objective_problems_top_match").$type<{ source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; matchedTerms?: string[]; products?: string[] } | null>(),
  interactionCount: integer("interaction_count").default(0).notNull(),
  status: text("status").default("not_started"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("idx_case_demand_conversation_id").on(table.conversationId),
}));

export const responsesSuggested = pgTable("responses_suggested", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  externalConversationId: text("external_conversation_id"),
  suggestedResponse: text("suggested_response").notNull(),
  lastEventId: integer("last_event_id"),
  openaiLogId: integer("openai_log_id"),
  inResponseTo: text("in_response_to"),
  status: text("status").default("created").notNull(),
  usedAt: timestamp("used_at"),
  dismissed: boolean("dismissed").default(false).notNull(),
  articlesUsed: json("articles_used").$type<Array<{ id: number; name: string; product: string; url?: string }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("idx_responses_suggested_conversation_id").on(table.conversationId),
}));

export type EventStandard = typeof eventsStandard.$inferSelect;
export type InsertEventStandard = Omit<typeof eventsStandard.$inferInsert, "id" | "receivedAt" | "processedAt">;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = Omit<typeof conversations.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type EventTypeMapping = typeof eventTypeMappings.$inferSelect;
export type InsertEventTypeMapping = Omit<typeof eventTypeMappings.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type ConversationSummary = typeof conversationsSummary.$inferSelect;
export type InsertConversationSummary = Omit<typeof conversationsSummary.$inferInsert, "id" | "createdAt" | "updatedAt" | "generatedAt">;
export type CaseDemand = typeof caseDemand.$inferSelect;
export type InsertCaseDemand = Omit<typeof caseDemand.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type SuggestedResponse = typeof responsesSuggested.$inferSelect;
export type InsertSuggestedResponse = Omit<typeof responsesSuggested.$inferInsert, "id" | "createdAt">;

export const externalEventSources = pgTable("external_event_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull().unique(),
  channelType: text("channel_type").notNull(),
  apiKey: text("api_key").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  lastRotatedAt: timestamp("last_rotated_at"),
}, (table) => ({
  sourceIdx: uniqueIndex("idx_external_event_sources_source").on(table.source),
  apiKeyIdx: index("idx_external_event_sources_api_key").on(table.apiKey),
}));

export type ExternalEventSource = typeof externalEventSources.$inferSelect;
export type InsertExternalEventSource = Omit<typeof externalEventSources.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const externalEventAuditLogs = pgTable("external_event_audit_logs", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id"),
  apiKeyPrefix: text("api_key_prefix"),
  action: text("action").notNull(),
  endpoint: text("endpoint").notNull(),
  eventCount: integer("event_count").default(1).notNull(),
  statusCode: integer("status_code").notNull(),
  errorMessage: text("error_message"),
  requestSource: text("request_source"),
  requestChannelType: text("request_channel_type"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdIdx: index("idx_external_event_audit_logs_source_id").on(table.sourceId),
  actionIdx: index("idx_external_event_audit_logs_action").on(table.action),
  createdAtIdx: index("idx_external_event_audit_logs_created_at").on(table.createdAt.desc()),
}));

export type ExternalEventAuditLog = typeof externalEventAuditLogs.$inferSelect;
export type InsertExternalEventAuditLog = Omit<typeof externalEventAuditLogs.$inferInsert, "id" | "createdAt">;
