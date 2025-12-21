ALTER TABLE "conversations_summary" ADD COLUMN "conversation_orchestrator_log" jsonb DEFAULT '[]'::jsonb;
