/**
 * CACHE MIDDLEWARE - Middleware para cache automático de APIs
 * Integra Redis com as rotas existentes
 */

const cacheService = require('../services/cacheService');

/**
 * Middleware de cache para GET requests
 */
const cacheMiddleware = (options = {}) => {
  const {
    ttl = null,
    keyGenerator = null,
    skipCache = false
  } = options;

  return async (req, res, next) => {
    // Só aplicar cache em GET requests
    if (req.method !== 'GET' || skipCache) {
      return next();
    }

    // 🚫 EXCLUIR CACHE para dados de clientes do revendedor (sempre frescos)
    if (req.path.includes('/reseller/clients')) {
      console.log('🚫 Cache DESABILITADO para rota de clientes:', req.path);
      return next();
    }

    try {
      // Gerar chave de cache
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : generateDefaultCacheKey(req);

      console.log('🔍 Verificando cache para:', cacheKey);

      // Tentar buscar do cache
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        console.log('⚡ Retornando dados do cache:', cacheKey);
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Se não encontrou no cache, continuar com a requisição
      console.log('🔄 Cache miss, processando requisição:', cacheKey);

      // Interceptar a resposta para salvar no cache
      const originalJson = res.json;
      res.json = function(data) {
        // Salvar no cache se a resposta foi bem-sucedida
        if (data && data.success && data.data) {
          cacheService.set(cacheKey, data.data, ttl)
            .then(() => {
              console.log('💾 Dados salvos no cache:', cacheKey);
            })
            .catch(err => {
              console.error('❌ Erro ao salvar no cache:', err);
            });
        }

        // Chamar o método original
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('❌ Erro no cache middleware:', error);
      // Em caso de erro, continuar sem cache
      next();
    }
  };
};

/**
 * Gerar chave de cache padrão baseada na URL e query params
 */
function generateDefaultCacheKey(req) {
  // Incluir parâmetros da URL (como :id) na chave do cache
  let baseKey = req.path.replace(/^\/api\//, '').replace(/\//g, ':');
  
  // Se há parâmetros na URL, incluí-los na chave
  if (req.params && Object.keys(req.params).length > 0) {
    const paramString = Object.entries(req.params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    baseKey += ':' + paramString;
  }
  
  // Adicionar query params se existirem
  const queryString = Object.keys(req.query).length > 0 
    ? ':query:' + Object.entries(req.query)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&')
    : '';
  
  const finalKey = cacheService.generateKey('api', baseKey + queryString);
  console.log('🔑 Chave de cache gerada:', finalKey, 'para path:', req.path);
  return finalKey;
}

/**
 * Middleware para invalidar cache após operações de escrita
 */
const invalidateCacheMiddleware = (patterns = []) => {
  return async (req, res, next) => {
    // Só aplicar em operações de escrita
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Interceptar resposta para invalidar cache após sucesso
    const originalJson = res.json;
    res.json = function(data) {
      // Invalidar cache se a operação foi bem-sucedida
      if (data && data.success) {
        patterns.forEach(pattern => {
          cacheService.invalidate(pattern)
            .then(() => {
              console.log('🗑️ Cache invalidado:', pattern);
            })
            .catch(err => {
              console.error('❌ Erro ao invalidar cache:', err);
            });
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Geradores de chave específicos para diferentes recursos
 */
const keyGenerators = {
  // Chaves para usuários
  users: (req) => {
    const { page = 1, limit = 20, search = '', role = '', status = '' } = req.query;
    return cacheService.generateKey('users', `page=${page}`, `limit=${limit}`, 
      search && `search=${search}`, role && `role=${role}`, status && `status=${status}`);
  },

  // Chaves para planos
  plans: (req) => {
    const { active = '', reseller = '' } = req.query;
    return cacheService.generateKey('plans', active && `active=${active}`, 
      reseller && `reseller=${reseller}`);
  },

  // Chaves para estatísticas
  stats: (req) => {
    const resource = req.path.split('/').pop();
    return cacheService.generateKey('stats', resource);
  }
};

/**
 * Middleware pré-configurado para diferentes recursos
 */
const cacheMiddlewares = {
  // Cache para usuários (5 minutos)
  users: cacheMiddleware({
    ttl: 300,
    keyGenerator: keyGenerators.users
  }),

  // Cache para planos (30 minutos)
  plans: cacheMiddleware({
    ttl: 1800,
    keyGenerator: keyGenerators.plans
  }),

  // Cache para estatísticas (2 minutos)
  stats: cacheMiddleware({
    ttl: 120,
    keyGenerator: keyGenerators.stats
  }),

  // Invalidação para usuários
  invalidateUsers: invalidateCacheMiddleware([
    'pabx:api:users:*',
    'pabx:stats:*'
  ]),

  // Invalidação para planos
  invalidatePlans: invalidateCacheMiddleware([
    'pabx:api:plans:*',
    'pabx:stats:*'
  ])
};

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  cacheMiddlewares,
  keyGenerators
};
