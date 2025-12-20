-- Migration: Add visibility fields to knowledge_base_objective_problems
-- Similar to knowledge_base articles, replacing single isActive with two controls

ALTER TABLE knowledge_base_objective_problems
ADD COLUMN IF NOT EXISTS visible_in_search BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS available_for_auto_reply BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data: copy isActive value to both new fields
UPDATE knowledge_base_objective_problems
SET visible_in_search = is_active,
    available_for_auto_reply = is_active;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_kb_objective_problems_visible_in_search 
ON knowledge_base_objective_problems(visible_in_search);

CREATE INDEX IF NOT EXISTS idx_kb_objective_problems_available_for_auto_reply 
ON knowledge_base_objective_problems(available_for_auto_reply);
