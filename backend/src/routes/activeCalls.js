const express = require('express');
const rateLimit = require('express-rate-limit');
const { param, query, body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { getActiveChannels, getChannel, hangupChannel } = require('../services/ariService');
const amiService = require('../services/amiService');
const cacheService = require('../services/cacheService');
const { supabase } = require('../config/database');
const User = require('../models/User');
const logger = require('../utils/logger');

// Configurações
const config = {
  ariTimeout: parseInt(process.env.ARI_TIMEOUT) || 5000,
  cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 300000,
  maxHangupsPerMinute: parseInt(process.env.MAX_HANGUPS_PER_MINUTE) || 10
};

// Cache para clientes de resellers
const clientsCache = new Map();
const router = express.Router();

// =====================================================
// Middleware: Cache inteligente para chamadas ativas
//  - Requer autenticação antes para incluir usuário/ramal no cache key
// =====================================================
const activeCallsCacheMiddleware = async (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  // Não aplicar cache em stream SSE
  if (req.path && req.path.startsWith('/stream')) {
    return next();
  }

  try {
    const extKey = req.agent && req.agent.ramal ? `ext:${String(req.agent.ramal)}` : 'ext:none';
    const cacheKey = `active-calls:${req.originalUrl}:${req.user?.id || 'anonymous'}:${extKey}`;
    const cached = await cacheService.get(cacheKey);
    
    if (cached) {
      // Log silencioso para cache hits
      return res.json(JSON.parse(cached));
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      // Cache por 3 segundos (reduzido para mais responsividade)
      cacheService.set(cacheKey, JSON.stringify(data), 3).catch(err => logger.error('Cache SET error:', err));
      // Log silencioso para cache sets
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('Active Calls Cache middleware error:', error);
    next();
  }
};

// Autenticar ANTES do cache para que o cache key inclua usuário/ramal
router.use(authenticateToken);
router.use(activeCallsCacheMiddleware);

// Rate limiting para hangup
const hangupLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: config.maxHangupsPerMinute,
  message: {
    success: false,
    message: 'Muitas tentativas de encerrar chamadas. Tente novamente em 1 minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validações
const validateChannelId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('Channel ID é obrigatório')
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('Channel ID contém caracteres inválidos')
];

const validateAccountCode = [
  query('accountcode')
    .optional()
    .isLength({ min: 1 })
    .withMessage('AccountCode não pode estar vazio')
    .trim()
];

// Função auxiliar para obter clientes do reseller com cache
async function getResellerClients(resellerId) {
  const cacheKey = `reseller_clients_${resellerId}`;
  
  if (clientsCache.has(cacheKey)) {
    const cached = clientsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < config.cacheTimeout) {
      return cached.clients;
    }
  }

  try {
    const clients = await User.findByReseller(resellerId);
    clientsCache.set(cacheKey, {
      clients,
      timestamp: Date.now()
    });
    return clients;
  } catch (error) {
    logger.error(`Erro ao buscar clientes do reseller ${resellerId}:`, error);
    throw error;
  }
}

// Função auxiliar para verificar permissões de acesso
async function checkChannelAccess(user, channel) {
  const role = user?.role || 'user';
  const channelAccount = String(channel?.accountcode || '');

  if (role === 'admin' || role === 'collaborator') {
    return true;
  }

  if (role === 'reseller') {
    const clients = await getResellerClients(user.id);
    const allowedIds = new Set([String(user.id), ...clients.map(c => String(c.id))]);
    return channelAccount && allowedIds.has(channelAccount);
  }

  // Regular user
  return channelAccount && channelAccount === String(user.id);
}

// GET /api/active-calls
async function getActiveCalls(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: errors.array()
      });
    }

    const { accountcode, all, summary } = req.query;
    const currentUser = req.user;
    const role = currentUser?.role || 'user';

    let records = [];

    if (accountcode && String(accountcode).trim() !== '') {
      const trimmedAccountCode = String(accountcode).trim();
      
      // Verificar se o usuário tem permissão para ver este accountcode
      if (role === 'user' && trimmedAccountCode !== String(currentUser.id)) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para visualizar chamadas deste accountcode'
        });
      }

      if (role === 'reseller') {
        const clients = await getResellerClients(currentUser.id);
        const allowedIds = new Set([String(currentUser.id), ...clients.map(c => String(c.id))]);
        
        if (!allowedIds.has(trimmedAccountCode)) {
          return res.status(403).json({
            success: false,
            message: 'Você não tem permissão para visualizar chamadas deste accountcode'
          });
        }
      }

      // 🚀 PRIORIDADE 1: Tentar buscar do AMI Service (tempo real)
      try {
        const amiCalls = await amiService.getActiveCallsByAccount(trimmedAccountCode);
        if (amiCalls && amiCalls.length > 0) {
          logger.debug(`AMI encontradas ${amiCalls.length} chamadas para account ${trimmedAccountCode}`);
          records = amiCalls;
        }
      } catch (amiErr) {
        logger.warn('AMI erro ao buscar chamadas, usando fallback ARI:', amiErr.message);
      }

      // 🔄 FALLBACK 1: ARI com accountcode (se AMI não retornou dados)
      if (!records || records.length === 0) {
        records = await getActiveChannels({ 
          accountcode: trimmedAccountCode, 
          timeoutMs: 15000
        });
      }

      // 🔄 FALLBACK 2: Filtrar por ramais do usuário
      if (!Array.isArray(records) || records.length === 0) {
        try {
          const userId = trimmedAccountCode;
          const userAgents = await agentsService.getAgentsByUser(userId);
          const extSet = new Set((userAgents || []).map(a => String(a.ramal)).filter(Boolean));
          if (extSet.size > 0) {
            const allChannels = await getActiveChannels({ timeoutMs: config.ariTimeout });
            records = allChannels.filter(ch => {
              const name = String(ch?.name || '').toLowerCase();
              if (name.includes('master')) return false;
              const m = name.match(/^pjsip\/(.+?)-/);
              if (!m) return false;
              const ext = m[1];
              return extSet.has(ext);
            });
          }
        } catch (fbErr) {
          logger.warn('ActiveCalls fallback por ramais falhou:', fbErr);
        }
      }
    } else {
      // Nenhum accountcode explícito fornecido
      if ((role === 'admin' || role === 'collaborator') && String(all) === 'true') {
        // Admin/Collaborator pode solicitar todos os canais explicitamente
        records = await getActiveChannels({ timeoutMs: config.ariTimeout });
      } else if (role === 'reseller') {
        // Reseller: incluir próprias chamadas e de clientes
        const clients = await getResellerClients(currentUser.id);
        const allowed = new Set([String(currentUser.id), ...clients.map(c => String(c.id))]);
        const allChannels = await getActiveChannels({ timeoutMs: config.ariTimeout });
        records = allChannels.filter(ch => allowed.has(String(ch.accountcode || '')));
      } else {
        // Usuário regular: apenas chamadas próprias (accountcode = user.id)
        records = await getActiveChannels({ 
          accountcode: String(currentUser.id), 
          timeoutMs: 15000 // Aumentar timeout para usuários regulares também
        });
      }
    }

    // Enforce per-extension scoping for agent-context requests
    try {
      if (req.agent && req.agent.ramal) {
        const targetExt = String(req.agent.ramal).trim().toLowerCase();
        const beforeCount = Array.isArray(records) ? records.length : 0;
        records = (records || []).filter((ch) => {
          const name = String(ch?.name || '').toLowerCase();
          if (name.includes('master')) return false; // ignorar master legs
          const m = name.match(/^pjsip\/(.+?)-/);
          if (!m) return false;
          const ext = m[1];
          const state = String(ch?.state || '').toLowerCase();
          if (!state || state === 'down' || state === 'destroyed') return false;
          return ext === targetExt;
        });
        logger.debug(`Agent-context extension filter applied: ${beforeCount} -> ${records.length} for ext=${targetExt}`);
      }
    } catch (extErr) {
      logger.warn('Failed to apply agent extension filter:', extErr?.message || extErr);
    }

    // Build optional diagnostic summary
    try {
      const uniqueStates = new Map();
      const pjsipStats = { total: 0, ringing: 0, talking: 0 };
      const sample = [];
      for (const ch of records) {
        const state = String(ch?.state || ch?.dialstatus || ch?.channelstate || 'unknown').toLowerCase();
        uniqueStates.set(state, (uniqueStates.get(state) || 0) + 1);
        const name = String(ch?.name || '').toLowerCase();
        const m = name.match(/^pjsip\/(.+?)-/);
        if (m) {
          pjsipStats.total++;
          if (state === 'up' || state === 'talking') pjsipStats.talking++;
          if (state === 'ring' || state === 'ringing') pjsipStats.ringing++;
        }
        if (sample.length < 5) {
          sample.push({ id: ch?.id, name: ch?.name, state: ch?.state, accountcode: ch?.accountcode });
        }
      }
      const summaryPayload = {
        uniqueStates: Object.fromEntries(uniqueStates.entries()),
        pjsipStats,
        meta: {
          role,
          queryAccountcode: accountcode ? String(accountcode) : null,
          currentUserId: currentUser?.id ? String(currentUser.id) : null,
          totalRecords: records.length,
        },
        sample,
      };

      // Server-side log to aid investigation
      logger.debug('ActiveCalls summary', JSON.stringify(summaryPayload));

      return res.json({
        success: true,
        data: {
          count: records.length,
          records,
          ...(String(summary) === 'true' ? { summary: summaryPayload } : {}),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (diagErr) {
      // If diagnostics fail, still return normal payload
      logger.warn('ActiveCalls diagnostics error:', diagErr);
      return res.json({
        success: true,
        data: {
          count: records.length,
          records,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Erro ao buscar chamadas ativas do ARI:', {
      message: error.message,
      stack: error.stack,
      status: error.status,
      accountcode: req.query.accountcode,
      userId: req.user?.id
    });
    
    // Log adicional para debugging
    logger.error('ActiveCalls detalhes da requisição:', {
      accountcode: req.query.accountcode,
      userId: req.user?.id,
      role: req.user?.role,
      timestamp: new Date().toISOString()
    });
    
    const status = error.status || 500;
    let message = 'Falha ao obter chamadas ativas';
    
    // Mensagens mais específicas baseadas no tipo de erro
    if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
      message = 'Timeout na conexão com o servidor ARI';
    } else if (error.code === 'ECONNREFUSED') {
      message = 'Não foi possível conectar ao servidor ARI';
    } else if (error.code === 'ENOTFOUND') {
      message = 'Servidor ARI não encontrado';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'Timeout na conexão com o servidor ARI';
    } else if (error.status === 401) {
      message = 'Credenciais ARI inválidas';
    } else if (error.status === 403) {
      message = 'Acesso negado ao servidor ARI';
    } else if (error.message) {
      message = error.message;
    }
    
    return res.status(status).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        code: error.code,
        status: error.status
      } : undefined
    });
  }
}

// POST /api/active-calls/:id/hangup - Encerrar um canal
async function hangupCall(req, res) {
  try {
    // Validar entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: errors.array()
      });
    }

    const channelId = req.params.id;
    const currentUser = req.user;

    logger.api(`Tentativa de hangup do canal ${channelId} pelo usuário ${currentUser.id}`);

    // Buscar detalhes do canal no ARI para validar propriedade/escopo
    let channel;
    try {
      channel = await getChannel(channelId, { timeoutMs: config.ariTimeout });
    } catch (error) {
      logger.error(`Erro ao consultar canal ${channelId}:`, error);
      
      if (error.status === 404) {
        return res.status(404).json({ 
          success: false, 
          message: 'Canal não encontrado. Pode ter sido encerrado recentemente.' 
        });
      }
      
      return res.status(502).json({ 
        success: false, 
        message: 'Falha ao consultar informações do canal no ARI' 
      });
    }

    // Verificar permissões de acesso
    const hasAccess = await checkChannelAccess(currentUser, channel);
    
    if (!hasAccess) {
      logger.warn(`Usuário ${currentUser.id} tentou encerrar canal sem permissão: ${channelId}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Você não tem permissão para encerrar esta chamada' 
      });
    }

    // Additional guard: if request comes from agent token, enforce same extension ownership
    if (req.agent && req.agent.ramal) {
      try {
        const name = String(channel?.name || '').toLowerCase();
        const m = name.match(/^pjsip\/(.+?)-/);
        const channelExt = m ? m[1] : '';
        const agentExt = String(req.agent.ramal).trim().toLowerCase();
        if (channelExt !== agentExt) {
          logger.warn(`Hangup blocked: agent ext ${agentExt} != channel ext ${channelExt} (channel ${channelId})`);
          return res.status(403).json({ 
            success: false, 
            message: 'Você não tem permissão para encerrar chamadas de outro ramal' 
          });
        }
      } catch (guardErr) {
        logger.warn('Error validating agent extension ownership on hangup:', guardErr?.message || guardErr);
        return res.status(403).json({ success: false, message: 'Validação de permissão do ramal falhou' });
      }
    }

    // Verificar se o canal ainda existe antes do hangup (dupla verificação)
    try {
      await getChannel(channelId, { timeoutMs: 2000 });
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ 
          success: false, 
          message: 'Canal não encontrado. Pode ter sido encerrado durante a operação.' 
        });
      }
      // Se não for 404, continua com o hangup (pode ser erro temporário)
    }

    // Executar hangup
    try {
      await hangupChannel(channelId, { timeoutMs: config.ariTimeout });
      
      logger.api(`Canal ${channelId} encerrado com sucesso pelo usuário ${currentUser.id}`);
      
      return res.json({ 
        success: true, 
        message: 'Chamada encerrada com sucesso',
        data: {
          channelId,
          accountcode: channel.accountcode,
          timestamp: new Date().toISOString()
        }
      });
    } catch (hangupError) {
      logger.error(`Erro ao executar hangup do canal ${channelId}:`, hangupError);
      
      if (hangupError.status === 404) {
        // Canal já foi encerrado por outro processo
        return res.json({ 
          success: true, 
          message: 'Chamada já havia sido encerrada',
          data: {
            channelId,
            accountcode: channel.accountcode,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      throw hangupError; // Re-throw para ser capturado pelo catch externo
    }
    
  } catch (error) {
    logger.error('Erro geral ao encerrar chamada:', error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Falha ao encerrar chamada',
    });
  }
}

// Função para limpar cache periodicamente
function startCacheCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of clientsCache.entries()) {
      if (now - value.timestamp > config.cacheTimeout) {
        clientsCache.delete(key);
      }
    }
  }, config.cacheTimeout);
}

// Iniciar limpeza de cache
startCacheCleanup();

// Definir rotas
router.get('/', validateAccountCode, authenticateToken, getActiveCalls);
router.post('/:id/hangup', validateChannelId, hangupLimiter, authenticateToken, hangupCall);

// Alternativa segura para IDs com '/' no valor: enviar no corpo
const validateBodyChannelId = [
  body('id')
    .isLength({ min: 1 })
    .withMessage('Channel ID é obrigatório')
    .isString()
];

router.post('/hangup', validateBodyChannelId, hangupLimiter, authenticateToken, async (req, res) => {
  // Reaproveita a lógica do hangupCall atribuindo o body.id ao params
  req.params.id = req.body.id;
  return hangupCall(req, res);
});

// =====================================================
// GET /api/active-calls/stream - SSE de chamadas ativas
// =====================================================
router.get('/stream', authenticateToken, async (req, res) => {
  try {
    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // desabilitar buffering em proxies como Nginx

    const currentUser = req.user;
    const role = currentUser?.role || 'user';
    const wantAll = String(req.query.all) === 'true';

    // Helper para enviar evento SSE
    const sendEvent = (eventName, payload) => {
      try {
        if (eventName) {
          res.write(`event: ${eventName}\n`);
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        // Silently ignore write errors (client may have disconnected)
      }
    };

    // Calcular conjunto de accounts permitidos (para reseller)
    let allowedAccounts = null; // null => usar account específico do user comum
    if (role === 'reseller') {
      try {
        const clients = await getResellerClients(currentUser.id);
        allowedAccounts = new Set([String(currentUser.id), ...clients.map(c => String(c.id))]);
      } catch (e) {
        logger.warn('SSE active-calls falha ao buscar clientes do reseller:', e.message);
        allowedAccounts = new Set([String(currentUser.id)]);
      }
    }

    // Enviar snapshot inicial
    try {
      let initialRecords = [];
      if (role === 'admin' || role === 'collaborator') {
        if (wantAll) {
          initialRecords = await amiService.getAllActiveCalls();
        } else {
          initialRecords = await amiService.getActiveCallsByAccount(String(currentUser.id));
        }
      } else if (role === 'reseller') {
        // Consolidar chamadas de todas as contas permitidas
        const all = [];
        for (const acc of allowedAccounts) {
          const calls = await amiService.getActiveCallsByAccount(acc);
          if (Array.isArray(calls)) all.push(...calls);
        }
        initialRecords = all;
      } else {
        // user regular
        initialRecords = await amiService.getActiveCallsByAccount(String(currentUser.id));
      }

      sendEvent('snapshot', {
        success: true,
        data: {
          count: Array.isArray(initialRecords) ? initialRecords.length : 0,
          records: initialRecords || []
        },
        timestamp: new Date().toISOString(),
      });
    } catch (snapErr) {
      logger.warn('SSE active-calls erro ao enviar snapshot inicial:', snapErr.message);
    }

    // Listener de eventos do AMI
    const listener = (payload) => {
      try {
        const accountcode = String(payload?.accountcode || '');
        if (!accountcode) return;

        // Filtrar por permissão
        if (role === 'user') {
          if (accountcode !== String(currentUser.id)) return;
        } else if (role === 'reseller') {
          if (!allowedAccounts || !allowedAccounts.has(accountcode)) return;
        } else if (role === 'admin' || role === 'collaborator') {
          // admin/collab recebem tudo; se cliente solicitou all=false, filtrar pelo próprio id
          if (!wantAll && accountcode !== String(currentUser.id)) return;
        }

        sendEvent('update', {
          success: true,
          data: {
            accountcode,
            count: Array.isArray(payload?.calls) ? payload.calls.length : 0,
            records: payload?.calls || [],
          },
          timestamp: new Date(payload?.timestamp || Date.now()).toISOString(),
        });
      } catch (err) {
        // Ignore
      }
    };

    amiService.on('callsUpdated', listener);

    // Heartbeat
    const hb = setInterval(() => {
      sendEvent('ping', { t: Date.now() });
    }, 15000);

    // Encerramento/limpeza
    req.on('close', () => {
      try { clearInterval(hb); } catch {}
      try { amiService.off('callsUpdated', listener); } catch {}
      try { res.end(); } catch {}
    });

  } catch (error) {
    logger.error('SSE active-calls erro ao iniciar stream:', error);
    try {
      res.status(500).json({ success: false, message: 'Falha ao iniciar stream de chamadas ativas' });
    } catch {}
  }
});

module.exports = router;