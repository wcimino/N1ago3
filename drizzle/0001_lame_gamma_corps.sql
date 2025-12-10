CREATE TABLE IF NOT EXISTS "embedding_generation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer,
	"zendesk_id" text,
	"status" text NOT NULL,
	"error_message" text,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_base_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"content_hash" text NOT NULL,
	"embedding_vector" text,
	"model_used" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"tokens_used" integer,
	"openai_log_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_enrichment_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"intent_id" integer NOT NULL,
	"article_id" integer,
	"action" text NOT NULL,
	"outcome_reason" text,
	"suggestion_id" integer,
	"source_articles" json,
	"confidence_score" integer,
	"product_standard" text,
	"outcome_payload" json,
	"openai_log_id" integer,
	"trigger_run_id" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zendesk_article_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"content_hash" text NOT NULL,
	"embedding_vector" text,
	"model_used" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"tokens_used" integer,
	"openai_log_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embedding_logs_status" ON "embedding_generation_logs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embedding_logs_created_at" ON "embedding_generation_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embedding_logs_article_id" ON "embedding_generation_logs" ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_knowledge_base_embeddings_article_id" ON "knowledge_base_embeddings" ("article_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_embeddings_content_hash" ON "knowledge_base_embeddings" ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_enrichment_log_action_product" ON "knowledge_enrichment_log" ("action","product_standard","processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_enrichment_log_intent" ON "knowledge_enrichment_log" ("intent_id","processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_enrichment_log_trigger_run" ON "knowledge_enrichment_log" ("trigger_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_zendesk_article_embeddings_article_id" ON "zendesk_article_embeddings" ("article_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_article_embeddings_content_hash" ON "zendesk_article_embeddings" ("content_hash");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_base_embeddings" ADD CONSTRAINT "knowledge_base_embeddings_article_id_knowledge_base_id_fk" FOREIGN KEY ("article_id") REFERENCES "knowledge_base"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zendesk_article_embeddings" ADD CONSTRAINT "zendesk_article_embeddings_article_id_zendesk_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "zendesk_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
