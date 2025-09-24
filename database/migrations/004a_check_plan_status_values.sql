-- =====================================================
-- PABX SYSTEM - VERIFICAR VALORES PLAN_STATUS
-- Versão: 1.0.4a
-- Data: 2025-01-05
-- Descrição: Verificar quais valores existem na coluna plan_status antes da conversão
-- =====================================================

-- Verificar todos os valores únicos na coluna plan_status
SELECT 
    plan_status,
    COUNT(*) as quantidade,
    CASE 
        WHEN LOWER(plan_status) = 'active' THEN 'TRUE'
        WHEN LOWER(plan_status) = 'inactive' THEN 'FALSE'
        WHEN LOWER(plan_status) = 'expired' THEN 'FALSE'
        WHEN LOWER(plan_status) = 'suspended' THEN 'FALSE'
        WHEN plan_status IS NULL THEN 'FALSE (NULL)'
        ELSE 'FALSE (OUTRO)'
    END as sera_convertido_para
FROM users_pabx 
GROUP BY plan_status
ORDER BY quantidade DESC;

-- Verificar usuários específicos e seus status
SELECT 
    id,
    name,
    email,
    plan_status,
    plan_id,
    created_at
FROM users_pabx 
ORDER BY created_at;
