const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');

const router = express.Router();

// Preferential CDR tables if env is not set
const CDR_TABLE_CANDIDATES = ['cdr_pabx', 'calls_pabx', 'cdr'];

// Resolve which table to use for CDR (duplicate of logic in cdr.js for independence)
async function resolveCdrTable(preferred) {
  const tried = [];
  const list = [];
  if (preferred && typeof preferred === 'string') list.push(preferred);
  for (const t of CDR_TABLE_CANDIDATES) {
    if (!list.includes(t)) list.push(t);
  }
  for (const table of list) {
    try {
      const { error } = await supabase
        .from(table)
        .select('uniqueid', { head: false, count: 'exact' })
        .limit(1);
      if (!error) {
        return { table, tried };
      }
      tried.push({ table, error: error.message });
    } catch (e) {
      tried.push({ table, error: e?.message || String(e) });
    }
  }
  return { table: preferred || 'cdr', tried };
}

// Extract trunk name from a dstchannel like: PJSIP/master-00000011
function extractTrunkFromDstChannel(dstchannel) {
  if (!dstchannel || typeof dstchannel !== 'string') return null;
  const m1 = dstchannel.match(/^PJSIP\/([A-Za-z0-9_\-\.]+)-/i);
  if (m1) return m1[1];
  const m2 = dstchannel.match(/^SIP\/([A-Za-z0-9_\-\.]+)-/i);
  if (m2) return m2[1];
  return null;
}

// Normalize disposition to buckets
function bucketDisposition(d) {
  const disp = String(d || '').toUpperCase().replace(/\s+/g, '_');
  if (disp === 'ANSWERED') return 'answered';
  if (disp === 'NO_ANSWER' || disp === 'NOANSWER' || disp === 'CANCEL') return 'no_answer';
  if (disp === 'BUSY') return 'busy';
  if (disp === 'FAILED' || disp.includes('FAIL') || disp === 'CONGESTION' || disp === 'CHANUNAVAIL') return 'failed';
  return 'other';
}

router.use(authenticateToken);

// GET /api/terminations
// Query params: startDate, endDate, all (admins/collaborators only)
router.get('/', async (req, res) => {
  try {
    const user = req.user;
    const role = user?.role || 'user';

    // 1) Load trunks from ps_endpoint_id_ips
    const { data: trunks, error: trunksErr } = await supabase
      .from('ps_endpoint_id_ips')
      .select('name, match, status, tarifa');

    if (trunksErr) throw trunksErr;

    let startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    let endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    // Default to today (00:00 -> now) if no dates provided
    if (!startDate && !endDate) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      startDate = d;
    }
    const preferred = process.env.CDR_TABLE && String(process.env.CDR_TABLE).trim();
    const { table: cdrTable } = await resolveCdrTable(preferred);

    // 2) Fetch CDR rows with minimal columns and aggregate in Node
    const all = String(req.query.all) === 'true' && (role === 'admin' || role === 'collaborator');
    let q = supabase
      .from(cdrTable)
      .select('dstchannel, disposition, calldate, accountcode', { head: false })
      .order('calldate', { ascending: false });
    if (!all) q = q.eq('accountcode', user.id);
    if (startDate) q = q.gte('calldate', startDate.toISOString());
    if (endDate) q = q.lte('calldate', endDate.toISOString());

    const { data: rows, error: rowsErr } = await q;
    if (rowsErr) throw rowsErr;

    // 3) Aggregate per trunk
    const statsByTrunk = new Map();
    for (const r of rows || []) {
      const trunk = extractTrunkFromDstChannel(r.dstchannel);
      if (!trunk) continue;
      if (!statsByTrunk.has(trunk)) {
        statsByTrunk.set(trunk, { total: 0, answered: 0, no_answer: 0, busy: 0, failed: 0, other: 0 });
      }
      const b = statsByTrunk.get(trunk);
      const bucket = bucketDisposition(r.disposition);
      b.total += 1;
      if (bucket in b) b[bucket] += 1; else b.other += 1;
    }

    // 4) Compose response merging trunks with stats
    const data = (trunks || []).map(t => {
      const key = String(t.name || '').trim();
      const st = statsByTrunk.get(key) || { total: 0, answered: 0, no_answer: 0, busy: 0, failed: 0, other: 0 };
      const denom = st.answered + st.no_answer + st.busy + st.failed + st.other;
      const successRate = denom > 0 ? Math.round((st.answered / denom) * 100) : 0;
      return {
        name: t.name,
        ip: t.match,
        status: t.status,
        tarifa: t.tarifa,
        stats: {
          total: st.total,
          answered: st.answered,
          no_answer: st.no_answer,
          busy: st.busy,
          failed: st.failed,
          other: st.other,
          successRate
        }
      };
    });

    // No-cache headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({ success: true, data, meta: { cdr_table: cdrTable, trunks: trunks?.length || 0 } });
  } catch (error) {
    console.error('[Terminations] Error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Erro interno do servidor' });
  }
});

// GET /api/terminations/:name - details for a single trunk
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const user = req.user;
    const role = user?.role || 'user';

    const { data: trunk, error: tErr } = await supabase
      .from('ps_endpoint_id_ips')
      .select('name, match, status, tarifa')
      .eq('name', name)
      .single();
    if (tErr) throw tErr;

    const preferred = process.env.CDR_TABLE && String(process.env.CDR_TABLE).trim();
    const { table: cdrTable } = await resolveCdrTable(preferred);

    let startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    let endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    if (!startDate && !endDate) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      startDate = d;
    }

    let q = supabase
      .from(cdrTable)
      .select('dstchannel, disposition, calldate, accountcode', { head: false })
      .order('calldate', { ascending: false });

    const all = String(req.query.all) === 'true' && (role === 'admin' || role === 'collaborator');
    if (!all) q = q.eq('accountcode', user.id);
    if (startDate) q = q.gte('calldate', startDate.toISOString());
    if (endDate) q = q.lte('calldate', endDate.toISOString());

    // Filter rows whose dstchannel starts with PJSIP/<name>-
    q = q.ilike('dstchannel', `PJSIP/${name}-%`);

    const { data: rows, error: rErr } = await q;
    if (rErr) throw rErr;

    const st = { total: 0, answered: 0, no_answer: 0, busy: 0, failed: 0, other: 0 };
    for (const r of rows || []) {
      const b = bucketDisposition(r.disposition);
      st.total += 1;
      if (b in st) st[b] += 1; else st.other += 1;
    }
    const denom = st.answered + st.no_answer + st.busy + st.failed + st.other;
    const successRate = denom > 0 ? Math.round((st.answered / denom) * 100) : 0;

    return res.json({
      success: true,
      data: {
        name: trunk.name,
        ip: trunk.match,
        status: trunk.status,
        tarifa: trunk.tarifa,
        stats: { ...st, successRate }
      },
      meta: { cdr_table: cdrTable }
    });
  } catch (error) {
    console.error('[Terminations] Detail error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Erro interno do servidor' });
  }
});

module.exports = router;
