const express = require('express');
const { body, validationResult } = require('express-validator');
const Plan = require('../models/Plan');
const { query } = require('../config/database');
const { authenticateToken, requireResellerOrAdmin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Helpers
const parseListParams = (req) => {
  const {
    status,
    search,
    created_by,
    reseller_id,
    limit = '20',
    offset = '0',
    orderBy = 'created_at',
    order = 'desc'
  } = req.query || {};

  return {
    status,
    search,
    created_by,
    reseller_id,
    limit: Math.max(1, Math.min(100, parseInt(limit))),
    offset: Math.max(0, parseInt(offset)),
    orderBy,
    order: String(order).toLowerCase() === 'asc' ? 'asc' : 'desc'
  };
};

const attachCounts = async (plans) => {
  const planIds = plans.map(p => p.id);
  const countsMap = await Plan.getUsersCountForPlans(planIds);
  return plans.map(p => ({ ...p.toJSON(), userCount: countsMap[p.id] || 0 }));
};

// GET /api/v2/plans - listagem com filtros/paginação e contadores agregados
router.get('/', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const params = parseListParams(req);

    // Escopo para reseller: força filtro por created_by/reseller_id
    if (req.user.role === 'reseller') {
      params.created_by = req.user.id;
      params.reseller_id = req.user.id;
    }

    const { items, total } = await Plan.searchAndPaginate(params);
    const withCounts = await attachCounts(items);

    res.json({
      success: true,
      countsIncluded: true,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset
      },
      data: withCounts
    });
  } catch (error) {
    console.error('❌ V2: Erro ao listar planos:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/v2/plans/active - apenas ativos (com paginação opcional)
router.get('/active', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const params = parseListParams(req);
    params.status = 'active';

    if (req.user.role === 'reseller') {
      params.created_by = req.user.id;
      params.reseller_id = req.user.id;
    }

    const { items, total } = await Plan.searchAndPaginate(params);
    const withCounts = await attachCounts(items);

    res.json({
      success: true,
      countsIncluded: true,
      pagination: {
        total,
        limit: params.limit,
        offset: params.offset
      },
      data: withCounts
    });
  } catch (error) {
    console.error('❌ V2: Erro ao listar planos ativos:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/v2/plans/:id - detalhe com contagem
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    // Verificar permissões baseadas no role
    if (req.user.role === 'user') {
      // Usuários normais só podem ver seu próprio plano
      const userPlanId = req.user.planId || req.user.plan_id; // compat: model usa planId
      if (userPlanId !== id) {
        return res.status(403).json({ success: false, message: 'Acesso negado a este plano' });
      }
    } else if (req.user.role === 'reseller') {
      // Revendedores só podem ver planos que criaram
      if (plan.createdBy !== req.user.id && plan.resellerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado a este plano' });
      }
    }
    // Admins podem ver qualquer plano

    const userCount = await Plan.getUserCountByPlan(plan.id);
    res.json({ success: true, data: { ...plan.toJSON(), userCount } });
  } catch (error) {
    console.error('❌ V2: Erro ao buscar plano por ID:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// Validações compartilhadas
const planValidators = [
  body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('price').optional().isNumeric().withMessage('Preço deve ser número').isFloat({ min: 0 }).withMessage('Preço >= 0'),
  body('max_agents').optional().isInt({ min: 1 }).withMessage('max_agents >= 1'),
  body('period_days').optional().isInt({ min: 1 }).withMessage('period_days >= 1'),
  body('features').optional().isArray().withMessage('features deve ser array'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('status inválido'),
];

// POST /api/v2/plans - criar (admin ou reseller)
router.post('/', authenticateToken, requireResellerOrAdmin, [
  body('name').notEmpty().withMessage('Nome obrigatório'),
  body('price').isNumeric().withMessage('Preço deve ser número').isFloat({ min: 0 }),
  body('max_agents').isInt({ min: 1 }),
  body('period_days').isInt({ min: 1 }),
  body('features').isArray(),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  // Validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Dados inválidos', errors: errors.array() });
  }

  try {
    const payload = { ...req.body };

    // Ownership automático para reseller
    if (req.user.role === 'reseller') {
      payload.created_by = req.user.id;
      payload.reseller_id = req.user.id;
    }

    const plan = await Plan.create(payload);
    res.status(201).json({ success: true, message: 'Plano criado com sucesso', data: plan.toJSON() });
  } catch (error) {
    console.error('❌ V2: Erro ao criar plano:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// PUT /api/v2/plans/:id - atualizar (admin ou reseller owner)
router.put('/:id', authenticateToken, requireResellerOrAdmin, planValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Dados inválidos', errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    if (req.user.role === 'reseller') {
      if (plan.createdBy !== req.user.id && plan.resellerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado a este plano' });
      }
    }

    const updated = await plan.update(req.body);
    res.json({ success: true, message: 'Plano atualizado com sucesso', data: updated.toJSON() });
  } catch (error) {
    console.error('❌ V2: Erro ao atualizar plano:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// GET /api/v2/plans/stats - estatísticas agregadas
router.get('/stats', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const isReseller = req.user && req.user.role === 'reseller';
    const resellerId = isReseller ? req.user.id : null;

    const planScopeWhere = isReseller
      ? 'WHERE (reseller_id = $1 OR created_by = $1)'
      : '';
    const params = isReseller ? [resellerId] : [];

    // total planos
    const totalSql = `SELECT COUNT(*)::int AS c FROM planos_pabx ${planScopeWhere}`;
    const totalRes = await query(totalSql, params);
    const total = totalRes?.rows?.[0]?.c || 0;

    // ativos
    const activeSql = `SELECT COUNT(*)::int AS c FROM planos_pabx ${planScopeWhere} ${planScopeWhere ? ' AND' : 'WHERE'} status = 'active'`;
    const activeRes = await query(activeSql, params);
    const active = activeRes?.rows?.[0]?.c || 0;

    // inativos
    const inactiveSql = `SELECT COUNT(*)::int AS c FROM planos_pabx ${planScopeWhere} ${planScopeWhere ? ' AND' : 'WHERE'} status = 'inactive'`;
    const inactiveRes = await query(inactiveSql, params);
    const inactive = inactiveRes?.rows?.[0]?.c || 0;

    // assinantes totais
    const subscribersSql = isReseller
      ? `SELECT COUNT(*)::int AS c FROM users_pabx u WHERE u.plan_id IN (SELECT id FROM planos_pabx WHERE reseller_id = $1 OR created_by = $1)`
      : `SELECT COUNT(*)::int AS c FROM users_pabx WHERE plan_id IS NOT NULL`;
    const subsRes = await query(subscribersSql, params);
    const total_subscribers = subsRes?.rows?.[0]?.c || 0;

    // receita total (placeholder)
    const total_revenue = 0;

    return res.json({ success: true, data: { total, active, inactive, total_subscribers, total_revenue } });
  } catch (error) {
    console.error('❌ V2: Erro ao obter estatísticas de planos:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

// DELETE /api/v2/plans/:id - excluir (admin ou reseller owner)
router.delete('/:id', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    if (req.user.role === 'reseller') {
      if (plan.createdBy !== req.user.id && plan.resellerId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado a este plano' });
      }
    }

    // Guard: impedir exclusão se houver usuários vinculados
    const userCount = await Plan.getUserCountByPlan(id);
    if (userCount > 0) {
      return res.status(400).json({ success: false, message: `Não é possível excluir. Existem ${userCount} usuário(s) usando este plano.` });
    }

    await plan.delete();
    res.json({ success: true, message: 'Plano excluído com sucesso' });
  } catch (error) {
    console.error('❌ V2: Erro ao excluir plano:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

module.exports = router;

// ---
// Nota: As rotas acima permanecem inalteradas. Abaixo foi adicionada a rota de estatísticas.

