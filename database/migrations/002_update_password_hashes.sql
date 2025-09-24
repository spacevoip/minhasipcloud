-- =====================================================
-- ATUALIZAÇÃO DE HASHES DE SENHA - PABX SYSTEM
-- =====================================================
-- Este script atualiza os hashes de senha para garantir
-- que as credenciais de teste funcionem corretamente
-- =====================================================

-- Gerar novos hashes bcrypt para as senhas de teste
-- Usando bcrypt com salt rounds = 10

-- ADMIN: admin123
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'admin@pabxsystem.com.br';

-- REVENDEDOR 1: revenda123  
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'contato@revendapro.com.br';

-- REVENDEDOR 2: revenda123
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'vendas@telecomplus.com.br';

-- CLIENTE 1: cliente123
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'contato@empresaabc.com.br';

-- CLIENTE 2: cliente123
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'admin@techsolutions.com.br';

-- COLABORADOR: colab123
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'suporte@pabxsystem.com.br';

-- CLIENTE DIRETO: direto123
UPDATE users_pabx 
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'contato@empresaxyz.com.br';

-- =====================================================
-- VERIFICAR ATUALIZAÇÕES
-- =====================================================

SELECT 
    email,
    username,
    role,
    password_hash,
    status
FROM users_pabx 
ORDER BY role, email;

-- =====================================================
-- CREDENCIAIS ATUALIZADAS:
-- =====================================================
-- TODAS AS SENHAS AGORA SÃO: "password"
-- 
-- Admin: admin@pabxsystem.com.br / password
-- Revenda1: contato@revendapro.com.br / password  
-- Revenda2: vendas@telecomplus.com.br / password
-- Cliente1: contato@empresaabc.com.br / password
-- Cliente2: admin@techsolutions.com.br / password
-- Colaborador: suporte@pabxsystem.com.br / password
-- Cliente Direto: contato@empresaxyz.com.br / password
-- =====================================================
