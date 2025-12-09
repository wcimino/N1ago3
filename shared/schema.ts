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
  lastAccess: timestamp("last_access"),
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
  eventsCreatedCount: integer("events_created_count").default(0).notNull(),
}, (table) => ({
  receivedAtIdx: index("idx_zendesk_webhook_received_at").on(table.receivedAt),
  processingStatusIdx: index("idx_zendesk_webhook_processing_status").on(table.processingStatus),
}));


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
  occurredAtIdx: index("idx_events_standard_occurred_at").on(table.occurredAt),
  conversationEventIdx: index("idx_events_standard_conversation_event").on(table.conversationId, table.eventType),
  sourceIdx: index("idx_events_standard_source").on(table.source),
  eventTypeIdx: index("idx_events_standard_event_type").on(table.eventType),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadataJson: json("metadata_json"),
}, (table) => ({
  userIdIdx: index("idx_conversations_user_id").on(table.userId),
  updatedAtIdx: index("idx_conversations_updated_at").on(table.updatedAt),
  statusIdx: index("idx_conversations_status").on(table.status),
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
  importantInfo: text("important_info"),
  lastEventId: integer("last_event_id"),
  product: text("product"),
  productStandard: text("product_standard"),
  intent: text("intent"),
  confidence: integer("confidence"),
  classifiedAt: timestamp("classified_at"),
  customerEmotionLevel: integer("customer_emotion_level"),
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
  promptSystem: text("prompt_system"),
  promptTemplate: text("prompt_template").notNull(),
  responseFormat: text("response_format"),
  modelName: text("model_name").default("gpt-4o-mini").notNull(),
  useKnowledgeBaseTool: boolean("use_knowledge_base_tool").default(false).notNull(),
  useProductCatalogTool: boolean("use_product_catalog_tool").default(false).notNull(),
  useZendeskKnowledgeBaseTool: boolean("use_zendesk_knowledge_base_tool").default(false).notNull(),
  useGeneralSettings: boolean("use_general_settings").default(false).notNull(),
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
});

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

export const usersStandard = pgTable("users_standard", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  source: text("source").notNull(),
  sourceUserId: text("source_user_id"),
  externalId: text("external_id"),
  name: text("name"),
  cpf: text("cpf"),
  phone: text("phone"),
  locale: text("locale"),
  signedUpAt: timestamp("signed_up_at"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex("idx_users_standard_email").on(table.email),
  cpfIdx: index("idx_users_standard_cpf").on(table.cpf),
  sourceIdx: index("idx_users_standard_source").on(table.source),
}));

export const usersStandardHistory = pgTable("users_standard_history", {
  id: serial("id").primaryKey(),
  userEmail: varchar("user_email").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  source: text("source"),
}, (table) => ({
  userEmailIdx: index("idx_users_standard_history_email").on(table.userEmail),
  changedAtIdx: index("idx_users_standard_history_changed_at").on(table.changedAt),
}));

export const organizationsStandard = pgTable("organizations_standard", {
  id: serial("id").primaryKey(),
  cnpj: varchar("cnpj"),
  cnpjRoot: varchar("cnpj_root").notNull().unique(),
  source: text("source").notNull(),
  name: text("name"),
  metadata: json("metadata"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  cnpjRootIdx: uniqueIndex("idx_organizations_standard_cnpj_root").on(table.cnpjRoot),
  cnpjIdx: index("idx_organizations_standard_cnpj").on(table.cnpj),
  sourceIdx: index("idx_organizations_standard_source").on(table.source),
}));

export const organizationsStandardHistory = pgTable("organizations_standard_history", {
  id: serial("id").primaryKey(),
  organizationCnpjRoot: varchar("organization_cnpj_root").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  source: text("source"),
}, (table) => ({
  cnpjRootIdx: index("idx_organizations_standard_history_cnpj_root").on(table.organizationCnpjRoot),
  changedAtIdx: index("idx_organizations_standard_history_changed_at").on(table.changedAt),
}));

export const userStandardHasOrganizationStandard = pgTable("user_standard_has_organization_standard", {
  id: serial("id").primaryKey(),
  userStandardId: integer("user_standard_id").notNull(),
  organizationStandardId: integer("organization_standard_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueLink: uniqueIndex("idx_user_org_unique").on(table.userStandardId, table.organizationStandardId),
  userIdx: index("idx_user_standard_has_org_user").on(table.userStandardId),
  orgIdx: index("idx_user_standard_has_org_org").on(table.organizationStandardId),
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

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  name: text("name"),
  productStandard: text("product_standard").notNull(),
  subproductStandard: text("subproduct_standard"),
  category1: text("category1"),
  category2: text("category2"),
  intent: text("intent").notNull(),
  description: text("description").notNull(),
  resolution: text("resolution").notNull(),
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdx: index("idx_knowledge_base_product").on(table.productStandard),
  intentIdx: index("idx_knowledge_base_intent").on(table.intent),
  category1Idx: index("idx_knowledge_base_category1").on(table.category1),
}));

export const ifoodProducts = pgTable("products_catalog", {
  id: serial("id").primaryKey(),
  produto: text("produto").notNull(),
  subproduto: text("subproduto"),
  categoria1: text("categoria1"),
  categoria2: text("categoria2"),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  produtoIdx: index("idx_ifood_products_produto").on(table.produto),
  fullNameIdx: uniqueIndex("idx_ifood_products_full_name").on(table.fullName),
}));

export const knowledgeSuggestions = pgTable("knowledge_suggestions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  
  suggestionType: text("suggestion_type").default("create").notNull(),
  
  name: text("name"),
  productStandard: text("product_standard"),
  subproductStandard: text("subproduct_standard"),
  category1: text("category1"),
  category2: text("category2"),
  
  description: text("description"),
  resolution: text("resolution"),
  observations: text("observations"),
  
  confidenceScore: integer("confidence_score"),
  qualityFlags: json("quality_flags"),
  similarArticleId: integer("similar_article_id"),
  similarityScore: integer("similarity_score"),
  
  updateReason: text("update_reason"),
  
  status: text("status").default("pending").notNull(),
  reviewedBy: varchar("reviewed_by"),
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

export const zendeskArticles = pgTable("zendesk_articles", {
  id: serial("id").primaryKey(),
  zendeskId: text("zendesk_id").notNull().unique(),
  title: text("title").notNull(),
  body: text("body"),
  sectionId: text("section_id"),
  sectionName: text("section_name"),
  categoryId: text("category_id"),
  categoryName: text("category_name"),
  authorId: text("author_id"),
  locale: text("locale"),
  htmlUrl: text("html_url"),
  draft: boolean("draft").default(false).notNull(),
  promoted: boolean("promoted").default(false).notNull(),
  position: integer("position"),
  voteSum: integer("vote_sum"),
  voteCount: integer("vote_count"),
  labelNames: json("label_names").$type<string[]>(),
  zendeskCreatedAt: timestamp("zendesk_created_at"),
  zendeskUpdatedAt: timestamp("zendesk_updated_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  zendeskIdIdx: uniqueIndex("idx_zendesk_articles_zendesk_id").on(table.zendeskId),
  sectionIdIdx: index("idx_zendesk_articles_section_id").on(table.sectionId),
  localeIdx: index("idx_zendesk_articles_locale").on(table.locale),
  titleIdx: index("idx_zendesk_articles_title").on(table.title),
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

export type EventStandard = typeof eventsStandard.$inferSelect;
export type InsertEventStandard = Omit<typeof eventsStandard.$inferInsert, "id" | "receivedAt" | "processedAt">;

export type EventTypeMapping = typeof eventTypeMappings.$inferSelect;
export type InsertEventTypeMapping = Omit<typeof eventTypeMappings.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type ConversationSummary = typeof conversationsSummary.$inferSelect;
export type InsertConversationSummary = Omit<typeof conversationsSummary.$inferInsert, "id" | "createdAt" | "updatedAt" | "generatedAt">;

export type OpenaiApiConfig = typeof openaiApiConfig.$inferSelect;
export type InsertOpenaiApiConfig = Omit<typeof openaiApiConfig.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type OpenaiApiConfigGeneral = typeof openaiApiConfigGeneral.$inferSelect;
export type InsertOpenaiApiConfigGeneral = Omit<typeof openaiApiConfigGeneral.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type OpenaiApiLog = typeof openaiApiLogs.$inferSelect;
export type InsertOpenaiApiLog = Omit<typeof openaiApiLogs.$inferInsert, "id" | "createdAt">;

export type ZendeskApiLog = typeof zendeskApiLogs.$inferSelect;
export type InsertZendeskApiLog = Omit<typeof zendeskApiLogs.$inferInsert, "id" | "createdAt">;

export type SuggestedResponse = typeof responsesSuggested.$inferSelect;
export type InsertSuggestedResponse = Omit<typeof responsesSuggested.$inferInsert, "id" | "createdAt">;

export type UserStandard = typeof usersStandard.$inferSelect;
export type InsertUserStandard = Omit<typeof usersStandard.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;

export type UserStandardHistory = typeof usersStandardHistory.$inferSelect;
export type InsertUserStandardHistory = Omit<typeof usersStandardHistory.$inferInsert, "id" | "changedAt">;

export type OrganizationStandard = typeof organizationsStandard.$inferSelect;
export type InsertOrganizationStandard = Omit<typeof organizationsStandard.$inferInsert, "id" | "createdAt" | "updatedAt" | "firstSeenAt" | "lastSeenAt">;

export type OrganizationStandardHistory = typeof organizationsStandardHistory.$inferSelect;
export type InsertOrganizationStandardHistory = Omit<typeof organizationsStandardHistory.$inferInsert, "id" | "changedAt">;

export type UserStandardHasOrganizationStandard = typeof userStandardHasOrganizationStandard.$inferSelect;
export type InsertUserStandardHasOrganizationStandard = Omit<typeof userStandardHasOrganizationStandard.$inferInsert, "id" | "createdAt">;

export type KnowledgeBaseArticle = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBaseArticle = Omit<typeof knowledgeBase.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type KnowledgeSuggestion = typeof knowledgeSuggestions.$inferSelect;
export type InsertKnowledgeSuggestion = Omit<typeof knowledgeSuggestions.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type IfoodProduct = typeof ifoodProducts.$inferSelect;
export type InsertIfoodProduct = Omit<typeof ifoodProducts.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type LearningAttempt = typeof learningAttempts.$inferSelect;
export type InsertLearningAttempt = Omit<typeof learningAttempts.$inferInsert, "id" | "createdAt">;

export type LearningAttemptResult = "suggestion_created" | "insufficient_messages" | "skipped_by_agent" | "processing_error";

export type ZendeskArticle = typeof zendeskArticles.$inferSelect;
export type InsertZendeskArticle = Omit<typeof zendeskArticles.$inferInsert, "id" | "createdAt" | "updatedAt" | "syncedAt">;

export const routingRules = pgTable("routing_rules", {
  id: serial("id").primaryKey(),
  ruleType: text("rule_type").notNull(),
  target: text("target").notNull(),
  allocateCount: integer("allocate_count"),
  allocatedCount: integer("allocated_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  authFilter: text("auth_filter").default("all").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  ruleTypeIdx: index("idx_routing_rules_rule_type").on(table.ruleType),
  isActiveIdx: index("idx_routing_rules_is_active").on(table.isActive),
}));

export type RoutingRule = typeof routingRules.$inferSelect;
export type InsertRoutingRule = Omit<typeof routingRules.$inferInsert, "id" | "createdAt" | "updatedAt" | "allocatedCount">;
