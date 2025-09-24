-- =====================================================
-- PABX SYSTEM - RECRIAR PLAN_STATUS COMO BOOLEAN
-- Versão: 1.0.5
-- Data: 2025-01-05
-- Descrição: Remover coluna plan_status e recriar como BOOLEAN
-- =====================================================

-- =====================================================
-- 1. REMOVER COLUNA PLAN_STATUS EXISTENTE
-- =====================================================

-- Remover a coluna plan_status completamente
ALTER TABLE users_pabx DROP COLUMN IF EXISTS plan_status;

-- =====================================================
-- 2. CRIAR NOVA COLUNA PLAN_STATUS COMO BOOLEAN
-- =====================================================

-- Adicionar nova coluna plan_status como BOOLEAN com default TRUE
ALTER TABLE users_pabx 
ADD COLUMN plan_status BOOLEAN NOT NULL DEFAULT TRUE;

-- =====================================================
-- 3. DEFINIR STATUS BASEADO NA DATA DE EXPIRAÇÃO
-- =====================================================

-- Atualizar status baseado na data de expiração do plano
-- Se plan_expires_at > agora = TRUE (ativo)
-- Se plan_expires_at <= agora = FALSE (vencido)
-- Se plan_expires_at é NULL = TRUE (sem restrição)
UPDATE users_pabx 
SET plan_status = CASE 
    WHEN plan_expires_at IS NULL THEN TRUE
    WHEN plan_expires_at > CURRENT_TIMESTAMP THEN TRUE
    ELSE FALSE
END;

-- =====================================================
-- 4. ATUALIZAR FUNÇÕES PARA USAR BOOLEAN
-- =====================================================

-- Função para ativar plano do usuário
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

-- Função para verificar status do plano
CREATE OR REPLACE FUNCTION check_plan_status(user_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
    expires_at TIMESTAMP;
    current_status BOOLEAN;
BEGIN
    SELECT plan_expires_at, plan_status 
    INTO expires_at, current_status
    FROM users_pabx 
    WHERE id = user_id;
    
    -- Se não encontrou o usuário
    IF expires_at IS NULL THEN
        RETURN TRUE; -- Sem restrição de plano
    END IF;
    
    -- Se o plano já expirou, atualizar status para FALSE
    IF expires_at < CURRENT_TIMESTAMP THEN
        UPDATE users_pabx 
        SET plan_status = FALSE 
        WHERE id = user_id;
        RETURN FALSE;
    END IF;
    
    -- Se ainda está válido, garantir que status seja TRUE
    UPDATE users_pabx 
    SET plan_status = TRUE 
    WHERE id = user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Função para expirar planos automaticamente
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

-- Função para renovar plano
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
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON COLUMN users_pabx.plan_status IS 'Status do plano: TRUE = ativo/válido, FALSE = vencido/inativo';

-- =====================================================
-- 6. VERIFICAR RESULTADO
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
WHERE plan_id IS NOT NULL
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
