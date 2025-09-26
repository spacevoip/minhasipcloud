/**
 * REDIS CACHE SERVICE - Sistema de Cache Inteligente
 * Implementação completa com fallback e otimizações
 */

const Redis = require('ioredis');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    
    // TTL otimizado para plano FREE (reduzir uso de memória)
    this.defaultTTL = {
      users: 180,      // 3 minutos (reduzido de 5)
      plans: 900,      // 15 minutos (reduzido de 30)
      stats: 60,       // 1 minuto (reduzido de 2)
      dashboard: 120,  // 2 minutos (reduzido de 3)
      session: 1800,   // 30 minutos (reduzido de 1h)
      // TTLs específicos para FREE tier
      free_tier: true
    };
  }

  /**
   * Inicializar conexão Redis
   */
  async connect() {
    try {
      console.log('🔄 Conectando ao Redis Cloud...');
      
      // Debug das variáveis de ambiente
      console.log('🔍 Debug Redis Config:');
      console.log('   HOST:', process.env.REDIS_HOST);
      console.log('   PORT:', process.env.REDIS_PORT, '-> parsed:', parseInt(process.env.REDIS_PORT));
      console.log('   USERNAME:', process.env.REDIS_USERNAME);
      console.log('   PASSWORD:', process.env.REDIS_PASSWORD ? '***' : 'undefined');
      
      const redisPort = parseInt(process.env.REDIS_PORT);
      if (isNaN(redisPort)) {
        throw new Error(`REDIS_PORT inválida: ${process.env.REDIS_PORT}`);
      }
      
      this.client = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST,
          port: redisPort,
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              console.error('❌ Redis: Máximo de tentativas atingido');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 50, 500);
          }
        },
        password: process.env.REDIS_PASSWORD
      });

      // Event listeners
      this.client.on('connect', () => {
        console.log('🔗 Redis: Conectando...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis: Conectado e pronto!');
        this.isConnected = true;
        this.retryAttempts = 0;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis: Conexão encerrada');
        this.isConnected = false;
      });

      await this.client.connect();
      
      // Testar conexão
      await this.client.ping();
      console.log('🏓 Redis: Ping successful!');
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Verificar se Redis está disponível
   */
  isAvailable() {
    return this.isConnected && this.client;
  }

  /**
   * Buscar dados do cache
   */
  async get(key) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis não disponível para GET:', key);
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        // Log apenas se não for blacklist (muito verboso)
        if (!key.startsWith('blacklist:')) {
          console.log('📦 Cache HIT:', key);
        }
        return JSON.parse(data);
      }
      
      // Não logar Cache MISS para blacklist (comportamento normal)
      if (!key.startsWith('blacklist:')) {
        console.log('❌ Cache MISS:', key);
      }
      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar cache:', error);
      return null;
    }
  }

  /**
   * Salvar dados no cache
   */
  async set(key, data, ttl = null) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis não disponível para SET:', key);
      return false;
    }

    try {
      const serializedData = JSON.stringify(data);
      const expiration = ttl || this.getDefaultTTL(key);
      
      await this.client.setEx(key, expiration, serializedData);
      
      // Log apenas se não for blacklist (muito verboso)
      if (!key.startsWith('blacklist:')) {
        console.log(`💾 Cache SET: ${key} (TTL: ${expiration}s)`);
      }
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar cache:', error);
      return false;
    }
  }

  /**
   * Invalidar cache por padrão
   */
  async invalidate(pattern) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis não disponível para INVALIDATE:', pattern);
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`🗑️ Cache INVALIDATED: ${keys.length} keys (${pattern})`);
        return keys.length;
      }
      return 0;
    } catch (error) {
      console.error('❌ Erro ao invalidar cache:', error);
      return 0;
    }
  }

  /**
   * Limpar todo o cache do PABX
   */
  async clear() {
    return await this.invalidate('pabx:*');
  }

  /**
   * Deletar chave específica
   */
  async delete(key) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis não disponível para DELETE:', key);
      return false;
    }

    try {
      const result = await this.client.del(key);
      console.log(`🗑️ Cache DELETED: ${key}`);
      return result > 0;
    } catch (error) {
      console.error('❌ Erro ao deletar chave:', error);
      return false;
    }
  }

  /**
   * Obter TTL de uma chave específica
   */
  async getTTL(key) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis não disponível para TTL:', key);
      return -1;
    }

    try {
      const ttl = await this.client.ttl(key);
      return ttl;
    } catch (error) {
      console.error('❌ Erro ao obter TTL:', error);
      return -1;
    }
  }

  /**
   * Obter TTL padrão baseado na chave
   */
  getDefaultTTL(key) {
    if (key.includes('users')) return this.defaultTTL.users;
    if (key.includes('plans')) return this.defaultTTL.plans;
    if (key.includes('stats')) return this.defaultTTL.stats;
    if (key.includes('dashboard')) return this.defaultTTL.dashboard;
    if (key.includes('session')) return this.defaultTTL.session;
    return 300; // 5 minutos padrão
  }

  /**
   * Listar chaves do cache por padrão
   */
  async getKeys(pattern = 'pabx:*', limit = 100) {
    if (!this.isAvailable()) {
      console.warn('⚠️ Redis não disponível para KEYS:', pattern);
      return [];
    }

    try {
      const keys = await this.client.keys(pattern);
      return keys.slice(0, limit);
    } catch (error) {
      console.error('❌ Erro ao listar chaves:', error);
      return [];
    }
  }

  /**
   * Gerar chave de cache padronizada
   */
  generateKey(prefix, ...parts) {
    return `pabx:${prefix}:${parts.filter(p => p !== undefined && p !== null).join(':')}`;
  }

  /**
   * Cache com fallback automático
   */
  async getOrSet(key, fetchFunction, ttl = null) {
    // Tentar buscar do cache primeiro
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    try {
      // Se não encontrou no cache, buscar dados
      console.log('🔄 Buscando dados para cache:', key);
      const data = await fetchFunction();
      
      // Salvar no cache para próximas consultas
      await this.set(key, data, ttl);
      
      return data;
    } catch (error) {
      console.error('❌ Erro no getOrSet:', error);
      throw error;
    }
  }

  /**
   * Status completo do Redis
   */
  async getStatus() {
    if (!this.isAvailable()) {
      return { connected: false };
    }

    try {
      const [memory, keyspace, server] = await Promise.all([
        this.client.info('memory'),
        this.client.info('keyspace'),
        this.client.info('server')
      ]);
      
      return {
        connected: true,
        uptime: this.parseInfo(server, 'uptime_in_seconds'),
        memory: {
          used_memory_human: this.parseInfo(memory, 'used_memory_human'),
          used_memory_peak_human: this.parseInfo(memory, 'used_memory_peak_human')
        },
        keyspace: this.parseKeyspace(keyspace),
        stats: {
          total_commands_processed: this.parseInfo(server, 'total_commands_processed'),
          instantaneous_ops_per_sec: this.parseInfo(server, 'instantaneous_ops_per_sec')
        }
      };
    } catch (error) {
      console.error('❌ Erro ao obter status:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Estatísticas do cache
   */
  async getStats() {
    if (!this.isAvailable()) {
      return { connected: false };
    }

    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: true,
        memory: info,
        keyspace: keyspace,
        uptime: await this.client.info('server')
      };
    } catch (error) {
      console.error('❌ Erro ao obter stats:', error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Parsear informações do Redis INFO
   */
  parseInfo(infoString, key) {
    const lines = infoString.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(key + ':')) {
        return line.split(':')[1];
      }
    }
    return null;
  }

  /**
   * Parsear informações de keyspace
   */
  parseKeyspace(keyspaceString) {
    const result = {};
    const lines = keyspaceString.split('\r\n');
    for (const line of lines) {
      if (line.startsWith('db')) {
        const [dbName, dbInfo] = line.split(':');
        const info = {};
        dbInfo.split(',').forEach(item => {
          const [key, value] = item.split('=');
          info[key] = parseInt(value) || value;
        });
        result[dbName] = info;
      }
    }
    return result;
  }

  /**
   * Desconectar Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      console.log('👋 Redis: Desconectado');
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
