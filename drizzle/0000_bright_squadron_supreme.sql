CREATE TABLE "auth_users" (
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
CREATE TABLE "auth_users_conversation_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_user_id" varchar NOT NULL,
	"conversation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorized_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"last_access" timestamp,
	CONSTRAINT "authorized_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
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
CREATE TABLE "zendesk_api_logs" (
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
CREATE TABLE "zendesk_conversations_webhook_raw" (
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
CREATE TABLE "zendesk_support_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"zendesk_id" bigint NOT NULL,
	"url" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"shared_phone_number" boolean,
	"alias" text,
	"role" text,
	"role_type" integer,
	"custom_role_id" integer,
	"verified" boolean,
	"active" boolean,
	"suspended" boolean,
	"moderator" boolean,
	"restricted_agent" boolean,
	"organization_id" bigint,
	"default_group_id" bigint,
	"time_zone" text,
	"iana_time_zone" text,
	"locale" text,
	"locale_id" integer,
	"details" text,
	"notes" text,
	"signature" text,
	"tags" json,
	"external_id" text,
	"ticket_restriction" text,
	"only_private_comments" boolean,
	"chat_only" boolean,
	"shared" boolean,
	"shared_agent" boolean,
	"two_factor_auth_enabled" boolean,
	"zendesk_created_at" timestamp,
	"zendesk_updated_at" timestamp,
	"last_login_at" timestamp,
	"user_fields" json,
	"photo" json,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zendesk_support_users_zendesk_id_unique" UNIQUE("zendesk_id")
);
--> statement-breakpoint
CREATE TABLE "case_demand" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"articles_and_objective_problems" json,
	"articles_and_objective_problems_top_match" json,
	"solution_center_articles_and_problems" json,
	"solution_center_article_and_problems_id_selected" text,
	"demand_finder_ai_response" json,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'not_started',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
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
	"handled_by_n1ago" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata_json" json,
	CONSTRAINT "conversations_external_conversation_id_unique" UNIQUE("external_conversation_id")
);
--> statement-breakpoint
CREATE TABLE "conversations_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"external_conversation_id" text,
	"summary" text NOT NULL,
	"client_request" text,
	"agent_actions" text,
	"current_status" text,
	"orchestrator_status" text DEFAULT 'new',
	"conversation_owner" text,
	"waiting_for_customer" boolean DEFAULT false,
	"last_processed_event_id" integer,
	"important_info" text,
	"last_event_id" integer,
	"product_id" integer,
	"product_confidence" integer,
	"product_confidence_reason" text,
	"classified_at" timestamp,
	"customer_emotion_level" integer,
	"customer_request_type" text,
	"customer_request_type_confidence" integer,
	"customer_request_type_reason" text,
	"objective_problems" json,
	"client_request_versions" json,
	"conversation_orchestrator_log" json DEFAULT '[]'::json,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_type_mappings" (
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
CREATE TABLE "events_standard" (
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
CREATE TABLE "external_event_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer,
	"api_key_prefix" text,
	"action" text NOT NULL,
	"endpoint" text NOT NULL,
	"event_count" integer DEFAULT 1 NOT NULL,
	"status_code" integer NOT NULL,
	"error_message" text,
	"request_source" text,
	"request_channel_type" text,
	"ip_address" text,
	"user_agent" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_event_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"channel_type" text NOT NULL,
	"api_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"last_rotated_at" timestamp,
	CONSTRAINT "external_event_sources_source_unique" UNIQUE("source")
);
--> statement-breakpoint
CREATE TABLE "responses_suggested" (
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
CREATE TABLE "case_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_solution_id" integer NOT NULL,
	"action_id" integer NOT NULL,
	"action_sequence" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_used" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_solutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"solution_id" integer,
	"root_cause_id" integer,
	"status" text DEFAULT 'pending_info' NOT NULL,
	"provided_inputs" jsonb DEFAULT '{}'::jsonb,
	"collected_inputs_customer" jsonb DEFAULT '{}'::jsonb,
	"collected_inputs_systems" jsonb DEFAULT '{}'::jsonb,
	"pending_inputs" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto" text NOT NULL,
	"subproduto" text,
	"full_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations_standard" (
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
CREATE TABLE "organizations_standard_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_cnpj_root" varchar NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "user_standard_has_organization_standard" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_standard_id" integer NOT NULL,
	"organization_standard_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_standard" (
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
CREATE TABLE "users_standard_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" varchar NOT NULL,
	"field_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "openai_api_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_type" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"trigger_event_types" json DEFAULT '[]'::json NOT NULL,
	"trigger_author_types" json DEFAULT '[]'::json NOT NULL,
	"prompt_system" text,
	"prompt_template" text NOT NULL,
	"response_format" text,
	"model_name" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openai_api_config_general" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openai_api_logs" (
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
CREATE TABLE "routing_processed_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_conversation_id" text NOT NULL,
	"rule_id" integer NOT NULL,
	"rule_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_type" text NOT NULL,
	"target" text NOT NULL,
	"allocate_count" integer,
	"allocated_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"auth_filter" text DEFAULT 'all' NOT NULL,
	"match_text" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "external_data_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_created" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"records_deleted" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_details" json,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archive_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"archive_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"records_archived" integer DEFAULT 0 NOT NULL,
	"records_deleted" integer DEFAULT 0 NOT NULL,
	"file_path" text,
	"file_size" integer,
	"last_processed_hour" integer,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"query_hash" text NOT NULL,
	"query_normalized" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"rows_affected" integer,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"query_hash" text NOT NULL,
	"query_normalized" text NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	"avg_duration_ms" real DEFAULT 0 NOT NULL,
	"max_duration_ms" integer DEFAULT 0 NOT NULL,
	"min_duration_ms" integer DEFAULT 0 NOT NULL,
	"last_called_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "query_stats_query_hash_unique" UNIQUE("query_hash")
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "case_demand" ADD CONSTRAINT "case_demand_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD CONSTRAINT "conversations_summary_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_actions" ADD CONSTRAINT "case_actions_case_solution_id_case_solutions_id_fk" FOREIGN KEY ("case_solution_id") REFERENCES "public"."case_solutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_favorites_user_conversation" ON "auth_users_conversation_favorites" USING btree ("auth_user_id","conversation_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_auth_user" ON "auth_users_conversation_favorites" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_conversation" ON "auth_users_conversation_favorites" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_zendesk_api_logs_conversation_id" ON "zendesk_api_logs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_zendesk_api_logs_request_type" ON "zendesk_api_logs" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "idx_zendesk_api_logs_created_at" ON "zendesk_api_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_zendesk_webhook_received_at" ON "zendesk_conversations_webhook_raw" USING btree ("received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_zendesk_webhook_processing_status" ON "zendesk_conversations_webhook_raw" USING btree ("processing_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_zendesk_support_users_zendesk_id" ON "zendesk_support_users" USING btree ("zendesk_id");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_email" ON "zendesk_support_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_role" ON "zendesk_support_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_organization" ON "zendesk_support_users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_active" ON "zendesk_support_users" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_case_demand_conversation_id" ON "case_demand" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_user_id" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_updated_at" ON "conversations" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_conversations_handled_by_n1ago" ON "conversations" USING btree ("handled_by_n1ago");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_conversations_summary_conversation_id" ON "conversations_summary" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_type_mappings_unique" ON "event_type_mappings" USING btree ("source","event_type");--> statement-breakpoint
CREATE INDEX "idx_events_standard_occurred_at" ON "events_standard" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_events_standard_conversation_event" ON "events_standard" USING btree ("conversation_id","event_type");--> statement-breakpoint
CREATE INDEX "idx_events_standard_source" ON "events_standard" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_events_standard_event_type" ON "events_standard" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_events_standard_source_event_id" ON "events_standard" USING btree ("source","source_event_id");--> statement-breakpoint
CREATE INDEX "idx_external_event_audit_logs_source_id" ON "external_event_audit_logs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_external_event_audit_logs_action" ON "external_event_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_external_event_audit_logs_created_at" ON "external_event_audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_external_event_sources_source" ON "external_event_sources" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_external_event_sources_api_key" ON "external_event_sources" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_responses_suggested_conversation_id" ON "responses_suggested" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_case_actions_case_solution" ON "case_actions" USING btree ("case_solution_id");--> statement-breakpoint
CREATE INDEX "idx_case_actions_action" ON "case_actions" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_case_actions_status" ON "case_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_case_solutions_conversation" ON "case_solutions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_case_solutions_solution" ON "case_solutions" USING btree ("solution_id");--> statement-breakpoint
CREATE INDEX "idx_case_solutions_status" ON "case_solutions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_case_solutions_created_at" ON "case_solutions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ifood_products_produto" ON "products_catalog" USING btree ("produto");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ifood_products_full_name" ON "products_catalog" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_organizations_standard_cnpj_root" ON "organizations_standard" USING btree ("cnpj_root");--> statement-breakpoint
CREATE INDEX "idx_organizations_standard_cnpj" ON "organizations_standard" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "idx_organizations_standard_source" ON "organizations_standard" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_organizations_standard_history_cnpj_root" ON "organizations_standard_history" USING btree ("organization_cnpj_root");--> statement-breakpoint
CREATE INDEX "idx_organizations_standard_history_changed_at" ON "organizations_standard_history" USING btree ("changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_org_unique" ON "user_standard_has_organization_standard" USING btree ("user_standard_id","organization_standard_id");--> statement-breakpoint
CREATE INDEX "idx_user_standard_has_org_user" ON "user_standard_has_organization_standard" USING btree ("user_standard_id");--> statement-breakpoint
CREATE INDEX "idx_user_standard_has_org_org" ON "user_standard_has_organization_standard" USING btree ("organization_standard_id");--> statement-breakpoint
CREATE INDEX "idx_users_standard_cpf" ON "users_standard" USING btree ("cpf");--> statement-breakpoint
CREATE INDEX "idx_users_standard_source" ON "users_standard" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_users_standard_history_email" ON "users_standard_history" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_users_standard_history_changed_at" ON "users_standard_history" USING btree ("changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_openai_api_config_type" ON "openai_api_config" USING btree ("config_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_openai_api_config_general_type" ON "openai_api_config_general" USING btree ("config_type");--> statement-breakpoint
CREATE INDEX "idx_openai_api_logs_created_at" ON "openai_api_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_routing_processed_conversation_rule_type" ON "routing_processed_events" USING btree ("external_conversation_id","rule_type");--> statement-breakpoint
CREATE INDEX "idx_routing_processed_expires_at" ON "routing_processed_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_routing_processed_rule_id" ON "routing_processed_events" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "idx_routing_rules_rule_type" ON "routing_rules" USING btree ("rule_type");--> statement-breakpoint
CREATE INDEX "idx_routing_rules_is_active" ON "routing_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_source_type" ON "external_data_sync_logs" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_status" ON "external_data_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_started_at" ON "external_data_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_archive_jobs_table_name" ON "archive_jobs" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "idx_archive_jobs_status" ON "archive_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_jobs_archive_date" ON "archive_jobs" USING btree ("archive_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_query_logs_query_hash" ON "query_logs" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "idx_query_logs_created_at" ON "query_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_query_logs_duration" ON "query_logs" USING btree ("duration_ms" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_query_stats_call_count" ON "query_stats" USING btree ("call_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_query_stats_avg_duration" ON "query_stats" USING btree ("avg_duration_ms" DESC NULLS LAST);