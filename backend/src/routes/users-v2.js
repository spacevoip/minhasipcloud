/**
 * =====================================================
 * USERS API V2 - API MODERNA E CENTRALIZADA
 * =====================================================
 * API completa para gerenciamento de usuários COM CACHE INTELIGENTE
 * Cache aplicado em consultas GET, invalidado em operações de escrita
 */

const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult, param, query } = require('express-validator');
const { supabase } = require('../config/database');
const User = require('../models/User');
const cacheService = require('../services/cacheService');
const financeService = require('../services/financeService');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeUserOutput } = require('../utils/sanitize');
const logger = require('../utils/logger');

const router = express.Router();

// Configuração: rounds do bcrypt (permite tunar performance e segurança)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

// Helper compartilhado importado de ../utils/sanitize

// =====================================================
// Middleware: Cache inteligente para otimização
// =====================================================
const cacheMiddleware = async (req, res, next) => {
  // Aplicar cache apenas em GET requests
  if (req.method !== 'GET') {
    return next();
  }

  try {
    const cacheKey = `users-v2:${req.originalUrl}:${req.user?.id || 'anonymous'}`;
    const cached = await cacheService.get(cacheKey);
    
    if (cached) {
      logger.cache(`Cache HIT: ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }
    
    // Interceptar res.json para salvar no cache
    const originalJson = res.json;
    res.json = function(data) {
      // Salvar no cache com TTL de 5 minutos
      cacheService.set(cacheKey, JSON.stringify(data), 300).catch(err => logger.error('Cache SET error:', err));
      logger.cache(`Cache SET: ${cacheKey}`);
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('Cache middleware error:', error);
    next();
  }
};

router.use(cacheMiddleware);

// =====================================================
// Validações reutilizáveis (definidas antes do uso)
// =====================================================
const idValidation = [param('id').isUUID().withMessage('ID inválido (UUID esperado)')];

// =====================================================
// GET /api/users-v2/:id/debug - DEBUG CAMPOS BOOLEAN
// =====================================================
router.get('/:id/debug', authenticateToken, idValidation, async (req, res) => {
  try {
    const { id } = req.params;
    logger.debug(`Verificando campos boolean para usuário: ${id}`);

    // Verificar permissão (admin apenas)
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado - apenas admin/collaborator'
      });
    }

    const { query } = require('../config/database');
    
    // Query SQL direta com cast explícito
    const result = await query(`
      SELECT 
        id, name, email,
        sms_send, 
        sms_send::text as sms_send_text,
        sms_send::boolean as sms_send_bool,
        webrtc,
        webrtc::text as webrtc_text, 
        webrtc::boolean as webrtc_bool,
        auto_discagem,
        auto_discagem::text as auto_discagem_text,
        auto_discagem::boolean as auto_discagem_bool,
        up_audio,
        mailling_up,
        pg_typeof(sms_send) as sms_send_type,
        pg_typeof(webrtc) as webrtc_type,
        pg_typeof(auto_discagem) as auto_discagem_type
      FROM users_pabx 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const rawData = result.rows[0];
    
    // Testar também via Supabase
    const { supabase } = require('../config/database');
    const { data: supabaseData } = await supabase
      .from('users_pabx')
      .select('sms_send, webrtc, auto_discagem, up_audio, mailling_up')
      .eq('id', id)
      .single();

    // Testar via modelo User
    const User = require('../models/User');
    const userModel = await User.findById(id);

    const response = {
      success: true,
      debug: {
        postgresql_raw: rawData,
        supabase_client: supabaseData,
        user_model: {
          sms_send: userModel?.sms_send,
          webrtc: userModel?.webrtc,
          auto_discagem: userModel?.auto_discagem,
          up_audio: userModel?.up_audio,
          mailling_up: userModel?.mailling_up
        },
        sanitized: sanitizeUserOutput(userModel)
      }
    };

    logger.debug('Resultado completo:', JSON.stringify(response.debug, null, 2));

    res.json(response);

  } catch (error) {
    logger.error('Erro no debug:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// PATCH /api/users-v2/:id/controls - ATUALIZAR CONTROLES (PostgreSQL direto)
// =====================================================
router.patch('/:id/controls', authenticateToken, [
  ...idValidation,
  body('field').isIn(['webrtc', 'auto_discagem', 'up_audio', 'sms_send', 'mailling_up']).withMessage('Campo inválido'),
  body('value').isBoolean().withMessage('Valor deve ser boolean')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    
    logger.debug(`Atualizando ${field} = ${value} para usuário ${id}`);

    // Verificar permissão (admin/collaborator apenas)
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros inválidos',
        details: errors.array()
      });
    }

    const { supabase } = require('../config/database');
    
    // Atualizar usando Supabase com verificação robusta
    const { data: updateData, error: updateError } = await supabase
      .from('users_pabx')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(field)
      .single();
    
    if (updateError) {
      logger.error(`Erro Supabase ao atualizar ${field}:`, updateError);
      throw new Error(`Erro do Supabase: ${updateError.message}`);
    }

    if (!updateData) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Verificar se foi atualizado corretamente
    const { data: verifyData, error: verifyError } = await supabase
      .from('users_pabx')
      .select(field)
      .eq('id', id)
      .single();

    if (verifyError) {
      logger.error(`Erro ao verificar ${field}:`, verifyError);
    }

    const actualValue = Boolean(verifyData?.[field]);
    
    logger.debug(`Campo ${field} atualizado: ${value} -> ${actualValue}`);

    // Invalidar cache
    await invalidateUsersCache();

    res.json({
      success: true,
      data: {
        field,
        old_value: !value,
        new_value: actualValue,
        verified: actualValue === value
      },
      message: `${field} ${actualValue ? 'ativado' : 'desativado'} com sucesso`
    });

  } catch (error) {
    logger.error('Erro ao atualizar controles:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// Helper: Invalidar cache relacionado aos usuários
// =====================================================
const invalidateUsersCache = async () => {
  try {
    await cacheService.invalidate('users-v2:*');
    await cacheService.invalidate('pabx:users:*');
    await cacheService.invalidate('pabx:stats:*');
    logger.cache('Cache de usuários invalidado');
  } catch (error) {
    logger.error('Erro ao invalidar cache:', error);
  }
};

// =====================================================
// POST /api/users-v2/:id/change-plan - ALTERAR PLANO (preserva vencimento)
// =====================================================
router.post('/:id/change-plan', authenticateToken, [
  ...idValidation,
  body('newPlanId').isUUID().withMessage('newPlanId inválido (UUID esperado)'),
  body('note').optional().isString().isLength({ max: 255 }).withMessage('Nota muito longa')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { newPlanId, note } = req.body;

    logger.api(`Alterando plano preservando vencimento: user=${id} -> plan=${newPlanId}`);

    // Permissão: admin/collaborator apenas
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Acesso negado.' });
    }

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
    }

    const { supabase } = require('../config/database');

    // Buscar usuário atual (datas e plano)
    const { data: userRow, error: userErr } = await supabase
      .from('users_pabx')
      .select('id, plan_id, plan_activated_at, plan_expires_at, plan_status')
      .eq('id', id)
      .single();
    if (userErr || !userRow) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    // Buscar plano novo
    const { data: newPlan, error: newPlanErr } = await supabase
      .from('planos_pabx')
      .select('id, name, price, period_days')
      .eq('id', newPlanId)
      .single();
    if (newPlanErr || !newPlan) {
      return res.status(404).json({ success: false, error: 'Plano não encontrado' });
    }

    // Buscar plano atual (quando existir)
    let currentPlan = null;
    if (userRow.plan_id) {
      const { data: curPlan, error: curPlanErr } = await supabase
        .from('planos_pabx')
        .select('id, name, price, period_days')
        .eq('id', userRow.plan_id)
        .single();
      if (!curPlanErr && curPlan) currentPlan = curPlan;
    }

    const today = new Date();
    const currentExpiration = userRow.plan_expires_at ? new Date(userRow.plan_expires_at) : today;
    // Dias restantes
    const remainingDays = currentExpiration > today ? Math.ceil((currentExpiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Valores diários
    const currentTotalDays = Number(currentPlan?.period_days || 30);
    const newTotalDays = Number(newPlan?.period_days || 30);
    const currentPrice = Number(currentPlan?.price || 0);
    const newPrice = Number(newPlan?.price || 0);
    const currentDaily = currentTotalDays > 0 ? currentPrice / currentTotalDays : 0;
    const newDaily = newTotalDays > 0 ? newPrice / newTotalDays : 0;

    const creditFromCurrent = remainingDays > 0 ? Math.round(remainingDays * currentDaily * 100) / 100 : 0;
    const proportionalNewCost = remainingDays > 0 ? Math.round(remainingDays * newDaily * 100) / 100 : 0;
    const differenceRaw = Math.round((proportionalNewCost - creditFromCurrent) * 100) / 100;
    const amount = Math.abs(differenceRaw);
    // Ajuste de semântica financeira: valor a pagar => 'credit' (entrada), reembolso => 'debit' (saída)
    const type = differenceRaw > 0 ? 'credit' : (differenceRaw < 0 ? 'debit' : null);

    // Atualizar apenas o plan_id preservando datas
    const { data: updated, error: updErr } = await supabase
      .from('users_pabx')
      .update({
        plan_id: newPlan.id,
        plan_status: true,
        plan_activated_at: userRow.plan_activated_at || null,
        plan_expires_at: userRow.plan_expires_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (updErr) {
      logger.error('Erro ao atualizar plan_id:', updErr);
      return res.status(400).json({ success: false, error: 'Não foi possível alterar o plano', details: updErr.message });
    }

    // Registrar financeiro quando houver diferença
    let finance = null;
    if (type && amount > 0) {
      try {
        await supabase.from('finance').insert({
          user_id: req.user.id,
          customer_id: id,
          amount,
          status: 'completed',
          type,
          description: note || `Alteração de plano: ${(currentPlan?.name || 'sem plano')} -> ${newPlan.name} (${remainingDays} dias restantes)` ,
          product: 'Update Plan',
          plan_id: newPlan.id,
        });
        finance = { amount, type };
      } catch (finErr) {
        logger.warn('Falha ao registrar lançamento financeiro:', finErr?.message || finErr);
      }
    }

    return res.json({
      success: true,
      message: 'Plano alterado com sucesso (vencimento preservado)',
      data: {
        user: sanitizeUserOutput(updated),
        finance,
        details: {
          remainingDays,
          currentDaily: Math.round(currentDaily * 100) / 100,
          newDaily: Math.round(newDaily * 100) / 100,
          creditFromCurrent,
          proportionalNewCost,
          difference: differenceRaw,
        }
      }
    });

  } catch (error) {
    logger.error('Erro ao alterar plano (API V2):', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor', message: error.message });
  }
});

// =====================================================
// Validações reutilizáveis
// (removido: já declarado no topo do arquivo)
// =====================================================

const sortByWhitelist = ['created_at', 'name', 'email', 'credits'];
const listUsersValidation = [
  query('search').optional().isString().trim().escape(),
  query('role').optional().isIn(['user', 'admin', 'reseller', 'collaborator', 'all']).withMessage('Role inválido'),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'all']).withMessage('Status inválido'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().isIn(sortByWhitelist).withMessage('Campo de ordenação inválido'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Ordem de ordenação inválida')
];

// =====================================================
// GET /api/users-v2 - BUSCAR USUÁRIOS (Admin)
// =====================================================
router.get('/', authenticateToken, listUsersValidation, async (req, res) => {
  try {
    logger.api('Buscando usuários...');
    
    // Verificar permissão
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem listar usuários.'
      });
    }

    // Validar query params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros de consulta inválidos',
        details: errors.array()
      });
    }

    // Extrair filtros
    const {
      search = '',
      role = '',
      status = '',
      page = 1,
      limit = 15,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Preparar filtros
    const filters = {
      limit: parseInt(limit),
      offset: offset,
      sortBy,
      sortOrder
    };

    if (search) filters.search = search;
    if (role && role !== 'all') filters.role = role;
    if (status && status !== 'all') filters.status = status;

    // Buscar usuários (usar métodos existentes no modelo)
    const result = await User.findAll(filters);
    
    // Contar total para paginação (usar método existente)
    const totalCount = await User.count(filters);
    
    const response = {
      success: true,
      data: sanitizeUserOutput(result),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      },
      meta: {
        timestamp: new Date().toISOString(),
        filters: filters
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// GET /api/users-v2/:id - BUSCAR USUÁRIO POR ID
// =====================================================
router.get('/:id', authenticateToken, idValidation, async (req, res) => {
  try {
    const { id } = req.params;
    logger.api(`Buscando usuário: ${id}`);

    // Verificar permissão (admin, collaborator ou próprio usuário)
    if (!['admin', 'collaborator'].includes(req.user.role) && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    // Validar params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros inválidos',
        details: errors.array()
      });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const sanitizedUser = sanitizeUserOutput(user);
    
    // Log detalhado dos campos de controle
    logger.debug(`Campos de controle para usuário ${id}:`, {
      original_sms_send: user.sms_send,
      original_webrtc: user.webrtc,
      original_auto_discagem: user.auto_discagem,
      original_up_audio: user.up_audio,
      original_mailling_up: user.mailling_up,
      sanitized_sms_send: sanitizedUser.sms_send,
      sanitized_webrtc: sanitizedUser.webrtc,
      sanitized_auto_discagem: sanitizedUser.auto_discagem,
      sanitized_up_audio: sanitizedUser.up_audio,
      sanitized_mailling_up: sanitizedUser.mailling_up
    });

    const response = {
      success: true,
      data: sanitizedUser,
      meta: {
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// POST /api/users-v2 - CRIAR USUÁRIO
// =====================================================
const createUserValidation = [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('username').isLength({ min: 3 }).withMessage('Username deve ter pelo menos 3 caracteres'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('role').isIn(['user', 'admin', 'reseller', 'collaborator']).withMessage('Role inválido')
];

router.post('/', authenticateToken, createUserValidation, async (req, res) => {
  try {
    logger.api('Criando usuário...');

    // Verificar permissão
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    // Validar dados
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const userData = req.body;
    
    // Hash da senha
    userData.password_hash = await bcrypt.hash(userData.password, SALT_ROUNDS);
    delete userData.password;

    // Criar usuário
    const newUser = await User.create(userData);

    // Invalidar cache relacionado
    // (Sem cache para invalidar)
    
    logger.api(`Usuário criado: ${newUser.name}`);

    res.status(201).json({
      success: true,
      data: sanitizeUserOutput(newUser),
      message: 'Usuário criado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// PUT /api/users-v2/:id - ATUALIZAR USUÁRIO
// =====================================================
router.put('/:id', authenticateToken, [
  ...idValidation,
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('name').optional().isString().isLength({ min: 2 }).withMessage('Nome inválido'),
  body('username').optional().isString().isLength({ min: 3 }).withMessage('Username inválido'),
  body('role').optional().isIn(['user', 'admin', 'reseller', 'collaborator']).withMessage('Role inválido'),
  body('status').optional().isIn(['active', 'inactive', 'suspended']).withMessage('Status inválido'),
  body('credits').optional().isFloat({ min: 0 }).withMessage('Créditos inválidos'),
], async (req, res) => {
  try {
    const { id } = req.params;
    logger.api(`Atualizando usuário: ${id}`);

    // Verificar permissão
    if (!['admin', 'collaborator'].includes(req.user.role) && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    // Validar corpo/params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const updateData = { ...req.body };
    // Se o usuário não é admin/collaborator, não pode alterar campos privilegiados
    const isPrivileged = ['admin', 'collaborator'].includes(req.user.role);
    if (!isPrivileged && req.user.id === id) {
      ['role', 'status', 'credits'].forEach((k) => delete updateData[k]);
    }
    
    // Se tem senha, fazer hash
    if (updateData.password) {
      updateData.password_hash = await bcrypt.hash(updateData.password, SALT_ROUNDS);
      delete updateData.password;
    }

    const updatedUser = await User.update(id, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Invalidar cache relacionado
    // (Sem cache para invalidar)

    res.json({
      success: true,
      data: sanitizeUserOutput(updatedUser),
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// POST /api/users-v2/:id/credits - ADICIONAR CRÉDITOS
// =====================================================
router.post('/:id/credits', authenticateToken, [
  ...idValidation,
  body('amount').isFloat({ gt: 0 }).withMessage('Valor deve ser maior que zero'),
  body('note').optional().isString().isLength({ max: 255 }).withMessage('Nota muito longa')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    
    logger.api(`Adicionando créditos para usuário: ${id}`);

    // Verificar permissão
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }
    
    // Validar corpo/params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const result = await User.addCredits(id, parseFloat(amount), note);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Registrar transação financeira (credits_adjustment)
    try {
      const { supabase } = require('../config/database');
      await supabase.from('finance').insert({
        user_id: req.user.id, // ator (admin/collaborator)
        customer_id: id, // beneficiário
        amount: parseFloat(amount),
        status: 'completed',
        type: 'credit',
        description: note || 'Crédito manual (API V2)',
        product: 'credits_adjustment'
      });
    } catch (finErr) {
      logger.warn('Falha ao registrar lançamento financeiro:', finErr?.message || finErr);
    }

    // Invalidar cache relacionado
    // (Sem cache para invalidar)

    res.json({
      success: true,
      data: sanitizeUserOutput(result),
      message: `Créditos adicionados com sucesso: R$ ${amount.toFixed(2)}`
    });

  } catch (error) {
    logger.error('Erro ao adicionar créditos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// POST /api/users-v2/:id/renew-plan - RENOVAR PLANO
// =====================================================
router.post('/:id/renew-plan', authenticateToken, [
  ...idValidation,
  body('planId').isUUID().withMessage('planId inválido (UUID esperado)')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;
    
    logger.api(`Renovando plano para usuário: ${id}`);

    // Verificar permissão
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    // Validar corpo/params
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const result = await User.renewPlan(id, planId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Usuário ou plano não encontrado'
      });
    }

    // Invalidar cache relacionado
    // (Sem cache para invalidar)

    res.json({
      success: true,
      data: sanitizeUserOutput(result),
      message: 'Plano renovado com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao renovar plano:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// GET /api/users-v2/stats - ESTATÍSTICAS DE USUÁRIOS
// =====================================================
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    logger.api('Buscando estatísticas de usuários...');

    // Verificar permissão
    if (!['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    const stats = await User.getStats();

    const response = {
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// PUT /api/users-v2/:id/change-password - ALTERAR SENHA
// =====================================================
const changePasswordValidation = [
  body('newPassword').isLength({ min: 8 }).withMessage('Nova senha deve ter pelo menos 8 caracteres'),
  body('newPassword').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Nova senha deve conter ao menos: 1 minúscula, 1 maiúscula, 1 número e 1 símbolo')
];

router.put('/:id/change-password', authenticateToken, [...idValidation, ...changePasswordValidation], async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    console.log(`🔐 [API V2] Alterando senha para usuário: ${id}`);

    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    // Verificar permissão (usuário pode alterar própria senha ou admin pode alterar qualquer uma)
    if (req.user.id !== id && !['admin', 'collaborator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Você só pode alterar sua própria senha.'
      });
    }

    // Verificar se usuário existe
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Atualizar senha no banco
    const result = await User.updatePassword(id, hashedPassword);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar senha'
      });
    }

    // Invalidar cache relacionado
    // (Sem cache para invalidar)

    console.log(`✅ Senha alterada com sucesso para usuário: ${id}`);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso',
      data: {
        userId: id,
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// =====================================================
// DELETE /api/users-v2/:id - DELETAR USUÁRIO
// =====================================================
router.delete('/:id', authenticateToken, idValidation, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ [API V2] Deletando usuário: ${id}`);

    // Verificar permissão
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem deletar usuários.'
      });
    }

    const result = await User.delete(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Invalidar cache relacionado
    // (Sem cache para invalidar)

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

module.exports = router;
