-- =====================================================
-- PABX SYSTEM - MIGRAÇÃO ATIVAÇÃO DE PLANOS
-- Versão: 1.0.3
-- Data: 2025-01-05
-- Descrição: Adicionar campos para controlar ativação/renovação de planos
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS DE ATIVAÇÃO DE PLANO
-- =====================================================

-- Adicionar campos para controlar data de ativação e expiração do plano
ALTER TABLE users_pabx ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMP;
ALTER TABLE users_pabx ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;
ALTER TABLE users_pabx ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) DEFAULT 'active';

-- =====================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_id ON users_pabx(plan_id);
CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_activated_at ON users_pabx(plan_activated_at);
CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_expires_at ON users_pabx(plan_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_status ON users_pabx(plan_status);

-- =====================================================
-- 3. FUNÇÃO PARA CALCULAR DATA DE EXPIRAÇÃO
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_plan_expiration(
    activation_date TIMESTAMP,
    period_days INTEGER
) RETURNS TIMESTAMP AS $$
BEGIN
    RETURN activation_date + (period_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FUNÇÃO PARA ATIVAR/RENOVAR PLANO
-- =====================================================

CREATE OR REPLACE FUNCTION activate_user_plan(
    user_id UUID,
    new_plan_id UUID,
    activation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) RETURNS VOID AS $$
DECLARE
    plan_period INTEGER;
BEGIN
    -- Buscar período do plano
    SELECT period_days INTO plan_period 
    FROM planos_pabx 
    WHERE id = new_plan_id;
    
    -- Atualizar dados do usuário
    UPDATE users_pabx SET
        plan_id = new_plan_id,
        plan_activated_at = activation_date,
        plan_expires_at = calculate_plan_expiration(activation_date, plan_period),
        plan_status = 'active',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. FUNÇÃO PARA VERIFICAR STATUS DO PLANO
-- =====================================================

CREATE OR REPLACE FUNCTION check_plan_status(user_id UUID) 
RETURNS VARCHAR(20) AS $$
DECLARE
    expires_at TIMESTAMP;
    current_status VARCHAR(20);
BEGIN
    SELECT plan_expires_at, plan_status 
    INTO expires_at, current_status
    FROM users_pabx 
    WHERE id = user_id;
    
    -- Se não tem data de expiração, considerar inativo
    IF expires_at IS NULL THEN
        RETURN 'inactive';
    END IF;
    
    -- Se expirou, retornar vencido
    IF expires_at < CURRENT_TIMESTAMP THEN
        RETURN 'expired';
    END IF;
    
    -- Caso contrário, retornar status atual
    RETURN COALESCE(current_status, 'active');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. TRIGGER PARA ATUALIZAR STATUS AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION update_plan_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar status do plano baseado na data de expiração
    NEW.plan_status = check_plan_status(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar status automaticamente
DROP TRIGGER IF EXISTS trigger_update_plan_status ON users_pabx;
CREATE TRIGGER trigger_update_plan_status
    BEFORE UPDATE ON users_pabx
    FOR EACH ROW
    EXECUTE FUNCTION update_plan_status_trigger();

-- =====================================================
-- 7. ATUALIZAR USUÁRIOS EXISTENTES
-- =====================================================

-- Ativar planos para usuários existentes que já têm plan_id
UPDATE users_pabx SET
    plan_activated_at = created_at,
    plan_expires_at = (
        SELECT calculate_plan_expiration(users_pabx.created_at, planos_pabx.period_days)
        FROM planos_pabx 
        WHERE planos_pabx.id = users_pabx.plan_id
    ),
    plan_status = 'active'
WHERE plan_id IS NOT NULL 
  AND plan_activated_at IS NULL;

-- =====================================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN users_pabx.plan_activated_at IS 'Data de ativação do plano atual';
COMMENT ON COLUMN users_pabx.plan_expires_at IS 'Data de expiração do plano atual';
COMMENT ON COLUMN users_pabx.plan_status IS 'Status do plano: active, expired, inactive, suspended';

COMMENT ON FUNCTION activate_user_plan IS 'Ativa ou renova um plano para um usuário';
COMMENT ON FUNCTION check_plan_status IS 'Verifica o status atual do plano de um usuário';
COMMENT ON FUNCTION calculate_plan_expiration IS 'Calcula a data de expiração baseada na ativação e período';

-- =====================================================
-- 9. EXEMPLOS DE USO
-- =====================================================

-- Ativar plano para um usuário:
-- SELECT activate_user_plan('user-uuid', 'plan-uuid', CURRENT_TIMESTAMP);

-- Verificar status do plano:
-- SELECT check_plan_status('user-uuid');

-- Buscar usuários com planos vencidos:
-- SELECT * FROM users_pabx WHERE plan_status = 'expired';

-- Buscar usuários com planos que vencem em X dias:
-- SELECT * FROM users_pabx WHERE plan_expires_at BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '7 days';
