DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_base' AND column_name = 'internal_actions') THEN
    ALTER TABLE "knowledge_base" ADD COLUMN "internal_actions" text;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_suggestions' AND column_name = 'internal_actions') THEN
    ALTER TABLE "knowledge_suggestions" ADD COLUMN "internal_actions" text;
  END IF;
END $$;