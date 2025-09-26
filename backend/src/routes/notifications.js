const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const cacheService = require('../services/cacheService');

const router = express.Router();

// Configuração do Supabase
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Middleware para debug de requisições
const debugRequest = (req, res, next) => {
  logger.debug('DEBUG REQUEST:', {
    method: req.method,
    url: req.originalUrl,
    headers: {
      'content-type': req.get('content-type'),
      'authorization': req.get('authorization') ? '***token***' : 'MISSING',
    },
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.user ? { id: req.user.id, role: req.user.role } : 'NOT_AUTHENTICATED'
  });
  next();
};

// --- Middleware para validar BIGINT ID
const validateBigIntId = (req, res, next) => {
  const { id } = req.params;
  logger.debug('Validando ID:', id);
  
  if (!/^\d+$/.test(id) || parseInt(id) <= 0) {
    logger.warn('ID inválido:', id);
    return res.status(400).json({ 
      success: false, 
      message: 'ID inválido - deve ser um número inteiro positivo',
      received_id: id
    });
  }
  logger.debug('ID válido:', id);
  next();
};

// --- Middleware para normalizar type a partir de audience/audience_type
// Se o frontend enviar "audience" ou "audience_type" e não enviar "type",
// copiamos para type antes da validação.
const normalizeTypeFromAudience = (req, res, next) => {
  try {
    if (!req.body) req.body = {};
    const typeRaw = req.body.type;
    const audienceRaw = req.body.audience;
    const audienceTypeRaw = req.body.audience_type;
    const hasType = typeRaw !== undefined && typeRaw !== null && String(typeRaw).trim() !== '';
    const hasAudience = audienceRaw !== undefined && audienceRaw !== null && String(audienceRaw).trim() !== '';
    const hasAudienceType = audienceTypeRaw !== undefined && audienceTypeRaw !== null && String(audienceTypeRaw).trim() !== '';
    if (!hasType) {
      if (hasAudience) {
        req.body.type = String(audienceRaw).trim();
        logger.debug('Normalizado type a partir de audience:', req.body.type);
      } else if (hasAudienceType) {
        req.body.type = String(audienceTypeRaw).trim();
        logger.debug('Normalizado type a partir de audience_type:', req.body.type);
      }
    }
  } catch (e) {
    logger.warn('Falha ao normalizar type de audience:', e.message);
  }
  next();
};

// --- Helpers
const parseListParams = (req) => {
  const {
    status,
    audience_type,
    search,
    limit = '20',
    offset = '0',
    orderBy = 'created_at',
    order = 'desc'
  } = req.query || {};
  
  // Whitelist de colunas para ordenação
  const allowedOrderBy = ['created_at', 'updated_at', 'expires_at', 'status', 'type', 'title'];

  const safeOrderBy = allowedOrderBy.includes(String(orderBy)) ? String(orderBy) : 'created_at';
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';

  const parsed = {
    status,
    audience_type,
    search,
    limit: Math.max(1, Math.min(100, parseInt(limit) || 20)),
    offset: Math.max(0, parseInt(offset) || 0),
    orderBy: safeOrderBy,
    order: safeOrder
  };
  
  logger.debug('Parâmetros parseados:', parsed);
  return parsed;
};

// --- Validações aprimoradas
const validateNotificationPayload = [
  body('message')
    .exists({ checkFalsy: true })
    .withMessage('Campo message é obrigatório')
    .isString()
    .withMessage('Message deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message deve ter entre 1 e 1000 caracteres'),
  
  body('title')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Title deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 150 })
    .withMessage('Title deve ter entre 1 e 150 caracteres'),
    
  body('type')
    .exists({ checkFalsy: true })
    .withMessage('Campo type é obrigatório')
    .isString()
    .withMessage('Type deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Type deve ter entre 1 e 50 caracteres'),
    
  body('status')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .withMessage('Status deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Status deve ter entre 1 e 20 caracteres')
    // Alinha com o frontend: draft | active | archived
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Status deve ser: draft, active ou archived'),
    
  body('expires_at')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      logger.debug('Validando expires_at:', value, typeof value);
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      // Verificar se é uma data ISO válida
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('expires_at deve ser uma data ISO8601 válida');
      }
      return true;
    }),
    
  body('data_termination')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      logger.debug('Validando data_termination:', value, typeof value);
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      // Verificar se é uma data ISO válida
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('data_termination deve ser uma data ISO8601 válida');
      }
      return true;
    })
];

// --- Validações de Query para listagem
// Whitelist de campos permitidos para ordenação via query
const allowedOrderByList = ['created_at', 'updated_at', 'expires_at', 'status', 'type', 'title'];

const validateListQuery = [
  query('status')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['draft', 'active', 'archived'])
    .withMessage('status inválido: use draft, active ou archived'),
  query('audience_type')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('audience_type deve ter entre 1 e 50 caracteres'),
  query('search')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('search deve ter entre 1 e 100 caracteres'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve ser um inteiro entre 1 e 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset deve ser um inteiro maior ou igual a 0')
    .toInt(),
  query('orderBy')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(allowedOrderByList)
    .withMessage(`orderBy inválido. Permitidos: ${allowedOrderByList.join(', ')}`),
  query('order')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['asc', 'desc'])
    .withMessage('order deve ser asc ou desc')
];

const validateMyListQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit deve ser um inteiro entre 1 e 100')
    .toInt(),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset deve ser um inteiro maior ou igual a 0')
    .toInt()
];

// Para updates, allow partial payload
const validateNotificationUpdatePayload = [
  body('message')
    .optional({ nullable: true })
    .isString()
    .withMessage('Message deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message deve ter entre 1 e 1000 caracteres'),
    
  body('type')
    .optional({ nullable: true })
    .isString()
    .withMessage('Type deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Type deve ter entre 1 e 50 caracteres'),
    
  body('status')
    .optional({ nullable: true })
    .isString()
    .withMessage('Status deve ser uma string')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Status deve ter entre 1 e 20 caracteres')
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Status deve ser: draft, active ou archived'),
    
  body('expires_at')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('expires_at deve ser uma data ISO8601 válida');
      }
      return true;
    }),
    
  body('data_termination')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error('data_termination deve ser uma data ISO8601 válida');
      }
      return true;
    })
];

// --- Routes

// GET /api/notifications - list
router.get('/', debugRequest, authenticateToken, requireResellerOrAdmin, validateListQuery, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros de consulta inválidos',
        errors: errors.array()
      });
    }
    logger.api('Listando notificações...');
    const params = parseListParams(req);

    let q = supabase
      .from('notifications')
      .select('id, title, message, type, status, expires_at, created_at, updated_at', { count: 'exact' });

    if (req.user.role === 'reseller') {
      logger.debug('Filtrando por user_id (reseller):', req.user.id);
      q = q.eq('user_id', req.user.id);
    }
    
    if (params.status) {
      logger.debug('Filtrando por status:', params.status);
      q = q.eq('status', params.status);
    }
    
    if (params.audience_type) {
      logger.debug('Filtrando por audience_type (type):', params.audience_type);
      q = q.eq('type', params.audience_type);
    }
    
    if (params.search) {
      const term = `%${params.search}%`;
      logger.debug('Pesquisando por:', term);
      q = q.or(`message.ilike.${term},type.ilike.${term}`);
    }

    // Ordenação e paginação
    q = q.order(params.orderBy, { ascending: params.order === 'asc' });
    q = q.range(params.offset, params.offset + params.limit - 1);

    logger.debug('Query final construída');
    const { data, error, count } = await q;
    
    if (error) {
      console.error('❌ Erro na query Supabase:', error);
      throw error;
    }

    logger.debug('Notificações encontradas:', count);
    
    // Cache control: avoid 304/client caching loops
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    return res.json({
      success: true,
      pagination: { total: count || 0, limit: params.limit, offset: params.offset },
      data: (data || []).map(n => ({ ...n, audience: n.type }))
    });
  } catch (error) {
    logger.error('Erro ao listar notificações:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/notifications/my - list notifications for current user
router.get('/my', authenticateToken, debugRequest, validateMyListQuery, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros de consulta inválidos',
        errors: errors.array()
      });
    }
    logger.api('Listando notificações do usuário:', req.user.id);
    const { limit = '20', offset = '0' } = req.query || {};
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit)));
    const safeOffset = Math.max(0, parseInt(offset));

    logger.debug('Parâmetros:', { safeLimit, safeOffset });

    // Buscar dados do usuário para saber parent_reseller_id e role
    const { data: me, error: meError } = await supabase
      .from('users_pabx')
      .select('id, role, parent_reseller_id')
      .eq('id', req.user.id)
      .single();
    if (meError) {
      logger.error('Erro ao buscar usuário atual:', meError);
      throw meError;
    }

    // Construir filtros de audiência
    const orClauses = ['type.eq.all'];
    if (me?.parent_reseller_id) {
      // Notificações criadas pela revenda do usuário e destinadas aos usuários da revenda
      orClauses.push(`and(type.eq.reseller_users,user_id.eq.${me.parent_reseller_id})`);
    }
    if (me?.role === 'reseller') {
      // Mensagens destinadas a revendedores (criadas por admin)
      orClauses.push('type.eq.resellers');
    }

    // Buscar notificações relevantes
    let q = supabase
      .from('notifications')
      .select('id, title, message, type, status, expires_at, created_at, updated_at', { count: 'exact' })
      .eq('status', 'active')
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (orClauses.length > 0) {
      const orExpr = orClauses.join(',');
      logger.debug('Filtro de audiência (OR):', orExpr);
      q = q.or(orExpr);
    }

    const { data, error, count } = await q;

    if (error) {
      console.error('❌ Erro na query Supabase:', error);
      throw error;
    }

    console.log('✅ Minhas notificações encontradas:', count);

    // Cache control: avoid 304/client caching loops
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    return res.json({
      success: true,
      pagination: { total: count || 0, limit: safeLimit, offset: safeOffset },
      data: (data || []).map(n => ({ ...n, audience: n.type }))
    });
  } catch (error) {
    console.error('❌ Erro ao listar minhas notificações:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor', 
      error: error.message 
    });
  }
});

// GET /api/notifications/:id - detail
router.get('/:id', debugRequest, validateBigIntId, authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando notificação ID:', id);
    
    const { data: n, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('❌ Erro na query Supabase:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
      }
      throw error;
    }
    
    if (!n) {
      console.log('❌ Notificação não encontrada');
      return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
    }
    
    console.log('✅ Notificação encontrada:', { id: n.id, user_id: n.user_id });
    
    if (req.user.role === 'reseller' && n.user_id !== req.user.id) {
      console.log('❌ Acesso negado - user_id não confere');
      return res.status(403).json({ success: false, message: 'Acesso negado a esta notificação' });
    }
    
    // Cache control: avoid 304/client caching loops
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    return res.json({ success: true, data: { ...n, audience: n.type } });
  } catch (error) {
    console.error('❌ Erro ao obter notificação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor', 
      error: error.message 
    });
  }
});

// POST /api/notifications - create
router.post('/', debugRequest, normalizeTypeFromAudience, authenticateToken, validateNotificationPayload, async (req, res) => {
  console.log('📝 Iniciando criação de notificação...');
  console.log('🔍 Body recebido:', JSON.stringify(req.body, null, 2));
  console.log('🔍 Content-Type:', req.get('content-type'));
  console.log('🔍 User autenticado:', req.user ? { id: req.user.id, role: req.user.role } : 'NONE');

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Erros de validação encontrados:');
    errors.array().forEach(error => {
      console.log(`   - ${error.param}: ${error.msg} (valor: ${JSON.stringify(error.value)})`);
    });
    
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos', 
      errors: errors.array(),
      received_body: req.body,
      validation_details: {
        message: 'Verifique os campos obrigatórios e formatos',
        required_fields: ['message', 'type'],
        optional_fields: ['status', 'expires_at', 'data_termination']
      }
    });
  }

  try {
    const { title, message, type } = req.body;
    let { status = 'active', expires_at, data_termination } = req.body;
    
    console.log('🔍 Dados extraídos do body:');
    console.log('   - message:', JSON.stringify(message));
    console.log('   - type:', JSON.stringify(type));
    console.log('   - status:', JSON.stringify(status));
    console.log('   - expires_at:', JSON.stringify(expires_at));
    console.log('   - data_termination:', JSON.stringify(data_termination));
    
    // Normalizar campos opcionais vazios
    if (expires_at === '' || expires_at === undefined) expires_at = null;
    if (data_termination === '' || data_termination === undefined) data_termination = null;
    
    console.log('🔍 Dados após normalização:');
    console.log('   - expires_at:', expires_at);
    console.log('   - data_termination:', data_termination);

    const userId = req.user.id;
    console.log('🔍 User ID para inserção:', userId);

    const insertData = {
      user_id: userId,
      title: title || null,
      message,
      type,
      status,
      expires_at: expires_at || null,
      data_termination: data_termination || null
    };
    
    console.log('🔍 Dados para inserção no Supabase:');
    console.log(JSON.stringify(insertData, null, 2));

    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro na inserção Supabase:', insertError);
      console.error('   - Code:', insertError.code);
      console.error('   - Message:', insertError.message);
      console.error('   - Details:', insertError.details);
      console.error('   - Hint:', insertError.hint);
      throw insertError;
    }

    console.log('✅ Notificação criada com sucesso:', notification.id);
    return res.status(201).json({ 
      success: true, 
      message: 'Notificação criada com sucesso', 
      data: { ...notification, audience: notification.type }
    });
  } catch (error) {
    console.error('❌ Erro geral ao criar notificação:', error);
    console.error('   - Stack:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor', 
      error: error.message,
      error_code: error.code,
      error_details: error.details,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/notifications/:id - update
router.put('/:id', debugRequest, validateBigIntId, normalizeTypeFromAudience, authenticateToken, validateNotificationUpdatePayload, async (req, res) => {
  console.log('✏️ Iniciando atualização de notificação...');
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Erros de validação na atualização:');
    errors.array().forEach(error => {
      console.log(`   - ${error.param}: ${error.msg}`);
    });
    
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos', 
      errors: errors.array(),
      received_body: req.body
    });
  }

  try {
    const { id } = req.params;
    console.log('🔍 Atualizando notificação ID:', id);
    
    // Buscar notificação existente
    const { data: existing, error: getError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();
    
    if (getError) {
      console.error('❌ Erro ao buscar notificação existente:', getError);
      if (getError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
      }
      throw getError;
    }
    
    if (!existing) {
      console.log('❌ Notificação não encontrada para atualização');
      return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
    }
    
    console.log('✅ Notificação existente encontrada:', { id: existing.id, user_id: existing.user_id });
    
    if (req.user.role === 'reseller' && existing.user_id !== req.user.id) {
      console.log('❌ Acesso negado na atualização - user_id não confere');
      return res.status(403).json({ success: false, message: 'Acesso negado a esta notificação' });
    }

    const { message, type, title } = req.body;
    let { status, expires_at, data_termination } = req.body;
    
    if (expires_at === '') expires_at = null;
    if (data_termination === '') data_termination = null;

    // Montar dados de atualização
    const updateData = {};
    if (message !== undefined) updateData.message = message;
    if (title !== undefined) updateData.title = title || null;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (expires_at !== undefined) updateData.expires_at = expires_at;
    if (data_termination !== undefined) updateData.data_termination = data_termination;
    
    // ✅ SEMPRE atualizar updated_at
    updateData.updated_at = new Date().toISOString();
    
    console.log('🔍 Dados para atualização:');
    console.log(JSON.stringify(updateData, null, 2));

    const { data: updated, error: updateError } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro na atualização Supabase:', updateError);
      throw updateError;
    }

    console.log('✅ Notificação atualizada com sucesso:', updated.id);
    return res.json({ 
      success: true, 
      message: 'Notificação atualizada com sucesso', 
      data: updated 
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar notificação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor', 
      error: error.message 
    });
  }
});

// DELETE /api/notifications/:id - delete
router.delete('/:id', debugRequest, validateBigIntId, authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Excluindo notificação ID:', id);
    
    const { data: row, error: fetchError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      console.error('❌ Erro ao buscar notificação para exclusão:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
      }
      throw fetchError;
    }
    
    if (!row) {
      console.log('❌ Notificação não encontrada para exclusão');
      return res.status(404).json({ success: false, message: 'Notificação não encontrada' });
    }
    
    console.log('✅ Notificação encontrada para exclusão:', { id, user_id: row.user_id });
    
    if (req.user.role === 'reseller' && String(row.user_id) !== String(req.user.id)) {
      console.log('❌ Acesso negado na exclusão - user_id não confere');
      return res.status(403).json({ success: false, message: 'Acesso negado a esta notificação' });
    }
    
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
      
    if (deleteError) {
      console.error('❌ Erro na exclusão Supabase:', deleteError);
      throw deleteError;
    }
  
    console.log('✅ Notificação excluída com sucesso:', id);
    return res.json({ success: true, message: 'Notificação excluída com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir notificação:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor', 
      error: error?.message || String(error)
    });
  }
});

module.exports = router;