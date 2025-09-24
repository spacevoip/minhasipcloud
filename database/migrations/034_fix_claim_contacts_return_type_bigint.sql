-- 034_fix_claim_contacts_return_type_bigint.sql
-- Ajusta o tipo de retorno da função claim_contacts para BIGINT
-- Corrige erro 42804: Returned type bigint does not match expected type uuid

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_contacts(
  p_agent_id uuid,
  p_batch integer,
  p_campaign_id uuid DEFAULT NULL,
  p_reserve_minutes integer DEFAULT 10
)
RETURNS TABLE(contact_id bigint) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT mc.id
    FROM public.mailings_contacts mc
    WHERE
      (
        -- Novos contatos prontos para discagem
        (mc.status = 'new' AND (mc.retry_at IS NULL OR mc.retry_at <= now()))
        OR
        -- Contatos anteriormente reservados cuja reserva expirou
        (mc.status = 'in_progress' AND mc.reservation_expires_at IS NOT NULL AND mc.reservation_expires_at <= now())
      )
      AND mc.agent_id = p_agent_id
      AND (p_campaign_id IS NULL OR mc.mailing_id = p_campaign_id)
    ORDER BY mc.priority DESC, mc.retry_at NULLS FIRST, mc.id
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
  RETURNING ct.id AS contact_id;
END$$;

COMMIT;
