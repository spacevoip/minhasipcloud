-- Script para criar tabela agentes_pabx no Supabase
-- Execute este script no SQL Editor do Supabase

-- Criar tabela agentes_pabx
CREATE TABLE IF NOT EXISTS agentes_pabx (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_pabx(id) ON DELETE CASCADE,
    ramal VARCHAR(10) NOT NULL UNIQUE,
    agente_name VARCHAR(100) NOT NULL,
    senha VARCHAR(50) NOT NULL,
    callerid VARCHAR(50),
    webrtc BOOLEAN DEFAULT false,
    bloqueio BOOLEAN DEFAULT false,
    status_sip VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    chamadas_total INTEGER DEFAULT 0,
    chamadas_hoje INTEGER DEFAULT 0
);

-- Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_agentes_user_id ON agentes_pabx(user_id);
CREATE INDEX IF NOT EXISTS idx_agentes_ramal ON agentes_pabx(ramal);
CREATE INDEX IF NOT EXISTS idx_agentes_status_sip ON agentes_pabx(status_sip);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_agentes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agentes_updated_at
    BEFORE UPDATE ON agentes_pabx
    FOR EACH ROW
    EXECUTE FUNCTION update_agentes_updated_at();

-- Inserir dados de teste para o usuário admin
INSERT INTO agentes_pabx (
    user_id, ramal, agente_name, senha, callerid, webrtc, bloqueio, status_sip, chamadas_total, chamadas_hoje
) VALUES 
(
    '550e8400-e29b-41d4-a716-446655440001', 
    '1001', 
    'Ana Silva', 
    'Ana@2024', 
    'Ana Silva <1001>', 
    true, 
    false, 
    'online', 
    145, 
    8
),
(
    '550e8400-e29b-41d4-a716-446655440001', 
    '1002', 
    'Carlos Santos', 
    'Carlos@2024', 
    'Carlos Santos <1002>', 
    false, 
    false, 
    'offline', 
    89, 
    3
),
(
    '550e8400-e29b-41d4-a716-446655440001', 
    '1003', 
    'Maria Oliveira', 
    'Maria@2024', 
    'Maria Oliveira <1003>', 
    true, 
    false, 
    'busy', 
    67, 
    5
)
ON CONFLICT (ramal) DO NOTHING;

-- Habilitar realtime para a tabela
ALTER TABLE agentes_pabx REPLICA IDENTITY FULL;

-- Comentários da tabela
COMMENT ON TABLE agentes_pabx IS 'Tabela para gerenciar ramais/agentes do sistema PABX';
COMMENT ON COLUMN agentes_pabx.user_id IS 'ID do usuário proprietário do ramal';
COMMENT ON COLUMN agentes_pabx.ramal IS 'Número do ramal (único no sistema)';
COMMENT ON COLUMN agentes_pabx.agente_name IS 'Nome do agente/operador';
COMMENT ON COLUMN agentes_pabx.status_sip IS 'Status atual do registro SIP (online, offline, busy)';
COMMENT ON COLUMN agentes_pabx.last_seen IS 'Última vez que o agente foi visto online';
