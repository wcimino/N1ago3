-- Recreate case_solutions and case_actions tables
-- These tables track solutions and actions applied to customer service cases
-- Note: FK constraints to knowledge_base tables are removed since those tables were dropped

CREATE TABLE IF NOT EXISTS "case_solutions" (
  "id" serial PRIMARY KEY NOT NULL,
  "conversation_id" integer NOT NULL,
  "solution_id" integer,
  "root_cause_id" integer,
  "status" text DEFAULT 'pending_info' NOT NULL,
  "provided_inputs" json DEFAULT '{}',
  "collected_inputs_customer" json DEFAULT '{}',
  "collected_inputs_systems" json DEFAULT '{}',
  "pending_inputs" json DEFAULT '[]',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "case_actions" (
  "id" serial PRIMARY KEY NOT NULL,
  "case_solution_id" integer NOT NULL REFERENCES "case_solutions"("id") ON DELETE CASCADE,
  "action_id" integer NOT NULL,
  "action_sequence" integer NOT NULL,
  "status" text DEFAULT 'not_started' NOT NULL,
  "input_used" json DEFAULT '{}',
  "output" json,
  "error_message" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_case_solutions_conversation" ON "case_solutions" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_case_solutions_solution" ON "case_solutions" ("solution_id");
CREATE INDEX IF NOT EXISTS "idx_case_solutions_status" ON "case_solutions" ("status");
CREATE INDEX IF NOT EXISTS "idx_case_solutions_created_at" ON "case_solutions" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_case_actions_case_solution" ON "case_actions" ("case_solution_id");
CREATE INDEX IF NOT EXISTS "idx_case_actions_action" ON "case_actions" ("action_id");
CREATE INDEX IF NOT EXISTS "idx_case_actions_status" ON "case_actions" ("status");
