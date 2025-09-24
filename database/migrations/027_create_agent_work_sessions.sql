-- 027_create_agent_work_sessions.sql
-- Controle de jornada: sessões de trabalho por agente
-- Simples e robusto: 1 sessão aberta por agente de cada vez

CREATE TABLE IF NOT EXISTS agent_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agentes_pabx(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users_pabx(id) ON DELETE CASCADE,
  agent_name TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_aws_agent_started ON agent_work_sessions(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_aws_owner_started ON agent_work_sessions(owner_user_id, started_at DESC);

-- Apenas 1 sessão aberta por agente
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_session_per_agent
  ON agent_work_sessions(agent_id)
  WHERE ended_at IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION trg_set_timestamp_aws()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_aws ON agent_work_sessions;
CREATE TRIGGER set_timestamp_aws
BEFORE UPDATE ON agent_work_sessions
FOR EACH ROW EXECUTE FUNCTION trg_set_timestamp_aws();

COMMENT ON TABLE agent_work_sessions IS 'Sessões de trabalho (jornada) por agente';
COMMENT ON COLUMN agent_work_sessions.owner_user_id IS 'ID do dono do agente (usuário)';
