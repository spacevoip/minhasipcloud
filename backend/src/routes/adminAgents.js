/**
 * =====================================================
 * ADMIN AGENTS API ROUTES - BACKEND
 * =====================================================
 * Rotas para gerenciar TODOS os agentes do sistema (admin)
 * Reutiliza a mesma estrutura da tabela agentes_pabx
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { adminRateLimit } = require('../middleware/rateLimiter');
const cacheService = require('../services/cacheService');
const { supabase, query } = require('../config/database');

const router = express.Router();

/**
 * GET /api/admin/agents/debug
 * Debug route - teste com Supabase
 */
router.get('/debug', adminRateLimit, authenticateToken, async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Testando rota admin agents com Supabase...');
    
    // ✅ VERIFICAR SE É ADMIN
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem acessar esta rota.'
      });
    }

    console.log('✅ [DEBUG] Usuário é admin, continuando...');

    // Teste simples com Supabase
    console.log('🔍 [DEBUG] Testando conexão Supabase...');
    
    const { data, error, count } = await supabase
      .from('agentes_pabx')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ [DEBUG] Erro Supabase:', error);
      throw new Error(`Erro Supabase: ${error.message}`);
    }
    
    console.log('✅ [DEBUG] Supabase funcionando, total de agentes:', count);

    res.json({
      success: true,
      message: 'Debug Supabase OK',
      data: {
        totalAgents: count,
        userInfo: {
          id: req.user.userId,
          role: req.user.role,
          email: req.user.email
        }
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Erro:', error);
    console.error('❌ [DEBUG] Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro no debug',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/agents
 * Buscar todos os agentes do sistema (admin) - SEM filtro por usuário
 */
router.get('/', adminRateLimit, authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const userId = req.query.userId || req.query.user_id || null;
    
    console.log('📋 [ADMIN AGENTS] Buscando TODOS os agentes do sistema...');
    
    // ✅ VERIFICAR SE É ADMIN
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem acessar esta rota.'
      });
    }

    // Headers anti-cache para garantir dados sempre frescos (igual à rota agents)
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });

    console.log('🔄 Buscando TODOS os agentes SEM CACHE (admin)');
    console.log('⏰ Timestamp da consulta:', new Date().toISOString());
    
    // Forçar consulta sem cache com timestamp único (igual à rota agents)
    const timestamp = Date.now();
    let supabaseQuery = supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        webrtc,
        bloqueio,
        status_sip,
        created_at,
        updated_at,
        chamadas_total,
        chamadas_hoje,
        user_id,
        users_pabx(name, company)
      `)
      .order('ramal', { ascending: true })
      // Adicionar filtro com timestamp para forçar nova consulta
      .gte('created_at', '1900-01-01T00:00:00.000Z');
      // DIFERENÇA: NÃO filtrar por user_id para buscar TODOS os agentes
    
    // Opcional: Filtrar por usuário específico quando fornecido (admin)
    if (userId) {
      supabaseQuery = supabaseQuery.eq('user_id', userId);
    }

    // Aplicar filtros se necessário
    if (search) {
      supabaseQuery = supabaseQuery.or(`agente_name.ilike.%${search}%,ramal.ilike.%${search}%,callerid.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        supabaseQuery = supabaseQuery.eq('bloqueio', false);
      } else if (status === 'inactive') {
        supabaseQuery = supabaseQuery.eq('bloqueio', true);
      } else if (status === 'online') {
        supabaseQuery = supabaseQuery.eq('status_sip', 'online');
      } else if (status === 'offline') {
        supabaseQuery = supabaseQuery.eq('status_sip', 'offline');
      }
    }

    // Aplicar paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    supabaseQuery = supabaseQuery.range(offset, offset + parseInt(limit) - 1);

    const { data: agents, error } = await supabaseQuery;

    if (error) {
      console.error('❌ Erro ao buscar agentes admin:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor',
        error: error.message 
      });
    }

    console.log('📊 Dados brutos retornados do Supabase (admin):', JSON.stringify(agents, null, 2));
    console.log('📈 Total de agentes encontrados (admin):', agents?.length || 0);

    // Formatar dados para o frontend (igual à rota agents, mas com campos extras para admin)
    const formattedAgents = (agents || []).map(agent => ({
      id: agent.id,
      name: agent.agente_name,
      extension: agent.ramal,
      sipPassword: agent.senha,
      callerId: agent.callerid,
      webrtc: agent.webrtc,
      isActive: !agent.bloqueio, // inverso do bloqueio
      status: agent.status_sip || 'offline',
      totalCalls: agent.chamadas_total || 0,
      todayCalls: agent.chamadas_hoje || 0,
      lastSeen: agent.updated_at || agent.created_at,
      createdAt: agent.created_at,
      userId: agent.user_id,
      userName: agent.users_pabx?.name || 'N/A',
      userCompany: agent.users_pabx?.company || 'N/A'
    }));

    // Contar total para paginação
    let countQuery = supabase
      .from('agentes_pabx')
      .select('id', { count: 'exact', head: true });

    // Aplicar mesmos filtros na contagem
    if (search) {
      countQuery = countQuery.or(`agente_name.ilike.%${search}%,ramal.ilike.%${search}%,callerid.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        countQuery = countQuery.eq('bloqueio', false);
      } else if (status === 'inactive') {
        countQuery = countQuery.eq('bloqueio', true);
      } else if (status === 'online') {
        countQuery = countQuery.eq('status_sip', 'online');
      } else if (status === 'offline') {
        countQuery = countQuery.eq('status_sip', 'offline');
      }
    }

    // Aplicar filtro de usuário também na contagem
    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    const { count: total, error: countError } = await countQuery;
    
    if (countError) {
      console.error('❌ Erro ao contar agentes:', countError);
      // Não falhar por causa da contagem, usar length dos dados retornados
      const fallbackTotal = formattedAgents.length;
      console.log('⚠️ Usando fallback para total:', fallbackTotal);
    }

    const response = {
      success: true,
      data: formattedAgents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || formattedAgents.length,
        totalPages: Math.ceil((total || formattedAgents.length) / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    };

    console.log(`✅ [ADMIN AGENTS] ${formattedAgents.length} agentes retornados (total: ${total || formattedAgents.length})`);
    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao buscar agentes admin:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Detalhes do erro:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/agents/:id
 * Buscar agente por ID (admin)
 */
router.get('/:id', adminRateLimit, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ VERIFICAR SE É ADMIN
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem acessar esta rota.'
      });
    }

    const { data: agent, error } = await supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        webrtc,
        bloqueio,
        status_sip,
        created_at,
        updated_at,
        chamadas_total,
        chamadas_hoje,
        user_id,
        users_pabx(name, company)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar agente por ID (admin):', error);
      return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agente não encontrado' });
    }

    const formatted = {
      id: agent.id,
      name: agent.agente_name,
      extension: agent.ramal,
      callerId: agent.callerid,
      userId: agent.user_id,
      userName: agent.users_pabx?.name || 'N/A',
      userCompany: agent.users_pabx?.company || 'N/A',
      isActive: !agent.bloqueio,
      lastSeen: agent.updated_at || agent.created_at,
      createdAt: agent.created_at,
      updatedAt: agent.updated_at,
      sipPassword: agent.senha,
    };

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('❌ Erro ao buscar agente por ID (admin):', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

/**
 * PUT /api/admin/agents/:id
 * Atualizar agente (admin)
 */
router.put('/:id', adminRateLimit, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, callerId, isActive } = req.body;

    console.log(`📝 [ADMIN AGENTS] Atualizando agente ${id}...`);

    // ✅ VERIFICAR SE É ADMIN
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem editar agentes.'
      });
    }

    // ✅ CONSTRUIR UPDATE
    const updateFields = [];
    const updateParams = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`agente_name = $${paramCount}`);
      updateParams.push(name);
    }

    if (callerId !== undefined) {
      paramCount++;
      updateFields.push(`callerid = $${paramCount}`);
      updateParams.push(callerId);
    }

    if (isActive !== undefined) {
      paramCount++;
      updateFields.push(`bloqueio = $${paramCount}`);
      updateParams.push(!isActive); // inverso do isActive
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo para atualizar fornecido'
      });
    }

    // ✅ ADICIONAR UPDATED_AT
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateParams.push(new Date().toISOString());

    // ✅ ADICIONAR ID NO FINAL
    paramCount++;
    updateParams.push(id);

    const updateQuery = `
      UPDATE agentes_pabx 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('🔍 Update Query:', updateQuery);
    console.log('🔍 Update Params:', updateParams);

    const result = await query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    // ✅ INVALIDAR CACHE
    await cacheService.invalidate('pabx:admin_agents:*');
    console.log('🗑️ Cache invalidado: admin_agents');

    const updatedAgent = result.rows[0];
    console.log(`✅ [ADMIN AGENTS] Agente ${id} atualizado com sucesso`);

    res.json({
      success: true,
      message: 'Agente atualizado com sucesso',
      data: {
        id: updatedAgent.id,
        name: updatedAgent.agente_name,
        extension: updatedAgent.ramal,
        callerId: updatedAgent.callerid,
        isActive: !updatedAgent.bloqueio,
        updatedAt: updatedAgent.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar agente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/agents/:id
 * Excluir agente (admin)
 */
router.delete('/:id', adminRateLimit, authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ [ADMIN AGENTS] Excluindo agente ${id}...`);

    // ✅ VERIFICAR SE É ADMIN
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem excluir agentes.'
      });
    }

    // ✅ VERIFICAR SE AGENTE EXISTE
    const checkQuery = 'SELECT id, agente_name, ramal FROM agentes_pabx WHERE id = $1';
    const checkResult = await query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    const agent = checkResult.rows[0];

    // ✅ EXCLUIR AGENTE
    const deleteQuery = 'DELETE FROM agentes_pabx WHERE id = $1';
    await query(deleteQuery, [id]);

    // ✅ INVALIDAR CACHE
    await cacheService.invalidate('pabx:admin_agents:*');
    console.log('🗑️ Cache invalidado: admin_agents');

    console.log(`✅ [ADMIN AGENTS] Agente ${agent.agente_name} (${agent.ramal}) excluído com sucesso`);

    res.json({
      success: true,
      message: `Agente ${agent.agente_name} (${agent.ramal}) excluído com sucesso`
    });

  } catch (error) {
    console.error('❌ Erro ao excluir agente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
