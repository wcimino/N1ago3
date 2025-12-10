DROP INDEX IF EXISTS "idx_conversations_updated_at";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_events_standard_occurred_at";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_zendesk_webhook_received_at";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_openai_api_logs_created_at" ON "openai_api_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_updated_at" ON "conversations" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_events_standard_occurred_at" ON "events_standard" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zendesk_webhook_received_at" ON "zendesk_conversations_webhook_raw" USING btree ("received_at" DESC NULLS LAST);