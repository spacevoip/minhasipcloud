/**
 * AMI SERVICE - Asterisk Manager Interface
 * Monitora eventos de chamadas em tempo real
 * Agora usa connection pooling para maior estabilidade
 */

const EventEmitter = require('events');
const AMIConnectionPool = require('./amiConnectionPool');
const cacheService = require('./cacheService');

class AMIService extends EventEmitter {
  constructor() {
    super();
    this.connectionPool = null;
    this.connected = false;
    
    // Configurações do AMI
    this.config = {
      host: process.env.AMI_HOST || '38.51.135.180',
      port: parseInt(process.env.AMI_PORTE || process.env.AMI_PORT || '5038'),
      username: process.env.AMI_USER || 'admin',
      password: process.env.AMI_PASSWORD || '35981517',
      poolSize: 3
    };
    
    // Cache de chamadas ativas por accountcode
    this.activeCalls = new Map();
    
    // Debounce para consolidar eventos
    this.eventBuffer = new Map();
    this.processTimeout = null;
  }

  /**
   * Conectar ao AMI usando connection pool
   */
  async connect() {
    try {
      console.log(`🔄 [AMI] Inicializando connection pool...`);
      
      this.connectionPool = new AMIConnectionPool(this.config);
      
      this.connectionPool.on('event', (event) => {
        this.handleEvent(event);
      });
      
      this.connectionPool.on('response', (response) => {
        this.handleResponse(response);
      });
      
      await this.connectionPool.initialize();
      this.connected = true;
      
      console.log('✅ [AMI] Connection pool inicializado com sucesso!');
      
    } catch (error) {
      console.error('❌ [AMI] Erro ao inicializar connection pool:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Obter status do pool de conexões
   */
  getPoolStatus() {
    if (!this.connectionPool) {
      return { status: 'disconnected', connections: [] };
    }
    
    return {
      status: this.connected ? 'connected' : 'disconnected',
      ...this.connectionPool.getPoolStatus()
    };
  }

  /**
   * Enviar ação AMI usando connection pool
   */
  async sendAction(action) {
    if (!this.connected || !this.connectionPool) {
      throw new Error('AMI connection pool não conectado');
    }
    
    console.log(`📤 [AMI] Enviando ação: ${action.Action} (ID: ${action.ActionID || 'N/A'})`);
    return await this.connectionPool.sendAction(action);
  }

  /**
   * Reconectar connection pool
   */
  async reconnect() {
    if (this.connectionPool) {
      await this.connectionPool.disconnect();
    }
    
    this.connected = false;
    await this.connect();
  }

  /**
   * Processar eventos AMI
   */
  handleEvent(event) {
    const eventType = event.Event;
    
    // Filtrar apenas eventos de chamadas relevantes
    const relevantEvents = [
      'Newchannel', 'Hangup', 'Newstate', 
      'DialBegin', 'DialEnd', 'Bridge', 'Unbridge'
    ];
    
    if (!relevantEvents.includes(eventType)) {
      return;
    }
    
    // Filtrar apenas canais PJSIP (ramais)
    if (!event.Channel || !event.Channel.includes('PJSIP/')) {
      return;
    }
    
    // Deve ter accountcode para identificar o usuário
    if (!event.AccountCode) {
      return;
    }
    
    console.log(`📡 [AMI] Evento: ${eventType} | Canal: ${event.Channel} | Account: ${event.AccountCode}`);
    
    // Adicionar ao buffer para processamento em lote
    this.bufferEvent(event);
  }

  /**
   * Buffer de eventos para debounce
   */
  bufferEvent(event) {
    const accountcode = event.AccountCode;
    
    if (!this.eventBuffer.has(accountcode)) {
      this.eventBuffer.set(accountcode, []);
    }
    
    this.eventBuffer.get(accountcode).push({
      ...event,
      timestamp: Date.now()
    });
    
    // Processar eventos após 200ms de silêncio (reduzido para mais responsividade)
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
    }
    
    this.processTimeout = setTimeout(() => {
      this.processBufferedEvents();
    }, 200);
  }

  /**
   * Processar eventos em lote
   */
  async processBufferedEvents() {
    for (const [accountcode, events] of this.eventBuffer.entries()) {
      const consolidatedCalls = this.consolidateEvents(events);
      
      // Atualizar cache Redis com TTL reduzido para resposta mais rápida
      const cacheKey = `ami:active-calls:${accountcode}`;
      await cacheService.set(cacheKey, consolidatedCalls, 5); // Reduzido de 30s para 5s
      
      // Emitir evento para outros serviços
      this.emit('callsUpdated', {
        accountcode,
        calls: consolidatedCalls,
        timestamp: Date.now()
      });
      
      console.log(`📊 [AMI] Processados ${events.length} eventos para account ${accountcode} -> ${consolidatedCalls.length} chamadas ativas`);
    }
    
    this.eventBuffer.clear();
  }

  /**
   * Consolidar eventos em chamadas ativas
   */
  consolidateEvents(events) {
    const callsMap = new Map();
    
    events.forEach(event => {
      const channel = event.Channel;
      const linkedId = event.Linkedid || event.Uniqueid;
      const key = linkedId || channel;
      
      if (!callsMap.has(key)) {
        callsMap.set(key, {
          id: key,
          channel: channel,
          accountcode: event.AccountCode,
          extension: this.extractExtension(channel),
          callerNumber: event.CallerIDNum || '',
          connectedNumber: event.ConnectedLineNum || '',
          state: 'unknown',
          startTime: new Date(),
          duration: 0
        });
      }
      
      const call = callsMap.get(key);
      
      // Atualizar estado baseado no evento
      switch (event.Event) {
        case 'Newchannel':
          call.state = 'ringing';
          call.startTime = new Date();
          break;
          
        case 'Newstate':
          if (event.ChannelStateDesc === 'Up') {
            call.state = 'talking';
          } else if (event.ChannelStateDesc === 'Ringing') {
            call.state = 'ringing';
          }
          break;
          
        case 'Bridge':
          call.state = 'talking';
          break;
          
        case 'Hangup':
          // Remove chamada encerrada
          callsMap.delete(key);
          break;
      }
      
      // Calcular duração
      if (call.startTime) {
        call.duration = Math.floor((Date.now() - call.startTime.getTime()) / 1000);
      }
    });
    
    return Array.from(callsMap.values());
  }

  /**
   * Extrair número do ramal do canal
   */
  extractExtension(channel) {
    const match = channel.match(/^PJSIP\/(.+?)-/);
    return match ? match[1] : '';
  }

  /**
   * Processar respostas AMI
   */
  handleResponse(response) {
    if (response.Response === 'Success' && response.Message?.includes('Authentication accepted')) {
      console.log('✅ [AMI] Login realizado com sucesso');
    } else if (response.Response === 'Error') {
      console.error('❌ [AMI] Erro na resposta:', response.Message);
    }
    
    // Emitir evento de resposta para listeners externos
    this.emit('Response', response);
  }

  /**
   * Obter chamadas ativas por accountcode
   */
  async getActiveCallsByAccount(accountcode) {
    const cacheKey = `ami:active-calls:${accountcode}`;
    const cached = await cacheService.get(cacheKey);
    return cached || [];
  }

  /**
   * Obter todas as chamadas ativas
   */
  async getAllActiveCalls() {
    const keys = await cacheService.getKeys('ami:active-calls:*');
    const allCalls = [];
    
    for (const key of keys) {
      const calls = await cacheService.get(key);
      if (calls && Array.isArray(calls)) {
        allCalls.push(...calls);
      }
    }
    
    return allCalls;
  }

  /**
   * Desconectar AMI connection pool
   */
  async disconnect() {
    if (this.connectionPool) {
      await this.connectionPool.disconnect();
      this.connectionPool = null;
    }
    this.connected = false;
    console.log('👋 [AMI] Connection pool desconectado');
  }

  /**
   * Status da conexão
   */
  isConnected() {
    return this.connected;
  }
}

// Singleton instance
const amiService = new AMIService();

module.exports = amiService;
