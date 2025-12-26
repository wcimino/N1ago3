-- Add client_hub_data column to conversations_summary
ALTER TABLE "conversations_summary" ADD COLUMN IF NOT EXISTS "client_hub_data" json;

-- Create client_hub_api_logs table
CREATE TABLE IF NOT EXISTS "client_hub_api_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "conversation_id" integer,
  "account_ref" text,
  "request_url" text NOT NULL,
  "response_status" integer,
  "response_data" json,
  "success" boolean NOT NULL,
  "error_message" text,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_client_hub_api_logs_conversation_id" ON "client_hub_api_logs" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_client_hub_api_logs_account_ref" ON "client_hub_api_logs" ("account_ref");
CREATE INDEX IF NOT EXISTS "idx_client_hub_api_logs_created_at" ON "client_hub_api_logs" ("created_at");
