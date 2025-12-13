-- Add product_id column to knowledge_base table
ALTER TABLE "knowledge_base" ADD COLUMN "product_id" integer;

-- Create index on product_id
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_product_id" ON "knowledge_base" ("product_id");

-- Add foreign key constraint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE set null ON UPDATE no action;

-- Migrate existing data: populate product_id based on product_standard matching full_name in products_catalog
UPDATE "knowledge_base" kb
SET "product_id" = pc.id
FROM "products_catalog" pc
WHERE kb."product_standard" = pc."full_name"
  AND kb."product_id" IS NULL;
