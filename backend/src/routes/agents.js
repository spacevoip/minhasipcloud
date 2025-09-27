const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const agentsService = require('../services/agentsService');
const extensionStatusService = require('../services/extensionStatusService');
const { supabase, pool, query } = require('../config/database');
const { body, param, query: queryValidator, validationResult } = require('express-validator');
const router = express.Router();

// Usar cliente Supabase compartilhado do backend

// Autenticação centralizada via middleware/auth

// Utilitário para retornar 400 quando houver erros de validação
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array(),
    });
  }
  next();
};

// GET /api/agents - Listar todos os ramais/agentes do usuário
router.get(
  '/',
  authenticateToken,
  async (req, res) => {
  try {
    // Headers anti-cache para garantir dados sempre frescos
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });

    const { ids, search } = req.query;
    
    console.log('🔄 [Agents] Buscando agentes + status (unificado) do usuário:', req.user.id);
    
    // Se IDs específicos foram fornecidos, buscar apenas esses agentes
    if (ids) {
      const agentIds = ids.split(',').map(id => id.trim()).filter(id => id);
      console.log('🎯 [Agents] Buscando agentes específicos:', agentIds);
      
      const { data: specificAgents, error } = await supabase
        .from('agentes_pabx')
        .select('id, agente_name, ramal')
        .in('id', agentIds)
        .eq('user_id', req.user.id);

      if (error) {
        throw new Error('Erro ao buscar agentes específicos: ' + error.message);
      }

      return res.json({
        success: true,
        data: specificAgents || [],
        total: specificAgents?.length || 0,
        meta: {
          timestamp: new Date().toISOString(),
          source: 'agentes_pabx (specific IDs)'
        }
      });
    }
    
    // ✅ CORREÇÃO: Forçar verificação real do ps_contacts na primeira carga
    try { 
      await extensionStatusService.checkExtensionStatus(true); // forceRefresh = true
    } catch (e) { 
      console.warn('⚠️ Refresh status falhou (GET /api/agents):', e?.message || e); 
    }
    const baseAgents = await agentsService.getAgentsByUser(req.user.id, { search });
    const enriched = await agentsService.enrichWithStatus(baseAgents, req.user.id);
    console.log('🧩 [Agents] Enriched status (GET /api/agents):');
    enriched.forEach(a => {
      console.log(`   - ${a.ramal || a.extension}: liveStatus=${a.liveStatus} isOnline=${a.isOnline}`);
    });

    // 🔗 Enriquecer com estado de Jornada (sessão/pausa) por agente
    try {
      const agentIds = enriched.map(a => a.id).filter(Boolean);
      let workSessionMap = {};
      let pausedSessionSet = new Set();
      let breakReasonMap = {};
      if (agentIds.length > 0) {
        // Buscar sessões abertas para estes agentes
        const { data: openSessions, error: wsErr } = await supabase
          .from('agent_work_sessions')
          .select('id, agent_id')
          .in('agent_id', agentIds)
          .is('ended_at', null);
        if (wsErr) throw wsErr;

        const sessionIds = (openSessions || []).map(s => s.id);
        if (sessionIds.length > 0) {
          // Buscar pausas abertas para as sessões (com motivo)
          const { data: openBreaks, error: wbErr } = await supabase
            .from('agent_work_breaks')
            .select('session_id, reason_code, reason_text')
            .in('session_id', sessionIds)
            .is('ended_at', null);
          if (wbErr) throw wbErr;
          pausedSessionSet = new Set((openBreaks || []).map(b => b.session_id));
          // Mapa de sessão -> motivo
          breakReasonMap = (openBreaks || []).reduce((acc, b) => {
            acc[b.session_id] = { reason_code: b.reason_code || null, reason_text: b.reason_text || null };
            return acc;
          }, {});
        }
        workSessionMap = (openSessions || []).reduce((acc, s) => { acc[s.agent_id] = s.id; return acc; }, {});
      }

      // Atribuir flags aos agentes
      enriched.forEach(a => {
        const sessionId = workSessionMap[a.id];
        const hasSession = !!sessionId;
        const paused = hasSession ? pausedSessionSet.has(sessionId) : false;
        a.work_session_active = hasSession;
        a.work_paused = paused;
        a.work_state = hasSession ? (paused ? 'paused' : 'working') : 'idle';
        if (paused && sessionId && breakReasonMap && breakReasonMap[sessionId]) {
          a.work_pause_reason_code = breakReasonMap[sessionId].reason_code || null;
          a.work_pause_reason_text = breakReasonMap[sessionId].reason_text || null;
        } else {
          a.work_pause_reason_code = null;
          a.work_pause_reason_text = null;
        }
      });
    } catch (e) {
      console.warn('⚠️ [Agents] Falha ao enriquecer com jornada:', e?.message || e);
    }

    res.json({
      success: true,
      data: enriched,
      total: enriched.length,
      meta: {
        timestamp: new Date().toISOString(),
        source: 'agentes_pabx + ps_contacts'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar agentes:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/agents/next-ramal-fast - Versão otimizada com PostgreSQL direto
router.get('/next-ramal-fast', authenticateToken, async (req, res) => {
  console.log(`🚀 [Fast Ramal] Rota chamada - URL: ${req.url}, Method: ${req.method}`);
  console.log(`🚀 [Fast Ramal] Headers:`, req.headers);
  const start = Date.now();
  
  try {
    // Sanitização permissiva: valores padrão e clamp de limites
    let startRange = parseInt(req.query.start || '1000', 10);
    let endRange = parseInt(req.query.end || '9999', 10);

    console.log(`⚡ [Fast Ramal] Iniciando busca otimizada - Range: ${startRange}-${endRange} para usuário: ${req.user?.id || 'undefined'}`);
    console.log(`⚡ [Fast Ramal] Query params recebidos:`, req.query);
    console.log(`⚡ [Fast Ramal] Headers de auth:`, req.headers.authorization ? 'Presente' : 'Ausente');
    console.log(`⚡ [Fast Ramal] User object:`, req.user);

    // Verificar se usuário está autenticado
    if (!req.user || !req.user.id) {
      console.log(`❌ [Fast Ramal] Usuário não autenticado`);
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        performance: { duration_ms: Date.now() - start }
      });
    }

    // Normalização/clamp de parâmetros (sem erros 400)
    if (isNaN(startRange)) startRange = 1000;
    if (isNaN(endRange)) endRange = 9999;
    startRange = Math.max(1000, Math.min(9999, startRange));
    endRange = Math.max(1000, Math.min(9999, endRange));
    // Se invertido, corrigir (trocar)
    if (startRange > endRange) {
      const tmp = startRange; startRange = endRange; endRange = tmp;
    }
    console.log(`✅ [Fast Ramal] Range sanitizado: ${startRange}-${endRange}`);

    // Pular pool PostgreSQL direto por enquanto - ir direto para Supabase RPC
    console.log(`🔄 [Fast Ramal] Usando Supabase RPC diretamente`);
    
    // Tentar Supabase RPC primeiro
    const { data, error } = await supabase.rpc('next_available_ramal', {
      p_start: startRange,
      p_end: endRange,
    });

    console.log(`🔄 [Fast Ramal] Resultado RPC - data:`, data, 'error:', error);

    if (error) {
      console.error('❌ [Fast Ramal] Erro Supabase RPC:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro na função do banco de dados',
        error: error.message,
        performance: { duration_ms: Date.now() - start }
      });
    }

    if (!data) {
      console.log(`⚠️ [Fast Ramal] Nenhum ramal disponível no intervalo ${startRange}-${endRange}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Nenhum ramal disponível no intervalo',
        performance: { duration_ms: Date.now() - start }
      });
    }

    const duration = Date.now() - start;
    console.log(`✅ [Fast Ramal] Próximo ramal obtido em ${duration}ms: ${data}`);
    
    return res.json({ 
      success: true, 
      data: { ramal: data },
      performance: { 
        duration_ms: duration,
        method: 'supabase_rpc_direct',
        range: `${startRange}-${endRange}`
      }
    });
    
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ [Fast Ramal] Erro na busca otimizada:', error.message);
    console.error('❌ [Fast Ramal] Stack trace:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor',
      error: error.message,
      performance: { duration_ms: duration }
    });
  }
});

// GET /api/agents/next-ramal - Sugerir próximo ramal disponível (atômico via função SQL)
router.get('/next-ramal', authenticateToken, async (req, res) => {
  try {
    const start = parseInt(req.query.start || '1000', 10);
    const end = parseInt(req.query.end || '9999', 10);

    console.log(`🔍 [Next Ramal] Buscando próximo ramal disponível - Range: ${start}-${end} para usuário: ${req.user.id}`);

    const { data, error } = await supabase.rpc('next_available_ramal', {
      p_start: isNaN(start) ? 1000 : start,
      p_end: isNaN(end) ? 9999 : end,
    });

    if (error) {
      console.error('❌ [Next Ramal] Erro RPC next_available_ramal:', error);
      // Propaga detalhes para facilitar diagnóstico (sem expor segredos)
      return res.status(500).json({ 
        success: false, 
        message: 'Erro ao obter próximo ramal',
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      });
    }

    if (!data) {
      console.log(`⚠️ [Next Ramal] Nenhum ramal disponível no intervalo ${start}-${end}`);
      return res.status(404).json({ success: false, message: 'Nenhum ramal disponível no intervalo' });
    }

    console.log(`✅ [Next Ramal] Próximo ramal disponível: ${data}`);
    return res.json({ success: true, data: { ramal: data } });
  } catch (e) {
    console.error('❌ [Next Ramal] Erro ao sugerir próximo ramal:', e);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

// GET /api/agents/:id - Buscar agente específico por ID do usuário autenticado
router.get(
  '/:id',
  [
    authenticateToken,
    param('id').isUUID(),
    handleValidation,
  ],
  async (req, res) => {
  try {
    const { id } = req.params;

    // Headers anti-cache para garantir dados sempre frescos
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });

    console.log(`🔍 [Agents] Buscando agente por ID: ${id} para usuário: ${req.user.id}`);

    // Buscar agente por ID e do usuário logado
    const { data: agent, error } = await supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        auto_discagem,
        webrtc,
        bloqueio,
        user_id,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !agent) {
      console.log(`❌ [Agents] Agente não encontrado: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    // Enriquecer com status em tempo real
    const enriched = await agentsService.enrichWithStatus([agent], req.user.id);
    const agentWithStatus = enriched[0];

    res.json({
      success: true,
      data: agentWithStatus,
      meta: {
        timestamp: new Date().toISOString(),
        source: 'agentes_pabx + ps_contacts'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar agente por ID:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/agents/ramal/:ramal - Buscar agente específico por ramal
router.get(
  '/ramal/:ramal',
  [
    authenticateToken,
    param('ramal').isString().isLength({ min: 2, max: 10 }).trim().escape(),
    handleValidation,
  ],
  async (req, res) => {
  try {
    const { ramal } = req.params;
    
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });

    console.log(`🔍 [Agents] Buscando agente por ramal: ${ramal} para usuário: ${req.user.id}`);
    
    // Buscar agente específico por ramal
    const { data: agents, error } = await supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        auto_discagem,
        webrtc,
        bloqueio,
        user_id,
        created_at,
        updated_at
      `)
      .eq('ramal', ramal)
      .eq('user_id', req.user.id)
      .single();

    if (error || !agents) {
      console.log(`❌ [Agents] Agente não encontrado: ${ramal}`);
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    // Enriquecer com status em tempo real
    const enriched = await agentsService.enrichWithStatus([agents], req.user.id);
    const agentWithStatus = enriched[0];

    console.log(`✅ [Agents] Agente encontrado: ${agentWithStatus.agente_name} (${ramal}) - Status: ${agentWithStatus.liveStatus}`);

    res.json({
      success: true,
      data: agentWithStatus,
      meta: {
        timestamp: new Date().toISOString(),
        source: 'agentes_pabx + ps_contacts'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar agente por ramal:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/agents/status - Lista de agentes do usuário com status + resumo
router.get('/status', authenticateToken, async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });

    const search = req.query.search || undefined;
    const baseAgents = await agentsService.getAgentsByUser(req.user.id, { search });
    const enriched = await agentsService.enrichWithStatus(baseAgents, req.user.id);

    const online = enriched.filter(a => a.isOnline).length;
    const total = enriched.length;

    res.json({
      success: true,
      data: enriched,
      summary: {
        total,
        online,
        offline: Math.max(total - online, 0),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao buscar status dos agentes:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// POST /api/agents - Criar novo ramal/agente
router.post(
  '/',
  [
    authenticateToken,
    body('ramal')
      .exists().withMessage('ramal é obrigatório')
      .bail()
      .isString().isLength({ min: 2, max: 10 })
      .matches(/^[0-9]+$/).withMessage('ramal deve conter apenas dígitos'),
    body('agente_name')
      .exists().withMessage('agente_name é obrigatório')
      .bail()
      .isString().isLength({ min: 2, max: 100 }).trim(),
    body('senha')
      .exists().withMessage('senha é obrigatória')
      .bail()
      .isString().isLength({ min: 8, max: 64 }),
    body('callerid').optional().isString().isLength({ max: 100 }).trim(),
    body('auto_discagem').optional().isBoolean().toBoolean(),
    handleValidation,
  ],
  async (req, res) => {
  try {
    const { ramal, agente_name, senha, callerid, auto_discagem } = req.body;

    // Validações básicas
    if (!ramal || !agente_name || !senha) {
      return res.status(400).json({ 
        error: 'Ramal, nome do agente e senha são obrigatórios' 
      });
    }

    // Verificar se o ramal já existe (mais robusto)
    const { data: existingAgents, error: checkError } = await supabase
      .from('agentes_pabx')
      .select('ramal')
      .eq('ramal', ramal);

    if (checkError) {
      console.error('Erro ao verificar ramal existente:', checkError);
      return res.status(500).json({ 
        error: 'Erro interno ao verificar ramal' 
      });
    }

    if (existingAgents && existingAgents.length > 0) {
      return res.status(409).json({ 
        error: 'Ramal já existe no sistema' 
      });
    }

    // Inserir novo agente com tratamento de erro melhorado
    const { data: newAgentArray, error } = await supabase
      .from('agentes_pabx')
      .insert([
        {
          ramal: ramal, // manter como string para preservar zeros à esquerda e corresponder ao tipo VARCHAR
          agente_name,
          senha,
          callerid: callerid || ramal,
          user_id: req.user.id,
          webrtc: false,
          bloqueio: false,
          auto_discagem: Boolean(auto_discagem) || false,
          chamadas_total: 0,
          chamadas_hoje: 0
        }
      ])
      .select();

    if (error) {
      // Log detalhado do erro para diagnóstico (inclui code, details e hint do Postgres)
      console.error('Erro ao criar agente:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Tratamento específico para erro de constraint única
      if (error.code === '23505' && error.message.includes('agentes_pabx_ramal_key')) {
        return res.status(409).json({ 
          error: 'Ramal já existe no sistema',
          details: 'Este número de ramal já está sendo usado por outro agente'
        });
      }
      
      // Outros erros de constraint
      if (error.code === '42P10') {
        return res.status(400).json({ 
          error: 'Erro de constraint no banco de dados',
          details: error.details || 'Verifique se todos os dados estão corretos',
          hint: error.hint || undefined
        });
      }
      
      return res.status(500).json({ 
        error: 'Erro ao criar ramal',
        details: error.message,
        code: error.code,
        hint: error.hint
      });
    }

    // Pegar o primeiro item do array retornado
    const newAgent = newAgentArray?.[0];

    if (!newAgent) {
      console.error('Erro: Nenhum agente foi criado');
      return res.status(500).json({ error: 'Erro ao criar ramal - dados não retornados' });
    }

    // Formatar resposta
    const formattedAgent = {
      id: newAgent.id,
      ramal: newAgent.ramal,
      name: newAgent.agente_name,
      password: newAgent.senha,
      callerid: newAgent.callerid,
      auto_discagem: newAgent.auto_discagem,
      webrtc: newAgent.webrtc,
      blocked: newAgent.bloqueio,
      status: newAgent.status_sip,
      totalCalls: newAgent.chamadas_total,
      todayCalls: newAgent.chamadas_hoje,
      lastActivity: newAgent.updated_at,
      createdAt: newAgent.created_at,
      userId: newAgent.user_id
    };

    // Forçar atualização de status (ps_contacts) para refletir imediatamente
    try { await extensionStatusService.checkExtensionStatus(); } catch (e) { console.warn('⚠️ Falha ao atualizar status após criação:', e?.message || e); }

    res.status(201).json({
      success: true,
      data: formattedAgent,
      message: 'Ramal criado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar agente:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// PUT /api/agents/:id - Atualizar ramal/agente
router.put(
  '/:id',
  [
    authenticateToken,
    param('id').isUUID(),
    body('agente_name').optional().isString().isLength({ min: 2, max: 100 }).trim(),
    body('senha').optional().isString().isLength({ min: 8, max: 64 }),
    body('callerid').optional().isString().isLength({ max: 100 }).trim(),
    body('webrtc').optional().isBoolean().toBoolean(),
    body('blocked').optional().isBoolean().toBoolean(),
    body('auto_discagem').optional().isBoolean().toBoolean(),
    body('sms_send').optional().isBoolean().toBoolean(),
    body('up_audio').optional().isBoolean().toBoolean(),
    handleValidation,
  ],
  async (req, res) => {
  try {
    const { id } = req.params;
    const { agente_name, senha, callerid, webrtc, blocked, auto_discagem, sms_send, up_audio } = req.body;

    // Verificar se o agente pertence ao usuário
    const { data: existingAgent } = await supabase
      .from('agentes_pabx')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existingAgent) {
      return res.status(404).json({ error: 'Ramal não encontrado' });
    }

    if (existingAgent.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Se tentativa de alterar sms_send, verificar permissão do dono
    if (sms_send !== undefined) {
      try {
        const { data: owner, error: ownerErr } = await supabase
          .from('users_pabx')
          .select('id, sms_send')
          .eq('id', req.user.id)
          .single();
        if (ownerErr) {
          console.error('Erro ao verificar permissão sms_send do usuário:', ownerErr);
          return res.status(500).json({ error: 'Erro ao verificar permissão do usuário' });
        }
        if (!owner || owner.sms_send !== true) {
          return res.status(403).json({ error: 'Você não tem permissão para habilitar o envio de SMS' });
        }
      } catch (permErr) {
        console.error('Erro inesperado ao validar permissão sms_send:', permErr);
        return res.status(500).json({ error: 'Erro interno ao validar permissão' });
      }
    }

    // Atualizar agente
    const updateData = {};
    if (agente_name !== undefined) updateData.agente_name = agente_name;
    if (senha !== undefined) updateData.senha = senha;
    if (callerid !== undefined) updateData.callerid = callerid;
    if (webrtc !== undefined) updateData.webrtc = Boolean(webrtc);
    if (blocked !== undefined) updateData.bloqueio = Boolean(blocked);
    if (auto_discagem !== undefined) updateData.auto_discagem = Boolean(auto_discagem);
    if (sms_send !== undefined) updateData.sms_send = Boolean(sms_send);
    if (up_audio !== undefined) updateData.up_audio = Boolean(up_audio);

    // Evitar update vazio que pode causar erro no banco
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
    }

    const { data: updatedAgent, error } = await supabase
      .from('agentes_pabx')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar agente:', error);
      return res.status(500).json({ error: 'Erro ao atualizar ramal' });
    }

    // Formatar resposta
    const formattedAgent = {
      id: updatedAgent.id,
      ramal: updatedAgent.ramal,
      name: updatedAgent.agente_name,
      password: updatedAgent.senha,
      callerid: updatedAgent.callerid,
      auto_discagem: updatedAgent.auto_discagem,
      webrtc: updatedAgent.webrtc,
      blocked: updatedAgent.bloqueio,
      status: updatedAgent.status_sip,
      totalCalls: updatedAgent.chamadas_total,
      todayCalls: updatedAgent.chamadas_hoje,
      lastActivity: updatedAgent.updated_at,
      createdAt: updatedAgent.created_at,
      userId: updatedAgent.user_id
    };

    // Forçar atualização de status (ps_contacts) após atualização
    try { await extensionStatusService.checkExtensionStatus(); } catch (e) { console.warn('⚠️ Falha ao atualizar status após update:', e?.message || e); }

    res.json({
      success: true,
      data: formattedAgent,
      message: 'Ramal atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar agente:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// DELETE /api/agents/:id - Remover ramal/agente
router.delete(
  '/:id',
  [authenticateToken, param('id').isUUID(), handleValidation],
  async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o agente pertence ao usuário
    const { data: existingAgent } = await supabase
      .from('agentes_pabx')
      .select('user_id, ramal, agente_name')
      .eq('id', id)
      .single();

    if (!existingAgent) {
      return res.status(404).json({ error: 'Ramal não encontrado' });
    }

    if (existingAgent.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Remover agente
    const { error } = await supabase
      .from('agentes_pabx')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao remover agente:', error);
      return res.status(500).json({ error: 'Erro ao remover ramal' });
    }

    // Forçar atualização de status (ps_contacts) após remoção
    try { await extensionStatusService.checkExtensionStatus(); } catch (e) { console.warn('⚠️ Falha ao atualizar status após delete:', e?.message || e); }

    res.json({
      success: true,
      message: `Ramal ${existingAgent.ramal} (${existingAgent.agente_name}) removido com sucesso`
    });

  } catch (error) {
    console.error('Erro ao remover agente:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/agents/stats - Estatísticas dos ramais do usuário
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { data: agents, error } = await supabase
      .from('agentes_pabx')
      .select('status_sip, chamadas_total, chamadas_hoje')
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }

    const stats = {
      total: agents.length,
      online: agents.filter(a => a.status_sip === 'online').length,
      offline: agents.filter(a => a.status_sip === 'offline').length,
      busy: agents.filter(a => a.status_sip === 'busy').length,
      totalCalls: agents.reduce((sum, a) => sum + (a.chamadas_total || 0), 0),
      todayCalls: agents.reduce((sum, a) => sum + (a.chamadas_hoje || 0), 0)
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// POST /api/agents/change-password - Alterar senha do agente
router.post(
  '/change-password',
  [authenticateToken, body('newPassword').isString().isLength({ min: 8, max: 64 }), handleValidation],
  async (req, res) => {
  try {
    const { newPassword } = req.body;

    // Validações
    if (!newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Nova senha é obrigatória' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: 'A senha deve ter pelo menos 8 caracteres' 
      });
    }

    if (!/[a-zA-Z]/.test(newPassword)) {
      return res.status(400).json({ 
        success: false,
        message: 'A senha deve conter pelo menos 1 letra' 
      });
    }

    console.log(`🔐 [Agents] Alterando senha para agente do usuário: ${req.user.id}`);

    // Buscar agente do usuário logado
    const { data: agent, error: findError } = await supabase
      .from('agentes_pabx')
      .select('id, ramal, agente_name')
      .eq('user_id', req.user.id)
      .single();

    if (findError || !agent) {
      console.log(`❌ [Agents] Agente não encontrado para usuário: ${req.user.id}`);
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    // Atualizar senha do agente
    const { error: updateError } = await supabase
      .from('agentes_pabx')
      .update({ 
        senha: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return res.status(500).json({ 
        success: false,
        message: 'Erro ao atualizar senha' 
      });
    }

    console.log(`✅ [Agents] Senha alterada com sucesso para agente: ${agent.agente_name} (${agent.ramal})`);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso',
      data: {
        agentName: agent.agente_name,
        ramal: agent.ramal,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
});

// GET /api/agents/next-ramal-fast - Versão otimizada com PostgreSQL direto
// [rotas subsequentes...]

module.exports = router;
