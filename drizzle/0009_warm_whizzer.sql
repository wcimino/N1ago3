CREATE TABLE "knowledge_base_objective_problems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"synonyms" json DEFAULT '[]'::json,
	"examples" json DEFAULT '[]'::json,
	"presented_by" text DEFAULT 'customer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_base_objective_problems_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "handled_by_n1ago" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_kb_objective_problems_name" ON "knowledge_base_objective_problems" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_kb_objective_problems_presented_by" ON "knowledge_base_objective_problems" USING btree ("presented_by");--> statement-breakpoint
CREATE INDEX "idx_kb_objective_problems_is_active" ON "knowledge_base_objective_problems" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_conversations_handled_by_n1ago" ON "conversations" USING btree ("handled_by_n1ago");