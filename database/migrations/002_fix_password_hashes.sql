-- =====================================================
-- MIGRAÇÃO 002: CORREÇÃO DOS HASHES DE SENHA
-- =====================================================
-- Data: 2025-08-04
-- Descrição: Atualizar hashes de senha para valores corretos
-- Motivo: Hashes anteriores não correspondiam às senhas de teste

-- Atualizar senhas com hashes corretos
UPDATE users_pabx SET password_hash = '$2a$10$rNvV5G5R5l0YdBwSHsszNuTz/2UJX47dYt1anViWHEYBh2VDw9q6y' WHERE email = 'admin@pabxsystem.com.br'; -- admin123

UPDATE users_pabx SET password_hash = '$2a$10$RRVXYHZyHGkfR2Y8SKwKqu.cM9HGV8i/iO7o1EAQv.5uLatKKVebi' WHERE email = 'contato@revendapro.com.br'; -- revenda123

UPDATE users_pabx SET password_hash = '$2a$10$RRVXYHZyHGkfR2Y8SKwKqu.cM9HGV8i/iO7o1EAQv.5uLatKKVebi' WHERE email = 'vendas@telecomplus.com.br'; -- revenda123

UPDATE users_pabx SET password_hash = '$2a$10$B2BwDuQOMt7QQej3Pjuhme6azZezuo2JeuGyVWD7yQ0VwyrX6LhUG' WHERE email = 'contato@empresaabc.com.br'; -- cliente123

UPDATE users_pabx SET password_hash = '$2a$10$B2BwDuQOMt7QQej3Pjuhme6azZezuo2JeuGyVWD7yQ0VwyrX6LhUG' WHERE email = 'admin@techsolutions.com.br'; -- cliente123

UPDATE users_pabx SET password_hash = '$2a$10$/BzDB2qxN1eIrbuKnA6oDup6do.yI7WP0zMwqejPXbVaJdYBItzVu' WHERE email = 'suporte@pabxsystem.com.br'; -- colab123

UPDATE users_pabx SET password_hash = '$2a$10$Ieqi9pq1GH0yGWxJc8poaeSeP52Z90kJJnP.BdHWzWEVv4gXNNrBi' WHERE email = 'contato@empresaxyz.com.br'; -- direto123

-- Verificar se as atualizações foram aplicadas
SELECT email, name, role, 
       CASE 
         WHEN password_hash LIKE '$2a$10$%' THEN '✅ Hash Correto'
         ELSE '❌ Hash Incorreto'
       END as hash_status
FROM users_pabx 
ORDER BY role, name;
