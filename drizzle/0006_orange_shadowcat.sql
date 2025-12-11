DROP INDEX IF EXISTS "idx_knowledge_base_intent";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_knowledge_base_category1";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_users_standard_email";--> statement-breakpoint
ALTER TABLE "routing_rules" ADD COLUMN IF NOT EXISTS "match_text" text;--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN IF EXISTS "category1";--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN IF EXISTS "category2";--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN IF EXISTS "intent";--> statement-breakpoint
ALTER TABLE "knowledge_suggestions" DROP COLUMN IF EXISTS "category1";--> statement-breakpoint
ALTER TABLE "knowledge_suggestions" DROP COLUMN IF EXISTS "category2";