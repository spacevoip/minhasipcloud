-- Migração 007: Criação da tabela agentes_pabx
-- Data: 2025-01-13
-- Descrição: Tabela para gerenciar ramais/agentes com vinculação aos usuários

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'America/Sao_Paulo'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'America/Sao_Paulo'),
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
    NEW.updated_at = NOW() AT TIME ZONE 'America/Sao_Paulo';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agentes_updated_at
    BEFORE UPDATE ON agentes_pabx
    FOR EACH ROW
    EXECUTE FUNCTION update_agentes_updated_at();

-- Inserir 2 ramais para o usuário admin (assumindo que o admin tem id conhecido)
-- Vamos buscar o ID do admin primeiro
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Buscar o ID do usuário admin
    SELECT id INTO admin_user_id 
    FROM users_pabx 
    WHERE email = 'admin@pabxsystem.com.br' 
    LIMIT 1;
    
    -- Se encontrou o admin, inserir os ramais
    IF admin_user_id IS NOT NULL THEN
        -- Ramal 1001 - Ana Silva
        INSERT INTO agentes_pabx (
            user_id, ramal, agente_name, senha, callerid, webrtc, bloqueio, status_sip, chamadas_total, chamadas_hoje
        ) VALUES (
            admin_user_id, '1001', 'Ana Silva', 'Ana@2024', 'Ana Silva <1001>', true, false, 'online', 145, 8
        );
        
        -- Ramal 1002 - Carlos Santos
        INSERT INTO agentes_pabx (
            user_id, ramal, agente_name, senha, callerid, webrtc, bloqueio, status_sip, chamadas_total, chamadas_hoje
        ) VALUES (
            admin_user_id, '1002', 'Carlos Santos', 'Carlos@2024', 'Carlos Santos <1002>', false, false, 'offline', 89, 3
        );
        
        RAISE NOTICE 'Ramais inseridos com sucesso para o usuário admin';
    ELSE
        RAISE NOTICE 'Usuário admin não encontrado';
    END IF;
END $$;

-- Comentários da tabela
COMMENT ON TABLE agentes_pabx IS 'Tabela para gerenciar ramais/agentes do sistema PABX';
COMMENT ON COLUMN agentes_pabx.user_id IS 'ID do usuário proprietário do ramal';
COMMENT ON COLUMN agentes_pabx.ramal IS 'Número do ramal (único no sistema)';
COMMENT ON COLUMN agentes_pabx.agente_name IS 'Nome do agente/operador';
COMMENT ON COLUMN agentes_pabx.senha IS 'Senha do ramal para autenticação SIP';
COMMENT ON COLUMN agentes_pabx.callerid IS 'Identificador de chamada exibido';
COMMENT ON COLUMN agentes_pabx.webrtc IS 'Habilita WebRTC para o ramal';
COMMENT ON COLUMN agentes_pabx.bloqueio IS 'Ramal bloqueado (não pode fazer/receber chamadas)';
COMMENT ON COLUMN agentes_pabx.status_sip IS 'Status atual do registro SIP (online, offline, busy)';
COMMENT ON COLUMN agentes_pabx.chamadas_total IS 'Total de chamadas realizadas pelo ramal';
COMMENT ON COLUMN agentes_pabx.chamadas_hoje IS 'Chamadas realizadas hoje (resetado diariamente)';
