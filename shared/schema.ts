import { pgTable, serial, text, timestamp, json, integer, boolean, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);

// Auth users table for Replit Auth
export const authUsers = pgTable("auth_users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Authorized users table for access control
export const authorizedUsers = pgTable("authorized_users", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  name: varchar("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by"),
});

// Zendesk users table (existing)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  sunshineId: text("sunshine_id").notNull().unique(),
  externalId: text("external_id"),
  signedUpAt: timestamp("signed_up_at"),
  authenticated: boolean("authenticated").default(false).notNull(),
  profile: json("profile"),
  metadata: json("metadata"),
  identities: json("identities"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const zendeskConversationsWebhookRaw = pgTable("zendesk_conversations_webhook_raw", {
  id: serial("id").primaryKey(),
  source: text("source").default("zendesk").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  sourceIp: text("source_ip"),
  headers: json("headers"),
  payload: json("payload"),
  rawBody: text("raw_body"),
  processingStatus: text("processing_status").default("pending").notNull(),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
  retryCount: integer("retry_count").default(0).notNull(),
});


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
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  zendeskConversationId: text("zendesk_conversation_id").notNull().unique(),
  zendeskAppId: text("zendesk_app_id"),
  userId: text("user_id"),
  userExternalId: text("user_external_id"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadataJson: json("metadata_json"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  zendeskMessageId: text("zendesk_message_id"),
  authorType: text("author_type").notNull(),
  authorId: text("author_id"),
  authorName: text("author_name"),
  contentType: text("content_type").default("text").notNull(),
  contentText: text("content_text"),
  contentPayload: json("content_payload"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  zendeskTimestamp: timestamp("zendesk_timestamp"),
  metadataJson: json("metadata_json"),
  webhookLogId: integer("webhook_log_id"),
});

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
  lastEventId: integer("last_event_id"),
  product: text("product"),
  intent: text("intent"),
  confidence: integer("confidence"),
  classifiedAt: timestamp("classified_at"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: uniqueIndex("idx_conversations_summary_conversation_id").on(table.conversationId),
}));

export const openaiApiConfig = pgTable("openai_api_config", {
  id: serial("id").primaryKey(),
  configType: text("config_type").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  triggerEventTypes: json("trigger_event_types").$type<string[]>().default([]).notNull(),
  triggerAuthorTypes: json("trigger_author_types").$type<string[]>().default([]).notNull(),
  promptTemplate: text("prompt_template").notNull(),
  modelName: text("model_name").default("gpt-4o-mini").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  configTypeIdx: uniqueIndex("idx_openai_api_config_type").on(table.configType),
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
});

export const responsesSuggested = pgTable("responses_suggested", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  externalConversationId: text("external_conversation_id"),
  suggestedResponse: text("suggested_response").notNull(),
  lastEventId: integer("last_event_id"),
  openaiLogId: integer("openai_log_id"),
  usedAt: timestamp("used_at"),
  dismissed: boolean("dismissed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("idx_responses_suggested_conversation_id").on(table.conversationId),
}));

// Types
export type AuthUser = typeof authUsers.$inferSelect;
export type UpsertAuthUser = typeof authUsers.$inferInsert;
export type AuthorizedUser = typeof authorizedUsers.$inferSelect;
export type InsertAuthorizedUser = Omit<typeof authorizedUsers.$inferInsert, "id" | "createdAt">;

export type User = typeof users.$inferSelect;
export type InsertUser = Omit<typeof users.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;
export type ZendeskConversationsWebhookRaw = typeof zendeskConversationsWebhookRaw.$inferSelect;
export type InsertZendeskConversationsWebhookRaw = Omit<typeof zendeskConversationsWebhookRaw.$inferInsert, "id" | "receivedAt">;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = Omit<typeof conversations.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = Omit<typeof messages.$inferInsert, "id" | "receivedAt">;

export type EventStandard = typeof eventsStandard.$inferSelect;
export type InsertEventStandard = Omit<typeof eventsStandard.$inferInsert, "id" | "receivedAt" | "processedAt">;

export type EventTypeMapping = typeof eventTypeMappings.$inferSelect;
export type InsertEventTypeMapping = Omit<typeof eventTypeMappings.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type ConversationSummary = typeof conversationsSummary.$inferSelect;
export type InsertConversationSummary = Omit<typeof conversationsSummary.$inferInsert, "id" | "createdAt" | "updatedAt" | "generatedAt">;

export type OpenaiApiConfig = typeof openaiApiConfig.$inferSelect;
export type InsertOpenaiApiConfig = Omit<typeof openaiApiConfig.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type OpenaiApiLog = typeof openaiApiLogs.$inferSelect;
export type InsertOpenaiApiLog = Omit<typeof openaiApiLogs.$inferInsert, "id" | "createdAt">;

export type SuggestedResponse = typeof responsesSuggested.$inferSelect;
export type InsertSuggestedResponse = Omit<typeof responsesSuggested.$inferInsert, "id" | "createdAt">;
