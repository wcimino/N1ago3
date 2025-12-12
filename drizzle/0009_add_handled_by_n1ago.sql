-- Add handled_by_n1ago field to conversations table
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "handled_by_n1ago" boolean DEFAULT false NOT NULL;

-- Create index for filtering by handled_by_n1ago
CREATE INDEX IF NOT EXISTS "idx_conversations_handled_by_n1ago" ON "conversations" USING btree ("handled_by_n1ago");
