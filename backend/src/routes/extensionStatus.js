/**
 * =====================================================
 * EXTENSION STATUS API - STATUS DE RAMAIS
 * =====================================================
 * API para consultar status online/offline dos ramais
 * baseado na tabela ps_contacts
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const extensionStatusService = require('../services/extensionStatusService');
const cacheService = require('../services/cacheService');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// =====================================================
// Middleware: Cache inteligente para extension status
// =====================================================
const extensionCacheMiddleware = async (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  // Não aplicar cache em stream SSE
  if (req.path && req.path.startsWith('/stream')) {
    return next();
  }

  // ✅ CORREÇÃO: DESABILITAR CACHE COMPLETAMENTE para garantir dados reais
  // TODO: Re-habilitar após confirmar que status está correto
  logger.debug('Cache DESABILITADO para extension-status - dados sempre frescos');
  return next();

  // ✅ CORREÇÃO: Não aplicar cache quando forçar refresh
  if (req.query.force === 'true' || req.query._fresh === 'true') {
    return next();
  }

  try {
    const cacheKey = `extension-status:${req.originalUrl}:${req.user?.id || 'anonymous'}`;
    const cached = await cacheService.get(cacheKey);
    
    if (cached) {
      // Log silencioso para cache hits
      return res.json(JSON.parse(cached));
    }
    
    const originalJson = res.json;
    res.json = function(data) {
      // Cache por 30 segundos (dados de status mudam rapidamente)
      cacheService.set(cacheKey, JSON.stringify(data), 30).catch(err => logger.error('Cache SET error:', err));
      // Log silencioso para cache sets
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('Extension Cache middleware error:', error);
    next();
  }
};

router.use(extensionCacheMiddleware);

// =====================================================
// GET /api/extension-status - STATUS DE TODOS OS RAMAIS
// =====================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    logger.api('Buscando status de todos os ramais...');

    // ✅ CORREÇÃO: Forçar refresh se solicitado via query parameter
    const forceRefresh = req.query._fresh === 'true' || req.query.force === 'true';
    const statusData = await extensionStatusService.getExtensionStatus(forceRefresh);

    res.json({
      success: true,
      data: statusData,
      meta: {
        timestamp: new Date().toISOString(),
        source: 'ps_contacts',
        updateInterval: '5s'
      }
    });

  } catch (error) {
    logger.error('Erro na API de status dos ramais:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status dos ramais',
      error: error.message
    });
  }
});

// =====================================================
// POST /api/extension-status/batch - STATUS DE RAMAIS EM LOTE (MÁXIMO 7)
// =====================================================
router.post('/batch', authenticateToken, async (req, res) => {
  try {
    const { extensions } = req.body;
    
    if (!Array.isArray(extensions)) {
      return res.status(400).json({
        success: false,
        message: 'Campo "extensions" deve ser um array'
      });
    }
    
    // Limitar a 7 ramais por lote conforme paginação
    const limitedExtensions = extensions.slice(0, 7);
    logger.api(`Buscando status em lote de ${limitedExtensions.length} ramais:`, limitedExtensions);

    const batchStatus = await extensionStatusService.getBatchExtensionStatus(limitedExtensions);

    res.json({
      success: true,
      data: batchStatus,
      meta: {
        timestamp: new Date().toISOString(),
        requestedCount: extensions.length,
        processedCount: limitedExtensions.length,
        maxBatchSize: 7,
        source: 'ps_contacts'
      }
    });

  } catch (error) {
    logger.error('Erro ao buscar status em lote:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status dos ramais em lote',
      error: error.message
    });
  }
});

// =====================================================
// GET /api/extension-status/:extension - STATUS DE UM RAMAL
// =====================================================
router.get('/:extension', authenticateToken, async (req, res) => {
  try {
    const { extension } = req.params;
    logger.api(`Buscando status do ramal: ${extension}`);

    const extensionStatus = await extensionStatusService.getExtensionStatusById(extension);

    res.json({
      success: true,
      data: extensionStatus,
      meta: {
        timestamp: new Date().toISOString(),
        extension,
        source: 'ps_contacts'
      }
    });

  } catch (error) {
    logger.error(`Erro ao buscar status do ramal ${req.params.extension}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar status do ramal',
      error: error.message
    });
  }
});

// =====================================================
// GET /api/extension-status/stats/monitoring - ESTATÍSTICAS DO MONITORAMENTO
// =====================================================
router.get('/stats/monitoring', authenticateToken, async (req, res) => {
  try {
    logger.api('Buscando estatísticas do monitoramento...');

    const stats = extensionStatusService.getMonitoringStats();

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        service: 'extensionStatusService'
      }
    });

  } catch (error) {
    logger.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas do monitoramento',
      error: error.message
    });
  }
});

// =====================================================
// POST /api/extension-status/start - INICIAR MONITORAMENTO
// =====================================================
router.post('/start', authenticateToken, async (req, res) => {
  try {
    logger.api('Iniciando monitoramento de ramais...');

    extensionStatusService.startMonitoring();

    res.json({
      success: true,
      message: 'Monitoramento de ramais iniciado',
      data: {
        interval: '5s',
        started: true
      }
    });

  } catch (error) {
    logger.error('Erro ao iniciar monitoramento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar monitoramento',
      error: error.message
    });
  }
});

// =====================================================
// POST /api/extension-status/stop - PARAR MONITORAMENTO
// =====================================================
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    logger.api('Parando monitoramento de ramais...');

    extensionStatusService.stopMonitoring();

    res.json({
      success: true,
      message: 'Monitoramento de ramais parado',
      data: {
        stopped: true
      }
    });

  } catch (error) {
    logger.error('Erro ao parar monitoramento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao parar monitoramento',
      error: error.message
    });
  }
});

// =====================================================
// POST /api/extension-status/clear-cache - LIMPAR CACHE DE STATUS
// =====================================================
router.post('/clear-cache', authenticateToken, async (req, res) => {
  try {
    logger.api('Limpando cache de extension status...');

    // Limpar cache Redis de extension status
    const redisDeleted = await cacheService.invalidate('extension-status:*');
    
    // Limpar cache local do service
    extensionStatusService.clearCache();
    
    // Forçar nova verificação
    await extensionStatusService.checkExtensionStatus(true);

    res.json({
      success: true,
      message: 'Cache de extension status limpo com sucesso',
      data: {
        redisKeysDeleted: redisDeleted,
        localCacheCleared: true,
        forcedRefresh: true
      }
    });

  } catch (error) {
    logger.error('Erro ao limpar cache de extension status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar cache',
      error: error.message
    });
  }
});

// =====================================================
// GET /api/extension-status/stream - SSE de status de ramais
// =====================================================
router.get('/stream', authenticateToken, async (req, res) => {
  try {
    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const currentUser = req.user;
    const role = currentUser?.role || 'user';
    const wantAll = String(req.query.all) === 'true';

    const sendEvent = (eventName, payload) => {
      try {
        if (eventName) res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (_) { /* ignore */ }
    };

    // Helper para buscar dados conforme papel
    let allowedUserIds = null; // para reseller
    async function fetchStatus() {
      if (role === 'admin' || role === 'collaborator') {
        if (wantAll) {
          return await extensionStatusService.getExtensionStatus();
        }
        // admin/collab sem all => somente seus próprios ramais
        return await extensionStatusService.getExtensionStatusByUser(currentUser.id);
      }

      if (role === 'reseller') {
        if (!allowedUserIds) {
          try {
            const clients = await User.findByReseller(currentUser.id);
            allowedUserIds = new Set([String(currentUser.id), ...clients.map(c => String(c.id))]);
          } catch (e) {
            logger.warn('Falha ao buscar clientes do reseller:', e.message);
            allowedUserIds = new Set([String(currentUser.id)]);
          }
        }
        // Buscar tudo e filtrar por userId permitido
        const full = await extensionStatusService.getExtensionStatus();
        const filtered = { ...full, extensions: {} };
        for (const [ext, info] of Object.entries(full.extensions || {})) {
          if (info && info.userId && allowedUserIds.has(String(info.userId))) {
            filtered.extensions[ext] = info;
          }
        }
        filtered.totalExtensions = Object.keys(filtered.extensions).length;
        filtered.onlineCount = Object.values(filtered.extensions).filter(e => e.isOnline).length;
        filtered.onlineExtensions = Object.values(filtered.extensions).filter(e => e.isOnline).map(e => e.extension);
        return filtered;
      }

      // user regular
      return await extensionStatusService.getExtensionStatusByUser(currentUser.id);
    }

    // Snapshot inicial
    let lastSerialized = '';
    async function pushUpdate(eventName = 'snapshot') {
      try {
        const data = await fetchStatus();
        const serialized = JSON.stringify(data);
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          sendEvent(eventName, { success: true, data, timestamp: new Date().toISOString() });
        }
      } catch (e) {
        sendEvent('error', { success: false, message: e.message || 'Erro ao obter status' });
      }
    }

    await pushUpdate('snapshot');

    // Atualizações periódicas (alinha com 5s do serviço)
    const updater = setInterval(() => {
      pushUpdate('update');
    }, 5000);

    // Heartbeat
    const hb = setInterval(() => {
      sendEvent('ping', { t: Date.now() });
    }, 15000);

    // Limpeza
    req.on('close', () => {
      try { clearInterval(updater); } catch {}
      try { clearInterval(hb); } catch {}
      try { res.end(); } catch {}
    });

  } catch (error) {
    logger.error('Erro ao iniciar stream:', error);
    try {
      res.status(500).json({ success: false, message: 'Falha ao iniciar stream de status de ramais' });
    } catch {}
  }
});

module.exports = router;

