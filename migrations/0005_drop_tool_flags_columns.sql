-- Drop unused AI tool flag columns from openai_api_config table
ALTER TABLE openai_api_config DROP COLUMN IF EXISTS use_knowledge_base_tool;
ALTER TABLE openai_api_config DROP COLUMN IF EXISTS use_subject_intent_tool;
ALTER TABLE openai_api_config DROP COLUMN IF EXISTS use_zendesk_knowledge_base_tool;
ALTER TABLE openai_api_config DROP COLUMN IF EXISTS use_objective_problem_tool;
ALTER TABLE openai_api_config DROP COLUMN IF EXISTS use_combined_knowledge_search_tool;
ALTER TABLE openai_api_config DROP COLUMN IF EXISTS use_knowledge_suggestion_tool;
