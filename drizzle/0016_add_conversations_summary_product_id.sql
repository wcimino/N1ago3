-- Add product_id column to conversations_summary table
ALTER TABLE "conversations_summary" ADD COLUMN "product_id" integer;

-- Create index on product_id
CREATE INDEX IF NOT EXISTS "idx_conversations_summary_product_id" ON "conversations_summary" ("product_id");

-- Add foreign key constraint
ALTER TABLE "conversations_summary" ADD CONSTRAINT "conversations_summary_product_id_products_catalog_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_catalog"("id") ON DELETE set null ON UPDATE no action;

-- Migrate existing data: populate product_id based on product_standard matching full_name in products_catalog
UPDATE "conversations_summary" cs
SET "product_id" = pc.id
FROM "products_catalog" pc
WHERE cs."product_standard" = pc."full_name"
  AND cs."product_id" IS NULL;
