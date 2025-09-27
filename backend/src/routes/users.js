const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeUserOutput } = require('../utils/sanitize');

const router = express.Router();

// =====================================================
// MIDDLEWARE DE AUTENTICAÇÃO PARA TODAS AS ROTAS
// =====================================================
router.use(authenticateToken);

// =====================================================
// GET /api/users - Buscar todos os usuários (Admin)
// =====================================================
router.get('/', async (req, res) => {
  try {
    console.log('📋 Buscando usuários...');
    
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem listar usuários.'
      });
    }

    // Extrair filtros da query
    const {
      search = '',
      role = '',
      status = '',
      page = 1,
      limit = 20
    } = req.query;

    // Calcular offset para paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Preparar filtros
    const filters = {
      limit: parseInt(limit),
      offset: offset
    };

    if (search) filters.search = search;
    if (role && role !== 'all') filters.role = role;
    if (status && status !== 'all') filters.status = status;

    // Buscar usuários e contar total
    const [users, totalCount] = await Promise.all([
      User.findAll(filters),
      User.count(filters)
    ]);

    console.log(`✅ ${users.length} usuários encontrados`);

    res.json({
      success: true,
      data: {
        users: users.map(user => sanitizeUserOutput(user)),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// GET /api/users/stats/counts-by-plan - Contagem por plano
// =====================================================
router.get('/stats/counts-by-plan', async (req, res) => {
  try {
    console.log('📊 Buscando contadores de usuários por plano...');

    // Apenas administradores
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    // Usar query SQL direta para garantir que funcione corretamente
    const { query } = require('../config/database');

    // Query SQL direta: buscar usuários que TÊM plano (plan_id IS NOT NULL)
    const result = await query(`
      SELECT id, plan_id, role, status, plan_status 
      FROM users_pabx 
      WHERE plan_id IS NOT NULL
    `);

    if (!result || !result.rows) {
      console.error('❌ Erro ao buscar usuários para contagem');
      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }

    const users = result.rows;

    console.log(`📊 Total de usuários encontrados: ${users?.length || 0}`);
    console.log('📋 Usuários encontrados:', users?.map(u => ({
      id: u.id,
      plan_id: u.plan_id,
      role: u.role,
      status: u.status,
      plan_status: u.plan_status
    })));

    // Agregar em memória respeitando plan_status quando presente
    // NOTA: plan_status pode ser boolean (true/false) ou string ('active'/'trial'/'inactive')
    const counts = {};
    for (const u of users || []) {
      // VALIDAÇÃO EXTRA: Ignorar usuários com plan_id null/undefined/vazio
      if (!u.plan_id || u.plan_id === null || u.plan_id === undefined || u.plan_id === '') {
        console.log(`⏭️  Usuário ${u.id} ignorado (plan_id: ${u.plan_id})`);
        continue;
      }
      
      // Se plan_status for boolean: true = ativo, false = inativo
      // Se plan_status for string: 'active'/'trial'/'true' = ativo, outros = inativo
      // Se plan_status for null/undefined: considerar ativo (compatibilidade)
      let allowed = true;
      if (u.plan_status !== null && u.plan_status !== undefined) {
        if (typeof u.plan_status === 'boolean') {
          allowed = u.plan_status === true;
        } else {
          // Aceitar 'true' como string também (problema do banco)
          allowed = ['active', 'trial', 'true'].includes(String(u.plan_status));
        }
      }
      
      if (!allowed) {
        console.log(`⏭️  Usuário ${u.id} ignorado (plan_status: ${u.plan_status})`);
        continue;
      }
      
      const key = String(u.plan_id);
      counts[key] = (counts[key] || 0) + 1;
      console.log(`✅ Usuário ${u.id} contabilizado no plano ${key}`);
    }

    console.log('✅ Contadores por plano calculados:', counts);

    return res.json({ success: true, data: counts });
  } catch (error) {
    console.error('❌ Erro ao calcular contadores por plano:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

// =====================================================
// GET /api/users/stats/overview - Estatísticas gerais
// =====================================================
router.get('/stats/overview', async (req, res) => {
  try {
    console.log('📊 Buscando estatísticas de usuários...');

    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    const { query } = require('../config/database');
    
    // Buscar estatísticas
    const [
      totalUsersResult,
      activeUsersResult,
      totalCreditsResult,
      usersByRoleResult
    ] = await Promise.all([
      query('SELECT COUNT(*) as total FROM users_pabx'),
      query('SELECT COUNT(*) as total FROM users_pabx WHERE status = $1', ['active']),
      query('SELECT SUM(credits) as total FROM users_pabx'),
      query(`
        SELECT role, COUNT(*) as count 
        FROM users_pabx 
        GROUP BY role 
        ORDER BY count DESC
      `)
    ]);

    const stats = {
      totalUsers: parseInt(totalUsersResult.rows[0].total),
      activeUsers: parseInt(activeUsersResult.rows[0].total),
      totalCredits: parseFloat(totalCreditsResult.rows[0].total || 0),
      usersByRole: usersByRoleResult.rows
    };

    console.log('✅ Estatísticas calculadas');

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// GET /api/users/:id - Buscar usuário por ID
// =====================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando usuário por ID:', id);

    // Verificar se é admin ou o próprio usuário
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado.'
      });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    console.log('✅ Usuário encontrado:', user.name);

    res.json({
      success: true,
      data: sanitizeUserOutput(user)
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// POST /api/users - Criar novo usuário (Admin)
// =====================================================
router.post('/', [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('username').notEmpty().withMessage('Username é obrigatório'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('company').optional(),
  body('phone').optional(),
  body('role').isIn(['user', 'admin', 'reseller', 'collaborator']).withMessage('Role inválido'),
  body('status').isIn(['active', 'inactive', 'pending', 'suspended']).withMessage('Status inválido')
], async (req, res) => {
  try {
    console.log('➕ Criando novo usuário...');

    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem criar usuários.'
      });
    }

    // Validar dados
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const {
      name,
      username,
      email,
      password,
      company = '',
      phone = '',
      role = 'user',
      status = 'active',
      planId = null,
      credits = 0
    } = req.body;

    // Verificar se email já existe
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email já está em uso'
      });
    }

    // Verificar se username já existe
    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username já está em uso'
      });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Criar usuário no banco
    const { query } = require('../config/database');
    const result = await query(`
      INSERT INTO users_pabx (
        name, username, email, password_hash, company, phone,
        role, status, credits, plan_id, created_by, timezone, language
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      name, username, email, passwordHash, company, phone,
      role, status, parseFloat(credits), planId, req.user.id,
      'America/Sao_Paulo', 'pt-BR'
    ]);

    const newUser = new User(result.rows[0]);
    console.log('✅ Usuário criado:', newUser.name);

    res.status(201).json({
      success: true,
      data: sanitizeUserOutput(newUser),
      message: 'Usuário criado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// PUT /api/users/:id/credits - Adicionar créditos
// =====================================================
router.put('/:id/credits', [
  body('amount').isNumeric().withMessage('Valor deve ser numérico'),
  body('note').optional().isString()
], async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💰 Adicionando créditos ao usuário:', id);

    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem adicionar créditos.'
      });
    }

    // Validar dados
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const { amount, note = '' } = req.body;

    // Verificar se usuário existe
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    // Adicionar créditos
    const { query } = require('../config/database');
    const newCredits = parseFloat(user.credits) + parseFloat(amount);
    
    await query(
      'UPDATE users_pabx SET credits = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newCredits, id]
    );

    // Registrar transação no histórico financeiro (finance)
    try {
      const { supabase } = require('../config/database');
      await supabase.from('finance').insert({
        user_id: req.user.id, // quem realizou a recarga
        customer_id: id, // beneficiário
        amount: parseFloat(amount),
        status: 'completed',
        type: 'credit',
        description: note || 'Crédito manual (admin)',
        product: 'credits_adjustment'
      });
    } catch (finErr) {
      console.warn('⚠️ Falha ao registrar lançamento financeiro (admin add credits):', finErr?.message || finErr);
    }

    console.log(`✅ Créditos adicionados: R$ ${amount} para ${user.name}`);

    res.json({
      success: true,
      data: {
        userId: id,
        previousCredits: parseFloat(user.credits),
        addedAmount: parseFloat(amount),
        newCredits: newCredits,
        note: note
      },
      message: `R$ ${amount} adicionados com sucesso`
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar créditos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// PUT /api/users/reseller/clients/:id/credits - Adicionar créditos ao cliente
router.put('/reseller/clients/:id/credits', [
  body('amount').isNumeric().withMessage('Valor deve ser numérico'),
  body('note').optional().isString()
], async (req, res) => {
  try {
    const { id } = req.params;
    console.log('💰 Adicionando créditos ao cliente:', id);
    
    // Verificar se é revendedor
    if (req.user.role !== 'reseller') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas revendedores podem adicionar créditos.'
      });
    }

    const { amount, note = '' } = req.body;
    const { supabase } = require('../config/database');
    
    // 🔍 VALIDAÇÃO: Verificar saldo do revendedor
    const { data: resellerData, error: resellerError } = await supabase
      .from('users_pabx')
      .select('credits, name')
      .eq('id', req.user.id)
      .single();

    if (resellerError || !resellerData) {
      console.error('❌ Erro ao buscar dados do revendedor:', resellerError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar saldo do revendedor'
      });
    }

    const resellerBalance = parseFloat(resellerData.credits || 0);
    const transferAmount = parseFloat(amount);

    // 🚫 VALIDAÇÃO: Saldo insuficiente
    if (transferAmount > resellerBalance) {
      return res.status(400).json({
        success: false,
        error: `Saldo insuficiente. Você possui R$ ${resellerBalance.toFixed(2)}, mas tentou transferir R$ ${transferAmount.toFixed(2)}.`
      });
    }
    
    // 🔍 Verificar se cliente existe e pertence ao revendedor
    const { data: clientData, error: clientError } = await supabase
      .from('users_pabx')
      .select('credits, name')
      .eq('id', id)
      .eq('created_by', req.user.id)
      .eq('role', 'user')
      .single();

    if (clientError || !clientData) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado ou não autorizado'
      });
    }

    const clientCurrentCredits = parseFloat(clientData.credits || 0);
    const clientNewCredits = clientCurrentCredits + transferAmount;
    const resellerNewBalance = resellerBalance - transferAmount;

    console.log(`💸 TRANSFERÊNCIA: R$ ${transferAmount} do revendedor (${resellerData.name}) para cliente (${clientData.name})`);
    console.log(`📊 Saldo revendedor: R$ ${resellerBalance} → R$ ${resellerNewBalance}`);
    console.log(`📊 Saldo cliente: R$ ${clientCurrentCredits} → R$ ${clientNewCredits}`);

    // 🔄 TRANSAÇÃO: Debitar do revendedor e creditar no cliente
    try {
      // 1. Debitar do revendedor
      const { error: debitError } = await supabase
        .from('users_pabx')
        .update({ 
          credits: resellerNewBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.user.id);

      if (debitError) {
        throw new Error('Erro ao debitar saldo do revendedor: ' + debitError.message);
      }

      // 2. Creditar no cliente
      const { error: creditError } = await supabase
        .from('users_pabx')
        .update({ 
          credits: clientNewCredits,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (creditError) {
        // Reverter débito do revendedor em caso de erro
        await supabase
          .from('users_pabx')
          .update({ credits: resellerBalance })
          .eq('id', req.user.id);
        
        throw new Error('Erro ao creditar cliente: ' + creditError.message);
      }

      console.log(`✅ Transferência concluída com sucesso!`);

      // Registrar lançamentos financeiros: débito do revendedor e crédito do cliente
      try {
        await supabase.from('finance').insert([
          {
            user_id: req.user.id, // quem realizou (revendedor)
            customer_id: req.user.id, // beneficiário do débito é o próprio revendedor
            amount: transferAmount,
            status: 'completed',
            type: 'debit',
            description: note || 'Transferência de créditos para cliente',
            product: 'credits_transfer'
          },
          {
            user_id: req.user.id, // quem realizou (revendedor)
            customer_id: id, // cliente beneficiário
            amount: transferAmount,
            status: 'completed',
            type: 'credit',
            description: note || 'Transferência de créditos recebida do revendedor',
            product: 'credits_transfer'
          }
        ]);
      } catch (finErr) {
        console.warn('⚠️ Falha ao registrar lançamentos de transferência (finance):', finErr?.message || finErr);
      }

      // 🚀 INVALIDAR CACHE - Limpar cache de usuários para forçar atualização
      try {
        const { cacheService } = require('../services/cacheService');
        await cacheService.clearPattern('pabx:users:*');
        console.log('🗑️ Cache de usuários invalidado após transferência de créditos');
      } catch (cacheError) {
        console.warn('⚠️ Erro ao invalidar cache:', cacheError.message);
      }

      res.json({
        success: true,
        data: {
          clientId: id,
          clientName: clientData.name,
          previousClientCredits: clientCurrentCredits,
          newClientCredits: clientNewCredits,
          transferredAmount: transferAmount,
          resellerPreviousBalance: resellerBalance,
          resellerNewBalance: resellerNewBalance,
          note: note
        },
        message: `R$ ${transferAmount.toFixed(2)} transferidos com sucesso para ${clientData.name}`
      });

    } catch (transactionError) {
      console.error('❌ Erro na transação de transferência:', transactionError);
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ Erro ao adicionar créditos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// DELETE /api/users/:id - Excluir usuário com cascata (Admin)
// =====================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Excluindo usuário (Admin):', id);
    
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem excluir usuários.'
      });
    }

    const { query } = require('../config/database');
    
    // Verificar se usuário existe
    const userCheck = await query('SELECT id, name, role FROM users_pabx WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const userName = userCheck.rows[0].name;
    const userRole = userCheck.rows[0].role;

    // Iniciar transação para exclusão em cascata
    await query('BEGIN');

    try {
      // 1. Excluir todos os agentes/ramais do usuário
      const agentsResult = await query(
        'DELETE FROM agentes_pabx WHERE user_id = $1 RETURNING id, name',
        [id]
      );
      
      const deletedAgentsCount = agentsResult.rows.length;
      console.log(`🗑️ ${deletedAgentsCount} agentes/ramais excluídos do usuário ${userName}`);

      // 2. Excluir o usuário
      await query('DELETE FROM users_pabx WHERE id = $1', [id]);

      // Confirmar transação
      await query('COMMIT');

      console.log(`✅ Usuário ${userName} excluído com sucesso (${deletedAgentsCount} ramais removidos)`);

      // 🚀 INVALIDAR CACHE - Limpar cache de usuários e agentes
      try {
        const { cacheService } = require('../services/cacheService');
        await Promise.all([
          cacheService.clearPattern('pabx:users:*'),
          cacheService.clearPattern('pabx:agents:*')
        ]);
        console.log('🗑️ Cache de usuários e agentes invalidado após exclusão');
      } catch (cacheError) {
        console.warn('⚠️ Erro ao invalidar cache:', cacheError.message);
      }

      res.json({
        success: true,
        message: `Usuário excluído com sucesso (${deletedAgentsCount} ramais removidos)`,
        data: {
          deletedUser: userName,
          deletedAgents: deletedAgentsCount
        }
      });

    } catch (transactionError) {
      // Reverter transação em caso de erro
      await query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ Erro ao excluir usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// DELETE /api/users/bulk - Excluir múltiplos usuários (Admin)
// =====================================================
router.delete('/bulk', async (req, res) => {
  try {
    const { userIds } = req.body;
    console.log('🗑️ Excluindo múltiplos usuários (Admin):', userIds);
    
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem excluir usuários.'
      });
    }

    // Validar entrada
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de IDs de usuários é obrigatória'
      });
    }

    const { query } = require('../config/database');
    
    // Verificar quais usuários existem
    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(', ');
    const userCheck = await query(
      `SELECT id, name, role FROM users_pabx WHERE id IN (${placeholders})`,
      userIds
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nenhum usuário encontrado'
      });
    }

    const existingUsers = userCheck.rows;
    const existingUserIds = existingUsers.map(u => u.id);

    // Iniciar transação para exclusão em lote
    await query('BEGIN');

    try {
      let totalDeletedAgents = 0;

      // 1. Excluir todos os agentes/ramais dos usuários
      for (const userId of existingUserIds) {
        const agentsResult = await query(
          'DELETE FROM agentes_pabx WHERE user_id = $1 RETURNING id',
          [userId]
        );
        totalDeletedAgents += agentsResult.rows.length;
      }

      // 2. Excluir os usuários
      const deleteResult = await query(
        `DELETE FROM users_pabx WHERE id IN (${placeholders}) RETURNING name`,
        existingUserIds
      );

      // Confirmar transação
      await query('COMMIT');

      const deletedCount = deleteResult.rows.length;
      const deletedNames = deleteResult.rows.map(u => u.name);

      console.log(`✅ ${deletedCount} usuários excluídos com sucesso (${totalDeletedAgents} ramais removidos)`);

      // 🚀 INVALIDAR CACHE - Limpar cache de usuários e agentes
      try {
        const { cacheService } = require('../services/cacheService');
        await Promise.all([
          cacheService.clearPattern('pabx:users:*'),
          cacheService.clearPattern('pabx:agents:*')
        ]);
        console.log('🗑️ Cache de usuários e agentes invalidado após exclusão em lote');
      } catch (cacheError) {
        console.warn('⚠️ Erro ao invalidar cache:', cacheError.message);
      }

      res.json({
        success: true,
        message: `${deletedCount} usuários excluídos com sucesso (${totalDeletedAgents} ramais removidos)`,
        data: {
          deletedCount,
          deletedUsers: deletedNames,
          deletedAgents: totalDeletedAgents
        }
      });

    } catch (transactionError) {
      // Reverter transação em caso de erro
      await query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('❌ Erro ao excluir usuários em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// DELETE /api/users/reseller/clients/:id - Excluir cliente do revendedor
router.delete('/reseller/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Excluindo cliente:', id);
    
    // Verificar se é revendedor
    if (req.user.role !== 'reseller') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas revendedores podem excluir clientes.'
      });
    }

    const { query } = require('../config/database');
    
    // Verificar se cliente existe e pertence ao revendedor
    const clientCheck = await query(
      'SELECT name FROM users_pabx WHERE id = $1 AND created_by = $2 AND role = $3',
      [id, req.user.id, 'user']
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cliente não encontrado ou não autorizado'
      });
    }

    const clientName = clientCheck.rows[0].name;

    // Excluir cliente
    await query('DELETE FROM users_pabx WHERE id = $1', [id]);

    console.log('✅ Cliente excluído:', clientName);

    res.json({
      success: true,
      message: 'Cliente excluído com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao excluir cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// PUT /api/users/:id - Atualizar usuário (Admin)
// =====================================================
router.put('/:id', [
  body('name').optional().notEmpty().withMessage('Nome não pode estar vazio'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('phone').optional(),
  body('company').optional(),
  body('status').optional().isIn(['active', 'inactive', 'pending', 'suspended']).withMessage('Status inválido'),
  body('role').optional().isIn(['user', 'admin', 'reseller', 'collaborator']).withMessage('Role inválido'),
  body('credits').optional().isNumeric().withMessage('Créditos devem ser numéricos'),
  body('sms_send').optional().isBoolean().toBoolean()
], async (req, res) => {
  try {
    const { id } = req.params;
    console.log('✏️ Atualizando usuário:', id);

    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado. Apenas administradores podem atualizar usuários.'
      });
    }

    // Validar erros de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const { query } = require('../config/database');
    
    // Verificar se usuário existe
    const userCheck = await query('SELECT id, name FROM users_pabx WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const currentUserName = userCheck.rows[0].name;

    // Preparar campos para atualização
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'email', 'phone', 'company', 'status', 'role', 'credits', 'sms_send'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        updateValues.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum campo válido fornecido para atualização'
      });
    }

    // Adicionar updated_at
    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(new Date().toISOString());
    paramIndex++;

    // Adicionar ID para WHERE clause
    updateValues.push(id);

    // Executar atualização
    const updateQuery = `
      UPDATE users_pabx 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const updatedUser = new User(result.rows[0]);
    console.log(`✅ Usuário ${currentUserName} atualizado com sucesso`);

    // 🚀 INVALIDAR CACHE - Limpar cache de usuários para forçar atualização
    try {
      const { cacheService } = require('../services/cacheService');
      await cacheService.clearPattern('pabx:users:*');
      console.log('🗑️ Cache de usuários invalidado após atualização');
    } catch (cacheError) {
      console.warn('⚠️ Erro ao invalidar cache:', cacheError.message);
    }

    res.json({
      success: true,
      data: updatedUser.toJSON(),
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
