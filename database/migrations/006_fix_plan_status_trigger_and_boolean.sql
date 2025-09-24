-- =====================================================
-- PABX SYSTEM - CORRIGIR TRIGGER E RECRIAR PLAN_STATUS COMO BOOLEAN
-- Versão: 1.0.6
-- Data: 2025-01-05
-- Descrição: Remover trigger problemático e recriar plan_status como BOOLEAN
-- =====================================================

-- =====================================================
-- 1. REMOVER TRIGGER E FUNÇÃO PROBLEMÁTICA
-- =====================================================

-- Remover o trigger que está causando o erro
DROP TRIGGER IF EXISTS trigger_update_plan_status ON users_pabx;

-- Remover a função que retorna VARCHAR
DROP FUNCTION IF EXISTS update_plan_status_trigger();

-- Remover a função check_plan_status que retorna VARCHAR
DROP FUNCTION IF EXISTS check_plan_status(UUID);

-- =====================================================
-- 2. REMOVER E RECRIAR COLUNA PLAN_STATUS COMO BOOLEAN
-- =====================================================

-- Remover a coluna plan_status existente (VARCHAR)
ALTER TABLE users_pabx DROP COLUMN IF EXISTS plan_status CASCADE;

-- Adicionar nova coluna plan_status como BOOLEAN
ALTER TABLE users_pabx 
ADD COLUMN plan_status BOOLEAN NOT NULL DEFAULT TRUE;

-- =====================================================
-- 3. DEFINIR STATUS BASEADO NA DATA DE EXPIRAÇÃO
-- =====================================================

-- Atualizar status baseado na data de expiração do plano
UPDATE users_pabx 
SET plan_status = CASE 
    WHEN plan_expires_at IS NULL THEN TRUE  -- Sem restrição = ativo
    WHEN plan_expires_at > CURRENT_TIMESTAMP THEN TRUE  -- Ainda válido = ativo
    ELSE FALSE  -- Expirado = inativo
END;

-- =====================================================
-- 4. RECRIAR FUNÇÕES PARA TRABALHAR COM BOOLEAN
-- =====================================================

-- Função para verificar status do plano (retorna BOOLEAN)
CREATE OR REPLACE FUNCTION check_plan_status_boolean(user_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
    expires_at TIMESTAMP;
BEGIN
    SELECT plan_expires_at INTO expires_at
    FROM users_pabx 
    WHERE id = user_id;
    
    -- Se não tem data de expiração, considera ativo
    IF expires_at IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Se expirou, retorna FALSE
    IF expires_at < CURRENT_TIMESTAMP THEN
        RETURN FALSE;
    END IF;
    
    -- Caso contrário, retorna TRUE (ativo)
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Função para ativar/renovar plano (usando BOOLEAN)
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
        plan_status = TRUE, -- TRUE = ativo
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. CRIAR NOVO TRIGGER PARA BOOLEAN
-- =====================================================

-- Função de trigger que trabalha com BOOLEAN
CREATE OR REPLACE FUNCTION update_plan_status_boolean_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar status do plano baseado na data de expiração
    IF NEW.plan_expires_at IS NULL THEN
        NEW.plan_status = TRUE;
    ELSIF NEW.plan_expires_at > CURRENT_TIMESTAMP THEN
        NEW.plan_status = TRUE;
    ELSE
        NEW.plan_status = FALSE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar novo trigger para atualizar status automaticamente
CREATE TRIGGER trigger_update_plan_status_boolean
    BEFORE UPDATE ON users_pabx
    FOR EACH ROW
    EXECUTE FUNCTION update_plan_status_boolean_trigger();

-- =====================================================
-- 6. FUNÇÃO PARA EXPIRAR PLANOS AUTOMATICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION expire_old_plans() 
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Atualizar planos expirados para FALSE
    UPDATE users_pabx 
    SET plan_status = FALSE 
    WHERE plan_expires_at < CURRENT_TIMESTAMP 
    AND plan_status = TRUE;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. FUNÇÃO PARA RENOVAR PLANO
-- =====================================================

CREATE OR REPLACE FUNCTION renew_user_plan(
    user_id UUID,
    renewal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) RETURNS VOID AS $$
DECLARE
    current_plan_id UUID;
    plan_period INTEGER;
BEGIN
    -- Buscar plano atual do usuário
    SELECT plan_id INTO current_plan_id 
    FROM users_pabx 
    WHERE id = user_id;
    
    -- Se não tem plano, não pode renovar
    IF current_plan_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não possui plano para renovar';
    END IF;
    
    -- Buscar período do plano
    SELECT period_days INTO plan_period 
    FROM planos_pabx 
    WHERE id = current_plan_id;
    
    -- Renovar plano
    UPDATE users_pabx SET
        plan_activated_at = renewal_date,
        plan_expires_at = calculate_plan_expiration(renewal_date, plan_period),
        plan_status = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. RECRIAR ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_status_boolean ON users_pabx(plan_status);

-- =====================================================
-- 9. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN users_pabx.plan_status IS 'Status do plano: TRUE = ativo/válido, FALSE = vencido/inativo';
COMMENT ON FUNCTION check_plan_status_boolean IS 'Verifica o status atual do plano de um usuário (retorna BOOLEAN)';
COMMENT ON FUNCTION update_plan_status_boolean_trigger IS 'Trigger que atualiza automaticamente o status do plano como BOOLEAN';

-- =====================================================
-- 10. VERIFICAR RESULTADO
-- =====================================================

-- Verificar se a migração foi bem-sucedida
SELECT 
    id, 
    name, 
    plan_status,
    plan_activated_at,
    plan_expires_at,
    CASE 
        WHEN plan_expires_at IS NULL THEN 'Sem restrição'
        WHEN plan_expires_at > CURRENT_TIMESTAMP THEN 'Válido'
        ELSE 'Expirado'
    END as status_calculado
FROM users_pabx 
ORDER BY created_at;

-- Mostrar estrutura da coluna
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users_pabx' 
AND column_name = 'plan_status';

-- =====================================================
-- 11. EXEMPLOS DE USO ATUALIZADOS
-- =====================================================

-- Ativar plano para um usuário:
-- SELECT activate_user_plan('user-uuid', 'plan-uuid', CURRENT_TIMESTAMP);

-- Verificar status do plano (retorna TRUE/FALSE):
-- SELECT check_plan_status_boolean('user-uuid');

-- Buscar usuários com planos vencidos:
-- SELECT * FROM users_pabx WHERE plan_status = FALSE;

-- Buscar usuários com planos ativos:
-- SELECT * FROM users_pabx WHERE plan_status = TRUE;

-- Expirar planos antigos:
-- SELECT expire_old_plans();

-- Renovar plano de um usuário:
-- SELECT renew_user_plan('user-uuid', CURRENT_TIMESTAMP);
