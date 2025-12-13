-- ============================================
-- SCRIPT DE PRODUÇÃO: Adicionar product_id na tabela conversations_summary
-- Execute este script ANTES de fazer deploy do código
-- ============================================

-- 1. Adicionar coluna product_id (nullable)
ALTER TABLE "conversations_summary" ADD COLUMN IF NOT EXISTS "product_id" integer;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS "idx_conversations_summary_product_id" ON "conversations_summary" ("product_id");

-- 3. Adicionar foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_summary_product_id_products_catalog_id_fk'
    ) THEN
        ALTER TABLE "conversations_summary" 
        ADD CONSTRAINT "conversations_summary_product_id_products_catalog_id_fk" 
        FOREIGN KEY ("product_id") 
        REFERENCES "products_catalog"("id") 
        ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

-- 4. Migrar dados existentes: associar product_id baseado no product_standard ou product
-- Primeiro tenta match exato com full_name, depois com produto
UPDATE "conversations_summary" cs
SET "product_id" = pc.id
FROM "products_catalog" pc
WHERE cs."product_id" IS NULL
  AND (
    cs."product_standard" = pc."full_name"
    OR cs."product" = pc."full_name"
    OR cs."product_standard" = pc."produto"
    OR cs."product" = pc."produto"
  );

-- 5. Migrar dados com match parcial (para nomes como "Cartão de Crédito" -> "Cartão")
UPDATE "conversations_summary" cs
SET "product_id" = matched.id
FROM (
    SELECT DISTINCT ON (cs2.id) cs2.id as summary_id, pc.id
    FROM "conversations_summary" cs2
    CROSS JOIN "products_catalog" pc
    WHERE cs2."product_id" IS NULL
      AND (
        LOWER(cs2."product") LIKE '%' || LOWER(pc."produto") || '%'
        OR LOWER(cs2."product_standard") LIKE '%' || LOWER(pc."produto") || '%'
        OR LOWER(pc."produto") LIKE '%' || LOWER(cs2."product") || '%'
      )
    ORDER BY cs2.id, LENGTH(pc."full_name") DESC
) matched
WHERE cs.id = matched.summary_id
  AND cs."product_id" IS NULL;

-- 6. Verificar migração
SELECT 
    'Total summaries' as metric, count(*)::text as value FROM conversations_summary
UNION ALL
SELECT 
    'Com product_id' as metric, count(*)::text as value 
FROM conversations_summary 
WHERE product_id IS NOT NULL
UNION ALL
SELECT 
    'Sem product_id' as metric, count(*)::text as value 
FROM conversations_summary 
WHERE product_id IS NULL;

-- 7. Listar os produtos mais comuns sem product_id (para análise manual)
SELECT product, product_standard, count(*) as qty
FROM conversations_summary
WHERE product_id IS NULL
GROUP BY product, product_standard
ORDER BY qty DESC
LIMIT 20;
