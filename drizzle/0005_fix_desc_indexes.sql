-- Fix DESC indexes to prevent repeated migrations
-- This migration explicitly creates the indexes with DESC ordering
-- to match the schema definition and stop the DROP/CREATE cycle

DROP INDEX IF EXISTS "idx_openai_api_logs_created_at";
DROP INDEX IF EXISTS "idx_zendesk_webhook_received_at";
DROP INDEX IF EXISTS "idx_conversations_updated_at";
DROP INDEX IF EXISTS "idx_events_standard_occurred_at";

CREATE INDEX IF NOT EXISTS "idx_openai_api_logs_created_at" ON "openai_api_logs" USING btree ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_zendesk_webhook_received_at" ON "zendesk_conversations_webhook_raw" USING btree ("received_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversations_updated_at" ON "conversations" USING btree ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_events_standard_occurred_at" ON "events_standard" USING btree ("occurred_at" DESC);
