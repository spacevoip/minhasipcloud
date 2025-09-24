-- =====================================================
-- Migration: Create performance indexes for agentes_pabx
-- Purpose: Optimize /api/admin/agents queries (filters: search, status, user, ordering)
-- =====================================================

-- Enable pg_trgm for trigram indexes (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes to speed up ILIKE searches used in backend route:
--   .or("agente_name.ilike.%search%,ramal.ilike.%search%,callerid.ilike.%search%")
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_agente_name_trgm
  ON public.agentes_pabx USING gin (agente_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_agentes_pabx_ramal_trgm
  ON public.agentes_pabx USING gin (ramal gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_agentes_pabx_callerid_trgm
  ON public.agentes_pabx USING gin (callerid gin_trgm_ops);

-- Equality filters and ordering
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_status_sip
  ON public.agentes_pabx (status_sip);

CREATE INDEX IF NOT EXISTS idx_agentes_pabx_bloqueio
  ON public.agentes_pabx (bloqueio);

CREATE INDEX IF NOT EXISTS idx_agentes_pabx_user_id
  ON public.agentes_pabx (user_id);

-- Ordering by ramal (ascending) used by the listing
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_ramal_btree
  ON public.agentes_pabx (ramal);

-- Helpful timestamp index if future ranges or freshness checks are used
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_updated_at
  ON public.agentes_pabx (updated_at);
