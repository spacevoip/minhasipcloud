-- =====================================================
-- MIGRAÇÃO: VINCULAR USUÁRIOS AOS PLANOS REAIS
-- =====================================================
-- Esta migração vincula usuários existentes aos planos reais
-- para que os contadores na página /admin/plans funcionem corretamente

-- Vincular usuário admin ao plano Sip Premium + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440002',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '30 days',
    plan_status = true
WHERE username = 'admin';

-- Vincular revendedor 1 ao plano Sip Exclusive + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440003',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '30 days',
    plan_status = true
WHERE username = 'revenda1';

-- Vincular revendedor 2 ao plano Sip Premium + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440002',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '30 days',
    plan_status = true
WHERE username = 'revenda2';

-- Vincular cliente 1 ao plano Sip Basico + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440001',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '20 days',
    plan_status = true
WHERE username = 'cliente1';

-- Vincular cliente 2 ao plano Sip Basico + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440001',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '20 days',
    plan_status = true
WHERE username = 'cliente2';

-- Vincular colaborador ao plano Sip Premium + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440002',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '25 days',
    plan_status = true
WHERE username = 'colaborador1';

-- Vincular cliente direto ao plano Sip Exclusive + Trunk
UPDATE users_pabx 
SET plan_id = '550e8400-e29b-41d4-a716-446655440003',
    plan_activated_at = NOW(),
    plan_expires_at = NOW() + INTERVAL '25 days',
    plan_status = true
WHERE username = 'cliente_direto';

-- =====================================================
-- VERIFICAÇÃO DOS RESULTADOS
-- =====================================================

-- Verificar usuários vinculados por plano
SELECT 
    p.name as plano_nome,
    COUNT(u.id) as total_usuarios,
    STRING_AGG(u.username, ', ') as usuarios
FROM planos_pabx p
LEFT JOIN users_pabx u ON u.plan_id = p.id
GROUP BY p.id, p.name
ORDER BY p.name;

-- Verificar contadores esperados
SELECT 
    'Sip Basico + Trunk' as plano,
    COUNT(*) as usuarios_vinculados
FROM users_pabx 
WHERE plan_id = '550e8400-e29b-41d4-a716-446655440001'

UNION ALL

SELECT 
    'Sip Premium + Trunk' as plano,
    COUNT(*) as usuarios_vinculados
FROM users_pabx 
WHERE plan_id = '550e8400-e29b-41d4-a716-446655440002'

UNION ALL

SELECT 
    'Sip Exclusive + Trunk' as plano,
    COUNT(*) as usuarios_vinculados
FROM users_pabx 
WHERE plan_id = '550e8400-e29b-41d4-a716-446655440003';

-- =====================================================
-- RESULTADO ESPERADO APÓS A MIGRAÇÃO:
-- =====================================================
-- Sip Basico + Trunk: 2 usuários (cliente1, cliente2)
-- Sip Premium + Trunk: 3 usuários (admin, revenda2, colaborador1)  
-- Sip Exclusive + Trunk: 2 usuários (revenda1, cliente_direto)
-- =====================================================
