// Serviço para buscar dados dos agentes da API externa
// Configurado para usar ENDPOINT_HOST, ENDPOINT_PORT e ENDPOINT_AGENTS do .env.local

export interface ExternalAgent {
  id: string;
  user_id: string;
  ramal: string;
  agente_name: string;
  senha: string;
  callerid: string;
  webrtc: boolean;
  bloqueio: boolean;
  created_at: string;
  updated_at: string;
  chamadas_total: number;
  chamadas_hoje: number;
  status_sip: string;
  username: string;
  user_name: string;
  user_email: string;
  status_real: 'online' | 'offline';
  ps_status: string | null;
  user_agent: string | null;
  expiration_time: string | null;
}

export interface ExternalAgentsResponse {
  success: boolean;
  data: ExternalAgent[];
  resumo: {
    total: number;
    online: number;
    offline: number;
  };
}

class ExternalAgentsService {
  private baseAgentsUrl: string;
  private baseUsersUrl: string;
  private DEBUG: boolean;

  constructor() {
    // Preferir um BASE URL único quando disponível
    // Variáveis aceitas:
    // - NEXT_PUBLIC_API_URL (ex: http://localhost:3001 ou https://api.suaempresa.com)
    // - OU (fallback) NEXT_PUBLIC_ENDPOINT_HOST, NEXT_PUBLIC_ENDPOINT_PORT
    //   e caminhos NEXT_PUBLIC_ENDPOINT_AGENTS, NEXT_PUBLIC_ENDPOINT_USERS
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();
    const host = process.env.NEXT_PUBLIC_ENDPOINT_HOST || '69.62.103.45';
    const port = process.env.NEXT_PUBLIC_ENDPOINT_PORT || '3000';
    const agentsEndpoint = process.env.NEXT_PUBLIC_ENDPOINT_AGENTS || '/api/agents';
    const usersEndpoint = process.env.NEXT_PUBLIC_ENDPOINT_USERS || '/api/users';

    const normalize = (s: string) => s.replace(/\/+$/, '');
    const ensureLeadingSlash = (s: string) => (s.startsWith('/') ? s : `/${s}`);

    let base = '';
    if (apiBase) {
      base = normalize(apiBase);
    } else {
      base = `http://${host}${port ? `:${port}` : ''}`;
    }

    this.baseAgentsUrl = `${base}${ensureLeadingSlash(agentsEndpoint)}`;
    this.baseUsersUrl = `${base}${ensureLeadingSlash(usersEndpoint)}`;

    // Flag de debug controlada por env (padrao: false)
    this.DEBUG = (process.env.NEXT_PUBLIC_DEBUG_EXTERNAL_AGENTS || '').toLowerCase() === 'true';

    if (this.DEBUG) {
      console.log('🔧 ExternalAgentsService configurado:', {
        base,
        agentsEndpoint,
        usersEndpoint,
        baseAgentsUrl: this.baseAgentsUrl,
        baseUsersUrl: this.baseUsersUrl
      });
    }
  }

  /**
   * Busca todos os agentes de um usuário específico
   */
  async getAgentsByUserId(userId: string): Promise<ExternalAgentsResponse> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      if (this.DEBUG) console.log(`🔄 Buscando agentes do usuário ${userId} na API externa...`);
      
      const url = `${this.baseAgentsUrl}?user_id=${userId}&_ts=${Date.now()}`;
      if (this.DEBUG) console.log('📡 URL da requisição:', url);
      
      // Anexar Authorization quando disponível
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      // Timeout compatível com todos os navegadores
      const controller = new AbortController();
      const timeoutMs = 8000;
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Função de tentativa com 1 retry em falha de rede/timeout
      const attemptFetch = async (attempt: number): Promise<Response> => {
        try {
          return await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            signal: controller.signal
          });
        } catch (err: any) {
          const isAbort = err?.name === 'AbortError';
          const isNetwork = err?.message?.includes('Failed to fetch');
          if (attempt === 0 && (isAbort || isNetwork)) {
            if (this.DEBUG) console.debug(`⚠️ Falha na tentativa ${attempt + 1}, tentando novamente em 800ms...`);
            await new Promise(r => setTimeout(r, 800));
            return attemptFetch(attempt + 1);
          }
          throw err;
        }
      };

      const response = await attemptFetch(0);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ExternalAgentsResponse = await response.json();
      
      if (this.DEBUG) console.log('✅ Dados dos agentes recebidos da API externa:', {
        total: data.resumo?.total || 0,
        online: data.resumo?.online || 0,
        offline: data.resumo?.offline || 0,
        agentes_count: data.data?.length || 0
      });

      // Validar estrutura da resposta
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Resposta da API externa inválida');
      }

      return data;
      
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        if (this.DEBUG) console.warn('⌛ Timeout ao buscar agentes na API externa (8s). Usando dados vazios por enquanto.');
      } else {
        if (this.DEBUG) console.error('❌ Erro ao buscar agentes da API externa:', error?.message || error);
      }
      
      // Retornar estrutura vazia em caso de erro
      return {
        success: false,
        data: [],
        resumo: {
          total: 0,
          online: 0,
          offline: 0
        }
      };
    } finally {
      // Garantir limpeza do timeout
      try { if (timeoutId) clearTimeout(timeoutId); } catch {}
    }
  }

  /**
   * Busca estatísticas resumidas dos agentes
   */
  async getAgentsStats(userId: string): Promise<{
    total: number;
    online: number;
    offline: number;
    busy: number;
    paused: number;
  }> {
    try {
      const response = await this.getAgentsByUserId(userId);
      
      if (!response.success) {
        return {
          total: 0,
          online: 0,
          offline: 0,
          busy: 0,
          paused: 0
        };
      }

      const { total, online, offline } = response.resumo;
      
      // Simular agentes ocupados e em pausa baseado nos online
      const busy = Math.floor(online * 0.4);
      const paused = Math.floor(online * 0.2);

      if (this.DEBUG) console.log('📊 Estatísticas dos agentes calculadas:', {
        total,
        online,
        offline,
        busy,
        paused
      });

      return {
        total,
        online,
        offline,
        busy,
        paused
      };
      
    } catch (error) {
      if (this.DEBUG) console.error('❌ Erro ao calcular estatísticas dos agentes:', error);
      return {
        total: 0,
        online: 0,
        offline: 0,
        busy: 0,
        paused: 0
      };
    }
  }

  /**
   * Formatar dados dos agentes para uso na interface
   */
  formatAgentsForUI(agents: ExternalAgent[]): Array<{
    id: string;
    name: string;
    extension: string;
    callerId: string;
    status: 'online' | 'offline';
    totalCalls: number;
    todayCalls: number;
    createdAt: string;
    psStatus: string | null;
    userAgent: string | null;
  }> {
    return agents.map(agent => ({
      id: agent.id,
      name: agent.agente_name,
      extension: agent.ramal,
      callerId: agent.callerid,
      status: agent.status_real,
      totalCalls: agent.chamadas_total,
      todayCalls: agent.chamadas_hoje,
      createdAt: agent.created_at,
      psStatus: agent.ps_status,
      userAgent: agent.user_agent
    }));
  }
}

// Instância singleton do serviço
export const externalAgentsService = new ExternalAgentsService();
