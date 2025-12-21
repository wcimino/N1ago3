-- Migration: Drop Zendesk Articles tables
-- Description: Removes zendesk_articles, zendesk_article_embeddings, and zendesk_articles_statistics tables
-- These tables are no longer needed as the system now uses the Solution Center API exclusively

-- Drop dependent table first (due to foreign key constraint)
DROP TABLE IF EXISTS zendesk_article_embeddings CASCADE;

-- Drop statistics table
DROP TABLE IF EXISTS zendesk_articles_statistics CASCADE;

-- Drop main articles table
DROP TABLE IF EXISTS zendesk_articles CASCADE;
