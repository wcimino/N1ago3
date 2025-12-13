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
CREATE TABLE "knowledge_base_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"action_type" text NOT NULL,
	"description" text NOT NULL,
	"required_input" text,
	"message_template" text,
	"owner_team" text,
	"sla" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_root_cause_has_knowledge_base_objective_problems" (
	"id" serial PRIMARY KEY NOT NULL,
	"root_cause_id" integer NOT NULL,
	"problem_id" integer NOT NULL,
	"validation_questions" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_root_cause_has_knowledge_base_solutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"root_cause_id" integer NOT NULL,
	"solution_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_root_causes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"observed_rate_30d" numeric(6, 5),
	"observed_n_30d" bigint,
	"observed_at" timestamp,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_solutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"product_id" integer,
	"conditions" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_solutions_has_knowledge_base_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"solution_id" integer NOT NULL,
	"action_id" integer NOT NULL,
	"action_sequence" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "knowledge_base_root_cause_has_knowledge_base_objective_problems" ADD CONSTRAINT "knowledge_base_root_cause_has_knowledge_base_objective_problems_root_cause_id_knowledge_base_root_causes_id_fk" FOREIGN KEY ("root_cause_id") REFERENCES "public"."knowledge_base_root_causes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_root_cause_has_knowledge_base_objective_problems" ADD CONSTRAINT "knowledge_base_root_cause_has_knowledge_base_objective_problems_problem_id_knowledge_base_objective_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."knowledge_base_objective_problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_root_cause_has_knowledge_base_solutions" ADD CONSTRAINT "knowledge_base_root_cause_has_knowledge_base_solutions_root_cause_id_knowledge_base_root_causes_id_fk" FOREIGN KEY ("root_cause_id") REFERENCES "public"."knowledge_base_root_causes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_root_cause_has_knowledge_base_solutions" ADD CONSTRAINT "knowledge_base_root_cause_has_knowledge_base_solutions_solution_id_knowledge_base_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."knowledge_base_solutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_solutions" ADD CONSTRAINT "knowledge_base_solutions_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_solutions_has_knowledge_base_actions" ADD CONSTRAINT "knowledge_base_solutions_has_knowledge_base_actions_solution_id_knowledge_base_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."knowledge_base_solutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_solutions_has_knowledge_base_actions" ADD CONSTRAINT "knowledge_base_solutions_has_knowledge_base_actions_action_id_knowledge_base_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."knowledge_base_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_source_type" ON "external_data_sync_logs" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_status" ON "external_data_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_started_at" ON "external_data_sync_logs" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_kb_actions_action_type" ON "knowledge_base_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_kb_actions_is_active" ON "knowledge_base_actions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_kb_root_cause_problems_root_cause" ON "knowledge_base_root_cause_has_knowledge_base_objective_problems" USING btree ("root_cause_id");--> statement-breakpoint
CREATE INDEX "idx_kb_root_cause_problems_problem" ON "knowledge_base_root_cause_has_knowledge_base_objective_problems" USING btree ("problem_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_root_cause_problems_unique" ON "knowledge_base_root_cause_has_knowledge_base_objective_problems" USING btree ("root_cause_id","problem_id");--> statement-breakpoint
CREATE INDEX "idx_kb_root_cause_solutions_root_cause" ON "knowledge_base_root_cause_has_knowledge_base_solutions" USING btree ("root_cause_id");--> statement-breakpoint
CREATE INDEX "idx_kb_root_cause_solutions_solution" ON "knowledge_base_root_cause_has_knowledge_base_solutions" USING btree ("solution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_root_cause_solutions_unique" ON "knowledge_base_root_cause_has_knowledge_base_solutions" USING btree ("root_cause_id","solution_id");--> statement-breakpoint
CREATE INDEX "idx_kb_root_causes_is_active" ON "knowledge_base_root_causes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_kb_solutions_product" ON "knowledge_base_solutions" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_kb_solutions_is_active" ON "knowledge_base_solutions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_kb_solutions_has_actions_solution" ON "knowledge_base_solutions_has_knowledge_base_actions" USING btree ("solution_id");--> statement-breakpoint
CREATE INDEX "idx_kb_solutions_has_actions_action" ON "knowledge_base_solutions_has_knowledge_base_actions" USING btree ("action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_solutions_has_actions_unique" ON "knowledge_base_solutions_has_knowledge_base_actions" USING btree ("solution_id","action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_zendesk_support_users_zendesk_id" ON "zendesk_support_users" USING btree ("zendesk_id");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_email" ON "zendesk_support_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_role" ON "zendesk_support_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_organization" ON "zendesk_support_users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_zendesk_support_users_active" ON "zendesk_support_users" USING btree ("active");