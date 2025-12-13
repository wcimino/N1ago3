import { pgTable, serial, text, timestamp, json, integer, boolean, varchar, index, uniqueIndex, numeric, bigint } from "drizzle-orm/pg-core";
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
  receivedAtIdx: index("idx_zendesk_webhook_received_at").on(table.receivedAt.desc()),
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
  occurredAtIdx: index("idx_events_standard_occurred_at").on(table.occurredAt.desc()),
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
  importantInfo: text("important_info"),
  lastEventId: integer("last_event_id"),
  productId: integer("product_id").references(() => productsCatalog.id, { onDelete: "set null" }),
  product: text("product"),
  productStandard: text("product_standard"),
  subproduct: text("subproduct"),
  subject: text("subject"),
  intent: text("intent"),
  confidence: integer("confidence"),
  classifiedAt: timestamp("classified_at"),
  customerEmotionLevel: integer("customer_emotion_level"),
  customerRequestType: text("customer_request_type"),
  objectiveProblems: json("objective_problems").$type<Array<{ id: number; name: string; matchScore?: number }>>(),
  articlesAndObjectiveProblems: json("articles_and_objective_problems").$type<Array<{ source: "article" | "problem"; id: number; name: string | null; description: string; resolution?: string; matchScore?: number; matchReason?: string; products?: string[] }>>(),
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
  useSubjectIntentTool: boolean("use_subject_intent_tool").default(false).notNull(),
  useZendeskKnowledgeBaseTool: boolean("use_zendesk_knowledge_base_tool").default(false).notNull(),
  useObjectiveProblemTool: boolean("use_objective_problem_tool").default(false).notNull(),
  useCombinedKnowledgeSearchTool: boolean("use_combined_knowledge_search_tool").default(false).notNull(),
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
}, (table) => ({
  createdAtIdx: index("idx_openai_api_logs_created_at").on(table.createdAt.desc()),
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
  productId: integer("product_id").references(() => productsCatalog.id, { onDelete: "set null" }),
  productStandard: text("product_standard").notNull(),
  subproductStandard: text("subproduct_standard"),
  subjectId: integer("subject_id"),
  intentId: integer("intent_id"),
  description: text("description").notNull(),
  resolution: text("resolution").notNull(),
  internalActions: text("internal_actions"),
  observations: text("observations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("idx_knowledge_base_product_id").on(table.productId),
  productIdx: index("idx_knowledge_base_product").on(table.productStandard),
  subjectIdx: index("idx_knowledge_base_subject").on(table.subjectId),
  intentIdIdx: index("idx_knowledge_base_intent_id").on(table.intentId),
}));

export const knowledgeBaseEmbeddings = pgTable("knowledge_base_embeddings", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  embeddingVector: text("embedding_vector"),
  modelUsed: text("model_used").notNull().default("text-embedding-3-small"),
  tokensUsed: integer("tokens_used"),
  openaiLogId: integer("openai_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  articleIdUnique: uniqueIndex("idx_knowledge_base_embeddings_article_id").on(table.articleId),
  contentHashIdx: index("idx_knowledge_base_embeddings_content_hash").on(table.contentHash),
}));

export const knowledgeBaseObjectiveProblems = pgTable("knowledge_base_objective_problems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  synonyms: json("synonyms").$type<string[]>().default([]),
  examples: json("examples").$type<string[]>().default([]),
  presentedBy: text("presented_by").notNull().default("customer"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  presentedByIdx: index("idx_kb_objective_problems_presented_by").on(table.presentedBy),
  isActiveIdx: index("idx_kb_objective_problems_is_active").on(table.isActive),
}));

export type KnowledgeBaseObjectiveProblem = typeof knowledgeBaseObjectiveProblems.$inferSelect;
export type InsertKnowledgeBaseObjectiveProblem = typeof knowledgeBaseObjectiveProblems.$inferInsert;

export const knowledgeBaseObjectiveProblemsHasProductsCatalog = pgTable("knowledge_base_objective_problems_has_products_catalog", {
  id: serial("id").primaryKey(),
  objectiveProblemId: integer("objective_problem_id").notNull().references(() => knowledgeBaseObjectiveProblems.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsCatalog.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueLink: uniqueIndex("idx_kb_objective_problems_products_unique").on(table.objectiveProblemId, table.productId),
  problemIdx: index("idx_kb_objective_problems_products_problem").on(table.objectiveProblemId),
  productIdx: index("idx_kb_objective_problems_products_product").on(table.productId),
}));

export type KnowledgeBaseObjectiveProblemsHasProductsCatalog = typeof knowledgeBaseObjectiveProblemsHasProductsCatalog.$inferSelect;
export type InsertKnowledgeBaseObjectiveProblemsHasProductsCatalog = Omit<typeof knowledgeBaseObjectiveProblemsHasProductsCatalog.$inferInsert, "id" | "createdAt">;

export const knowledgeBaseObjectiveProblemsEmbeddings = pgTable("knowledge_base_objective_problems_embeddings", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id").notNull().references(() => knowledgeBaseObjectiveProblems.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  embeddingVector: text("embedding_vector"),
  modelUsed: text("model_used").notNull().default("text-embedding-3-small"),
  tokensUsed: integer("tokens_used"),
  openaiLogId: integer("openai_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  problemIdUnique: uniqueIndex("idx_kb_objective_problems_embeddings_problem_id").on(table.problemId),
  contentHashIdx: index("idx_kb_objective_problems_embeddings_content_hash").on(table.contentHash),
}));

export type KnowledgeBaseObjectiveProblemsEmbedding = typeof knowledgeBaseObjectiveProblemsEmbeddings.$inferSelect;
export type InsertKnowledgeBaseObjectiveProblemsEmbedding = typeof knowledgeBaseObjectiveProblemsEmbeddings.$inferInsert;

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

export const knowledgeSuggestions = pgTable("knowledge_suggestions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  
  suggestionType: text("suggestion_type").default("create").notNull(),
  
  name: text("name"),
  productStandard: text("product_standard"),
  subproductStandard: text("subproduct_standard"),
  
  description: text("description"),
  resolution: text("resolution"),
  internalActions: text("internal_actions"),
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
  zendeskId: text("zendesk_id").notNull(),
  helpCenterSubdomain: text("help_center_subdomain").notNull(),
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
  zendeskIdSubdomainUnique: uniqueIndex("idx_zendesk_articles_zendesk_id_subdomain").on(table.zendeskId, table.helpCenterSubdomain),
  sectionIdIdx: index("idx_zendesk_articles_section_id").on(table.sectionId),
  localeIdx: index("idx_zendesk_articles_locale").on(table.locale),
  titleIdx: index("idx_zendesk_articles_title").on(table.title),
  helpCenterSubdomainIdx: index("idx_zendesk_articles_help_center_subdomain").on(table.helpCenterSubdomain),
}));

export const zendeskArticleEmbeddings = pgTable("zendesk_article_embeddings", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => zendeskArticles.id, { onDelete: "cascade" }),
  contentHash: text("content_hash").notNull(),
  embeddingVector: text("embedding_vector"),
  modelUsed: text("model_used").notNull().default("text-embedding-3-small"),
  tokensUsed: integer("tokens_used"),
  openaiLogId: integer("openai_log_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  articleIdUnique: uniqueIndex("idx_zendesk_article_embeddings_article_id").on(table.articleId),
  contentHashIdx: index("idx_zendesk_article_embeddings_content_hash").on(table.contentHash),
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

export type KnowledgeBaseEmbedding = typeof knowledgeBaseEmbeddings.$inferSelect;
export type InsertKnowledgeBaseEmbedding = Omit<typeof knowledgeBaseEmbeddings.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type KnowledgeSuggestion = typeof knowledgeSuggestions.$inferSelect;
export type InsertKnowledgeSuggestion = Omit<typeof knowledgeSuggestions.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type ProductCatalog = typeof productsCatalog.$inferSelect;
export type InsertProductCatalog = Omit<typeof productsCatalog.$inferInsert, "id" | "createdAt" | "updatedAt">;

export type LearningAttempt = typeof learningAttempts.$inferSelect;
export type InsertLearningAttempt = Omit<typeof learningAttempts.$inferInsert, "id" | "createdAt">;

export type LearningAttemptResult = "suggestion_created" | "insufficient_messages" | "skipped_by_agent" | "processing_error";

export type ZendeskArticle = typeof zendeskArticles.$inferSelect;
export type InsertZendeskArticle = Omit<typeof zendeskArticles.$inferInsert, "id" | "createdAt" | "updatedAt" | "syncedAt">;

export type ZendeskArticleEmbedding = typeof zendeskArticleEmbeddings.$inferSelect;
export type InsertZendeskArticleEmbedding = Omit<typeof zendeskArticleEmbeddings.$inferInsert, "id" | "createdAt" | "updatedAt">;

// Knowledge Subjects - Assuntos vinculados a produtos
export const knowledgeSubjects = pgTable("knowledge_subjects", {
  id: serial("id").primaryKey(),
  productCatalogId: integer("product_catalog_id").notNull().references(() => productsCatalog.id),
  name: text("name").notNull(),
  synonyms: json("synonyms").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productCatalogIdx: index("idx_knowledge_subjects_product_catalog").on(table.productCatalogId),
  nameIdx: index("idx_knowledge_subjects_name").on(table.name),
}));

export type KnowledgeSubject = typeof knowledgeSubjects.$inferSelect;
export type InsertKnowledgeSubject = Omit<typeof knowledgeSubjects.$inferInsert, "id" | "createdAt" | "updatedAt">;

// Knowledge Intents - Intenções vinculadas a assuntos
export const knowledgeIntents = pgTable("knowledge_intents", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => knowledgeSubjects.id),
  name: text("name").notNull(),
  synonyms: json("synonyms").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  subjectIdx: index("idx_knowledge_intents_subject").on(table.subjectId),
  nameIdx: index("idx_knowledge_intents_name").on(table.name),
}));

export type KnowledgeIntent = typeof knowledgeIntents.$inferSelect;
export type InsertKnowledgeIntent = Omit<typeof knowledgeIntents.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const zendeskArticlesStatistics = pgTable("zendesk_articles_statistics", {
  id: serial("id").primaryKey(),
  zendeskArticleId: integer("zendesk_article_id").notNull(),
  keywords: text("keywords"),
  sectionId: text("section_id"),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  zendeskArticleIdIdx: index("idx_zendesk_articles_statistics_article_id").on(table.zendeskArticleId),
  createdAtIdx: index("idx_zendesk_articles_statistics_created_at").on(table.createdAt),
  conversationIdIdx: index("idx_zendesk_articles_statistics_conversation_id").on(table.conversationId),
}));

export type ZendeskArticleStatistic = typeof zendeskArticlesStatistics.$inferSelect;
export type InsertZendeskArticleStatistic = Omit<typeof zendeskArticlesStatistics.$inferInsert, "id" | "createdAt">;

export const knowledgeBaseStatistics = pgTable("knowledge_base_statistics", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => knowledgeBase.id, { onDelete: "cascade" }),
  keywords: text("keywords"),
  conversationId: integer("conversation_id"),
  externalConversationId: text("external_conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  articleIdIdx: index("idx_knowledge_base_statistics_article_id").on(table.articleId),
  createdAtIdx: index("idx_knowledge_base_statistics_created_at").on(table.createdAt),
  conversationIdIdx: index("idx_knowledge_base_statistics_conversation_id").on(table.conversationId),
}));

export type KnowledgeBaseStatistic = typeof knowledgeBaseStatistics.$inferSelect;
export type InsertKnowledgeBaseStatistic = Omit<typeof knowledgeBaseStatistics.$inferInsert, "id" | "createdAt">;

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

export type RoutingRule = typeof routingRules.$inferSelect;
export type InsertRoutingRule = Omit<typeof routingRules.$inferInsert, "id" | "createdAt" | "updatedAt" | "allocatedCount">;

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

export type RoutingProcessedEvent = typeof routingProcessedEvents.$inferSelect;
export type InsertRoutingProcessedEvent = Omit<typeof routingProcessedEvents.$inferInsert, "id" | "processedAt">;

export const authUsersConversationFavorites = pgTable("auth_users_conversation_favorites", {
  id: serial("id").primaryKey(),
  authUserId: varchar("auth_user_id").notNull(),
  conversationId: integer("conversation_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userConversationUnique: uniqueIndex("idx_favorites_user_conversation").on(table.authUserId, table.conversationId),
  authUserIdx: index("idx_favorites_auth_user").on(table.authUserId),
  conversationIdx: index("idx_favorites_conversation").on(table.conversationId),
}));

export type AuthUserConversationFavorite = typeof authUsersConversationFavorites.$inferSelect;
export type InsertAuthUserConversationFavorite = Omit<typeof authUsersConversationFavorites.$inferInsert, "id" | "createdAt">;

// Knowledge Enrichment Log - Log de processamento de enriquecimento
export const knowledgeEnrichmentLog = pgTable("knowledge_enrichment_log", {
  id: serial("id").primaryKey(),
  intentId: integer("intent_id").notNull(),
  articleId: integer("article_id"),
  action: text("action").notNull(), // 'create' | 'update' | 'skip'
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

export type KnowledgeEnrichmentLog = typeof knowledgeEnrichmentLog.$inferSelect;
export type InsertKnowledgeEnrichmentLog = Omit<typeof knowledgeEnrichmentLog.$inferInsert, "id" | "createdAt">;

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

export type EmbeddingGenerationLog = typeof embeddingGenerationLogs.$inferSelect;
export type InsertEmbeddingGenerationLog = Omit<typeof embeddingGenerationLogs.$inferInsert, "id" | "createdAt">;

export const knowledgeBaseActions = pgTable("knowledge_base_actions", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  requiredInput: text("required_input"),
  messageTemplate: text("message_template"),
  ownerTeam: text("owner_team"),
  sla: text("sla"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  actionTypeIdx: index("idx_kb_actions_action_type").on(table.actionType),
  isActiveIdx: index("idx_kb_actions_is_active").on(table.isActive),
}));

export type KnowledgeBaseAction = typeof knowledgeBaseActions.$inferSelect;
export type InsertKnowledgeBaseAction = Omit<typeof knowledgeBaseActions.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const knowledgeBaseSolutions = pgTable("knowledge_base_solutions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  productId: integer("product_id").references(() => productsCatalog.id),
  conditions: json("conditions").$type<Record<string, unknown>>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdx: index("idx_kb_solutions_product").on(table.productId),
  isActiveIdx: index("idx_kb_solutions_is_active").on(table.isActive),
}));

export type KnowledgeBaseSolution = typeof knowledgeBaseSolutions.$inferSelect;
export type InsertKnowledgeBaseSolution = Omit<typeof knowledgeBaseSolutions.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const knowledgeBaseSolutionsHasKnowledgeBaseActions = pgTable("knowledge_base_solutions_has_knowledge_base_actions", {
  id: serial("id").primaryKey(),
  solutionId: integer("solution_id").notNull().references(() => knowledgeBaseSolutions.id, { onDelete: "cascade" }),
  actionId: integer("action_id").notNull().references(() => knowledgeBaseActions.id, { onDelete: "cascade" }),
  actionSequence: integer("action_sequence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  solutionIdx: index("idx_kb_solutions_has_actions_solution").on(table.solutionId),
  actionIdx: index("idx_kb_solutions_has_actions_action").on(table.actionId),
  uniqueSolutionAction: uniqueIndex("idx_kb_solutions_has_actions_unique").on(table.solutionId, table.actionId),
}));

export type KnowledgeBaseSolutionHasAction = typeof knowledgeBaseSolutionsHasKnowledgeBaseActions.$inferSelect;
export type InsertKnowledgeBaseSolutionHasAction = Omit<typeof knowledgeBaseSolutionsHasKnowledgeBaseActions.$inferInsert, "id" | "createdAt">;

export const knowledgeBaseRootCauses = pgTable("knowledge_base_root_causes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  observedRate30d: numeric("observed_rate_30d", { precision: 6, scale: 5 }),
  observedN30d: bigint("observed_n_30d", { mode: "number" }),
  observedAt: timestamp("observed_at"),
  createdBy: text("created_by").default("system").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  isActiveIdx: index("idx_kb_root_causes_is_active").on(table.isActive),
}));

export type KnowledgeBaseRootCause = typeof knowledgeBaseRootCauses.$inferSelect;
export type InsertKnowledgeBaseRootCause = Omit<typeof knowledgeBaseRootCauses.$inferInsert, "id" | "createdAt" | "updatedAt">;

export interface ValidationQuestion {
  question: string;
  order: number;
}

export const knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems = pgTable("knowledge_base_root_cause_has_knowledge_base_objective_problems", {
  id: serial("id").primaryKey(),
  rootCauseId: integer("root_cause_id").notNull().references(() => knowledgeBaseRootCauses.id, { onDelete: "cascade" }),
  problemId: integer("problem_id").notNull().references(() => knowledgeBaseObjectiveProblems.id, { onDelete: "cascade" }),
  validationQuestions: json("validation_questions").$type<ValidationQuestion[]>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  rootCauseIdx: index("idx_kb_root_cause_problems_root_cause").on(table.rootCauseId),
  problemIdx: index("idx_kb_root_cause_problems_problem").on(table.problemId),
  uniqueLink: uniqueIndex("idx_kb_root_cause_problems_unique").on(table.rootCauseId, table.problemId),
}));

export type KnowledgeBaseRootCauseHasProblem = typeof knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.$inferSelect;
export type InsertKnowledgeBaseRootCauseHasProblem = Omit<typeof knowledgeBaseRootCauseHasKnowledgeBaseObjectiveProblems.$inferInsert, "id" | "createdAt">;

export const knowledgeBaseRootCauseHasKnowledgeBaseSolutions = pgTable("knowledge_base_root_cause_has_knowledge_base_solutions", {
  id: serial("id").primaryKey(),
  rootCauseId: integer("root_cause_id").notNull().references(() => knowledgeBaseRootCauses.id, { onDelete: "cascade" }),
  solutionId: integer("solution_id").notNull().references(() => knowledgeBaseSolutions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  rootCauseIdx: index("idx_kb_root_cause_solutions_root_cause").on(table.rootCauseId),
  solutionIdx: index("idx_kb_root_cause_solutions_solution").on(table.solutionId),
  uniqueLink: uniqueIndex("idx_kb_root_cause_solutions_unique").on(table.rootCauseId, table.solutionId),
}));

export type KnowledgeBaseRootCauseHasSolution = typeof knowledgeBaseRootCauseHasKnowledgeBaseSolutions.$inferSelect;
export type InsertKnowledgeBaseRootCauseHasSolution = Omit<typeof knowledgeBaseRootCauseHasKnowledgeBaseSolutions.$inferInsert, "id" | "createdAt">;

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

export type ZendeskSupportUser = typeof zendeskSupportUsers.$inferSelect;
export type InsertZendeskSupportUser = Omit<typeof zendeskSupportUsers.$inferInsert, "id" | "createdAt" | "updatedAt">;

export const externalDataSyncLogs = pgTable("external_data_sync_logs", {
  id: serial("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
  recordsProcessed: integer("records_processed").default(0).notNull(),
  recordsCreated: integer("records_created").default(0).notNull(),
  recordsUpdated: integer("records_updated").default(0).notNull(),
  recordsDeleted: integer("records_deleted").default(0).notNull(),
  recordsFailed: integer("records_failed").default(0).notNull(),
  errorMessage: text("error_message"),
  errorDetails: json("error_details"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceTypeIdx: index("idx_external_data_sync_logs_source_type").on(table.sourceType),
  statusIdx: index("idx_external_data_sync_logs_status").on(table.status),
  startedAtIdx: index("idx_external_data_sync_logs_started_at").on(table.startedAt.desc()),
}));

export type ExternalDataSyncLog = typeof externalDataSyncLogs.$inferSelect;
export type InsertExternalDataSyncLog = Omit<typeof externalDataSyncLogs.$inferInsert, "id" | "createdAt">;
