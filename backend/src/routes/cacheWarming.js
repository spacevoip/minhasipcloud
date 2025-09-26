/**
 * =====================================================
 * CACHE WARMING ROUTES - Monitoramento e controle
 * =====================================================
 */

const express = require('express');
const cacheWarmingService = require('../services/cacheWarmingService');
const cacheService = require('../services/cacheService');

const router = express.Router();

/**
 * GET /api/cache-warming/status
 * Status do cache warming
 */
router.get('/status', async (req, res) => {
  try {
    const status = cacheWarmingService.getStatus();
    const cacheStatus = await cacheService.getStatus();
    
    res.json({
      success: true,
      data: {
        warming: status,
        redis: {
          connected: cacheStatus.connected,
          memory: cacheStatus.memory,
          uptime: cacheStatus.uptime
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter status do cache warming',
      error: error.message
    });
  }
});

/**
 * POST /api/cache-warming/warm
 * Executar cache warming manual
 */
router.post('/warm', async (req, res) => {
  try {
    // Executar warming em background
    cacheWarmingService.warmCache().catch(console.error);
    
    res.json({
      success: true,
      message: 'Cache warming iniciado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar cache warming',
      error: error.message
    });
  }
});

/**
 * POST /api/cache-warming/refresh
 * Limpar e re-aquecer cache
 */
router.post('/refresh', async (req, res) => {
  try {
    // Executar refresh em background
    cacheWarmingService.refreshCache().catch(console.error);
    
    res.json({
      success: true,
      message: 'Cache refresh iniciado',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer refresh do cache',
      error: error.message
    });
  }
});

/**
 * GET /api/cache-warming/keys
 * Listar chaves em cache
 */
router.get('/keys', async (req, res) => {
  try {
    const { pattern = 'pabx:*', limit = 50 } = req.query;
    const keys = await cacheService.getKeys(pattern, parseInt(limit));
    
    // Obter informações detalhadas das chaves
    const keysWithInfo = await Promise.all(
      keys.map(async (key) => {
        const ttl = await cacheService.getTTL(key);
        return {
          key,
          ttl,
          expires: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        keys: keysWithInfo,
        total: keys.length,
        pattern,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao listar chaves do cache',
      error: error.message
    });
  }
});

/**
 * GET /api/cache-warming/metrics
 * Métricas do cache
 */
router.get('/metrics', async (req, res) => {
  try {
    const keys = await cacheService.getKeys('pabx:*', 1000);
    const status = await cacheService.getStatus();
    
    // Categorizar chaves por tipo
    const categories = {
      users: keys.filter(k => k.includes(':users:')).length,
      plans: keys.filter(k => k.includes(':plans:')).length,
      stats: keys.filter(k => k.includes(':stats:')).length,
      agents: keys.filter(k => k.includes(':agents:')).length,
      config: keys.filter(k => k.includes(':config:')).length,
      other: keys.filter(k => !k.match(/:(?:users|plans|stats|agents|config):/)).length
    };
    
    res.json({
      success: true,
      data: {
        totalKeys: keys.length,
        categories,
        redis: {
          connected: status.connected,
          memory: status.memory,
          uptime: status.uptime,
          keyspace: status.keyspace
        },
        warming: cacheWarmingService.getStatus(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter métricas do cache',
      error: error.message
    });
  }
});

module.exports = router;
