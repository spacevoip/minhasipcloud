/**
 * =====================================================
 * EXTENSION STATUS SERVICE - MONITORAMENTO DE RAMAIS
 * =====================================================
 * Serviço para monitorar status online/offline dos ramais
 * baseado na tabela ps_contacts a cada 5 segundos
 */

const { supabase } = require('../config/database');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

class ExtensionStatusService {
  constructor() {
    this.supabase = supabase;
      process.env.SUPABASE_ANON_KEY
    );
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastStatusUpdate = new Date();
    this.lastLogTime = 0; // Para controlar logs
    this.lastContactsCheck = 0; // Para throttling de ps_contacts
    
    // Cache para armazenar status dos ramais
    this.extensionStatusCache = new Map();
    
    console.log('🔌 ExtensionStatusService inicializado');
  }

  // Converte expiration_time (segundos Unix, milissegundos ou ISO) para Date
  parseExpiration(expVal) {
    if (!expVal) return null;
    // número ou string numérica
    if (typeof expVal === 'number' || (typeof expVal === 'string' && /^\d+$/.test(expVal))) {
      let n = typeof expVal === 'number' ? expVal : parseInt(expVal, 10);
      // se parece segundos (10 dígitos), converter para ms
      if (n < 1e12) n = n * 1000;
      const d = new Date(n);
      return isNaN(d.getTime()) ? null : d;
    }
    // ISO string
    const d = new Date(expVal);
    return isNaN(d.getTime()) ? null : d;
  }

  // Normaliza valores de ramal/endpoint vindos de ps_contacts e agentes
  normalizeExtension(value) {
    if (value === undefined || value === null) return '';
    let s = String(value).trim();
    // remover prefixo sip:
    s = s.replace(/^sip:/i, '');
    // quebrar por ; @ : / e pegar a última parte útil
    const parts = s.split(/[;@:/]/).filter(Boolean);
    if (parts.length > 0) {
      s = parts[parts.length - 1];
    }
    return s.trim();
  }

  /**
   * Iniciar monitoramento automático dos ramais
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoramento já está ativo');
      return;
    }

    console.log('🚀 Iniciando monitoramento de ramais (5s)...');
    this.isMonitoring = true;

    // Primeira verificação imediata
    this.checkExtensionStatus();

    // Verificação a cada 5 segundos
    this.monitoringInterval = setInterval(() => {
      this.checkExtensionStatus();
    }, 5000);
  }

  /**
   * Parar monitoramento
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      console.log('⚠️ Monitoramento já está parado');
      return;
    }

    console.log('🛑 Parando monitoramento de ramais...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Verificar status dos ramais na tabela ps_contacts (com throttling otimizado)
   */
  async checkExtensionStatus(forceRefresh = false) {
    try {
      const now = Date.now();
      
      // ✅ CORREÇÃO: Sempre consultar na primeira carga ou quando forçado
      const isFirstCheck = this.lastContactsCheck === 0;
      const shouldThrottle = !forceRefresh && !isFirstCheck && (now - this.lastContactsCheck < 120000);
      
      if (shouldThrottle) {
        console.log('⏭️ Throttling: pulando verificação ps_contacts (última há', Math.round((now - this.lastContactsCheck) / 1000), 'segundos)');
        return; // Skip this check apenas se não for primeira vez
      }
      
      console.log('🔍 Consultando ps_contacts...', isFirstCheck ? '(primeira carga)' : forceRefresh ? '(forçado)' : '(throttling expirado)');
      this.lastContactsCheck = now;

      // Buscar todos os ramais registrados na ps_contacts
      const { data: contacts, error } = await this.supabase
        .from('ps_contacts')
        .select('endpoint, uri, user_agent, expiration_time');

      if (error) {
        console.error('❌ Erro ao buscar ps_contacts:', error);
        return;
      }

      // ✅ DEBUG: Log detalhado para investigar cache do ramal 1001
      console.log('🔍 [DEBUG] ps_contacts encontrados:', contacts?.length || 0);
      if (contacts && contacts.length > 0) {
        console.log('🔍 [DEBUG] Endpoints na ps_contacts:');
        contacts.forEach(c => {
          console.log(`   - endpoint: ${c.endpoint}, expiration: ${c.expiration_time}`);
        });
      }

      // Extrair ramais online
      const onlineExtensions = new Set();
      const extensionDetails = new Map();

      const nowIso = new Date().toISOString();
      if (contacts && contacts.length > 0) {
        // Log apenas se mudou a quantidade de registros
        const prevCount = this.extensionStatusCache.get('contacts_count') || 0;
        if (contacts.length !== prevCount) {
          console.log(`📡 ps_contacts: ${contacts.length} registros (mudança de ${prevCount})`);
          this.extensionStatusCache.set('contacts_count', contacts.length);
        }
        contacts.forEach(contact => {
          const endpoint = this.normalizeExtension(contact?.endpoint);
          const exp = this.parseExpiration(contact?.expiration_time);
          const notExpired = exp ? exp.getTime() > Date.now() : true;
          if (endpoint && notExpired) {
            onlineExtensions.add(endpoint);
            extensionDetails.set(endpoint, {
              endpoint,
              status: 'online',
              uri: contact.uri || null,
              userAgent: contact.user_agent || null,
              expirationTime: contact.expiration_time || null,
              lastSeen: nowIso
            });
          }
        });
      }

      // Buscar todos os agentes/ramais cadastrados no sistema
      const { data: agents, error: agentsError } = await this.supabase
        .from('agentes_pabx')
        .select('ramal, agente_name, user_id');

      if (agentsError) {
        console.error('❌ Erro ao buscar agentes:', agentsError);
        return;
      }

      // Criar mapa de status para todos os ramais cadastrados
      const extensionStatusMap = new Map();

      if (agents && agents.length > 0) {
        agents.forEach(agent => {
          const ramal = this.normalizeExtension(agent?.ramal);
          if (ramal) {
            const isOnline = onlineExtensions.has(ramal);
            const details = extensionDetails.get(ramal);

            // ✅ DEBUG: Log específico para ramal 1001
            if (ramal === '1001') {
              console.log('🔍 [DEBUG 1001] Processando ramal 1001:');
              console.log(`   - ramal normalizado: ${ramal}`);
              console.log(`   - está em onlineExtensions: ${isOnline}`);
              console.log(`   - onlineExtensions.size: ${onlineExtensions.size}`);
              console.log(`   - onlineExtensions:`, Array.from(onlineExtensions));
              console.log(`   - status_sip na tabela: ${agent.status_sip}`);
              console.log(`   - details:`, details);
            }

            extensionStatusMap.set(ramal, {
              extension: ramal,
              name: agent.agente_name,
              userId: agent.user_id,
              isOnline,
              status: isOnline ? 'online' : 'offline',
              lastSeen: details?.lastSeen || null,
              uri: details?.uri || null,
              userAgent: details?.userAgent || null,
              expirationTime: details?.expirationTime || null
            });
          }
        });
      }

      // Atualizar cache local
      this.extensionStatusCache = extensionStatusMap;
      this.lastStatusUpdate = new Date();

      // ✅ SEM CACHE - Dados sempre frescos para máxima precisão
      const statusData = {
        extensions: Object.fromEntries(extensionStatusMap),
        onlineCount: onlineExtensions.size,
        totalExtensions: extensionStatusMap.size,
        lastUpdate: this.lastStatusUpdate.toISOString(),
        onlineExtensions: Array.from(onlineExtensions)
      };

      // Log silencioso - apenas a cada 30 segundos
      if (!this.lastLogTime || (Date.now() - this.lastLogTime) > 30000) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        console.log(`⏰ [${timeString}] Status: ${onlineExtensions.size}/${extensionStatusMap.size} online`);
        this.lastLogTime = Date.now();
      }

    } catch (error) {
      console.error('❌ Erro na verificação de status:', error);
    }
  }

  /**
   * Obter status atual dos ramais - SEMPRE FRESCO, SEM CACHE
   */
  async getExtensionStatus(forceRefresh = false) {
    try {
      // ✅ SEMPRE VERIFICAR STATUS FRESCO - SEM CACHE
      await this.checkExtensionStatus(forceRefresh);

      // Retornar dados sempre atualizados
      const statusData = {
        extensions: Object.fromEntries(this.extensionStatusCache),
        onlineCount: Array.from(this.extensionStatusCache.values()).filter(e => e.isOnline).length,
        totalExtensions: this.extensionStatusCache.size,
        lastUpdate: this.lastStatusUpdate.toISOString(),
        onlineExtensions: Array.from(this.extensionStatusCache.values())
          .filter(e => e.isOnline)
          .map(e => e.extension)
      };

      return statusData;

    } catch (error) {
      console.error('❌ Erro ao obter status dos ramais:', error);
      return {
        extensions: {},
        onlineCount: 0,
        totalExtensions: 0,
        lastUpdate: new Date().toISOString(),
        onlineExtensions: [],
        error: 'Erro ao verificar status dos ramais'
      };
    }
  }

  /**
   * 🔒 NOVO: Obter status filtrado apenas para ramais de um usuário específico
   */
  async getExtensionStatusByUser(userId) {
    try {
      if (!userId) {
        throw new Error('userId é obrigatório');
      }

      // 1. Primeiro buscar ramais do usuário
      const { data: userAgents, error: agentsError } = await this.supabase
        .from('agentes_pabx')
        .select('ramal, agente_name')
        .eq('user_id', userId);

      if (agentsError) {
        console.error('❌ Erro ao buscar ramais do usuário:', agentsError);
        return {
          extensions: {},
          onlineCount: 0,
          totalExtensions: 0,
          lastUpdate: new Date().toISOString(),
          onlineExtensions: [],
          error: 'Erro ao buscar ramais do usuário'
        };
      }

      // 2. Se usuário não tem ramais, retornar vazio
      if (!userAgents || userAgents.length === 0) {
        console.log(`ℹ️ Usuário ${userId} não possui ramais cadastrados`);
        return {
          extensions: {},
          onlineCount: 0,
          totalExtensions: 0,
          lastUpdate: new Date().toISOString(),
          onlineExtensions: [],
          userRamais: []
        };
      }

      // 3. Extrair ramais do usuário
      const userRamais = userAgents.map(a => this.normalizeExtension(a.ramal)).filter(Boolean);
      console.log(`🔍 Verificando status para ramais do usuário ${userId}:`, userRamais);

      // 4. Buscar status na ps_contacts diretamente (sem JOIN)
      const { data: allContacts, error: contactsError } = await this.supabase
        .from('ps_contacts')
        .select('endpoint, uri, user_agent, expiration_time');

      if (contactsError) {
        console.error('❌ Erro ao buscar ps_contacts:', contactsError);
      }

      // Filtrar apenas os contatos que correspondem aos ramais do usuário
      const contacts = [];
      if (allContacts && allContacts.length > 0) {
        userRamais.forEach(ramal => {
          const contact = allContacts.find(c => 
            c.endpoint && (
              c.endpoint === ramal || 
              c.endpoint.includes(ramal) ||
              this.normalizeExtension(c.endpoint) === ramal
            )
          );
          if (contact) {
            contacts.push({
              ramal: ramal,
              agente_name: userAgents.find(a => this.normalizeExtension(a.ramal) === ramal)?.agente_name,
              ps_contacts: contact
            });
          }
        });
      }

      // 5. Processar status dos ramais online (JOIN já filtra apenas os online)
      const onlineExtensions = new Set();
      const extensionDetails = new Map();
      const nowIso = new Date().toISOString();

      if (contacts && contacts.length > 0) {
        contacts.forEach(agent => {
          const ramal = this.normalizeExtension(agent?.ramal);
          const psContact = agent.ps_contacts;
          
          if (ramal && psContact) {
            const exp = this.parseExpiration(psContact.expiration_time);
            const notExpired = exp ? exp.getTime() > Date.now() : true;
            
            if (notExpired) {
              onlineExtensions.add(ramal);
              extensionDetails.set(ramal, {
                endpoint: ramal,
                status: 'online',
                uri: psContact.uri || null,
                userAgent: psContact.user_agent || null,
                expirationTime: psContact.expiration_time || null,
                lastSeen: nowIso
              });
            }
          }
        });
      }

      // 6. Criar mapa de status apenas para ramais do usuário
      const userExtensionStatusMap = new Map();
      userAgents.forEach(agent => {
        const ramal = this.normalizeExtension(agent?.ramal);
        if (ramal) {
          const isOnline = onlineExtensions.has(ramal);
          const details = extensionDetails.get(ramal);

          userExtensionStatusMap.set(ramal, {
            extension: ramal,
            name: agent.agente_name,
            userId: userId,
            isOnline,
            status: isOnline ? 'online' : 'offline',
            lastSeen: details?.lastSeen || null,
            uri: details?.uri || null,
            userAgent: details?.userAgent || null,
            expirationTime: details?.expirationTime || null
          });
        }
      });

      const statusData = {
        extensions: Object.fromEntries(userExtensionStatusMap),
        onlineCount: onlineExtensions.size,
        totalExtensions: userExtensionStatusMap.size,
        lastUpdate: new Date().toISOString(),
        onlineExtensions: Array.from(onlineExtensions),
        userRamais: userRamais
      };

      console.log(`✅ Status filtrado para usuário ${userId}: ${onlineExtensions.size}/${userRamais.length} online`);
      return statusData;

    } catch (error) {
      console.error(`❌ Erro ao obter status filtrado para usuário ${userId}:`, error);
      return {
        extensions: {},
        onlineCount: 0,
        totalExtensions: 0,
        lastUpdate: new Date().toISOString(),
        onlineExtensions: [],
        error: 'Erro ao verificar status filtrado'
      };
    }
  }

  /**
   * 🎯 NOVO: Obter status de ramais em lote (máximo 7 por vez)
   */
  async getBatchExtensionStatus(extensions) {
    try {
      if (!Array.isArray(extensions) || extensions.length === 0) {
        return {};
      }
      
      // Limitar a 7 ramais por lote conforme paginação
      const limitedExtensions = extensions.slice(0, 7);
      console.log(`🎯 Buscando status em lote de ${limitedExtensions.length} ramais:`, limitedExtensions);
      
      // Buscar ramais específicos na tabela agentes_pabx
      const { data: agents, error: agentsError } = await this.supabase
        .from('agentes_pabx')
        .select('ramal, agente_name, user_id')
        .in('ramal', limitedExtensions);

      if (agentsError) {
        console.error('❌ Erro ao buscar agentes em lote:', agentsError);
        // Retornar fallback para todos os ramais solicitados
        const fallback = {};
        limitedExtensions.forEach(ext => {
          fallback[ext] = {
            extension: ext,
            name: '',
            userId: '',
            status: 'offline',
            isOnline: false,
            lastChecked: new Date().toISOString()
          };
        });
        return fallback;
      }
      
      // Buscar status na ps_contacts apenas para os ramais encontrados
      const { data: contacts, error: contactsError } = await this.supabase
        .from('ps_contacts')
        .select('endpoint, uri, user_agent, expiration_time');

      if (contactsError) {
        console.error('❌ Erro ao buscar ps_contacts em lote:', contactsError);
      }
      
      // Processar status para cada ramal
      const batchStatus = {};
      const nowIso = new Date().toISOString();
      
      limitedExtensions.forEach(extension => {
        const agent = agents?.find(a => this.normalizeExtension(a.ramal) === extension);
        
        // Verificar se ramal está online na ps_contacts
        let isOnline = false;
        let details = null;
        
        if (contacts && contacts.length > 0) {
          const contact = contacts.find(c => 
            c.endpoint && this.normalizeExtension(c.endpoint) === extension
          );
          
          if (contact) {
            const exp = this.parseExpiration(contact.expiration_time);
            const notExpired = exp ? exp.getTime() > Date.now() : true;
            
            if (notExpired) {
              isOnline = true;
              details = {
                endpoint: extension,
                uri: contact.uri || null,
                userAgent: contact.user_agent || null,
                expirationTime: contact.expiration_time || null,
                lastSeen: nowIso
              };
            }
          }
        }
        
        batchStatus[extension] = {
          agentId: agent?.id || '',
          extension: extension,
          name: agent?.agente_name || '',
          userId: agent?.user_id || '',
          status: isOnline ? 'online' : 'offline',
          isOnline: isOnline,
          details: details,
          lastChecked: nowIso
        };
      });
      
      const onlineCount = Object.values(batchStatus).filter(s => s.isOnline).length;
      // Log silencioso para batch processing
      
      return batchStatus;
      
    } catch (error) {
      console.error('❌ Erro ao buscar status em lote:', error);
      // Retornar fallback para todos os ramais solicitados
      const fallback = {};
      extensions.slice(0, 7).forEach(ext => {
        fallback[ext] = {
          agentId: '',
          extension: ext,
          name: '',
          userId: '',
          status: 'offline',
          isOnline: false,
          lastChecked: new Date().toISOString()
        };
      });
      return fallback;
    }
  }

  /**
   * Obter status de um ramal específico
   */
  async getExtensionStatusById(extension) {
    try {
      const allStatus = await this.getExtensionStatus();
      return allStatus.extensions[extension] || {
        extension,
        status: 'offline',
        isOnline: false,
        error: 'Ramal não encontrado'
      };
    } catch (error) {
      console.error(`❌ Erro ao obter status do ramal ${extension}:`, error);
      return {
        extension,
        status: 'offline',
        isOnline: false,
        error: 'Erro ao verificar status'
      };
    }
  }

  /**
   * Obter estatísticas do monitoramento
   */
  getMonitoringStats() {
    return {
      isMonitoring: this.isMonitoring,
      lastUpdate: this.lastStatusUpdate.toISOString(),
      cacheSize: this.extensionStatusCache.size,
      onlineCount: Array.from(this.extensionStatusCache.values()).filter(e => e.isOnline).length
    };
  }

  /**
   * ✅ NOVO: Limpar cache local do service
   */
  clearCache() {
    console.log('🗑️ Limpando cache local do ExtensionStatusService...');
    this.extensionStatusCache.clear();
    this.lastContactsCheck = 0; // Reset throttling
    this.lastLogTime = 0;
    console.log('✅ Cache local limpo - próxima consulta será fresca');
  }
}

// Instância singleton
const extensionStatusService = new ExtensionStatusService();

module.exports = extensionStatusService;
