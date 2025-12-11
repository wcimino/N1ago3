DROP INDEX "idx_knowledge_base_intent";--> statement-breakpoint
DROP INDEX "idx_knowledge_base_category1";--> statement-breakpoint
DROP INDEX "idx_users_standard_email";--> statement-breakpoint
ALTER TABLE "routing_rules" ADD COLUMN "match_text" text;--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN "category1";--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN "category2";--> statement-breakpoint
ALTER TABLE "knowledge_base" DROP COLUMN "intent";--> statement-breakpoint
ALTER TABLE "knowledge_suggestions" DROP COLUMN "category1";--> statement-breakpoint
ALTER TABLE "knowledge_suggestions" DROP COLUMN "category2";