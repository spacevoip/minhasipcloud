-- =====================================================
-- PABX SYSTEM - CONVERSÃO PLAN_STATUS PARA BOOLEAN
-- Versão: 1.0.4
-- Data: 2025-01-05
-- Descrição: Converter coluna plan_status de VARCHAR para BOOLEAN
-- =====================================================

-- =====================================================
-- 1. REMOVER DEFAULT ATUAL E CONVERTER PARA BOOLEAN
-- =====================================================

-- Primeiro, remover o valor padrão atual
ALTER TABLE users_pabx ALTER COLUMN plan_status DROP DEFAULT;

-- Converter valores existentes para boolean usando CASE
-- 'active' -> TRUE, qualquer outro valor ('inactive', 'expired', etc.) -> FALSE
UPDATE users_pabx 
SET plan_status = CASE 
    WHEN LOWER(plan_status) = 'active' THEN 'true'
    WHEN LOWER(plan_status) = 'inactive' THEN 'false'
    WHEN LOWER(plan_status) = 'expired' THEN 'false'
    WHEN LOWER(plan_status) = 'suspended' THEN 'false'
    ELSE 'false'
END;

-- Agora alterar o tipo da coluna para boolean
ALTER TABLE users_pabx 
ALTER COLUMN plan_status TYPE BOOLEAN 
USING plan_status::boolean;

-- Definir novo valor padrão como TRUE (plano ativo por padrão)
ALTER TABLE users_pabx 
ALTER COLUMN plan_status SET DEFAULT TRUE;

-- =====================================================
-- 2. ATUALIZAR FUNÇÃO DE ATIVAÇÃO DE PLANO
-- =====================================================

-- Recriar função para usar boolean ao invés de string
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
-- 3. ATUALIZAR FUNÇÃO DE VERIFICAÇÃO DE STATUS
-- =====================================================

-- Recriar função para retornar boolean
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
        RETURN FALSE;
    END IF;
    
    -- Se o plano já expirou, atualizar status para FALSE
    IF expires_at < CURRENT_TIMESTAMP THEN
        UPDATE users_pabx 
        SET plan_status = FALSE 
        WHERE id = user_id;
        RETURN FALSE;
    END IF;
    
    -- Se ainda está válido, garantir que status seja TRUE
    IF current_status IS NULL OR current_status = FALSE THEN
        UPDATE users_pabx 
        SET plan_status = TRUE 
        WHERE id = user_id;
        RETURN TRUE;
    END IF;
    
    RETURN current_status;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FUNÇÃO PARA EXPIRAR PLANOS AUTOMATICAMENTE
-- =====================================================

-- Função para marcar planos expirados como FALSE
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
-- 5. COMENTÁRIOS PARA REFERÊNCIA
-- =====================================================

-- Valores da coluna plan_status:
-- TRUE  = Plano ativo/válido
-- FALSE = Plano vencido/inativo
-- NULL  = Status indefinido (será tratado como FALSE)

COMMENT ON COLUMN users_pabx.plan_status IS 'Status do plano: TRUE = ativo/válido, FALSE = vencido/inativo';

-- =====================================================
-- 6. VERIFICAR RESULTADO
-- =====================================================

-- Verificar se a conversão foi bem-sucedida
SELECT 
    id, 
    name, 
    plan_status,
    plan_activated_at,
    plan_expires_at,
    CASE 
        WHEN plan_expires_at > CURRENT_TIMESTAMP THEN 'Válido'
        ELSE 'Expirado'
    END as status_calculado
FROM users_pabx 
WHERE plan_id IS NOT NULL
ORDER BY created_at;
