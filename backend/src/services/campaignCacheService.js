/**
 * =====================================================
 * CAMPAIGN CACHE SERVICE - REDIS CACHE PARA CAMPANHAS
 * =====================================================
 * Serviço para cache de contatos de campanhas usando Redis
 * Evita consultas constantes ao banco de dados
 */

const { createClient } = require('@supabase/supabase-js');
const cacheService = require('./cacheService'); // Usar CacheService principal

// Singleton para evitar múltiplas instâncias
let instance = null;

class CampaignCacheService {
  constructor() {
    // Singleton pattern
    if (instance) {
      return instance;
    }

    // Configuração Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // TTL do cache (30 minutos)
    this.CACHE_TTL = 30 * 60;

    instance = this;
  }

  /**
   * Inicializar Redis de forma segura
   */
  async initializeRedis() {
    try {
      // Verificar se Redis está disponível
      const Redis = require('redis');
      
      this.redis = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      this.redis.on('error', (err) => {
        console.log('📝 [CACHE] Redis não disponível, funcionando sem cache');
        this.redisConnected = false;
      });

      this.redis.on('connect', () => {
        console.log('✅ [CACHE] Redis conectado');
        this.redisConnected = true;
      });

      this.redis.on('ready', () => {
        console.log('✅ [CACHE] Redis pronto para uso');
        this.redisConnected = true;
      });

      // Tentar conectar
      await this.redis.connect();
      
    } catch (error) {
      console.log('📝 [CACHE] Redis não instalado/disponível, funcionando sem cache');
      this.redisConnected = false;
      this.redis = null;
    }
  }

  /**
   * Gerar chave de cache para campanha
   */
  getCacheKey(campaignId, userId) {
    return `campaign:${campaignId}:user:${userId}:contacts`;
  }

  /**
   * Buscar contatos do cache
   */
  async getCachedContacts(campaignId, userId) {
    try {
      // Usar CacheService principal
      if (!cacheService.isAvailable()) {
        return null;
      }

      const key = this.getCacheKey(campaignId, userId);
      const cached = await cacheService.get(key);
      
      if (cached) {
        console.log(`📋 [CACHE] Contatos encontrados no cache: ${campaignId}`);
        // cacheService.get já retorna objeto parseado
        return cached;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Salvar contatos no cache
   */
  async setCachedContacts(campaignId, userId, contacts, discados = 0) {
    try {
      if (!cacheService.isAvailable()) {
        return false;
      }

      const key = this.getCacheKey(campaignId, userId);
      await cacheService.set(key, { contacts, discados }, this.CACHE_TTL);
      
      console.log(`💾 [CACHE] Salvos ${contacts.length} contatos para campanha ${campaignId} (discados=${discados})`);
      return true;
      
    } catch (error) {
      console.error('❌ [CACHE] Erro ao salvar contatos:', error.message);
      return false;
    }
  }

  /**
   * Invalidar cache de uma campanha
   */
  async invalidateCache(campaignId, userId) {
    try {
      if (!cacheService.isConnected()) {
        return false;
      }

      const key = this.getCacheKey(campaignId, userId);
      await cacheService.delete(key);
      
      console.log(`🗑️ [CACHE] Cache invalidado para campanha ${campaignId}`);
      return true;
      
    } catch (error) {
      console.error('❌ [CACHE] Erro ao invalidar cache:', error.message);
      return false;
    }
  }

  /**
   * Buscar contatos com cache inteligente
   */
  async getContacts(campaignId, userId, page = 1, limit = 3) {
    try {
      // Tentar buscar do cache primeiro
      const cached = await this.getCachedContacts(campaignId, userId);
      
      if (cached) {
        const { contacts: allContacts, discados } = cached;
        
        // Aplicar lógica de discados (pular contatos já discados)
        const availableContacts = allContacts.slice(discados);
        const offset = (page - 1) * limit;
        const paginatedContacts = availableContacts.slice(offset, offset + limit);
        
        return {
          contacts: paginatedContacts,
          total: availableContacts.length,
          discados,
          fromCache: true
        };
      }

      // Se não está no cache, buscar do banco
      let campaign = null;
      let error = null;
      // Tentar com total_discados primeiro; fallback para discados
      const resp = await this.supabase
        .from('mailings_pabx')
        .select('id, name, content, total_discados')
        .eq('id', campaignId)
        .eq('user_id', userId)
        .single();
      campaign = resp.data;
      error = resp.error;
      if (error && String(error.message || '').includes('total_discados')) {
        const resp2 = await this.supabase
          .from('mailings_pabx')
          .select('id, name, content, discados')
          .eq('id', campaignId)
          .eq('user_id', userId)
          .single();
        campaign = resp2.data;
        error = resp2.error;
        if (!error && campaign && campaign.discados !== undefined && campaign.total_discados === undefined) {
          campaign.total_discados = campaign.discados;
        }
      }

      if (error || !campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Processar contatos da coluna content (JSONB)
      let allContacts = [];
      if (campaign.content && campaign.content.contacts) {
        allContacts = campaign.content.contacts.map((contact, index) => ({
          id: String(index + 1),
          name: contact.name || `Contato ${index + 1}`,
          number: contact.number || contact.phone || '',
          status: 'active'
        }));
      }

      // Armazenar no cache
      await this.setCachedContacts(campaignId, userId, allContacts, campaign.total_discados || 0);

      // Aplicar lógica de discados
      const discados = campaign.total_discados || 0;
      const availableContacts = allContacts.slice(discados);
      const offset = (page - 1) * limit;
      const paginatedContacts = availableContacts.slice(offset, offset + limit);

      return {
        contacts: paginatedContacts,
        total: availableContacts.length,
        discados,
        fromCache: false
      };

    } catch (error) {
      console.error('❌ [CACHE] Erro ao buscar contatos:', error);
      throw error;
    }
  }

  /**
   * Atualizar contador de discados e invalidar cache
   */
  async updateDiscados(campaignId, userId) {
    try {
      // Invalidar cache para forçar nova busca
      await this.invalidateCache(campaignId, userId);
      
      console.log(`🔄 [CACHE] Cache invalidado após discagem: ${campaignId}`);
    } catch (error) {
      console.warn('⚠️ [CACHE] Erro ao atualizar discados:', error.message);
    }
  }

  /**
   * Conectar ao Redis (chamado na inicialização)
   */
  async connect() {
    // Método mantido para compatibilidade, mas inicialização é feita no constructor
    return;
  }

  /**
   * Desconectar do Redis
   */
  async disconnect() {
    try {
      if (this.redis && this.redisConnected) {
        await this.redis.quit();
      }
    } catch (error) {
      // Silencioso
    }
  }
}

module.exports = new CampaignCacheService();
