-- 028_create_agent_work_breaks.sql
-- Pausas durante uma sessão de trabalho do agente

CREATE TABLE IF NOT EXISTS agent_work_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_work_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agentes_pabx(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users_pabx(id) ON DELETE CASCADE,
  reason_code TEXT NULL,
  reason_text TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_awb_session_started ON agent_work_breaks(session_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_awb_agent_started ON agent_work_breaks(agent_id, started_at DESC);

-- Apenas 1 pausa aberta por sessão
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_break_per_session
  ON agent_work_breaks(session_id)
  WHERE ended_at IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION trg_set_timestamp_awb()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_awb ON agent_work_breaks;
CREATE TRIGGER set_timestamp_awb
BEFORE UPDATE ON agent_work_breaks
FOR EACH ROW EXECUTE FUNCTION trg_set_timestamp_awb();

COMMENT ON TABLE agent_work_breaks IS 'Pausas por sessão de trabalho do agente';
