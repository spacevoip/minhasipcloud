-- 026_mailings_total_discados_fix.sql
-- Padroniza contador de discagens em mailings_pabx para total_discados (INTEGER)

BEGIN;

-- 1) Criar coluna total_discados se não existir
ALTER TABLE IF EXISTS mailings_pabx
  ADD COLUMN IF NOT EXISTS total_discados INTEGER NOT NULL DEFAULT 0;

-- 2) Se existir a coluna antiga discados, tentar migrar valores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'mailings_pabx' AND column_name = 'discados'
  ) THEN
    BEGIN
      EXECUTE $$
        UPDATE public.mailings_pabx
           SET total_discados = COALESCE(NULLIF(discados::text, '')::integer, 0)
         WHERE total_discados IS NULL
      $$;
    EXCEPTION WHEN others THEN
      -- Se conversão falhar por tipo/conteúdo, mantém default 0
      RAISE NOTICE 'Falha ao migrar discados -> total_discados; mantendo defaults';
    END;
  END IF;
END$$;

-- 3) Constraint de não-negativo (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discados_non_negative') THEN
    ALTER TABLE public.mailings_pabx DROP CONSTRAINT discados_non_negative;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'total_discados_non_negative') THEN
    ALTER TABLE public.mailings_pabx ADD CONSTRAINT total_discados_non_negative CHECK (total_discados >= 0);
  END IF;
END$$;

-- 4) Comentário
COMMENT ON COLUMN public.mailings_pabx.total_discados IS 'Contador total de discagens realizadas para esta campanha (INTEGER)';

COMMIT;
