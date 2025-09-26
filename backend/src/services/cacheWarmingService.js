/**
 * =====================================================
 * CACHE WARMING SERVICE - Pré-carregamento de dados críticos
 * =====================================================
 * Carrega dados importantes no Redis na inicialização do sistema
 */

const cacheService = require('./cacheService');
const { createClient } = require('@supabase/supabase-js');

class CacheWarmingService {
  constructor() {
    // Configurar Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://31.97.84.157:8000',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUyNTQ4NDAwLCJleHAiOjE5MTAzMTQ4MDB9.y8Warh7fcdJrgMO2KMmphRajbF4Cxvz1xH1Ui9HOAyE'
    );
    
    this.isWarming = false;
    this.lastWarmTime = null;
  }

  /**
   * Executar cache warming completo
   */
  async warmCache() {
    if (this.isWarming) {
      console.log('⚠️ Cache warming já em execução...');
      return;
    }

    console.log('🔥 ===================================');
    console.log('🔥 INICIANDO CACHE WARMING');
    console.log('🔥 ===================================');

    this.isWarming = true;
    const startTime = Date.now();

    try {
      // Verificar se Redis está disponível
      if (!cacheService.isAvailable()) {
        console.log('⚠️ Redis não disponível - pulando cache warming');
        return;
      }

      // 1. Carregar planos ativos
      await this.warmPlans();

      // 2. Carregar estatísticas globais
      await this.warmGlobalStats();

      // 3. Carregar configurações do sistema
      await this.warmSystemConfig();

      // 4. Carregar dados de usuários mais acessados
      await this.warmPopularUsers();

      // 5. Carregar dados de agentes online
      await this.warmAgentsStatus();

      const duration = Date.now() - startTime;
      this.lastWarmTime = new Date();

      console.log('🎉 ===================================');
      console.log('🎉 CACHE WARMING CONCLUÍDO!');
      console.log(`🎉 Tempo total: ${duration}ms`);
      console.log('🎉 ===================================');

    } catch (error) {
      console.error('❌ Erro no cache warming:', error.message);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Carregar planos ativos no cache
   */
  async warmPlans() {
    try {
      console.log('📋 Carregando planos ativos...');

      const { data: plans, error } = await this.supabase
        .from('planos_pabx')
        .select('*')
        .eq('status', true)
        .order('price', { ascending: true });

      if (error) throw error;

      // Cache planos ativos
      const cacheKey = cacheService.generateKey('plans', 'active=true');
      await cacheService.set(cacheKey, plans, 3600); // 1 hora

      // Cache individual por ID
      for (const plan of plans) {
        const planKey = cacheService.generateKey('plans', `id=${plan.id}`);
        await cacheService.set(planKey, plan, 3600);
      }

      console.log(`✅ ${plans.length} planos carregados no cache`);

    } catch (error) {
      console.error('❌ Erro ao carregar planos:', error.message);
    }
  }

  /**
   * Carregar estatísticas globais
   */
  async warmGlobalStats() {
    try {
      console.log('📊 Carregando estatísticas globais...');

      // Contar usuários por role
      const { data: userStats } = await this.supabase
        .from('users_pabx')
        .select('role')
        .eq('status', 'active');

      const roleCount = userStats?.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {}) || {};

      // Contar agentes
      const { count: totalAgents } = await this.supabase
        .from('agentes_pabx')
        .select('*', { count: 'exact', head: true });

      // Contar planos
      const { count: totalPlans } = await this.supabase
        .from('planos_pabx')
        .select('*', { count: 'exact', head: true })
        .eq('status', true);

      const globalStats = {
        users: {
          total: userStats?.length || 0,
          byRole: roleCount,
          admin: roleCount.admin || 0,
          user: roleCount.user || 0,
          reseller: roleCount.reseller || 0,
          collaborator: roleCount.collaborator || 0
        },
        agents: {
          total: totalAgents || 0
        },
        plans: {
          total: totalPlans || 0
        },
        lastUpdate: new Date().toISOString()
      };

      const statsKey = cacheService.generateKey('stats', 'global');
      await cacheService.set(statsKey, globalStats, 300); // 5 minutos

      console.log('✅ Estatísticas globais carregadas:', {
        usuarios: globalStats.users.total,
        agentes: globalStats.agents.total,
        planos: globalStats.plans.total
      });

    } catch (error) {
      console.error('❌ Erro ao carregar estatísticas:', error.message);
    }
  }

  /**
   * Carregar configurações do sistema
   */
  async warmSystemConfig() {
    try {
      console.log('⚙️ Carregando configurações do sistema...');

      const systemConfig = {
        version: '1.0.0',
        features: {
          redis: true,
          webrtc: true,
          asterisk: true,
          supabase: true
        },
        limits: {
          maxUsersPerPage: 20,
          maxAgentsPerUser: 100,
          maxCallsPerDay: 1000,
          cacheTimeout: 300
        },
        maintenance: false,
        lastUpdate: new Date().toISOString()
      };

      const configKey = cacheService.generateKey('config', 'system');
      await cacheService.set(configKey, systemConfig, 7200); // 2 horas

      console.log('✅ Configurações do sistema carregadas');

    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error.message);
    }
  }

  /**
   * Carregar usuários mais acessados
   */
  async warmPopularUsers() {
    try {
      console.log('👥 Carregando usuários populares...');

      // Buscar usuários admin e resellers (mais acessados)
      const { data: popularUsers } = await this.supabase
        .from('users_pabx')
        .select(`
          id, name, email, role, status, credits,
          plan_id, plan_activated_at, plan_expires_at, plan_status,
          created_at, last_login_at
        `)
        .in('role', ['admin', 'reseller'])
        .eq('status', 'active')
        .order('last_login_at', { ascending: false })
        .limit(20);

      if (popularUsers && popularUsers.length > 0) {
        // Cache lista de usuários populares
        const popularKey = cacheService.generateKey('users', 'popular');
        await cacheService.set(popularKey, popularUsers, 600); // 10 minutos

        // Cache individual por ID
        for (const user of popularUsers) {
          const userKey = cacheService.generateKey('users', `id=${user.id}`);
          await cacheService.set(userKey, user, 300); // 5 minutos
        }

        console.log(`✅ ${popularUsers.length} usuários populares carregados`);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar usuários populares:', error.message);
    }
  }

  /**
   * Carregar status dos agentes
   */
  async warmAgentsStatus() {
    try {
      console.log('📞 Carregando status dos agentes...');

      // Buscar agentes ativos
      const { data: agents } = await this.supabase
        .from('agentes_pabx')
        .select('id, user_id, extension, name, caller_id, is_active')
        .eq('is_active', true)
        .limit(100);

      if (agents && agents.length > 0) {
        // Simular status online/offline (seria integrado com ps_contacts em produção)
        const agentsWithStatus = agents.map(agent => ({
          ...agent,
          status: Math.random() > 0.3 ? 'online' : 'offline',
          lastSeen: new Date().toISOString()
        }));

        const agentsKey = cacheService.generateKey('agents', 'status');
        await cacheService.set(agentsKey, agentsWithStatus, 120); // 2 minutos

        console.log(`✅ Status de ${agents.length} agentes carregado`);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar status dos agentes:', error.message);
    }
  }

  /**
   * Re-aquecer cache automaticamente
   */
  async scheduleRewarming() {
    console.log('🔄 Agendando re-aquecimento automático do cache...');

    // Re-aquecer a cada 30 minutos
    setInterval(async () => {
      console.log('🔄 Re-aquecimento automático iniciado...');
      await this.warmCache();
    }, 30 * 60 * 1000); // 30 minutos

    console.log('✅ Re-aquecimento agendado para cada 30 minutos');
  }

  /**
   * Obter status do cache warming
   */
  getStatus() {
    return {
      isWarming: this.isWarming,
      lastWarmTime: this.lastWarmTime,
      nextWarmTime: this.lastWarmTime ? 
        new Date(this.lastWarmTime.getTime() + 30 * 60 * 1000) : null
    };
  }

  /**
   * Limpar cache e re-aquecer
   */
  async refreshCache() {
    console.log('🔄 Limpando e re-aquecendo cache...');
    
    // Limpar cache atual
    await cacheService.clear();
    
    // Re-aquecer
    await this.warmCache();
  }
}

// Singleton instance
const cacheWarmingService = new CacheWarmingService();

module.exports = cacheWarmingService;
