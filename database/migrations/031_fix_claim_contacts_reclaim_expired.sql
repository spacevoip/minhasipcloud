-- 031_fix_claim_contacts_reclaim_expired.sql
-- Ajusta a função claim_contacts para também re-clamar contatos com reserva expirada
-- Situação corrigida: contatos com status 'in_progress' e reservation_expires_at <= now()
-- passam a ser elegíveis novamente para claim, evitando filas vazias eternas

BEGIN;

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
    WHERE
      (
        -- Novos contatos prontos para discagem
        (status = 'new' AND (retry_at IS NULL OR retry_at <= now()))
        OR
        -- Contatos anteriormente reservados cuja reserva expirou
        (status = 'in_progress' AND reservation_expires_at IS NOT NULL AND reservation_expires_at <= now())
      )
      AND agent_id = p_agent_id
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
