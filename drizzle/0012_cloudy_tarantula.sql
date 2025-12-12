DO $$ BEGIN
  ALTER TABLE "conversations_summary" ADD COLUMN IF NOT EXISTS "customer_request_type" text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conversations_summary" ADD COLUMN IF NOT EXISTS "objective_problems" json;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
