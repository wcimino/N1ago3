-- Migration: Drop knowledge_suggestions table
-- Description: Removes the knowledge_suggestions table as the Suggestions feature has been removed
-- This table is no longer needed as the UI and backend functionality have been removed

DROP TABLE IF EXISTS knowledge_suggestions CASCADE;
