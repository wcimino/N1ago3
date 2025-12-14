CREATE TABLE "routing_processed_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_conversation_id" text NOT NULL,
	"rule_id" integer NOT NULL,
	"rule_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_external_data_sync_logs_started_at";--> statement-breakpoint
ALTER TABLE "knowledge_suggestions" ALTER COLUMN "reviewed_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD COLUMN "orchestrator_status" text DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD COLUMN "articles_and_objective_problems" json;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD COLUMN "product_id" integer;--> statement-breakpoint
ALTER TABLE "openai_api_config" ADD COLUMN "use_combined_knowledge_search_tool" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "openai_api_config" ADD COLUMN "use_knowledge_suggestion_tool" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_routing_processed_conversation_rule_type" ON "routing_processed_events" USING btree ("external_conversation_id","rule_type");--> statement-breakpoint
CREATE INDEX "idx_routing_processed_expires_at" ON "routing_processed_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_routing_processed_rule_id" ON "routing_processed_events" USING btree ("rule_id");--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD CONSTRAINT "conversations_summary_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_product_id" ON "knowledge_base" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_external_data_sync_logs_started_at" ON "external_data_sync_logs" USING btree ("started_at");