const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

// Preferred tables in order if CDR_TABLE is not set or empty
const CDR_TABLE_CANDIDATES = [
  // Convention-first
  'cdr_pabx',
  'calls_pabx',
  // Legacy
  'cdr'
];

const router = express.Router();

router.use(authenticateToken);

// Debug flag: only verbose logs when not in production and LOG_VERBOSE=1
const debug = process.env.NODE_ENV !== 'production' && process.env.LOG_VERBOSE === '1';

// =====================================================
// Middleware: Cache inteligente para CDR
// =====================================================
const cdrCacheMiddleware = async (req, res, next) => {
  // Aplicar cache apenas em GET requests
  if (req.method !== 'GET') {
    return next();
  }

  try {
    // Gerar chave de cache baseada na URL, parâmetros e usuário
    const cacheKey = `cdr:${req.originalUrl}:${req.user?.id || 'anonymous'}`;
    const cached = await cacheService.get(cacheKey);
    
    if (cached) {
      logger.cache(`Cache HIT: ${cacheKey}`);
      return res.json(JSON.parse(cached));
    }
    
    // Interceptar res.json para salvar no cache
    const originalJson = res.json;
    res.json = function(data) {
      // Salvar no cache com TTL de 2 minutos (dados de CDR mudam frequentemente)
      cacheService.set(cacheKey, JSON.stringify(data), 120).catch(err => logger.error('Cache SET error:', err));
      logger.cache(`Cache SET: ${cacheKey} (TTL: 120s)`);
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('CDR Cache middleware error:', error);
    next();
  }
};

// Aplicar cache middleware apenas nas rotas GET
router.use(cdrCacheMiddleware);

// Resolve which table to use for CDR. It will try the provided env name first,
// then fallback to candidates until it finds one that responds without error.
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
        if (table === 'cdr') {
          logger.warn('CDR usando tabela legacy "cdr". Considere configurar CDR_TABLE para *_pabx.');
        }
        return { table, tried };
      }
      tried.push({ table, error: error.message });
    } catch (e) {
      tried.push({ table, error: e?.message || String(e) });
    }
  }
  return { table: preferred || 'cdr', tried };
}

// =====================================================
// DELETE /api/cdr - Exclui CDRs do usuário autenticado por uniqueid
// Body: { ids: string[] } ou { uniqueid: string }
// =====================================================
router.delete('/', async (req, res) => {
  try {
    if (debug) {
      logger.debug('CDR DELETE request received', { method: req.method, url: req.originalUrl, contentType: req.headers['content-type'] });
    }
    
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('CDR DELETE: Usuário não autenticado');
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    // Aceita tanto array de IDs quanto uniqueid individual
    let ids = [];
    if (req.body?.ids && Array.isArray(req.body.ids)) {
      ids = req.body.ids.filter(Boolean).map(String);
    } else if (req.body?.uniqueid) {
      ids = [String(req.body.uniqueid)];
    }
    
    if (debug) {
      logger.debug('CDR IDs recebidos para deletar (count):', ids.length);
    }
    
    if (ids.length === 0) {
      logger.warn('CDR DELETE: Nenhum ID fornecido');
      return res.status(400).json({ 
        success: false, 
        message: 'É necessário fornecer ids (array) ou uniqueid (string)',
        received: req.body
      });
    }

    const preferred = process.env.CDR_TABLE && String(process.env.CDR_TABLE).trim();
    const { table: tableName } = await resolveCdrTable(preferred);
    if (debug) logger.debug('CDR usando tabela:', tableName);

    if (debug) logger.debug('CDR executando delete para userId:', userId, 'ids_count:', ids.length);
    
    const { data, error, count } = await supabase
      .from(tableName)
      .delete()
      .in('uniqueid', ids)
      .eq('accountcode', userId)
      .select('uniqueid', { count: 'exact' });

    if (error) {
      logger.error('CDR DELETE Supabase error:', error.message);
      throw error;
    }

    const deleted = typeof count === 'number' ? count : (Array.isArray(data) ? data.length : 0);
    if (debug) logger.debug('CDR DELETE concluído. Registros deletados:', deleted);
  
    return res.json({ 
      success: true, 
      data: { 
        deleted, 
        ids_processed: ids,
        table_used: tableName,
        message: `${deleted} registro(s) deletado(s) com sucesso`
      } 
    });
  } catch (error) {
    logger.error('CDR DELETE error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || 'Erro interno do servidor',
      error_details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// =====================================================
// GET /api/cdr/agent/:ramal - Lista CDR de um ramal específico (para agentes)
// Filtro: extension = ramal + accountcode = req.user.id
// =====================================================
router.get('/agent/:ramal', authenticateToken, async (req, res) => {
  try {
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (debug) logger.debug('CDR-AGENT Start', { reqId, ramal: req.params.ramal, at: new Date().toISOString() });
    
    const preferred = process.env.CDR_TABLE && String(process.env.CDR_TABLE).trim();
    const { table: tableName, tried } = await resolveCdrTable(preferred);
    if (debug) console.log('📚 [CDR-AGENT] Tabela resolvida:', { tableName, preferred, tried });
    
    const userId = req.user?.id;
    const ramal = req.params.ramal;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }
    
    if (!ramal) {
      return res.status(400).json({ success: false, message: 'Ramal é obrigatório' });
    }

    // Query params
    const {
      page = '1',
      limit = '50',
      search = '',
      disposition = '',
      startDate = '',
      endDate = '',
      order = 'desc'
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offset = (pageNum - 1) * limitNum;
    const orderDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    if (debug) console.log('👤 [CDR-AGENT] userId:', userId, 'ramal:', ramal, '| params:', { page, limit, search, disposition, startDate, endDate, order });

    // Build Supabase query with extension filter
    const from = offset;
    const to = offset + limitNum - 1;
    let q = supabase
      .from(tableName)
      .select('calldate, clid, src, dst, dcontext, channel, dstchannel, lastapp, lastdata, duration, billsec, disposition, amaflags, uniqueid, userfield, accountcode', { count: 'exact', head: false })
      .order('calldate', { ascending: orderDir === 'ASC' })
      .range(from, to)
      .eq('accountcode', userId);

    // Filter by extension parsed from channel/dstchannel like TECH/1234-xxxx
    // Use pattern %/ramal-% to precisely match the extension segment
    q = q.or(`channel.ilike.%/${ramal}-% ,dstchannel.ilike.%/${ramal}-%`.replace(/\s*,\s*/g, ','));

    if (search) {
      const like = `%${search}%`;
      q = q.or(`src.ilike.${like},dst.ilike.${like},clid.ilike.${like}`);
    }
    if (disposition) {
      q = q.eq('disposition', disposition);
    }
    if (startDate) {
      q = q.gte('calldate', new Date(startDate).toISOString());
    }
    if (endDate) {
      q = q.lte('calldate', new Date(endDate).toISOString());
    }

    const qRes = await q;
    if (qRes.error) {
      throw qRes.error;
    }
    
    let rows = qRes.data || [];
    let total = qRes.count || 0;

    // No-cache for real-time
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (debug) console.log(`📞 [CDR-AGENT] Registros para ramal ${ramal}: ${rows?.length || 0} | total: ${total ?? 'n/a'} | table: ${tableName}`);

    // Parse extension and enrich with agent name
    const parsed = rows.map(r => {
      let ext = ramal; // We know the extension is the ramal we're filtering for
      let direction = 'unknown';
      
      // Determine call direction using precise channel match
      const needle = `/${ramal}-`;
      if (r.channel && r.channel.includes(needle)) {
        direction = 'outbound';
      } else if (r.dstchannel && r.dstchannel.includes(needle)) {
        direction = 'inbound';
      } else if (r.src === ramal) {
        direction = 'outbound';
      } else if (r.dst === ramal) {
        direction = 'inbound';
      }
      
      return { ...r, __ext: ext, direction };
    });

    // Get agent name for this ramal
    let agentName = null;
    const { data: agent, error: agentErr } = await supabase
      .from('agentes_pabx')
      .select('agente_name')
      .eq('ramal', ramal)
      .eq('user_id', userId)
      .single();
    
    if (!agentErr && agent) {
      agentName = agent.agente_name;
    }

    // Normalize disposition -> ui_status for UI labels
    const toUiStatus = (d) => {
      const disp = String(d || '').toUpperCase().replace(/\s+/g, '_');
      if (disp === 'ANSWERED') return 'Atendida';
      if (disp === 'NO_ANSWER' || disp === 'NOANSWER' || disp === 'CANCEL') return 'Sem Resposta';
      if (disp === 'BUSY') return 'Ocupado';
      if (disp === 'FAILED' || disp.includes('FAIL') || disp === 'CONGESTION' || disp === 'CHANUNAVAIL') return 'Falhou';
      return disp || 'Desconhecido';
    };

    const enriched = parsed.map(r => ({
      ...r,
      extension: ramal,
      agent_name: agentName,
      disposition_raw: r.disposition ?? null,
      ui_status: toUiStatus(r.disposition),
      call_direction: r.direction
    }));

    // Calculate stats from ALL records (not just current page)
    // Note: Supabase defaults to returning up to 1000 rows if no range is specified.
    // To ensure today's count is accurate even with large datasets, we'll compute
    // today_calls using a dedicated COUNT-only query with UTC boundaries.
    let allRecordsQuery = supabase
      .from(tableName)
      .select('calldate, disposition, duration, billsec', { count: 'exact', head: false })
      .eq('accountcode', userId)
      .or(`channel.ilike.%/${ramal}-% ,dstchannel.ilike.%/${ramal}-%`.replace(/\s*,\s*/g, ','));
    
    if (search) {
      const like = `%${search}%`;
      allRecordsQuery = allRecordsQuery.or(`src.ilike.${like},dst.ilike.${like},clid.ilike.${like}`);
    }
    if (disposition) {
      allRecordsQuery = allRecordsQuery.eq('disposition', disposition);
    }
    if (startDate) {
      allRecordsQuery = allRecordsQuery.gte('calldate', new Date(startDate).toISOString());
    }
    if (endDate) {
      allRecordsQuery = allRecordsQuery.lte('calldate', new Date(endDate).toISOString());
    }

    const allRecordsResult = await allRecordsQuery;
    const allRecords = allRecordsResult.data || [];

    // Calculate stats from all records
    const todayLocal = new Date();
    // Use UTC day boundaries to avoid timezone drift when comparing ISO strings
    const todayStartUTC = new Date(Date.UTC(
      todayLocal.getUTCFullYear(),
      todayLocal.getUTCMonth(),
      todayLocal.getUTCDate()
    ));
    const todayEndUTC = new Date(Date.UTC(
      todayLocal.getUTCFullYear(),
      todayLocal.getUTCMonth(),
      todayLocal.getUTCDate() + 1
    ));

    // Dedicated count-only query for today's calls to avoid 1000-row limit issues
    const todayCountQuery = supabase
      .from(tableName)
      .select('uniqueid', { count: 'exact', head: true })
      .eq('accountcode', userId)
      .or(`channel.ilike.%/${ramal}-% ,dstchannel.ilike.%/${ramal}-%`.replace(/\s*,\s*/g, ','))
      .gte('calldate', todayStartUTC.toISOString())
      .lt('calldate', todayEndUTC.toISOString());

    const todayCountRes = await todayCountQuery;
    const todayCount = (todayCountRes && typeof todayCountRes.count === 'number') ? todayCountRes.count : 0;

    const stats = {
      total_calls: allRecords.length,
      // Override today_calls with accurate count from dedicated query
      today_calls: todayCount,
      answered_calls: allRecords.filter(call => call.disposition === 'ANSWERED').length,
      total_duration: allRecords.reduce((sum, call) => sum + (parseInt(call.duration) || 0), 0),
      total_billsec: allRecords.reduce((sum, call) => sum + (parseInt(call.billsec) || 0), 0)
    };

    if (debug) console.log('🧮 [CDR-AGENT] Stats calculadas:', stats);
    console.log('📅 [CDR-AGENT] Debug contagem hoje:', {
      todayStartUTC: todayStartUTC.toISOString(),
      todayEndUTC: todayEndUTC.toISOString(),
      totalRecords: allRecords.length,
      todayCallsCount: todayCount,
      sampleCallDates: allRecords.slice(0, 3).map(c => c.calldate)
    });
    
    return res.json({
      success: true,
      data: {
        calls: enriched,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        stats,
        agent: {
          ramal,
          name: agentName
        }
      },
      meta: {
        table_used: tableName,
        req_id: reqId,
        filter_ramal: ramal
      }
    });
  } catch (error) {
    console.error('❌ Erro ao consultar CDR do agente:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Erro interno do servidor' });
  }
});

// =====================================================
// GET /api/cdr - Lista CDR do usuário autenticado
// Filtro principal: accountcode = req.user.id (uuid)
// Suporte a paginação e filtros comuns
// =====================================================
router.get('/', async (req, res) => {
  try {
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (debug) console.log('🔎 [CDR] Start', { reqId, at: new Date().toISOString() });
    const preferred = process.env.CDR_TABLE && String(process.env.CDR_TABLE).trim();
    const { table: tableName, tried } = await resolveCdrTable(preferred);
    if (debug) console.log('📚 [CDR] Tabela resolvida:', { tableName, preferred, tried });
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    // Query params
    const {
      page = '1',
      limit = '20',
      search = '',          // busca em src/dst/clid
      disposition = '',     // e.g., ANSWERED, NO ANSWER, BUSY, FAILED
      startDate = '',       // ISO date/time string
      endDate = '',         // ISO date/time string
      order = 'desc',       // calldate order: asc|desc
      probe = '0'           // se '1', ignora filtro de accountcode para diagnosticar
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const offset = (pageNum - 1) * limitNum;
    const orderDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    if (debug) console.log('👤 [CDR] userId:', userId, '| params:', { page, limit, search, disposition, startDate, endDate, order });

    // Build WHERE clauses
    const where = ['accountcode = $1'];
    const params = [userId];
    let p = params.length;

    if (search) {
      where.push(`(src ILIKE $${++p} OR dst ILIKE $${++p} OR clid ILIKE $${++p})`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (disposition) {
      where.push(`disposition = $${++p}`);
      params.push(disposition);
    }

    if (startDate) {
      where.push(`calldate >= $${++p}`);
      params.push(new Date(startDate));
    }

    if (endDate) {
      where.push(`calldate <= $${++p}`);
      params.push(new Date(endDate));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Build Supabase query
    const from = offset;
    const to = offset + limitNum - 1;
    let q = supabase
      .from(tableName)
      .select('calldate, clid, src, dst, dcontext, channel, dstchannel, lastapp, lastdata, duration, billsec, disposition, amaflags, uniqueid, userfield, accountcode', { count: 'exact', head: false })
      .order('calldate', { ascending: orderDir === 'ASC' })
      .range(from, to);

    // Apply account code filter unless probing
    const probing = String(probe) === '1';
    if (!probing) {
      q = q.eq('accountcode', userId);
    } else {
      if (debug) console.warn('🧪 [CDR] PROBE ativo: ignorando filtro por accountcode (apenas debug).');
    }

    if (search) {
      const like = `%${search}%`;
      q = q.or(`src.ilike.${like},dst.ilike.${like},clid.ilike.${like}`);
    }
    if (disposition) {
      q = q.eq('disposition', disposition);
    }
    if (startDate) {
      q = q.gte('calldate', new Date(startDate).toISOString());
    }
    if (endDate) {
      q = q.lte('calldate', new Date(endDate).toISOString());
    }

    const qRes = await q;
    if (qRes.error) {
      throw qRes.error;
    }
    let rows = qRes.data;
    let total = qRes.count;

    // No-cache for real-time
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (debug) console.log(`📞 [CDR] Registros recebidos: ${rows?.length || 0} | total: ${total ?? 'n/a'}${probing ? ' (PROBE)' : ''} | table: ${tableName}`);

    // 🔒 SEGURANÇA: Nunca retornar dados de outros usuários
    // Se não há dados para este usuário, retornar vazio corretamente
    let metaWarning = null;
    if (!probing && (!rows || rows.length === 0)) {
      if (debug) console.log('ℹ️ [CDR] Usuário não possui registros de chamadas. Retornando vazio.');
      // Manter rows vazio e total = 0 para usuários sem dados
      rows = [];
      total = 0;
      metaWarning = 'Usuário não possui registros de chamadas.';
    }

    // Parse extension from channel (PJSIP/, SIP/, Local/)
    const parsed = (rows || []).map(r => {
      let ext = null;
      if (r.channel && typeof r.channel === 'string') {
        // Try common techs
        const m1 = r.channel.match(/PJSIP\/(\d{2,})/);
        const m2 = !m1 && r.channel.match(/SIP\/(\d{2,})/);
        const m3 = !m1 && !m2 && r.channel.match(/Local\/(\d{2,})/);
        const m = m1 || m2 || m3;
        if (m) ext = m[1];
      }
      // Try from dstchannel when not found
      if (!ext && r.dstchannel && typeof r.dstchannel === 'string') {
        const d1 = r.dstchannel.match(/PJSIP\/(\d{2,})/);
        const d2 = !d1 && r.dstchannel.match(/SIP\/(\d{2,})/);
        const d3 = !d1 && !d2 && r.dstchannel.match(/Local\/(\d{2,})/);
        const dm = d1 || d2 || d3;
        if (dm) ext = dm[1];
      }
      // Try from lastdata (some Asterisk apps include tech/extension)
      if (!ext && r.lastdata && typeof r.lastdata === 'string') {
        const l1 = r.lastdata.match(/PJSIP\/(\d{2,})/);
        const l2 = !l1 && r.lastdata.match(/SIP\/(\d{2,})/);
        const l3 = !l1 && !l2 && r.lastdata.match(/Local\/(\d{2,})/);
        const lm = l1 || l2 || l3;
        if (lm) ext = lm[1];
      }
      if (!ext && typeof r.src === 'string') {
        // Fallback: if src looks like extension
        const n = Number(r.src);
        if (Number.isFinite(n)) ext = String(n);
      }
      // Try short CLID as extension (e.g., 3-5 digit internal callerids)
      if (!ext && typeof r.clid === 'string') {
        const cl = r.clid.trim();
        const clNum = cl.match(/^(\d{2,6})$/);
        if (clNum) ext = clNum[1];
      }
      return { ...r, __ext: ext };
    });
    // Debug first 3 parsed results
    if (debug) {
      const parsedSample = parsed.slice(0, 3).map(r => ({ ext: r.__ext }));
      console.log('🧩 [CDR] Parsed extensions sample (count only):', { count: parsed.length, sample: parsedSample });
    }

    // Resolve agent names by extension - APENAS agentes_pabx
    let nameByExt = {};
    const extList = [...new Set(parsed.map(r => r.__ext && String(r.__ext).trim()).filter(Boolean))];
    if (debug) console.log('🔎 [CDR] Extensões detectadas (count):', extList.length);
    
    if (extList.length > 0) {
      if (debug) console.log('🔍 [CDR] Buscando agentes para extensões (count):', extList.length);
      
      // Primeiro: tenta buscar como string
      if (debug) console.log('🔍 [CDR] Primeira busca (string)');
      const { data: agents1, error: agentErr1 } = await supabase
        .from('agentes_pabx')
        .select('ramal, agente_name')
        .in('ramal', extList);
      
      if (debug) console.log('🔍 [CDR] Resultado primeira busca:', { erro: agentErr1?.message || 'nenhum', total: agents1?.length || 0 });
      
      let agentRows = agents1 || [];
      
      // Segundo: tenta buscar como número se não encontrou nada
      if (!agentErr1 && agentRows.length === 0) {
        const extListNum = extList.map(v => parseInt(v, 10)).filter(n => !isNaN(n));
        if (debug) console.log('🔍 [CDR] Segunda busca (número)');
        
        if (extListNum.length > 0) {
          const { data: agents2, error: agentErr2 } = await supabase
            .from('agentes_pabx')
            .select('ramal, agente_name')
            .in('ramal', extListNum);
          
          if (debug) console.log('🔍 [CDR] Resultado segunda busca:', { erro: agentErr2?.message || 'nenhum', total: agents2?.length || 0 });
          
          if (!agentErr2 && agents2) {
            agentRows = agents2;
          }
        }
      }
      
      // Terceiro: busca individual para debug detalhado
      if (agentRows.length === 0) {
        if (debug) console.log('🔍 [CDR] Busca individual para debug...');
        for (const ext of extList) {
          const { data: singleAgent, error: singleErr } = await supabase
            .from('agentes_pabx')
            .select('ramal, agente_name')
            .eq('ramal', ext)
            .single();
          
          if (debug) console.log(`🔍 [CDR] Busca individual para ${ext}:`, { erro: singleErr?.message || 'nenhum' });
        }
        
        // Busca todos os agentes para ver o que tem na tabela
        if (debug) console.log('🔍 [CDR] Listando todos os agentes (máximo 10)...');
        const { data: allAgents, error: allErr } = await supabase
          .from('agentes_pabx')
          .select('ramal, agente_name')
          .limit(10);
        
        if (debug) console.log('🔍 [CDR] Todos os agentes:', { erro: allErr?.message || 'nenhum', total: allAgents?.length || 0 });
      }
      
      // Processar resultados encontrados
      if (agentRows && agentRows.length > 0) {
        if (debug) console.log('🧾 [CDR] Agentes encontrados (count):', agentRows.length);
        
        nameByExt = agentRows.reduce((acc, a) => {
          const extVal = a?.ramal;
          if (extVal != null) {
            const key = String(extVal).trim();
            const val = a.agente_name; // Apenas agente_name existe
            if (val) {
              acc[key] = val;
              if (debug) console.log(`✅ [CDR] Mapeado: ${key} -> [name]`);
            }
          }
          return acc;
        }, {});
        
        if (debug) console.log('🔎 [CDR] Mapa final nameByExt (size):', Object.keys(nameByExt).length);
      } else {
        if (debug) console.log('⚠️ [CDR] Nenhum agente encontrado para as extensões (count):', extList.length);
      }
    }

    // Normalize disposition -> ui_status for UI labels
    const toUiStatus = (d) => {
      const disp = String(d || '').toUpperCase().replace(/\s+/g, '_');
      if (disp === 'ANSWERED') return 'Atendida';
      if (disp === 'NO_ANSWER' || disp === 'NOANSWER' || disp === 'CANCEL') return 'Sem Resposta';
      if (disp === 'BUSY') return 'Ocupado';
      if (disp === 'FAILED' || disp.includes('FAIL') || disp === 'CONGESTION' || disp === 'CHANUNAVAIL') return 'Falhou';
      return disp || 'Desconhecido';
    };

    const enriched = parsed.map(r => {
      const ext = r.__ext || null;
      let agentName = null;
      if (ext != null) {
        const key = String(ext).trim();
        agentName = nameByExt[key] || null;
        console.log(`🔍 [CDR] Busca agente para ext ${ext} (key: ${key}): ${agentName || 'não encontrado'}`);
      }
      return {
        ...r,
        extension: ext,
        agent_name: agentName,
        disposition_raw: r.disposition ?? null,
        ui_status: toUiStatus(r.disposition),
      };
    });

    if (debug) console.log('🧮 [CDR] Enriched sample (count only):', { count: enriched.length });
    
    return res.json({
      success: true,
      data: {
        records: enriched || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      },
      meta: {
        table_used: tableName,
        req_id: reqId,
        agents_resolved: Object.keys(nameByExt).length,
        ...(metaWarning ? { warning: metaWarning } : {})
      }
    });
  } catch (error) {
    console.error('❌ Erro ao consultar CDR:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Erro interno do servidor' });
  }
});

module.exports = router;