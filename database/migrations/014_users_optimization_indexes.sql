-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE - TABELA users_pabx
-- =====================================================
-- Índices para acelerar consultas da página /admin/users
-- Data: 2025-08-21
-- Objetivo: Otimizar busca textual e filtros/paginação
-- =====================================================

-- 1) Extensão necessária para trigram (busca com LIKE/ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- 2) ÍNDICES TRIGRAM PARA BUSCA TEXTUAL (GIN + gin_trgm_ops)
-- Aceleram filtros de pesquisa por nome, username, email, empresa
-- Consultas beneficiadas: busca rápida com LIKE/ILIKE e autosuggest
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_pabx_name_trgm
ON users_pabx USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_pabx_username_trgm
ON users_pabx USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_pabx_email_trgm
ON users_pabx USING GIN (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_pabx_company_trgm
ON users_pabx USING GIN (company gin_trgm_ops);

-- Observação: phone normalmente é numérico/formatado; trigram raramente ajuda.
-- Caso necessário, habilitar sob demanda:
-- CREATE INDEX IF NOT EXISTS idx_users_pabx_phone_trgm
-- ON users_pabx USING GIN (phone gin_trgm_ops);

-- =====================================================
-- 3) ÍNDICES COMPOSTOS PARA FILTROS FREQUENTES
-- Beneficiam paginação ordenada e filtros combinados
-- =====================================================

-- 3.1) Filtrar usuários por revendedor + tipo + status
-- Ex.: revenda vê apenas seus clientes ativos/inativos
CREATE INDEX IF NOT EXISTS idx_users_pabx_parent_role_status
ON users_pabx(parent_reseller_id, role, status);

-- 3.2) Listagens gerais com filtros por tipo/status e ordenação por data
-- Usado em /admin/users com ordenação por created_at
CREATE INDEX IF NOT EXISTS idx_users_pabx_role_status_created_at
ON users_pabx(role, status, created_at DESC);

-- 3.3) Filtros por plano + status (usuários por plano)
CREATE INDEX IF NOT EXISTS idx_users_pabx_plan_status
ON users_pabx(plan_id, status);

-- =====================================================
-- 4) ATUALIZAÇÃO DE ESTATÍSTICAS
-- =====================================================
ANALYZE users_pabx;

-- =====================================================
-- 5) COMENTÁRIOS SOBRE PERFORMANCE ESPERADA
-- =====================================================
/*
IMPACTO ESPERADO DOS ÍNDICES:

1) Busca textual (nome/username/email/empresa)
   - Antes: Full table scan com LIKE/ILIKE
   - Depois: Index scan via trigram (GIN) — até 90% mais rápido

2) Listagem por revendedor com filtros
   - parent_reseller_id + role + status: elimina scans custosos

3) Paginação com filtros tipo/status
   - role + status + created_at DESC: melhora ORDER BY em conjunto com WHERE

4) Relatórios por plano
   - plan_id + status: acelera contagens e listagens por plano

Obs.: Evitamos criação excessiva de índices. Estes cobrem os principais casos
identificados na página /admin/users e serviços relacionados (usersService).
*/
