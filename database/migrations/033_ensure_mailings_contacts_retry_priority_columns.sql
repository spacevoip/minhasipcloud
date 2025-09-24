-- 033_ensure_mailings_contacts_retry_priority_columns.sql
-- Garante colunas e índices necessários para a função claim_contacts
-- Corrige erros 42703 (mc.retry_at inexistente) e melhora performance da fila

BEGIN;

-- Garantir colunas necessárias (idempotente)
ALTER TABLE IF EXISTS public.mailings_contacts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_by uuid NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz NULL;

-- Constraint de status permitido (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mailings_contacts_status_check'
  ) THEN
    ALTER TABLE public.mailings_contacts
      ADD CONSTRAINT mailings_contacts_status_check
      CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'dnc', 'invalid'));
  END IF;
END$$;

-- Índices para performance (idempotentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_mc_new_agent' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_mc_new_agent
      ON public.mailings_contacts (agent_id, priority DESC, id)
      WHERE status = 'new' AND (retry_at IS NULL OR retry_at <= now());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_mc_inprogress_exp' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_mc_inprogress_exp
      ON public.mailings_contacts (reservation_expires_at)
      WHERE status = 'in_progress';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_mc_retry' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_mc_retry
      ON public.mailings_contacts (retry_at)
      WHERE status = 'new';
  END IF;
END$$;

COMMIT;
