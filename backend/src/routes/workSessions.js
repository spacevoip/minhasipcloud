const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');

const router = express.Router();

// Util: agora do servidor
const serverNow = () => new Date().toISOString();

// GET /api/work-sessions/active -> sessão e pausa abertas
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const isAgent = !!req.agent?.id;
    if (!isAgent) {
      return res.status(403).json({ success: false, message: 'Apenas agentes podem usar esta rota' });
    }

    const agentId = req.agent.id;
    const ownerId = req.agent.user_id || req.user.id;

    const { data: session, error: sErr } = await supabase
      .from('agent_work_sessions')
      .select('id, agent_id, owner_user_id, agent_name, started_at, ended_at')
      .eq('agent_id', agentId)
      .is('ended_at', null)
      .maybeSingle();

    if (sErr) throw sErr;

    let currentBreak = null;
    let closedBreakSeconds = 0;
    if (session) {
      const { data: brk, error: bErr } = await supabase
        .from('agent_work_breaks')
        .select('id, session_id, reason_code, reason_text, started_at, ended_at')
        .eq('session_id', session.id)
        .is('ended_at', null)
        .maybeSingle();
      if (bErr) throw bErr;
      currentBreak = brk || null;

      // Somar pausas já encerradas nesta sessão
      const { data: closedBreaks, error: cbErr } = await supabase
        .from('agent_work_breaks')
        .select('started_at, ended_at')
        .eq('session_id', session.id)
        .not('ended_at', 'is', null);
      if (cbErr) throw cbErr;
      if (Array.isArray(closedBreaks)) {
        closedBreakSeconds = closedBreaks.reduce((acc, b) => {
          const s = new Date(b.started_at).getTime();
          const e = new Date(b.ended_at || serverNow()).getTime();
          return acc + Math.max(0, Math.floor((e - s) / 1000));
        }, 0);
      }
    }

    return res.json({ success: true, data: { session: session || null, break: currentBreak, closed_break_seconds: closedBreakSeconds, server_time: serverNow() } });
  } catch (err) {
    console.error('[WorkSessions] GET /active error:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// POST /api/work-sessions/start -> inicia (ou retorna existente)
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const isAgent = !!req.agent?.id;
    if (!isAgent) return res.status(403).json({ success: false, message: 'Apenas agentes' });

    const agentId = req.agent.id;
    const ownerId = req.agent.user_id || req.user.id;

    // Existe aberta?
    const { data: existing, error: exErr } = await supabase
      .from('agent_work_sessions')
      .select('id, agent_id, owner_user_id, agent_name, started_at, ended_at')
      .eq('agent_id', agentId)
      .is('ended_at', null)
      .maybeSingle();

    if (exErr) throw exErr;
    if (existing) return res.json({ success: true, data: { session: existing, server_time: serverNow() } });

    // Criar
    const { data: agentRow, error: aErr } = await supabase
      .from('agentes_pabx')
      .select('id, agente_name')
      .eq('id', agentId)
      .single();
    if (aErr || !agentRow) return res.status(400).json({ success: false, message: 'Agente não encontrado' });

    const { data: created, error: cErr } = await supabase
      .from('agent_work_sessions')
      .insert({ agent_id: agentId, owner_user_id: ownerId, agent_name: agentRow.agente_name })
      .select('id, agent_id, owner_user_id, agent_name, started_at, ended_at')
      .single();
    if (cErr) throw cErr;

    return res.json({ success: true, data: { session: created, server_time: serverNow() } });
  } catch (err) {
    console.error('[WorkSessions] POST /start error:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// POST /api/work-sessions/pause -> abre pausa (ou retorna existente)
router.post('/pause', authenticateToken, async (req, res) => {
  try {
    const isAgent = !!req.agent?.id;
    if (!isAgent) return res.status(403).json({ success: false, message: 'Apenas agentes' });

    const agentId = req.agent.id;
    const ownerId = req.agent.user_id || req.user.id;
    const { reason_code = null, reason_text = null } = req.body || {};

    // Garantir sessão aberta
    const { data: session, error: sErr } = await supabase
      .from('agent_work_sessions')
      .select('id, started_at')
      .eq('agent_id', agentId)
      .is('ended_at', null)
      .single();
    if (sErr || !session) return res.status(400).json({ success: false, message: 'Nenhuma sessão aberta' });

    // Pausa existente?
    const { data: existing, error: exErr } = await supabase
      .from('agent_work_breaks')
      .select('id, session_id, reason_code, reason_text, started_at, ended_at')
      .eq('session_id', session.id)
      .is('ended_at', null)
      .maybeSingle();
    if (exErr) throw exErr;
    if (existing) return res.json({ success: true, data: { break: existing, session, server_time: serverNow() } });

    // Criar pausa
    const { data: created, error: cErr } = await supabase
      .from('agent_work_breaks')
      .insert({ session_id: session.id, agent_id: agentId, owner_user_id: ownerId, reason_code, reason_text })
      .select('id, session_id, reason_code, reason_text, started_at, ended_at')
      .single();
    if (cErr) throw cErr;

    return res.json({ success: true, data: { break: created, session, server_time: serverNow() } });
  } catch (err) {
    console.error('[WorkSessions] POST /pause error:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// POST /api/work-sessions/resume -> fecha pausa se existir
router.post('/resume', authenticateToken, async (req, res) => {
  try {
    const isAgent = !!req.agent?.id;
    if (!isAgent) return res.status(403).json({ success: false, message: 'Apenas agentes' });

    const agentId = req.agent.id;

    // Obter sessão aberta
    const { data: session, error: sErr } = await supabase
      .from('agent_work_sessions')
      .select('id')
      .eq('agent_id', agentId)
      .is('ended_at', null)
      .single();
    if (sErr || !session) return res.status(400).json({ success: false, message: 'Nenhuma sessão aberta' });

    // Obter pausa aberta
    const { data: brk, error: bErr } = await supabase
      .from('agent_work_breaks')
      .select('id')
      .eq('session_id', session.id)
      .is('ended_at', null)
      .maybeSingle();
    if (bErr) throw bErr;

    if (!brk) return res.json({ success: true, data: { session, server_time: serverNow() } });

    const { data: updated, error: uErr } = await supabase
      .from('agent_work_breaks')
      .update({ ended_at: serverNow() })
      .eq('id', brk.id)
      .select('id, session_id, reason_code, reason_text, started_at, ended_at')
      .single();
    if (uErr) throw uErr;

    return res.json({ success: true, data: { session, closed_break: updated, server_time: serverNow() } });
  } catch (err) {
    console.error('[WorkSessions] POST /resume error:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// POST /api/work-sessions/stop -> fecha sessão (fecha pausa aberta também)
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const isAgent = !!req.agent?.id;
    if (!isAgent) return res.status(403).json({ success: false, message: 'Apenas agentes' });

    const agentId = req.agent.id;

    const { data: session, error: sErr } = await supabase
      .from('agent_work_sessions')
      .select('id')
      .eq('agent_id', agentId)
      .is('ended_at', null)
      .single();
    if (sErr || !session) return res.status(400).json({ success: false, message: 'Nenhuma sessão aberta' });

    // Fechar pausa aberta se houver
    const { data: brk, error: bErr } = await supabase
      .from('agent_work_breaks')
      .select('id')
      .eq('session_id', session.id)
      .is('ended_at', null)
      .maybeSingle();
    if (bErr) throw bErr;
    if (brk) {
      await supabase
        .from('agent_work_breaks')
        .update({ ended_at: serverNow() })
        .eq('id', brk.id);
    }

    const { data: updated, error: uErr } = await supabase
      .from('agent_work_sessions')
      .update({ ended_at: serverNow() })
      .eq('id', session.id)
      .select('id, agent_id, owner_user_id, agent_name, started_at, ended_at')
      .single();
    if (uErr) throw uErr;

    return res.json({ success: true, data: { session: updated, server_time: serverNow() } });
  } catch (err) {
    console.error('[WorkSessions] POST /stop error:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// GET /api/work-sessions/today-summary?tz=America/Sao_Paulo
router.get('/today-summary', authenticateToken, async (req, res) => {
  try {
    const isAgent = !!req.agent?.id;
    if (!isAgent) return res.status(403).json({ success: false, message: 'Apenas agentes' });

    const agentId = req.agent.id;
    const tz = req.query.tz || 'America/Sao_Paulo';

    // Cálculo simples usando Supabase RPC não disponível -> fazer via SQL agregada futura.
    // Por ora, buscar sessões de hoje e somar em JS (mantendo simples).
    const { data: sessions, error: sErr } = await supabase
      .from('agent_work_sessions')
      .select('id, started_at, ended_at')
      .eq('agent_id', agentId)
      .gte('started_at', new Date(new Date().toLocaleString('en-US', { timeZone: tz }).split(',')[0]).toISOString());
    if (sErr) throw sErr;

    let totalSeconds = 0;
    let breakSeconds = 0;

    for (const s of (sessions || [])) {
      const sStart = new Date(s.started_at).getTime();
      const sEnd = new Date(s.ended_at || serverNow()).getTime();
      totalSeconds += Math.max(0, Math.floor((sEnd - sStart) / 1000));

      const { data: breaks, error: bErr } = await supabase
        .from('agent_work_breaks')
        .select('started_at, ended_at')
        .eq('session_id', s.id);
      if (bErr) throw bErr;
      for (const b of (breaks || [])) {
        const bStart = new Date(b.started_at).getTime();
        const bEnd = new Date(b.ended_at || serverNow()).getTime();
        breakSeconds += Math.max(0, Math.floor((bEnd - bStart) / 1000));
      }
    }

    const netSeconds = Math.max(0, totalSeconds - breakSeconds);

    return res.json({ success: true, data: { total_seconds: totalSeconds, break_seconds: breakSeconds, net_seconds: netSeconds } });
  } catch (err) {
    console.error('[WorkSessions] GET /today-summary error:', err);
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

module.exports = router;
