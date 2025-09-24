/**
 * =====================================================
 * AGENTS SERVICE - UNIFIED DATA ACCESS
 * =====================================================
 * Centraliza consultas de agentes e mescla status de ramais (ps_contacts)
 */

const { supabase } = require('../config/database');
const extensionStatusService = require('./extensionStatusService');

class AgentsService {
  constructor() {
    // Use o cliente Supabase compartilhado (com suporte a SERVICE_ROLE no backend)
    this.supabase = supabase;
  }

  // Buscar agentes do usuário
  async getAgentsByUser(userId, { search } = {}) {
    let query = this.supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        auto_discagem,
        webrtc,
        bloqueio,
        status_sip,
        sms_send,
        up_audio,
        created_at,
        updated_at,
        chamadas_total,
        chamadas_hoje,
        user_id
      `)
      .eq('user_id', userId)
      .order('ramal', { ascending: true });

    if (search) {
      query = query.or(`agente_name.ilike.%${search}%,ramal.ilike.%${search}%,callerid.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(a => ({
      id: a.id,
      ramal: a.ramal,
      name: a.agente_name,
      password: a.senha,
      callerid: a.callerid,
      auto_discagem: a.auto_discagem,
      webrtc: a.webrtc,
      blocked: a.bloqueio,
      status: a.status_sip,
      sms_send: a.sms_send,
      up_audio: a.up_audio,
      totalCalls: a.chamadas_total,
      todayCalls: a.chamadas_hoje,
      lastActivity: a.updated_at,
      createdAt: a.created_at,
      userId: a.user_id
    }));
  }

  // Buscar todos os agentes (admin)
  async getAllAgents({ search, status, page = 1, limit = 50 } = {}) {
    let query = this.supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        webrtc,
        bloqueio,
        status_sip,
        sms_send,
        up_audio,
        auto_discagem,
        created_at,
        updated_at,
        chamadas_total,
        chamadas_hoje,
        user_id
      `)
      .order('ramal', { ascending: true });

    if (search) {
      query = query.or(`agente_name.ilike.%${search}%,ramal.ilike.%${search}%,callerid.ilike.%${search}%`);
    }

    if (status && status !== 'all') {
      if (status === 'active') query = query.eq('bloqueio', false);
      if (status === 'inactive') query = query.eq('bloqueio', true);
      if (status === 'online') query = query.eq('status_sip', 'online');
      if (status === 'offline') query = query.eq('status_sip', 'offline');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  // 🔒 NOVO: Mesclar status filtrado por usuário aos agentes
  async enrichWithStatus(agents, userId = null) {
    // Se userId fornecido, usar status filtrado. Senão, usar método global (admin)
    const status = userId 
      ? await extensionStatusService.getExtensionStatusByUser(userId)
      : await extensionStatusService.getExtensionStatus();
    
    const map = status.extensions || {};

    const normalize = (value) => {
      if (value === undefined || value === null) return '';
      let s = String(value).trim();
      s = s.replace(/^sip:/i, '');
      const parts = s.split(/[;@:/]/).filter(Boolean);
      if (parts.length > 0) s = parts[parts.length - 1];
      return s.trim();
    };

    return agents.map(a => {
      const k1 = a.ramal;
      const k2 = a.extension;
      const nk1 = normalize(k1);
      const nk2 = normalize(k2);
      const ext = map[k1] || map[k2] || map[nk1] || map[nk2] || null;
      return {
        ...a,
        extension: a.ramal || a.extension,
        liveStatus: ext?.status || 'offline',
        isOnline: !!ext?.isOnline,
        lastSeen: ext?.lastSeen || null,
        userAgent: ext?.userAgent || null,
        uri: ext?.uri || null,
        expirationTime: ext?.expirationTime || null
      };
    });
  }

  // Atalho: obter agentes do usuário já enriquecidos
  async getUserAgentsWithStatus(userId, options = {}) {
    const base = await this.getAgentsByUser(userId, options);
    return this.enrichWithStatus(base);
  }
}

module.exports = new AgentsService();
