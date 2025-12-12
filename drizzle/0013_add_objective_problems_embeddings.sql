CREATE TABLE "knowledge_base_objective_problems_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"problem_id" integer NOT NULL,
	"content_hash" text NOT NULL,
	"embedding_vector" text,
	"model_used" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"tokens_used" integer,
	"openai_log_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_base_objective_problems" DROP CONSTRAINT "knowledge_base_objective_problems_name_unique";--> statement-breakpoint
DROP INDEX "idx_kb_objective_problems_name";--> statement-breakpoint
ALTER TABLE "knowledge_base_objective_problems_embeddings" ADD CONSTRAINT "knowledge_base_objective_problems_embeddings_problem_id_knowledge_base_objective_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."knowledge_base_objective_problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_objective_problems_embeddings_problem_id" ON "knowledge_base_objective_problems_embeddings" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "idx_kb_objective_problems_embeddings_content_hash" ON "knowledge_base_objective_problems_embeddings" USING btree ("content_hash");