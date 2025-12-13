-- ============================================
-- SCRIPT DE PRODUÇÃO (FASE 2): Tornar product_id NOT NULL
-- Execute APENAS depois que os dados estiverem corrigidos
-- ============================================

-- 1. Verificar se existem registros sem product_id
DO $$
DECLARE
    null_count integer;
BEGIN
    SELECT count(*) INTO null_count 
    FROM conversations_summary 
    WHERE product_id IS NULL;
    
    IF null_count > 0 THEN
        RAISE EXCEPTION 'Existem % registros sem product_id. Corrija antes de continuar.', null_count;
    END IF;
END $$;

-- 2. Tornar product_id NOT NULL (só executa se passou a verificação acima)
ALTER TABLE "conversations_summary" ALTER COLUMN "product_id" SET NOT NULL;

-- 3. Confirmar mudança
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'conversations_summary' 
  AND column_name = 'product_id';
