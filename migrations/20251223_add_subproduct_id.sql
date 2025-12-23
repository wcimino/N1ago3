-- Migration: Add subproduct_id to conversations_summary
-- Date: 2025-12-23
-- Description: Adds subproduct tracking to conversation summaries

-- Step 1: Create subproducts_catalog table (if not exists)
CREATE TABLE IF NOT EXISTS "subproducts_catalog" (
  "id" serial PRIMARY KEY NOT NULL,
  "external_id" uuid NOT NULL,
  "name" text NOT NULL,
  "produto_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_subproducts_catalog_external_id" ON "subproducts_catalog" USING btree ("external_id");
CREATE INDEX IF NOT EXISTS "idx_subproducts_catalog_produto_id" ON "subproducts_catalog" USING btree ("produto_id");
CREATE INDEX IF NOT EXISTS "idx_subproducts_catalog_name" ON "subproducts_catalog" USING btree ("name");

-- Step 2: Add new columns to products_catalog (if not exists)
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "external_id" uuid;
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "color" text;

-- Step 3: Add subproduct_id to conversations_summary
ALTER TABLE "conversations_summary" ADD COLUMN IF NOT EXISTS "subproduct_id" integer REFERENCES "subproducts_catalog"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_conversations_summary_subproduct_id" ON "conversations_summary" ("subproduct_id");

-- NOTE: After running this migration, you need to:
-- 1. Populate products_catalog with your product data (external_id, name, icon, color)
-- 2. Populate subproducts_catalog with your subproduct data
-- 3. Clean up old columns from products_catalog if migration is successful:
--    ALTER TABLE "products_catalog" DROP COLUMN IF EXISTS "produto";
--    ALTER TABLE "products_catalog" DROP COLUMN IF EXISTS "subproduto";
--    ALTER TABLE "products_catalog" DROP COLUMN IF EXISTS "full_name";
