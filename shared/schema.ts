import { pgTable, serial, text, timestamp, json, integer, boolean } from "drizzle-orm/pg-core";

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

export const webhookRawLogs = pgTable("webhook_raw_logs", {
  id: serial("id").primaryKey(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  sourceIp: text("source_ip"),
  headers: json("headers"),
  payload: json("payload"),
  rawBody: text("raw_body"),
  processingStatus: text("processing_status").default("pending").notNull(),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
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

export type User = typeof users.$inferSelect;
export type InsertUser = Omit<typeof users.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;
export type WebhookRawLog = typeof webhookRawLogs.$inferSelect;
export type InsertWebhookRawLog = Omit<typeof webhookRawLogs.$inferInsert, "id" | "receivedAt">;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = Omit<typeof conversations.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = Omit<typeof messages.$inferInsert, "id" | "receivedAt">;
