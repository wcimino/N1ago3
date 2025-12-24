-- Migration: Drop query monitoring tables
-- Date: 2024-12-24
-- Description: Removes query_logs and query_stats tables to eliminate 
--              query monitoring overhead on database performance

DROP TABLE IF EXISTS query_logs CASCADE;
DROP TABLE IF EXISTS query_stats CASCADE;

-- Note: system_config table is preserved as it's used by other features
-- The obsolete monitoring keys (query_monitoring_enabled, etc.) remain but are no longer read
