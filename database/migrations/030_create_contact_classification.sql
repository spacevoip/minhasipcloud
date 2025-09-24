-- Migration 030: Create contact_classification table
-- Stores post-call classifications submitted by agents

CREATE TABLE IF NOT EXISTS public.contact_classification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agentes_pabx(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_pabx(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  reason TEXT,
  number VARCHAR(30) NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0, -- seconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'America/Sao_Paulo')
);

CREATE INDEX IF NOT EXISTS idx_contact_classification_user ON public.contact_classification(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_classification_agent ON public.contact_classification(agent_id);
CREATE INDEX IF NOT EXISTS idx_contact_classification_created_at ON public.contact_classification(created_at);

COMMENT ON TABLE public.contact_classification IS 'Classificação de contatos (avaliar chamadas) enviada pelos agentes';
COMMENT ON COLUMN public.contact_classification.rating IS '1 a 5 estrelas';
COMMENT ON COLUMN public.contact_classification.duration IS 'Duração em segundos';
