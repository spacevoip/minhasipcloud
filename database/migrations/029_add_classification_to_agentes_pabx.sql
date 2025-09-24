-- Migration 029: Add classification flag to agentes_pabx
-- Description: Adds a boolean column to enforce post-call classification per agent

ALTER TABLE public.agentes_pabx
ADD COLUMN IF NOT EXISTS classification BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.agentes_pabx.classification IS 'Se TRUE, agente deve classificar a chamada ao finalizar (1-5 estrelas + motivo)';
