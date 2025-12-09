CREATE TABLE IF NOT EXISTS "auth_users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_users_conversation_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_user_id" varchar NOT NULL,
	"conversation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "authorized_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"last_access" timestamp,
	CONSTRAINT "authorized_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_conversation_id" text NOT NULL,
	"external_app_id" text,
	"user_id" text,
	"user_external_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"external_status" text,
	"closed_at" timestamp,
	"closed_reason" text,
	"current_handler" text,
	"current_handler_name" text,
	"autopilot_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata_json" json,
	CONSTRAINT "conversations_external_conversation_id_unique" UNIQUE("external_conversation_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"external_conversation_id" text,
	"summary" text NOT NULL,
	"client_request" text,
	"agent_actions" text,
	"current_status" text,
	"important_info" text,
	"last_event_id" integer,
	"product" text,
	"product_standard" text,
	"intent" text,
	"confidence" integer,
	"classified_at" timestamp,
	"customer_emotion_level" integer,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_type_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"show_in_list" boolean DEFAULT true NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events_standard" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"event_subtype" text,
	"source" text NOT NULL,
	"source_event_id" text,
	"source_raw_id" integer,
	"conversation_id" integer,
	"external_conversation_id" text,
	"user_id" integer,
	"external_user_id" text,
	"author_type" text NOT NULL,
	"author_id" text,
	"author_name" text,
	"content_text" text,
	"content_payload" json,
	"occurred_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"metadata" json,
	"channel_type" text,
	"processing_status" text DEFAULT 'processed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto" text NOT NULL,
	"subproduto" text,
	"full_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"product_standard" text NOT NULL,
	"subproduct_standard" text,
	"category1" text,
	"category2" text,
	"subject_id" integer,
	"intent_id" integer,
	"intent" text NOT NULL,
	"description" text NOT NULL,
	"resolution" text NOT NULL,
	"observations" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_intents" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"name" text NOT NULL,
	"synonyms" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_catalog_id" integer NOT NULL,
	"name" text NOT NULL,
	"synonyms" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"external_conversation_id" text,
	"suggestion_type" text DEFAULT 'create' NOT NULL,
	"name" text,
	"product_standard" text,
	"subproduct_standard" text,
	"category1" text,
	"category2" text,
	"description" text,
	"resolution" text,
	"observations" text,
	"confidence_score" integer,
	"quality_flags" json,
	"similar_article_id" integer,
	"similarity_score" integer,
	"update_reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"conversation_handler" text,
	"extracted_from_messages" json,
	"raw_extraction" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"external_conversation_id" text,
	"result" text NOT NULL,
	"result_reason" text,
	"suggestion_id" integer,
	"message_count" integer,
	"openai_log_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "openai_api_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_type" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"trigger_event_types" json DEFAULT '[]'::json NOT NULL,
	"trigger_author_types" json DEFAULT '[]'::json NOT NULL,
	"prompt_system" text,
	"prompt_template" text NOT NULL,
	"response_format" text,
	"model_name" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"use_knowledge_base_tool" boolean DEFAULT false NOT NULL,
	"use_product_catalog_tool" boolean DEFAULT false NOT NULL,
	"use_zendesk_knowledge_base_tool" boolean DEFAULT false NOT NULL,
	"use_general_settings" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "openai_api_config_general" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "openai_api_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" text NOT NULL,
	"model_name" text NOT NULL,
	"prompt_system" text,
	"prompt_user" text NOT NULL,
	"response_raw" json,
	"response_content" text,
	"tokens_prompt" integer,
	"tokens_completion" integer,
	"tokens_total" integer,
	"duration_ms" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"context_type" text,
	"context_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations_standard" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" varchar,
	"cnpj_root" varchar NOT NULL,
	"source" text NOT NULL,
	"name" text,
	"metadata" json,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_standard_cnpj_root_unique" UNIQUE("cnpj_root")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations_standard_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_cnpj_root" varchar NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"source" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "responses_suggested" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"external_conversation_id" text,
	"suggested_response" text NOT NULL,
	"last_event_id" integer,
	"openai_log_id" integer,
	"in_response_to" text,
	"status" text DEFAULT 'created' NOT NULL,
	"used_at" timestamp,
	"dismissed" boolean DEFAULT false NOT NULL,
	"articles_used" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_type" text NOT NULL,
	"target" text NOT NULL,
	"allocate_count" integer,
	"allocated_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"auth_filter" text DEFAULT 'all' NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_standard_has_organization_standard" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_standard_id" integer NOT NULL,
	"organization_standard_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"sunshine_id" text NOT NULL,
	"external_id" text,
	"signed_up_at" timestamp,
	"authenticated" boolean DEFAULT false NOT NULL,
	"profile" json,
	"metadata" json,
	"identities" json,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_sunshine_id_unique" UNIQUE("sunshine_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users_standard" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"source" text NOT NULL,
	"source_user_id" text,
	"external_id" text,
	"name" text,
	"cpf" text,
	"phone" text,
	"locale" text,
	"signed_up_at" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_standard_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users_standard_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" varchar NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"source" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zendesk_api_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_type" text NOT NULL,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"conversation_id" text,
	"request_payload" json,
	"response_raw" json,
	"response_status" integer,
	"duration_ms" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"context_type" text,
	"context_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zendesk_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"zendesk_id" text NOT NULL,
	"help_center_subdomain" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"section_id" text,
	"section_name" text,
	"category_id" text,
	"category_name" text,
	"author_id" text,
	"locale" text,
	"html_url" text,
	"draft" boolean DEFAULT false NOT NULL,
	"promoted" boolean DEFAULT false NOT NULL,
	"position" integer,
	"vote_sum" integer,
	"vote_count" integer,
	"label_names" json,
	"zendesk_created_at" timestamp,
	"zendesk_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zendesk_articles_statistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"zendesk_article_id" integer NOT NULL,
	"keywords" text,
	"section_id" text,
	"conversation_id" integer,
	"external_conversation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zendesk_conversations_webhook_raw" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'zendesk' NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"source_ip" text,
	"headers" json,
	"payload" json,
	"raw_body" text,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"processed_at" timestamp,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"events_created_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_favorites_user_conversation" ON "auth_users_conversation_favorites" ("auth_user_id","conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_favorites_auth_user" ON "auth_users_conversation_favorites" ("auth_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_favorites_conversation" ON "auth_users_conversation_favorites" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_user_id" ON "conversations" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_updated_at" ON "conversations" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_status" ON "conversations" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_conversations_summary_conversation_id" ON "conversations_summary" ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_event_type_mappings_unique" ON "event_type_mappings" ("source","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_standard_occurred_at" ON "events_standard" ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_standard_conversation_event" ON "events_standard" ("conversation_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_standard_source" ON "events_standard" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_standard_event_type" ON "events_standard" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ifood_products_produto" ON "products_catalog" ("produto");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ifood_products_full_name" ON "products_catalog" ("full_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_product" ON "knowledge_base" ("product_standard");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_intent" ON "knowledge_base" ("intent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_category1" ON "knowledge_base" ("category1");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_subject" ON "knowledge_base" ("subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_intent_id" ON "knowledge_base" ("intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_intents_subject" ON "knowledge_intents" ("subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_intents_name" ON "knowledge_intents" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_subjects_product_catalog" ON "knowledge_subjects" ("product_catalog_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_subjects_name" ON "knowledge_subjects" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_suggestions_status" ON "knowledge_suggestions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_suggestions_conversation" ON "knowledge_suggestions" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_suggestions_product" ON "knowledge_suggestions" ("product_standard");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_suggestions_created_at" ON "knowledge_suggestions" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_attempts_conversation" ON "learning_attempts" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_attempts_result" ON "learning_attempts" ("result");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_attempts_created_at" ON "learning_attempts" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_openai_api_config_type" ON "openai_api_config" ("config_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_openai_api_config_general_type" ON "openai_api_config_general" ("config_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_organizations_standard_cnpj_root" ON "organizations_standard" ("cnpj_root");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_standard_cnpj" ON "organizations_standard" ("cnpj");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_standard_source" ON "organizations_standard" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_standard_history_cnpj_root" ON "organizations_standard_history" ("organization_cnpj_root");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organizations_standard_history_changed_at" ON "organizations_standard_history" ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_responses_suggested_conversation_id" ON "responses_suggested" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_routing_rules_rule_type" ON "routing_rules" ("rule_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_routing_rules_is_active" ON "routing_rules" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_org_unique" ON "user_standard_has_organization_standard" ("user_standard_id","organization_standard_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_standard_has_org_user" ON "user_standard_has_organization_standard" ("user_standard_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_standard_has_org_org" ON "user_standard_has_organization_standard" ("organization_standard_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_standard_email" ON "users_standard" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_standard_cpf" ON "users_standard" ("cpf");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_standard_source" ON "users_standard" ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_standard_history_email" ON "users_standard_history" ("user_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_standard_history_changed_at" ON "users_standard_history" ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_api_logs_conversation_id" ON "zendesk_api_logs" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_api_logs_request_type" ON "zendesk_api_logs" ("request_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_api_logs_created_at" ON "zendesk_api_logs" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_zendesk_articles_zendesk_id_subdomain" ON "zendesk_articles" ("zendesk_id","help_center_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_section_id" ON "zendesk_articles" ("section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_locale" ON "zendesk_articles" ("locale");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_title" ON "zendesk_articles" ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_help_center_subdomain" ON "zendesk_articles" ("help_center_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_statistics_article_id" ON "zendesk_articles_statistics" ("zendesk_article_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_statistics_created_at" ON "zendesk_articles_statistics" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_articles_statistics_conversation_id" ON "zendesk_articles_statistics" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_webhook_received_at" ON "zendesk_conversations_webhook_raw" ("received_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_webhook_processing_status" ON "zendesk_conversations_webhook_raw" ("processing_status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_intents" ADD CONSTRAINT "knowledge_intents_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "knowledge_subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_subjects" ADD CONSTRAINT "knowledge_subjects_product_catalog_id_products_catalog_id_fk" FOREIGN KEY ("product_catalog_id") REFERENCES "products_catalog"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
