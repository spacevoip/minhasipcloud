/**
 * =====================================================
 * RESELLER AGENTS API ROUTES - BACKEND
 * =====================================================
 * Rotas para revendedor buscar agentes de seus clientes
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

// Configuração do Supabase (igual a outras rotas)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

/**
 * GET /api/reseller/agents
 * Lista agentes filtrando obrigatoriamente por userId (para reseller)
 * - Admin pode consultar qualquer userId (ou até omitir)
 * - Reseller SOMENTE pode consultar userId de seus clientes
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const userId = req.query.userId || req.query.user_id || null;

    // Role do usuário autenticado
    const currentUser = req.user;

    // Apenas reseller ou admin
    if (!['reseller', 'admin'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Requer perfil de revendedor ou administrador.'
      });
    }

    // Para revendedor, userId é obrigatório e precisa ser cliente dele
    if (currentUser.role === 'reseller') {
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Parâmetro userId é obrigatório para revendedor'
        });
      }
      // Validar que o alvo pertence a este revendedor
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado' });
      }
      if (targetUser.parentResellerId !== currentUser.id && targetUser.id !== currentUser.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado a este usuário' });
      }
    }

    // Headers anti-cache
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString()
    });

    // Monta query
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
        user_id
      `)
      .order('ramal', { ascending: true })
      .gte('created_at', '1900-01-01T00:00:00.000Z');

    // Filtro userId: obrigatório para reseller, opcional para admin
    if (userId) {
      supabaseQuery = supabaseQuery.eq('user_id', userId);
    } else if (currentUser.role === 'reseller') {
      // já retornado acima por 400, mas mantemos a intenção
      return res.status(400).json({ success: false, message: 'userId é obrigatório' });
    }

    // Filtros adicionais
    if (search) {
      supabaseQuery = supabaseQuery.or(`agente_name.ilike.%${search}%,ramal.ilike.%${search}%,callerid.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      if (status === 'active') supabaseQuery = supabaseQuery.eq('bloqueio', false);
      else if (status === 'inactive') supabaseQuery = supabaseQuery.eq('bloqueio', true);
      else if (status === 'online') supabaseQuery = supabaseQuery.eq('status_sip', 'online');
      else if (status === 'offline') supabaseQuery = supabaseQuery.eq('status_sip', 'offline');
    }

    // Paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    supabaseQuery = supabaseQuery.range(offset, offset + parseInt(limit) - 1);

    const { data: agents, error } = await supabaseQuery;
    if (error) {
      console.error('❌ Erro ao buscar agentes reseller:', error);
      return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
    }

    const formattedAgents = (agents || []).map(a => ({
      id: a.id,
      name: a.agente_name,
      extension: a.ramal,
      callerId: a.callerid,
      isActive: !a.bloqueio,
      status: a.status_sip || 'offline',
      totalCalls: a.chamadas_total || 0,
      todayCalls: a.chamadas_hoje || 0,
      lastSeen: a.updated_at || a.created_at,
      createdAt: a.created_at,
      userId: a.user_id,
    }));

    // Contagem total
    let countQuery = supabase
      .from('agentes_pabx')
      .select('id', { count: 'exact', head: true });

    if (userId) countQuery = countQuery.eq('user_id', userId);
    if (search) countQuery = countQuery.or(`agente_name.ilike.%${search}%,ramal.ilike.%${search}%,callerid.ilike.%${search}%`);
    if (status && status !== 'all') {
      if (status === 'active') countQuery = countQuery.eq('bloqueio', false);
      else if (status === 'inactive') countQuery = countQuery.eq('bloqueio', true);
      else if (status === 'online') countQuery = countQuery.eq('status_sip', 'online');
      else if (status === 'offline') countQuery = countQuery.eq('status_sip', 'offline');
    }

    const { count: total, error: countError } = await countQuery;
    if (countError) {
      console.warn('⚠️ Erro ao contar agentes (reseller):', countError);
    }

    return res.json({
      success: true,
      data: formattedAgents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total ?? formattedAgents.length,
        totalPages: Math.ceil((total ?? formattedAgents.length) / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro na rota reseller/agents:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

module.exports = router;
