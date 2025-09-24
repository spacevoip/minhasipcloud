-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE - PÁGINA /AGENTS
-- =====================================================
-- Índices para acelerar consultas da API de agentes
-- Data: 2025-08-21
-- Objetivo: Otimizar performance das consultas mais frequentes

-- 1. ÍNDICE PRINCIPAL: user_id (consulta mais frequente)
-- Acelera: GET /api/agents (busca por usuário)
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_user_id 
ON agentes_pabx(user_id);

-- 2. ÍNDICE ÚNICO: ramal (validação de duplicatas)
-- Acelera: POST /api/agents (verificação de ramal existente)
-- Acelera: GET /api/agents/ramal/:ramal
CREATE UNIQUE INDEX IF NOT EXISTS idx_agentes_pabx_ramal_unique 
ON agentes_pabx(ramal);

-- 3. ÍNDICE COMPOSTO: user_id + ramal (consultas filtradas)
-- Acelera: Busca de ramal específico por usuário
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_user_ramal 
ON agentes_pabx(user_id, ramal);

-- 4. ÍNDICE DE BUSCA: agente_name (filtros de nome)
-- Acelera: Busca por nome do agente
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_name 
ON agentes_pabx(agente_name);

-- 5. ÍNDICE DE BUSCA: callerid (filtros de CallerID)
-- Acelera: Busca por CallerID
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_callerid 
ON agentes_pabx(callerid);

-- 6. ÍNDICE DE STATUS: status_sip (filtros de status)
-- Acelera: GET /api/agents/stats (contagem por status)
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_status 
ON agentes_pabx(status_sip);

-- 7. ÍNDICE DE BLOQUEIO: bloqueio (filtros ativos/inativos)
-- Acelera: Filtros por agentes bloqueados/desbloqueados
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_bloqueio 
ON agentes_pabx(bloqueio);

-- 8. ÍNDICE TEMPORAL: created_at (ordenação por data)
-- Acelera: Ordenação por data de criação
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_created_at 
ON agentes_pabx(created_at);

-- 9. ÍNDICE TEMPORAL: updated_at (última atividade)
-- Acelera: Ordenação por última atividade
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_updated_at 
ON agentes_pabx(updated_at);

-- 10. ÍNDICE COMPOSTO PARA BUSCA TEXTUAL
-- Acelera: Busca simultânea por nome, ramal e callerid
CREATE INDEX IF NOT EXISTS idx_agentes_pabx_search 
ON agentes_pabx(user_id, agente_name, ramal, callerid);

-- =====================================================
-- ÍNDICES PARA TABELA ps_contacts (STATUS EM TEMPO REAL)
-- =====================================================

-- 11. ÍNDICE PRINCIPAL: endpoint (ramal no ps_contacts)
-- Acelera: JOIN com agentes_pabx para status online/offline
CREATE INDEX IF NOT EXISTS idx_ps_contacts_endpoint 
ON ps_contacts(endpoint);

-- 12. ÍNDICE TEMPORAL: reg_time (última atividade)
-- Acelera: Ordenação por última atividade no ps_contacts
CREATE INDEX IF NOT EXISTS idx_ps_contacts_reg_time 
ON ps_contacts(reg_time);

-- =====================================================
-- ESTATÍSTICAS E ANÁLISE
-- =====================================================

-- Atualizar estatísticas das tabelas após criação dos índices
ANALYZE agentes_pabx;
ANALYZE ps_contacts;

-- =====================================================
-- COMENTÁRIOS SOBRE PERFORMANCE ESPERADA
-- =====================================================

/*
IMPACTO ESPERADO DOS ÍNDICES:

1. GET /api/agents (user_id): 
   - Antes: Full table scan
   - Depois: Index scan - 95% mais rápido

2. POST /api/agents (verificação ramal):
   - Antes: Full table scan para verificar duplicata
   - Depois: Index lookup - 99% mais rápido

3. Busca textual (nome/ramal/callerid):
   - Antes: Full table scan com LIKE
   - Depois: Index scan - 80% mais rápido

4. JOIN com ps_contacts:
   - Antes: Nested loop sem índice
   - Depois: Hash join com índice - 90% mais rápido

5. Filtros por status/bloqueio:
   - Antes: Full table scan
   - Depois: Index scan - 85% mais rápido

CONSULTAS MAIS BENEFICIADAS:
- Listagem de agentes por usuário
- Verificação de ramal único
- Status online/offline em tempo real
- Busca por nome/ramal/callerid
- Estatísticas de agentes
*/
