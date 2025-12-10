ALTER TABLE "conversations_summary" ADD COLUMN "subproduct" text;--> statement-breakpoint
ALTER TABLE "conversations_summary" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "openai_api_config" ADD COLUMN "use_subject_intent_tool" boolean DEFAULT false NOT NULL;