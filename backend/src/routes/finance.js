const express = require('express');
const { authenticateToken, requireResellerOrAdmin } = require('../middleware/auth');
const { supabase } = require('../config/database');

const router = express.Router();

// GET /api/finance - list transactions
// Query params: status, startDate, endDate, user_id, reseller_id, limit, offset, orderBy, order
router.get('/', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const {
      status,
      startDate,
      endDate,
      user_id,
      reseller_id,
      limit = '20',
      offset = '0',
      orderBy = 'created_at',
      order = 'desc'
    } = req.query || {};

    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    const safeOrder = String(order).toLowerCase() === 'asc' ? true : false;

    let q = supabase
      .from('finance')
      .select('id, user_id, reseller_id, customer_id, amount, status, created_at, type, description, product, plan_id', { count: 'exact' })
      .order(orderBy, { ascending: safeOrder })
      .range(safeOffset, safeOffset + safeLimit - 1);

    // Role-based scoping
    if (req.user.role === 'reseller') {
      q = q.eq('reseller_id', req.user.id);
    }

    // Optional filters (admin can pass them; reseller is scoped already)
    if (status) q = q.eq('status', status);
    if (user_id) q = q.eq('user_id', user_id);
    if (reseller_id && req.user.role === 'admin') q = q.eq('reseller_id', reseller_id);

    if (startDate && endDate) {
      q = q.gte('created_at', startDate).lte('created_at', endDate);
    } else if (startDate) {
      q = q.gte('created_at', startDate);
    } else if (endDate) {
      q = q.lte('created_at', endDate);
    }

    const { data, error, count } = await q;
    if (error) {
      console.error('❌ Supabase error (finance list):', error);
      return res.status(500).json({ success: false, message: 'Erro ao buscar transações', error: error.message });
    }

    // Fallback temporário: se customer_id estiver vazio, usar user_id ou reseller_id como beneficiário
    const enrichedData = (data || []).map((row) => ({
      ...row,
      customer_id: row.customer_id || row.user_id || row.reseller_id || null
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({ success: true, pagination: { total: count || 0, limit: safeLimit, offset: safeOffset }, data: enrichedData });
  } catch (e) {
    console.error('❌ Erro geral /api/finance:', e);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: e.message });
  }
});

// POST /api/finance - create a new transaction
// Body: { customer_id, amount, type, description, product, plan_id, status }
router.post('/', authenticateToken, requireResellerOrAdmin, async (req, res) => {
  try {
    const performerId = req.user.id; // quem realizou
    const performerRole = req.user.role; // admin ou reseller

    const {
      customer_id = null,
      amount,
      type = 'credit',
      description = null,
      product = null,
      plan_id = null,
      status = 'completed'
    } = req.body || {};

    // Validações básicas
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valor "amount" deve ser número > 0' });
    }

    // Escopo: se for reseller, força reseller_id do próprio usuário
    const reseller_id = performerRole === 'reseller' ? performerId : (req.body?.reseller_id || null);

    const insertPayload = {
      user_id: performerId,
      reseller_id,
      customer_id,
      amount,
      status,
      type,
      description,
      product,
      plan_id
    };

    const { data, error } = await supabase
      .from('finance')
      .insert([insertPayload])
      .select('id, user_id, reseller_id, customer_id, amount, status, created_at, type, description, product, plan_id')
      .single();

    if (error) {
      console.error('❌ Supabase error (finance create):', error);
      return res.status(500).json({ success: false, message: 'Erro ao criar transação', error: error.message });
    }

    // Fallback beneficiário, como no GET
    const enriched = { ...data, customer_id: data.customer_id || data.user_id || data.reseller_id || null };

    return res.status(201).json({ success: true, data: enriched });
  } catch (e) {
    console.error('❌ Erro geral POST /api/finance:', e);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor', error: e.message });
  }
});

module.exports = router;
