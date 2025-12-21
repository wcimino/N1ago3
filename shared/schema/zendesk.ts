import { pgTable, serial, text, timestamp, json, integer, boolean, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

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
  eventsCreatedCount: integer("events_created_count").default(0).notNull(),
}, (table) => ({
  receivedAtIdx: index("idx_zendesk_webhook_received_at").on(table.receivedAt.desc()),
  processingStatusIdx: index("idx_zendesk_webhook_processing_status").on(table.processingStatus),
}));

export const zendeskApiLogs = pgTable("zendesk_api_logs", {
  id: serial("id").primaryKey(),
  requestType: text("request_type").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  conversationId: text("conversation_id"),
  requestPayload: json("request_payload"),
  responseRaw: json("response_raw"),
  responseStatus: integer("response_status"),
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  contextType: text("context_type"),
  contextId: text("context_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  conversationIdIdx: index("idx_zendesk_api_logs_conversation_id").on(table.conversationId),
  requestTypeIdx: index("idx_zendesk_api_logs_request_type").on(table.requestType),
  createdAtIdx: index("idx_zendesk_api_logs_created_at").on(table.createdAt),
}));

export const zendeskSupportUsers = pgTable("zendesk_support_users", {
  id: serial("id").primaryKey(),
  zendeskId: bigint("zendesk_id", { mode: "number" }).notNull().unique(),
  url: text("url"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  sharedPhoneNumber: boolean("shared_phone_number"),
  alias: text("alias"),
  role: text("role"),
  roleType: integer("role_type"),
  customRoleId: integer("custom_role_id"),
  verified: boolean("verified"),
  active: boolean("active"),
  suspended: boolean("suspended"),
  moderator: boolean("moderator"),
  restrictedAgent: boolean("restricted_agent"),
  organizationId: bigint("organization_id", { mode: "number" }),
  defaultGroupId: bigint("default_group_id", { mode: "number" }),
  timeZone: text("time_zone"),
  ianaTimeZone: text("iana_time_zone"),
  locale: text("locale"),
  localeId: integer("locale_id"),
  details: text("details"),
  notes: text("notes"),
  signature: text("signature"),
  tags: json("tags").$type<string[]>(),
  externalId: text("external_id"),
  ticketRestriction: text("ticket_restriction"),
  onlyPrivateComments: boolean("only_private_comments"),
  chatOnly: boolean("chat_only"),
  shared: boolean("shared"),
  sharedAgent: boolean("shared_agent"),
  twoFactorAuthEnabled: boolean("two_factor_auth_enabled"),
  zendeskCreatedAt: timestamp("zendesk_created_at"),
  zendeskUpdatedAt: timestamp("zendesk_updated_at"),
  lastLoginAt: timestamp("last_login_at"),
  userFields: json("user_fields").$type<Record<string, unknown>>(),
  photo: json("photo").$type<Record<string, unknown>>(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  zendeskIdIdx: uniqueIndex("idx_zendesk_support_users_zendesk_id").on(table.zendeskId),
  emailIdx: index("idx_zendesk_support_users_email").on(table.email),
  roleIdx: index("idx_zendesk_support_users_role").on(table.role),
  organizationIdx: index("idx_zendesk_support_users_organization").on(table.organizationId),
  activeIdx: index("idx_zendesk_support_users_active").on(table.active),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = Omit<typeof users.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;
export type ZendeskConversationsWebhookRaw = typeof zendeskConversationsWebhookRaw.$inferSelect;
export type InsertZendeskConversationsWebhookRaw = Omit<typeof zendeskConversationsWebhookRaw.$inferInsert, "id" | "receivedAt">;
export type ZendeskApiLog = typeof zendeskApiLogs.$inferSelect;
export type InsertZendeskApiLog = Omit<typeof zendeskApiLogs.$inferInsert, "id" | "createdAt">;
export type ZendeskSupportUser = typeof zendeskSupportUsers.$inferSelect;
export type InsertZendeskSupportUser = Omit<typeof zendeskSupportUsers.$inferInsert, "id" | "createdAt" | "updatedAt">;
