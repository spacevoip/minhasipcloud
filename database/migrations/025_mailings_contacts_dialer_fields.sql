-- 025_mailings_contacts_dialer_fields.sql
-- Campos de discador e índices para mailings_contacts + função de claim

BEGIN;

-- 1) Novos campos (idempotentes)
ALTER TABLE IF EXISTS mailings_contacts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_by uuid NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz NULL;

-- 2) Constraint de status permitido (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mailings_contacts_status_check'
  ) THEN
    ALTER TABLE mailings_contacts
      ADD CONSTRAINT mailings_contacts_status_check
      CHECK (status IN ('new', 'in_progress', 'completed', 'failed', 'dnc', 'invalid'));
  END IF;
END$$;

-- 3) Índices para performance (idempotentes)
-- status=new do agente e pronto para discagem
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

-- contatos em progresso com reserva expirada
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

-- agenda de retries
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

-- 4) Função de claim com SKIP LOCKED (idempotente via OR REPLACE)
CREATE OR REPLACE FUNCTION public.claim_contacts(
  p_agent_id uuid,
  p_batch integer,
  p_campaign_id uuid DEFAULT NULL,
  p_reserve_minutes integer DEFAULT 10
)
RETURNS TABLE(id uuid) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT id
    FROM public.mailings_contacts
    WHERE status = 'new'
      AND agent_id = p_agent_id
      AND (retry_at IS NULL OR retry_at <= now())
      AND (p_campaign_id IS NULL OR mailing_id = p_campaign_id)
    ORDER BY priority DESC, retry_at NULLS FIRST, id
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch
  )
  UPDATE public.mailings_contacts ct
     SET status = 'in_progress',
         locked_by = p_agent_id,
         locked_at = now(),
         reservation_expires_at = now() + make_interval(mins => p_reserve_minutes)
    FROM c
   WHERE ct.id = c.id
  RETURNING ct.id;
END$$;

COMMIT;
