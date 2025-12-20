-- Migration: Replace isActive with visibleInSearch and availableForAutoReply
-- This migration adds separate visibility controls for articles

-- Add new columns with defaults based on old isActive value
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS visible_in_search BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS available_for_auto_reply BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data: if isActive was true, set both new fields to true
UPDATE knowledge_base SET visible_in_search = is_active, available_for_auto_reply = is_active;

-- Drop old column
ALTER TABLE knowledge_base DROP COLUMN IF EXISTS is_active;

-- Drop old index and add new indexes
DROP INDEX IF EXISTS idx_knowledge_base_is_active;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_visible_in_search ON knowledge_base (visible_in_search);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_available_for_auto_reply ON knowledge_base (available_for_auto_reply);
