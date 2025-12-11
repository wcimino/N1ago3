DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations_summary' AND column_name = 'subproduct') THEN
    ALTER TABLE "conversations_summary" ADD COLUMN "subproduct" text;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations_summary' AND column_name = 'subject') THEN
    ALTER TABLE "conversations_summary" ADD COLUMN "subject" text;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'openai_api_config' AND column_name = 'use_subject_intent_tool') THEN
    ALTER TABLE "openai_api_config" ADD COLUMN "use_subject_intent_tool" boolean DEFAULT false NOT NULL;
  END IF;
END $$;