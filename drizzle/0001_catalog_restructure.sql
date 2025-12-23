-- Migration: Restructure products_catalog and create subproducts_catalog

-- Step 1: Create subproducts_catalog table
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

-- Step 2: Add new columns to products_catalog
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "external_id" uuid;
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "icon" text;
ALTER TABLE "products_catalog" ADD COLUMN IF NOT EXISTS "color" text;

-- Step 3: Drop old indexes
DROP INDEX IF EXISTS "idx_ifood_products_produto";
DROP INDEX IF EXISTS "idx_ifood_products_full_name";

-- Step 4: Remove old columns
ALTER TABLE "products_catalog" DROP COLUMN IF EXISTS "produto";
ALTER TABLE "products_catalog" DROP COLUMN IF EXISTS "subproduto";
ALTER TABLE "products_catalog" DROP COLUMN IF EXISTS "full_name";

-- Step 5: Make external_id and name NOT NULL (after data migration)
-- This will be done after populating data

-- Step 6: Create new indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_products_catalog_external_id" ON "products_catalog" USING btree ("external_id");
CREATE INDEX IF NOT EXISTS "idx_products_catalog_name" ON "products_catalog" USING btree ("name");
