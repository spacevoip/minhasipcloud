/**
 * DIALER ROUTES - Claim de contatos por agente + fila Redis
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const cacheService = require('../services/cacheService');
const { query, supabase } = require('../config/database');

// Watermarks e limites padrão
const HIGH_WATERMARK = parseInt(process.env.DIALER_HIGH_WATERMARK || '500');
const LOW_WATERMARK = parseInt(process.env.DIALER_LOW_WATERMARK || '100');
const MAX_CLAIM_BATCH = parseInt(process.env.DIALER_MAX_CLAIM_BATCH || '200');
const RESERVE_MINUTES = parseInt(process.env.DIALER_RESERVE_MINUTES || '10');
const DIALER_PREFERRED = (process.env.DIALER_PREFERRED || 'fallback').toLowerCase(); // 'fallback' como padrão robusto

function queueKey(agentId, campaignId = null) {
  // Escopo por campanha quando especificado, evitando mistura de filas entre campanhas diferentes
  return campaignId
    ? `pabx:dialer:agent:${agentId}:campaign:${campaignId}:queue`
    : `pabx:dialer:agent:${agentId}:queue`;
}

async function canAccessAgent(req, agentId) {
  try {
    // Se token de agente: só pode acessar o próprio agentId
    if (req.agent && req.agent.id) {
      return String(req.agent.id) === String(agentId);
    }

    // Admin e collaborator podem acessar qualquer agent
    if (req.user && (req.user.role === 'admin' || req.user.role === 'collaborator')) {
      return true;
    }

    // Usuário comum: precisa ser dono do agent
    if (req.user) {
      const { data, error } = await supabase
        .from('agentes_pabx')
        .select('id, user_id')
        .eq('id', agentId)
        .single();
      if (error || !data) return false;
      return String(data.user_id) === String(req.user.id);
    }

    return false;
  } catch (e) {
    console.error('❌ [DIALER] Erro no canAccessAgent:', e);
    return false;
  }
}

async function refillIfNeeded(agentId, campaignId = null, userId = null) {
  if (!cacheService.isAvailable()) return 0; // Sem Redis: nada a fazer aqui
  let len = await cacheService.client.lLen(queueKey(agentId, campaignId));
  if (len > LOW_WATERMARK) return 0; // só reabastece quando abaixo do LOW
  let totalClaimed = 0;
  while (len < HIGH_WATERMARK) {
    const toClaim = Math.min(HIGH_WATERMARK - len, MAX_CLAIM_BATCH);
    if (toClaim <= 0) break;

    // Quando campaignId é informado, buscar somente contatos dessa campanha
    let claimed = [];
    // Preferência
    if (DIALER_PREFERRED !== 'fallback') {
      claimed = await claimContacts(agentId, toClaim, campaignId, RESERVE_MINUTES);
    }
    if ((!claimed || claimed.length === 0) && userId) {
      claimed = await fallbackClaimContacts(agentId, toClaim, campaignId, RESERVE_MINUTES, userId);
    }
    if (!claimed || claimed.length === 0) break; // nada a mais para enfileirar
    totalClaimed += claimed.length;
    const asStrings = claimed.map((x) => String(x));
    await cacheService.client.rPush(queueKey(agentId, campaignId), ...asStrings);
    len = await cacheService.client.lLen(queueKey(agentId, campaignId));
  }
  return totalClaimed;
}

async function claimContacts(agentId, batch, campaignId = null, reserveMinutes = RESERVE_MINUTES) {
  if (DIALER_PREFERRED === 'fallback') return []; // força fallback como principal
  // 1) Tentar via Supabase RPC (preferencial com SERVICE ROLE)
  try {
    const { data, error } = await supabase.rpc('claim_contacts', {
      p_agent_id: agentId,
      p_batch: batch,
      p_campaign_id: campaignId || null,
      p_reserve_minutes: reserveMinutes
    });
    if (error) {
      if (error.code === '42703') {
        // Column does not exist (e.g., mc.retry_at) => pedir para aplicar migração 033
        console.warn('⚠️ [DIALER] RPC claim_contacts erro 42703 (coluna ausente). Aplique a migração 033_ensure_mailings_contacts_retry_priority_columns.sql. Pulando fallback para evitar ruído.');
        return [];
      } else if (error.code === '42804') {
        // Return type mismatch (ex.: função espera uuid mas id é bigint) => aplicar migração 034
        console.warn('⚠️ [DIALER] RPC claim_contacts erro 42804 (tipo de retorno). Aplique a migração 034_fix_claim_contacts_return_type_bigint.sql. Pulando fallback para evitar ruído.');
        return [];
      }
      console.warn('⚠️ [DIALER] RPC claim_contacts retornou erro, tentará fallback pool.query:', error);
    } else if (Array.isArray(data)) {
      // Supabase retorna array de objetos { id } ou { contact_id } dependendo da versão da função
      const ids = data.map((r) => r.id || r.contact_id).filter(Boolean);
      return ids;
    }
  } catch (e) {
    console.warn('⚠️ [DIALER] Falha ao chamar RPC claim_contacts, tentará fallback pool.query:', e);
  }

  // 2) Fallback: pool.query (requer credenciais corretas de DB)
  try {
    // A função pode retornar contact_id: padronizar como id via alias
    const res = await query('SELECT contact_id as id FROM public.claim_contacts($1, $2, $3, $4)', [agentId, batch, campaignId, reserveMinutes]);
    return res.rows.map(r => r.id).filter(Boolean);
  } catch (e) {
    console.error('❌ [DIALER] Erro ao executar claim_contacts (fallback pool):', e);
    return [];
  }
}

// Fallback robusto: selecionar contatos prontos via Supabase e reservar
async function fallbackClaimContacts(agentId, batch, campaignId = null, reserveMinutes = RESERVE_MINUTES, userId = null) {
  try {
    if (!userId) return [];
    const nowIso = new Date().toISOString();
    const reserveUntil = new Date(Date.now() + reserveMinutes * 60000).toISOString();

    // 1) Buscar 'new' prontos
    let q1 = supabase
      .from('mailings_contacts')
      .select('id')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .eq('status', 'new')
      .order('priority', { ascending: false })
      .order('retry_at', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .limit(batch);
    if (campaignId) q1 = q1.eq('mailing_id', campaignId);
    // Só prontos: retry_at IS NULL OR <= now
    q1 = q1.or(`retry_at.is.null,retry_at.lte.${nowIso}`);
    const r1 = await q1;
    if (r1.error) throw r1.error;
    let ids = (r1.data || []).map((r) => r.id);

    // 2) Se faltou, pegar 'in_progress' expirados
    if (ids.length < batch) {
      const left = batch - ids.length;
      let q2 = supabase
        .from('mailings_contacts')
        .select('id')
        .eq('agent_id', agentId)
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .lte('reservation_expires_at', nowIso)
        .order('priority', { ascending: false })
        .order('reservation_expires_at', { ascending: true, nullsFirst: true })
        .order('id', { ascending: true })
        .limit(left);
      if (campaignId) q2 = q2.eq('mailing_id', campaignId);
      const r2 = await q2;
      if (r2.error) throw r2.error;
      const ids2 = (r2.data || []).map((r) => r.id);
      const set = new Set(ids.map(String));
      for (const i of ids2) if (!set.has(String(i))) ids.push(i);
    }

    if (ids.length === 0) return [];

    // 3) Reservar no banco (marcar em progresso) e retornar somente os que foram atualizados
    const upd = await supabase
      .from('mailings_contacts')
      .update({
        status: 'in_progress',
        locked_by: agentId,
        locked_at: nowIso,
        reservation_expires_at: reserveUntil
      })
      .in('id', ids)
      .eq('user_id', userId)
      .or(`status.eq.new,and(status.eq.in_progress,reservation_expires_at.lte.${nowIso})`)
      .select('id');
    if (upd.error) throw upd.error;

    // Normalizar e preservar ordem original na medida do possível
    const updatedIdsSet = new Set((upd.data || []).map((r) => String(r.id)));
    const finalIds = ids.filter((x) => updatedIdsSet.has(String(x)));
    return finalIds;
  } catch (e) {
    console.warn('⚠️ [DIALER] fallbackClaimContacts erro:', e);
    return [];
  }
}

async function getContactById(contactId) {
  // 1) Preferir supabase client (evita dependência do pool direto)
  try {
    const idValue = (/^\d+$/.test(String(contactId))) ? Number(contactId) : contactId; // bigint compat
    const { data, error } = await supabase
      .from('mailings_contacts')
      .select('id, name, phone, mailing_id, user_id, agent_id, dados_extras, status, attempt_count, retry_at, priority')
      .eq('id', idValue)
      .single();
    if (!error && data) return data;
    if (error) console.warn('⚠️ [DIALER] Supabase getContactById erro, tentando fallback pool:', error);
  } catch (e) {
    console.warn('⚠️ [DIALER] Falha supabase getContactById, tentando fallback pool:', e);
  }

  // 2) Fallback via pool
  try {
    const sql = `
      SELECT id, name, phone, mailing_id, user_id, agent_id, dados_extras, status, attempt_count, retry_at, priority
      FROM public.mailings_contacts
      WHERE id = $1
    `;
    const res = await query(sql, [contactId]);
    return res.rows[0] || null;
  } catch (e) {
    console.error('❌ [DIALER] getContactById (fallback pool) erro:', e);
    return null;
  }
}

// GET próximo contato do agente
router.get('/agents/:agentId/next', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { campaignId = null } = req.query || {};
    if (!(await canAccessAgent(req, agentId))) {
      return res.status(403).json({ success: false, error: 'Acesso negado ao agente' });
    }

    // Com Redis
    if (cacheService.isAvailable()) {
      // Refill assíncrono se necessário (não bloquear)
      const userId = (req.user && req.user.id) || (req.agent && req.agent.user_id) || null;
      refillIfNeeded(agentId, campaignId, userId).catch(() => {});

      // Consumir 1 ID
      let id = await cacheService.client.lPop(queueKey(agentId, campaignId));

      // Se vazio, tentar claim imediato mínimo
      if (!id) {
        const amount = Math.min(LOW_WATERMARK, MAX_CLAIM_BATCH);
        let claimed = await claimContacts(agentId, amount, campaignId);
        if ((!claimed || claimed.length === 0) && userId) {
          claimed = await fallbackClaimContacts(agentId, amount, campaignId, RESERVE_MINUTES, userId);
        }
        if (claimed.length > 0) {
          // Devolver um e enfileirar o resto
          id = claimed.shift();
          if (claimed.length > 0) {
            await cacheService.client.rPush(queueKey(agentId, campaignId), ...claimed.map(String));
          }
        }
      }

      if (!id) {
        return res.status(204).json({ success: true, message: 'Sem contatos disponíveis' });
      }

      const contact = await getContactById(id);
      if (!contact) {
        return res.status(404).json({ success: false, error: 'Contato não encontrado' });
      }

      return res.json({ success: true, data: contact });
    }

    // Sem Redis: usar fallback como principal
    const amount = 1;
    let claimed = await claimContacts(agentId, amount, campaignId);
    if (!claimed || claimed.length === 0) {
      const userId = (req.user && req.user.id) || (req.agent && req.agent.user_id) || null;
      if (userId) {
        claimed = await fallbackClaimContacts(agentId, amount, campaignId, RESERVE_MINUTES, userId);
      }
    }
    if (!claimed || claimed.length === 0) {
      return res.status(204).json({ success: true, message: 'Sem contatos disponíveis' });
    }
    const contact = await getContactById(claimed[0]);
    return res.json({ success: true, data: contact });
  } catch (e) {
    console.error('❌ [DIALER] /next error:', e);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// POST claim manual (admin/colaborador ou próprio agente)
router.post('/agents/:agentId/claim', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { batch = 100, campaignId = null } = req.body || {};

    if (!(await canAccessAgent(req, agentId))) {
      return res.status(403).json({ success: false, error: 'Acesso negado ao agente' });
    }

    const amount = Math.max(1, Math.min(parseInt(batch) || 1, MAX_CLAIM_BATCH));
    let ids = await claimContacts(agentId, amount, campaignId);
    if (!ids || ids.length === 0) {
      const userId = (req.user && req.user.id) || (req.agent && req.agent.user_id) || null;
      if (userId) ids = await fallbackClaimContacts(agentId, amount, campaignId, RESERVE_MINUTES, userId);
    }

    if (cacheService.isAvailable() && ids.length > 0) {
      await cacheService.client.rPush(queueKey(agentId, campaignId), ...ids.map(String));
    }

    return res.json({ success: true, data: { claimed: ids.length, ids } });
  } catch (e) {
    console.error('❌ [DIALER] /claim error:', e);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// POST completar contato
router.post('/contacts/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { outcome = 'completed', notes = null } = req.body || {};

    const allowed = ['completed', 'failed', 'dnc', 'invalid'];
    const finalOutcome = allowed.includes(outcome) ? outcome : 'completed';

    const sql = `UPDATE public.mailings_contacts
                 SET status = $1,
                     locked_by = NULL,
                     locked_at = NULL,
                     reservation_expires_at = NULL,
                     is_dialed = TRUE,
                     dialed_at = NOW()
                 WHERE id = $2
                 RETURNING id`;
    const result = await query(sql, [finalOutcome, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Contato não encontrado' });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('❌ [DIALER] /complete error:', e);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// POST reagendar contato (retry)
router.post('/contacts/:id/retry', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { retryAt = null, delaySeconds = null, priority = null } = req.body || {};

    let retryDate = null;
    if (retryAt) retryDate = new Date(retryAt);
    if (!retryDate && delaySeconds) retryDate = new Date(Date.now() + (parseInt(delaySeconds) || 60) * 1000);

    const sql = `UPDATE public.mailings_contacts
                 SET status = 'new',
                     attempt_count = attempt_count + 1,
                     retry_at = $1,
                     locked_by = NULL,
                     locked_at = NULL,
                     reservation_expires_at = NULL,
                     priority = COALESCE($2, priority)
                 WHERE id = $3
                 RETURNING id`;

    const result = await query(sql, [retryDate, priority, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Contato não encontrado' });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error('❌ [DIALER] /retry error:', e);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// GET status da fila (debug)
router.get('/agents/:agentId/queue', authenticateToken, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { campaignId = null } = req.query || {};
    if (!(await canAccessAgent(req, agentId))) {
      return res.status(403).json({ success: false, error: 'Acesso negado ao agente' });
    }

    if (!cacheService.isAvailable()) {
      return res.json({ success: true, data: { redis: false, len: 0 } });
    }

    const len = await cacheService.client.lLen(queueKey(agentId, campaignId));
    return res.json({ success: true, data: { redis: true, len } });
  } catch (e) {
    console.error('❌ [DIALER] /queue error:', e);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

module.exports = router;
