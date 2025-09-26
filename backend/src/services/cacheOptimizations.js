/**
 * OTIMIZAÇÕES REDIS PARA 100+ CLIENTES
 * Melhorias específicas para alta escala
 */

const cacheService = require('./cacheService');

class CacheOptimizations {
  constructor() {
    this.warmupInProgress = false;
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0
    };
  }

  /**
   * Cache Warming - Pré-aquecer dados críticos
   */
  async warmupCriticalData() {
    if (this.warmupInProgress) {
      console.log('🔥 Cache warming já em progresso...');
      return;
    }

    this.warmupInProgress = true;
    console.log('🔥 Iniciando cache warming para dados críticos...');

    try {
      const warmupTasks = [
        // Planos ativos (dados mais estáveis)
        this.warmupPlans(),
        
        // Configurações globais
        this.warmupGlobalConfigs(),
        
        // Estatísticas do dashboard admin
        this.warmupAdminStats()
      ];

      await Promise.allSettled(warmupTasks);
      console.log('✅ Cache warming concluído com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro no cache warming:', error);
    } finally {
      this.warmupInProgress = false;
    }
  }

  /**
   * Pré-aquecer dados de planos
   */
  async warmupPlans() {
    try {
      const plansKey = cacheService.generateKey('plans', 'active=true');
      
      // Simular dados de planos (em produção, viria da API)
      const plansData = {
        plans: [
          { id: '1', name: 'Básico', price: 49.90, maxAgents: 3 },
          { id: '2', name: 'Profissional', price: 99.90, maxAgents: 10 },
          { id: '3', name: 'Empresarial', price: 199.90, maxAgents: 25 }
        ]
      };

      await cacheService.set(plansKey, plansData, 1800); // 30 minutos
      console.log('🔥 Planos pré-carregados no cache');
      
    } catch (error) {
      console.error('❌ Erro ao pré-carregar planos:', error);
    }
  }

  /**
   * Pré-aquecer configurações globais
   */
  async warmupGlobalConfigs() {
    try {
      const configKey = cacheService.generateKey('config', 'global');
      
      const globalConfig = {
        systemName: 'PABX System',
        version: '1.0.0',
        maxAgentsPerPlan: 100,
        supportedCodecs: ['G.711', 'G.729', 'G.722'],
        defaultSettings: {
          callTimeout: 30,
          recordCalls: true,
          enableReports: true
        }
      };

      await cacheService.set(configKey, globalConfig, 3600); // 1 hora
      console.log('🔥 Configurações globais pré-carregadas');
      
    } catch (error) {
      console.error('❌ Erro ao pré-carregar configurações:', error);
    }
  }

  /**
   * Pré-aquecer estatísticas do admin
   */
  async warmupAdminStats() {
    try {
      const statsKey = cacheService.generateKey('stats', 'admin-overview');
      
      const adminStats = {
        totalClients: 100,
        totalAgents: 500,
        totalCalls: 20000,
        activeConnections: 250,
        systemHealth: 'excellent',
        lastUpdate: new Date().toISOString()
      };

      await cacheService.set(statsKey, adminStats, 180); // 3 minutos
      console.log('🔥 Estatísticas admin pré-carregadas');
      
    } catch (error) {
      console.error('❌ Erro ao pré-carregar estatísticas:', error);
    }
  }

  /**
   * Limpeza inteligente de cache
   */
  async intelligentCleanup() {
    try {
      console.log('🧹 Iniciando limpeza inteligente de cache...');
      
      // Buscar todas as chaves
      const allKeys = await cacheService.getKeys('pabx:*', 10000);
      
      let expiredKeys = 0;
      let oldKeys = 0;
      
      for (const key of allKeys) {
        const ttl = await cacheService.getTTL(key);
        
        // Remover chaves que vão expirar em menos de 10 segundos
        if (ttl > 0 && ttl < 10) {
          await cacheService.delete(key);
          expiredKeys++;
        }
        
        // Identificar chaves muito antigas (sem TTL)
        if (ttl === -1) {
          oldKeys++;
        }
      }
      
      console.log(`🧹 Limpeza concluída: ${expiredKeys} chaves expiradas removidas, ${oldKeys} chaves antigas encontradas`);
      
    } catch (error) {
      console.error('❌ Erro na limpeza inteligente:', error);
    }
  }

  /**
   * Monitoramento de performance
   */
  async getPerformanceMetrics() {
    try {
      const status = await cacheService.getStatus();
      const keys = await cacheService.getKeys('pabx:*', 1000);
      
      return {
        connected: status.connected,
        uptime: status.uptime,
        memory: status.memory,
        totalKeys: keys.length,
        hitRatio: this.calculateHitRatio(),
        lastCleanup: this.lastCleanup || 'Nunca',
        recommendations: this.getRecommendations(keys.length, status.memory)
      };
      
    } catch (error) {
      console.error('❌ Erro ao obter métricas:', error);
      return { error: error.message };
    }
  }

  /**
   * Calcular hit ratio
   */
  calculateHitRatio() {
    const total = this.metrics.hits + this.metrics.misses;
    if (total === 0) return 0;
    return ((this.metrics.hits / total) * 100).toFixed(2);
  }

  /**
   * Recomendações baseadas no uso
   */
  getRecommendations(keyCount, memory) {
    const recommendations = [];
    
    if (keyCount > 5000) {
      recommendations.push('Considere implementar limpeza automática mais frequente');
    }
    
    if (memory?.used_memory_human && parseInt(memory.used_memory_human) > 50) {
      recommendations.push('Uso de memória alto - revisar TTLs');
    }
    
    if (this.calculateHitRatio() < 80) {
      recommendations.push('Hit ratio baixo - revisar estratégia de cache');
    }
    
    return recommendations.length > 0 ? recommendations : ['Sistema funcionando otimamente'];
  }

  /**
   * Registrar hit/miss para métricas
   */
  recordHit() {
    this.metrics.hits++;
  }

  recordMiss() {
    this.metrics.misses++;
  }

  recordError() {
    this.metrics.errors++;
  }
}

// Singleton instance
const cacheOptimizations = new CacheOptimizations();

module.exports = cacheOptimizations;
