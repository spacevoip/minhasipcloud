// Interfaces para tipagem
import { unifiedAuthService } from '@/lib/unifiedAuth';
export interface Agent {
  id: string;
  ramal: string;
  name: string;
  password: string;
  callerid?: string;
  webrtc: boolean;
  blocked: boolean;
  autoDiscagem?: boolean;
  // Flags adicionais vindas do backend
  auto_discagem?: boolean;
  up_audio?: boolean;
  sms_send?: boolean;
  status: 'online' | 'offline' | 'busy' | 'away';
  totalCalls: number;
  todayCalls: number;
  lastActivity: string;
  createdAt: string;
  userId: string;
  // Work session enrichment (optional)
  work_session_active?: boolean;
  work_paused?: boolean;
  work_state?: 'idle' | 'working' | 'paused';
  // Motivo da pausa (quando work_state = 'paused')
  work_pause_reason_code?: string | null;
  work_pause_reason_text?: string | null;
}

export interface CreateAgentData {
  ramal: string;
  agente_name: string;
  senha: string;
  callerid?: string;
  webrtc?: boolean;
  bloqueio?: boolean;
}

export interface UpdateAgentData {
  agente_name?: string;
  senha?: string;
  callerid?: string;
  webrtc?: boolean;
  bloqueio?: boolean;
  blocked?: boolean;
  auto_discagem?: boolean;
  up_audio?: boolean;
  sms_send?: boolean;
}

export interface AgentStats {
  totalAgents: number;
  onlineAgents: number;
  offlineAgents: number;
  blockedAgents: number;
  totalCalls: number;
  todayCalls: number;
  averageCallsPerAgent: number;
}

class AgentsService {
  // Handler central para 401
  private async handleUnauthorized(res: Response) {
    try {
      // Tentar extrair corpo para detectar forceLogout
      let data: any = null;
      try { data = await res.clone().json(); } catch { try { data = await res.text(); } catch {} }
    } catch {}
    try {
      await unifiedAuthService.logout();
    } finally {
      if (typeof window !== 'undefined') {
        try { window.dispatchEvent(new Event('app:force-logout')); } catch {}
        window.location.assign('/login');
      }
    }
  }
  // Helper para obter token JWT do localStorage
  private getAuthHeaders() {
    if (typeof window === 'undefined') {
      throw new Error('Método só pode ser executado no cliente.');
    }
    // Suportar tanto login "app" quanto login do Agente (Agent Dashboard)
    const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
    if (!token) throw new Error('Token ausente. Faça login novamente.');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    } as Record<string, string>;
  }

  // Buscar um único agente por ID (backend)
  async getAgentById(id: string): Promise<Agent> {
    try {
      const res = await fetch(`/api/agents/${id}?_=${Date.now()}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      });
      if (res.status === 401) {
        await this.handleUnauthorized(res);
        throw new Error('Não autorizado');
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `Erro ao buscar agente ${id}`);
      }
      const a = payload?.data || payload;
      return {
        id: a.id,
        ramal: a.ramal,
        name: a.name ?? a.agente_name,
        password: a.password ?? a.senha ?? '',
        callerid: a.callerid || a.ramal,
        webrtc: Boolean(a.webrtc),
        blocked: Boolean(a.blocked ?? a.bloqueio),
        autoDiscagem: typeof a.auto_discagem === 'boolean' ? a.auto_discagem : Boolean(a.auto_discagem),
        auto_discagem: typeof a.auto_discagem === 'boolean' ? a.auto_discagem : Boolean(a.auto_discagem),
        up_audio: Boolean(a.up_audio),
        sms_send: Boolean(a.sms_send),
        status: (
          a.liveStatus ||
          (typeof a.isOnline === 'boolean' ? (a.isOnline ? 'online' : 'offline') : undefined) ||
          a.status ||
          a.status_sip ||
          'offline'
        ) as Agent['status'],
        totalCalls: a.totalCalls ?? a.chamadas_total ?? 0,
        todayCalls: a.todayCalls ?? a.chamadas_hoje ?? 0,
        lastActivity: a.lastActivity ?? a.updated_at ?? a.created_at,
        createdAt: a.createdAt ?? a.created_at,
        userId: a.userId ?? a.user_id,
        work_session_active: a.work_session_active,
        work_paused: a.work_paused,
        work_state: a.work_state,
        work_pause_reason_code: a.work_pause_reason_code ?? null,
        work_pause_reason_text: a.work_pause_reason_text ?? null
      };
    } catch (error) {
      console.error('❌ Erro ao buscar agente por ID:', error);
      throw error;
    }
  }

  // Sugere próximo ramal disponível (apenas método otimizado)
  async getNextRamal(range?: { start?: number; end?: number }): Promise<string> {
    const params = new URLSearchParams();
    if (range?.start) params.set('start', String(range.start));
    if (range?.end) params.set('end', String(range.end));
    
    const res = await fetch(`/api/agents/next-ramal-fast${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-store'
    });
    
    if (res.status === 401) {
      await this.handleUnauthorized(res);
      throw new Error('Não autorizado');
    }
    
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.message || payload?.error || 'Erro ao sugerir próximo ramal');
    }
    
    const ramal = payload?.data?.ramal ?? payload?.ramal ?? payload;
    if (!ramal || typeof ramal !== 'string') {
      throw new Error('Resposta inválida do servidor ao sugerir ramal');
    }
    
    console.log(`⚡ Ramal obtido em ${payload.performance?.duration_ms || 'N/A'}ms via ${payload.performance?.method || 'otimizado'}`);
    return ramal;
  }

  // Listar todos os ramais/agentes do usuário (com status unificado do backend)
  async getAgents(): Promise<Agent[]> {
    try {
      const res = await fetch('/api/agents', {
        method: 'GET',
        headers: this.getAuthHeaders(),
        // evitar cache
        cache: 'no-store'
      });
      if (res.status === 401) {
        await this.handleUnauthorized(res);
        throw new Error('Não autorizado');
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Erro HTTP ${res.status} ${res.statusText} ${txt}`);
      }
      const payload = await res.json();
      const items = payload?.data || payload || [];
      const formatted: Agent[] = items.map((a: any) => ({
        id: a.id,
        ramal: a.ramal,
        name: a.name ?? a.agente_name,
        password: a.password ?? a.senha ?? '',
        callerid: a.callerid || a.ramal,
        webrtc: Boolean(a.webrtc),
        blocked: Boolean(a.blocked ?? a.bloqueio),
        autoDiscagem: typeof a.auto_discagem === 'boolean' ? a.auto_discagem : Boolean(a.auto_discagem),
        // Preferir status enriquecido do backend (liveStatus/isOnline)
        status: (
          a.liveStatus ||
          (typeof a.isOnline === 'boolean' ? (a.isOnline ? 'online' : 'offline') : undefined) ||
          a.status ||
          a.status_sip ||
          'offline'
        ) as Agent['status'],
        totalCalls: a.totalCalls ?? a.chamadas_total ?? 0,
        todayCalls: a.todayCalls ?? a.chamadas_hoje ?? 0,
        lastActivity: a.lastActivity ?? a.updated_at ?? a.created_at,
        createdAt: a.createdAt ?? a.created_at,
        userId: a.userId ?? a.user_id,
        work_session_active: a.work_session_active,
        work_paused: a.work_paused,
        work_state: a.work_state,
        work_pause_reason_code: a.work_pause_reason_code ?? null,
        work_pause_reason_text: a.work_pause_reason_text ?? null
      }));
      return formatted;
    } catch (error) {
      console.error('❌ Erro ao buscar agentes (backend):', error);
      // Não retornar dados mockados: forçar a UI a exibir erro real
      throw error;
    }
  }

  // Criar novo ramal/agente (backend)
  async createAgent(agentData: CreateAgentData | Record<string, any>): Promise<Agent> {
    // Normaliza e valida payload aceitando chaves antigas/novas
    const normalized = {
      ramal: String((agentData as any)?.ramal ?? '').trim(),
      agente_name: String((agentData as any)?.agente_name ?? (agentData as any)?.name ?? '').trim(),
      senha: String((agentData as any)?.senha ?? (agentData as any)?.password ?? '').trim(),
      callerid: (agentData as any)?.callerid ?? (agentData as any)?.callerId ?? undefined,
      auto_discagem: typeof (agentData as any)?.auto_discagem === 'boolean'
        ? (agentData as any)?.auto_discagem
        : Boolean((agentData as any)?.autoDiscagem),
    } as Record<string, any>;

    // Validações rápidas no cliente para evitar roundtrip desnecessário
    if (!normalized.ramal || !/^[0-9]{2,10}$/.test(normalized.ramal)) {
      throw new Error('Ramal inválido. Use apenas dígitos (2 a 10).');
    }
    if (!normalized.agente_name || normalized.agente_name.length < 2) {
      throw new Error('Nome do agente é obrigatório (mín. 2 caracteres).');
    }
    if (!normalized.senha || normalized.senha.length < 8) {
      throw new Error('Senha é obrigatória (mín. 8 caracteres).');
    }

    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(normalized)
    });
    if (res.status === 401) {
      await this.handleUnauthorized(res);
      throw new Error('Não autorizado');
    }

    // Tenta ler json sempre, mesmo em erro, para extrair mensagem
    const payload = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      // Mensagens específicas por status
      if (res.status === 409) {
        throw new Error(payload?.error || 'Ramal já existe no sistema');
      }
      if (res.status === 400) {
        throw new Error(payload?.error || 'Dados inválidos ao criar agente');
      }
      throw new Error(payload?.error || payload?.message || `Erro ao criar agente (HTTP ${res.status})`);
    }

    const a = (payload as any).data ?? payload;
    return {
      id: a.id,
      ramal: a.ramal,
      name: a.name ?? a.agente_name,
      password: a.password ?? a.senha ?? '',
      callerid: a.callerid || a.ramal,
      webrtc: Boolean(a.webrtc),
      blocked: Boolean(a.blocked ?? a.bloqueio),
      autoDiscagem: typeof a.auto_discagem === 'boolean' ? a.auto_discagem : Boolean(a.auto_discagem),
      status: (
        a.liveStatus ||
        (typeof a.isOnline === 'boolean' ? (a.isOnline ? 'online' : 'offline') : undefined) ||
        a.status ||
        a.status_sip ||
        'offline'
      ) as Agent['status'],
      totalCalls: a.totalCalls ?? a.chamadas_total ?? 0,
      todayCalls: a.todayCalls ?? a.chamadas_hoje ?? 0,
      lastActivity: a.lastActivity ?? a.updated_at ?? a.created_at,
      createdAt: a.createdAt ?? a.created_at,
      userId: a.userId ?? a.user_id
    };
  }

  // Atualizar ramal/agente (backend)
  async updateAgent(id: string, updateData: UpdateAgentData): Promise<Agent> {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData)
    });
    if (res.status === 401) {
      await this.handleUnauthorized(res);
      throw new Error('Não autorizado');
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || 'Erro ao atualizar agente');
    }
    const a = payload.data;
    return {
      id: a.id,
      ramal: a.ramal,
      name: a.name ?? a.agente_name,
      password: a.password ?? a.senha ?? '',
      callerid: a.callerid || a.ramal,
      webrtc: Boolean(a.webrtc),
      blocked: Boolean(a.blocked ?? a.bloqueio),
      autoDiscagem: typeof a.auto_discagem === 'boolean' ? a.auto_discagem : Boolean(a.auto_discagem),
      auto_discagem: typeof a.auto_discagem === 'boolean' ? a.auto_discagem : Boolean(a.auto_discagem),
      up_audio: Boolean(a.up_audio),
      sms_send: Boolean(a.sms_send),
      status: (
        a.liveStatus ||
        (typeof a.isOnline === 'boolean' ? (a.isOnline ? 'online' : 'offline') : undefined) ||
        a.status ||
        a.status_sip ||
        'offline'
      ) as Agent['status'],
      totalCalls: a.totalCalls ?? a.chamadas_total ?? 0,
      todayCalls: a.todayCalls ?? a.chamadas_hoje ?? 0,
      lastActivity: a.lastActivity ?? a.updated_at ?? a.created_at,
      createdAt: a.createdAt ?? a.created_at,
      userId: a.userId ?? a.user_id
    };
  }



  // Remover ramal/agente (backend)
  async deleteAgent(id: string): Promise<void> {
    const res = await fetch(`/api/agents/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    if (res.status === 401) {
      await this.handleUnauthorized(res);
      throw new Error('Não autorizado');
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload?.error || payload?.message || 'Erro ao remover agente');
    }
  }

  // Obter estatísticas dos ramais (backend)
  async getAgentStats(): Promise<AgentStats> {
    const res = await fetch('/api/agents/stats', {
      method: 'GET',
      headers: this.getAuthHeaders(),
      cache: 'no-store'
    });
    if (res.status === 401) {
      await this.handleUnauthorized(res);
      throw new Error('Não autorizado');
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || payload?.message || 'Erro ao buscar estatísticas');
    }
    const data = payload.data || payload;
    return {
      totalAgents: data.total ?? data.totalAgents ?? 0,
      onlineAgents: data.online ?? data.onlineAgents ?? 0,
      offlineAgents: data.offline ?? Math.max((data.total ?? 0) - (data.online ?? 0), 0),
      blockedAgents: data.blockedAgents ?? 0,
      totalCalls: data.totalCalls ?? 0,
      todayCalls: data.todayCalls ?? 0,
      averageCallsPerAgent: data.averageCallsPerAgent ?? 0
    };
  }

  // Removidos mocks: manter apenas dados reais
}

// Instância singleton
export const agentsService = new AgentsService();
export default agentsService;
