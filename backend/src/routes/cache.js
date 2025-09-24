/**
 * ROTAS DE CACHE - Monitoramento e administração do Redis
 */

const express = require('express');
const cacheService = require('../services/cacheService');
const router = express.Router();

/**
 * GET /api/cache/status
 * Verificar status do Redis e estatísticas
 */
router.get('/status', async (req, res) => {
  try {
    const status = await cacheService.getStatus();
    
    res.json({
      success: true,
      data: {
        connected: status.connected,
        uptime: status.uptime,
        memory: status.memory,
        keyspace: status.keyspace,
        stats: status.stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status do cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status do cache',
      error: error.message
    });
  }
});

/**
 * GET /api/cache/keys
 * Listar chaves do cache (para debug)
 */
router.get('/keys', async (req, res) => {
  try {
    const { pattern = 'pabx:*', limit = 100 } = req.query;
    
    const keys = await cacheService.getKeys(pattern, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        pattern,
        count: keys.length,
        keys: keys.map(key => ({
          key,
          ttl: null // TTL será adicionado se necessário
        }))
      }
    });
  } catch (error) {
    console.error('❌ Erro ao listar chaves do cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar chaves do cache',
      error: error.message
    });
  }
});

/**
 * GET /api/cache/key/:key
 * Buscar valor específico do cache
 */
router.get('/key/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const fullKey = key.startsWith('pabx:') ? key : `pabx:${key}`;
    
    const value = await cacheService.get(fullKey);
    const ttl = await cacheService.getTTL(fullKey);
    
    res.json({
      success: true,
      data: {
        key: fullKey,
        exists: value !== null,
        value,
        ttl,
        size: value ? JSON.stringify(value).length : 0
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar chave do cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar chave do cache',
      error: error.message
    });
  }
});

/**
 * DELETE /api/cache/key/:key
 * Remover chave específica do cache
 */
router.delete('/key/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const fullKey = key.startsWith('pabx:') ? key : `pabx:${key}`;
    
    const deleted = await cacheService.delete(fullKey);
    
    res.json({
      success: true,
      data: {
        key: fullKey,
        deleted
      }
    });
  } catch (error) {
    console.error('❌ Erro ao remover chave do cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover chave do cache',
      error: error.message
    });
  }
});

/**
 * DELETE /api/cache/pattern/:pattern
 * Invalidar chaves por padrão
 */
router.delete('/pattern/:pattern', async (req, res) => {
  try {
    const { pattern } = req.params;
    const fullPattern = pattern.startsWith('pabx:') ? pattern : `pabx:${pattern}`;
    
    const deleted = await cacheService.invalidate(fullPattern);
    
    res.json({
      success: true,
      data: {
        pattern: fullPattern,
        deletedCount: deleted
      }
    });
  } catch (error) {
    console.error('❌ Erro ao invalidar padrão do cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao invalidar padrão do cache',
      error: error.message
    });
  }
});

/**
 * POST /api/cache/clear
 * Limpar todo o cache do PABX
 */
router.post('/clear', async (req, res) => {
  try {
    const deleted = await cacheService.clear();
    
    res.json({
      success: true,
      data: {
        message: 'Cache limpo com sucesso',
        deletedCount: deleted
      }
    });
  } catch (error) {
    console.error('❌ Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar cache',
      error: error.message
    });
  }
});

/**
 * POST /api/cache/warmup
 * Pré-aquecer cache com dados essenciais
 */
router.post('/warmup', async (req, res) => {
  try {
    // Simular algumas chamadas para aquecer o cache
    const warmupTasks = [
      // Buscar planos ativos
      fetch(`http://localhost:${process.env.PORT || 3001}/api/plans?active=true`),
      // Buscar estatísticas básicas
      fetch(`http://localhost:${process.env.PORT || 3001}/api/users?limit=1`)
    ];

    await Promise.allSettled(warmupTasks);
    
    res.json({
      success: true,
      data: {
        message: 'Cache aquecido com sucesso',
        tasks: warmupTasks.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao aquecer cache:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao aquecer cache',
      error: error.message
    });
  }
});

module.exports = router;
