-- ============================================
-- SCRIPT DE PRODUÇÃO: Adicionar product_id na tabela knowledge_base
-- Execute este script ANTES de fazer deploy do código
-- ============================================

-- 1. Adicionar coluna product_id (nullable)
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "product_id" integer;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS "idx_knowledge_base_product_id" ON "knowledge_base" ("product_id");

-- 3. Adicionar foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'knowledge_base_product_id_products_catalog_id_fk'
    ) THEN
        ALTER TABLE "knowledge_base" 
        ADD CONSTRAINT "knowledge_base_product_id_products_catalog_id_fk" 
        FOREIGN KEY ("product_id") 
        REFERENCES "products_catalog"("id") 
        ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

-- 4. Migrar dados existentes: associar product_id baseado no product_standard
UPDATE "knowledge_base" kb
SET "product_id" = pc.id
FROM "products_catalog" pc
WHERE kb."product_standard" = pc."full_name"
  AND kb."product_id" IS NULL;

-- 5. Verificar migração
SELECT 
    'Total artigos' as metric, count(*)::text as value FROM knowledge_base
UNION ALL
SELECT 
    'Artigos com product_id' as metric, count(*)::text as value 
FROM knowledge_base 
WHERE product_id IS NOT NULL
UNION ALL
SELECT 
    'Artigos sem product_id' as metric, count(*)::text as value 
FROM knowledge_base 
WHERE product_id IS NULL;
