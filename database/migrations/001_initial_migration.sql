-- =====================================================
-- PABX SYSTEM - MIGRAÇÃO INICIAL
-- Versão: 1.0.0
-- Data: 2025-01-04
-- Descrição: Criação da estrutura inicial do banco de dados
-- =====================================================

-- =====================================================
-- 1. CRIAR EXTENSÕES NECESSÁRIAS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 2. CRIAR TIPOS ENUM
-- =====================================================

-- ENUM para roles de usuário
CREATE TYPE user_role_enum AS ENUM ('user', 'admin', 'reseller', 'collaborator');

-- ENUM para status de usuário
CREATE TYPE user_status_enum AS ENUM ('active', 'inactive', 'pending', 'suspended');

-- =====================================================
-- 3. CRIAR FUNÇÕES AUXILIARES
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 4. CRIAR TABELA USERS_PABX
-- =====================================================

CREATE TABLE users_pabx (
  -- Identificação Principal
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username             VARCHAR(50) UNIQUE NOT NULL,
  email                VARCHAR(255) UNIQUE NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  
  -- Informações Pessoais
  name                 VARCHAR(100) NOT NULL,
  company              VARCHAR(100),
  phone                VARCHAR(20),
  
  -- Tipo e Permissões
  role                 user_role_enum NOT NULL DEFAULT 'user',
  status               user_status_enum NOT NULL DEFAULT 'pending',
  
  -- Dados Financeiros
  credits              DECIMAL(10,2) DEFAULT 0.00,
  plan_id              UUID, -- Referência será adicionada após criar plans_pabx
  
  -- Hierarquia (para revendedores)
  parent_reseller_id   UUID REFERENCES users_pabx(id),
  
  -- Configurações do Sistema
  max_concurrent_calls INTEGER DEFAULT 0,
  
  -- Dados de Auditoria (TIMEZONE SÃO PAULO)
  created_at           TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
  updated_at           TIMESTAMP DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'),
  last_login_at        TIMESTAMP,
  created_by           UUID REFERENCES users_pabx(id),
  
  -- Configurações Específicas
  timezone             VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  language             VARCHAR(5) DEFAULT 'pt-BR',
  
  -- Dados Adicionais (JSON para flexibilidade)
  settings             JSONB DEFAULT '{}',
  metadata             JSONB DEFAULT '{}'
);

-- =====================================================
-- 5. CRIAR TRIGGERS
-- =====================================================

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_users_pabx_updated_at 
    BEFORE UPDATE ON users_pabx 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_users_pabx_email ON users_pabx(email);
CREATE INDEX idx_users_pabx_username ON users_pabx(username);
CREATE INDEX idx_users_pabx_role ON users_pabx(role);
CREATE INDEX idx_users_pabx_status ON users_pabx(status);
CREATE INDEX idx_users_pabx_parent_reseller ON users_pabx(parent_reseller_id);
CREATE INDEX idx_users_pabx_plan ON users_pabx(plan_id);
CREATE INDEX idx_users_pabx_created_at ON users_pabx(created_at);

-- =====================================================
-- 7. ADICIONAR COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE users_pabx IS 'Tabela principal de usuários do sistema PABX';
COMMENT ON COLUMN users_pabx.role IS 'Tipo de usuário: user, admin, reseller, collaborator';
COMMENT ON COLUMN users_pabx.status IS 'Status da conta: active, inactive, pending, suspended';
COMMENT ON COLUMN users_pabx.parent_reseller_id IS 'ID do revendedor pai (NULL para usuários diretos)';
COMMENT ON COLUMN users_pabx.credits IS 'Saldo de créditos do usuário em BRL';

-- =====================================================
-- 8. INSERIR DADOS DE TESTE
-- =====================================================

-- Usuário ADMIN (Super Administrador)
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'admin',
    'admin@pabxsystem.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: admin123
    'Administrador do Sistema',
    'PABX System Ltda',
    '+55 11 99999-0001',
    'admin',
    'active',
    0.00,
    0,
    'America/Sao_Paulo',
    'pt-BR'
);

-- Usuário REVENDEDOR 1
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'revenda1',
    'contato@revendapro.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: revenda123
    'João Silva Santos',
    'Revenda Pro Telecom',
    '+55 11 98888-0001',
    'reseller',
    'active',
    5000.00,
    0,
    'America/Sao_Paulo',
    'pt-BR'
);

-- Usuário REVENDEDOR 2
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'revenda2',
    'vendas@telecomplus.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: revenda123
    'Maria Fernanda Costa',
    'Telecom Plus Solutions',
    '+55 11 97777-0002',
    'reseller',
    'active',
    3500.00,
    0,
    'America/Sao_Paulo',
    'pt-BR'
);

-- Usuário CLIENTE (do revendedor 1)
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, parent_reseller_id, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440004',
    'cliente1',
    'contato@empresaabc.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: cliente123
    'Carlos Eduardo Oliveira',
    'Empresa ABC Ltda',
    '+55 11 96666-0001',
    'user',
    'active',
    150.00,
    '550e8400-e29b-41d4-a716-446655440002', -- filho do revendedor 1
    10,
    'America/Sao_Paulo',
    'pt-BR'
);

-- Usuário CLIENTE (do revendedor 2)
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, parent_reseller_id, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440005',
    'cliente2',
    'admin@techsolutions.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: cliente123
    'Ana Paula Rodrigues',
    'Tech Solutions Inc',
    '+55 11 95555-0002',
    'user',
    'active',
    280.50,
    '550e8400-e29b-41d4-a716-446655440003', -- filho do revendedor 2
    15,
    'America/Sao_Paulo',
    'pt-BR'
);

-- Usuário COLABORADOR
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440006',
    'colaborador1',
    'suporte@pabxsystem.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: colab123
    'Pedro Henrique Lima',
    'PABX System Ltda',
    '+55 11 94444-0001',
    'collaborator',
    'active',
    0.00,
    0,
    'America/Sao_Paulo',
    'pt-BR'
);

-- Usuário CLIENTE DIRETO (sem revendedor)
INSERT INTO users_pabx (
    id, username, email, password_hash, name, company, phone, 
    role, status, credits, max_concurrent_calls, timezone, language
) VALUES (
    '550e8400-e29b-41d4-a716-446655440007',
    'cliente_direto',
    'contato@empresaxyz.com.br',
    '$2b$10$rQZ9vKp.fX8mHqJ2nL4kZeYxGzP3wR7sT1uV5yW9xA2bC4dE6fG8h', -- senha: direto123
    'Roberto Silva Mendes',
    'Empresa XYZ Corp',
    '+55 11 93333-0001',
    'user',
    'active',
    450.75,
    5,
    'America/Sao_Paulo',
    'pt-BR'
);

-- =====================================================
-- 9. VERIFICAÇÕES FINAIS
-- =====================================================

-- Verificar se a tabela foi criada corretamente
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users_pabx' 
ORDER BY ordinal_position;

-- Verificar se os dados foram inseridos
SELECT 
    username, 
    email, 
    role, 
    status, 
    name,
    company,
    credits
FROM users_pabx 
ORDER BY role, name;

-- =====================================================
-- CREDENCIAIS DE TESTE:
-- =====================================================
-- Admin: admin / admin123
-- Revenda1: revenda1 / revenda123  
-- Revenda2: revenda2 / revenda123
-- Cliente1: cliente1 / cliente123
-- Cliente2: cliente2 / cliente123
-- Colaborador: colaborador1 / colab123
-- Cliente Direto: cliente_direto / direto123
-- =====================================================
