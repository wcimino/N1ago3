-- Drop knowledge base tables (Problems, Root Causes, Solutions, Actions)
-- These are being replaced by an external API service

-- First drop tables that have foreign key dependencies
DROP TABLE IF EXISTS "case_actions" CASCADE;
DROP TABLE IF EXISTS "case_solutions" CASCADE;

-- Drop pivot/junction tables
DROP TABLE IF EXISTS "knowledge_base_root_cause_has_knowledge_base_solutions" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_root_cause_has_knowledge_base_objective_problems" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_solutions_has_knowledge_base_actions" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_objective_problems_has_products_catalog" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_objective_problems_embeddings" CASCADE;

-- Drop main knowledge base tables
DROP TABLE IF EXISTS "knowledge_base_root_causes" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_solutions" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_actions" CASCADE;
DROP TABLE IF EXISTS "knowledge_base_objective_problems" CASCADE;
