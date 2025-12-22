-- Script SQL para sincronizar índices no banco PROD com o que o Drizzle espera
-- Execute este script MANUALMENTE no banco de produção antes de fazer deploy
-- Isso evita que o deploy tente recriar índices já existentes

-- ============================================
-- CONTEXTO DO PROBLEMA:
-- O Drizzle gera índices com sintaxe diferente do que foi criado anteriormente.
-- Por exemplo, ao usar .desc() no schema, Drizzle gera "DESC NULLS LAST",
-- mas os índices foram criados apenas com "DESC".
-- Este script dropando e recriando os índices garante que o banco
-- corresponda exatamente ao schema Drizzle atual (que NÃO usa .desc()).
-- ============================================

-- ============================================
-- PASSO 1: Dropar índices que serão recriados
-- ============================================

-- Índices em conversations (com DESC que precisam ser recriados SEM DESC)
DROP INDEX IF EXISTS idx_conversations_created_at;
DROP INDEX IF EXISTS idx_conversations_updated_at;

-- Índices em events_standard (não existem mais no schema)
DROP INDEX IF EXISTS idx_events_standard_occurred_at;
DROP INDEX IF EXISTS idx_events_standard_source;
DROP INDEX IF EXISTS idx_events_standard_message_aggregation;

-- Índices em query_logs (com DESC que precisam ser recriados SEM DESC)
DROP INDEX IF EXISTS idx_query_logs_created_at;
DROP INDEX IF EXISTS idx_query_logs_duration;

-- Índices em query_stats (com DESC que precisam ser recriados SEM DESC)
DROP INDEX IF EXISTS idx_query_stats_call_count;
DROP INDEX IF EXISTS idx_query_stats_avg_duration;

-- Índices em archive_jobs (com DESC que precisam ser recriados SEM DESC)
DROP INDEX IF EXISTS idx_archive_jobs_archive_date;

-- Índices em external_event_audit_logs (com DESC que precisam ser recriados SEM DESC)
DROP INDEX IF EXISTS idx_external_event_audit_logs_created_at;

-- Índices em zendesk_conversations_webhook_raw (com DESC que precisam ser recriados SEM DESC)
DROP INDEX IF EXISTS idx_zendesk_webhook_received_at;
DROP INDEX IF EXISTS idx_zendesk_webhook_status_retry;

-- ============================================
-- PASSO 2: Recriar índices exatamente como Drizzle espera
-- ============================================

-- conversations - índices SEM DESC (como no novo schema)
CREATE INDEX idx_conversations_created_at ON conversations USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_external_id ON conversations USING btree (user_external_id);

-- query_logs - índices SEM DESC
CREATE INDEX idx_query_logs_created_at ON query_logs USING btree (created_at);
CREATE INDEX idx_query_logs_duration ON query_logs USING btree (duration_ms);

-- query_stats - índices SEM DESC
CREATE INDEX idx_query_stats_call_count ON query_stats USING btree (call_count);
CREATE INDEX idx_query_stats_avg_duration ON query_stats USING btree (avg_duration_ms);

-- archive_jobs - índice SEM DESC
CREATE INDEX idx_archive_jobs_archive_date ON archive_jobs USING btree (archive_date);

-- external_event_audit_logs - índice SEM DESC
CREATE INDEX idx_external_event_audit_logs_created_at ON external_event_audit_logs USING btree (created_at);

-- zendesk_conversations_webhook_raw - índice SEM DESC
CREATE INDEX idx_zendesk_webhook_received_at ON zendesk_conversations_webhook_raw USING btree (received_at);

-- conversations_summary - adicionar índice faltante
CREATE INDEX IF NOT EXISTS idx_conversations_summary_product_id ON conversations_summary USING btree (product_id);

-- ============================================
-- PASSO 3: Verificação final
-- ============================================
-- Após executar, rode o comando abaixo para verificar:
-- SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%' ORDER BY tablename, indexname;

-- ============================================
-- NOTA: A tabela openai_api_logs ainda usa idx_openai_api_logs_created_at 
-- com "DESC NULLS LAST" no schema. Esse índice precisa ser sincronizado
-- apenas se estiver diferente:
-- ============================================
DROP INDEX IF EXISTS idx_openai_api_logs_created_at;
CREATE INDEX idx_openai_api_logs_created_at ON openai_api_logs USING btree (created_at DESC NULLS LAST);
