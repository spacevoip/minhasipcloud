const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');

const router = express.Router();

// POST /api/call-logs
// Save a single final call log entry when the call has ended
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const {
      number,
      direction = 'outbound',
      started_at,
      ended_at,
      disposition_en,
      failure_cause_code = null,
      failure_status_code = null,
      agent_id = null,
      extension = null,
      campaign_id = null,
      contact_id = null,
      metadata = null,
      user_agent = null,
      ip_address = null
    } = req.body || {};

    // Basic validation
    if (!number || !started_at || !ended_at || !disposition_en) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: number, started_at, ended_at, disposition_en'
      });
    }

    const allowed = ['answered', 'failed', 'no_answer'];
    if (!allowed.includes(String(disposition_en))) {
      return res.status(400).json({ success: false, message: 'disposition_en inválido' });
    }

    // Determine accountcode (owner user id). For agent tokens, middleware sets req.user to the owner user as well.
    const accountcode = user.id;

    // Prefer server-derived IP and UA if not provided
    const clientIp = ip_address || req.ip || null;
    const clientUa = user_agent || req.headers['user-agent'] || null;

    const insert = {
      accountcode,
      agent_id,
      extension,
      number: String(number),
      direction,
      started_at: new Date(started_at).toISOString(),
      ended_at: new Date(ended_at).toISOString(),
      disposition_en,
      failure_cause_code,
      failure_status_code,
      campaign_id,
      contact_id,
      metadata: metadata || {},
      ip_address: clientIp,
      user_agent: clientUa
    };

    const { data, error } = await supabase
      .from('call_logs_pabx')
      .insert([insert])
      .select('id, duration_sec')
      .single();

    if (error) {
      console.error('❌ [call-logs] Supabase insert error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Erro ao salvar call log' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('❌ [call-logs] POST error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Erro interno do servidor' });
  }
});

module.exports = router;
