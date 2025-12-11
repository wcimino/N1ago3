CREATE TABLE "knowledge_base_statistics" (
        "id" serial PRIMARY KEY NOT NULL,
        "article_id" integer NOT NULL,
        "keywords" text,
        "conversation_id" integer,
        "external_conversation_id" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_base_statistics" ADD CONSTRAINT "knowledge_base_statistics_article_id_knowledge_base_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_statistics_article_id" ON "knowledge_base_statistics" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_statistics_created_at" ON "knowledge_base_statistics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_knowledge_base_statistics_conversation_id" ON "knowledge_base_statistics" USING btree ("conversation_id");--> statement-breakpoint
-- These indexes already exist from migration 0005 (with DESC ordering)
-- Using IF NOT EXISTS to avoid conflicts and sync Drizzle state with actual DB
CREATE INDEX IF NOT EXISTS "idx_conversations_updated_at" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_standard_occurred_at" ON "events_standard" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_openai_api_logs_created_at" ON "openai_api_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_webhook_received_at" ON "zendesk_conversations_webhook_raw" USING btree ("received_at");