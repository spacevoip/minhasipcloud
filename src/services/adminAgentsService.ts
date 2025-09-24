/**
 * =====================================================
 * ADMIN AGENTS SERVICE - FRONTEND
 * =====================================================
 * Serviço para gerenciar TODOS os agentes do sistema (admin)
 * IMPORTANTE: Usa SOMENTE a API do backend, sem acesso direto ao Supabase.
 */

export interface AdminAgent {
  id: string;
  name: string;
  extension: string;
  callerId?: string;
  userId: string;
  userName?: string;
  userCompany?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  // Status real do sistema de ramais
  isOnline?: boolean;
  lastSeen?: string;
  uri?: string;
  userAgent?: string;
  // Senha SIP em texto puro (backend expõe para admin)
  sipPassword?: string;
}

export interface AdminAgentsResponse {
  agents: AdminAgent[];
  total: number;
  page: number;
  limit: number;
}

class AdminAgentsService {
  private baseUrl = (() => {
    const host = process.env.NEXT_PUBLIC_ENDPOINT_HOST || 'localhost';
    const port = process.env.NEXT_PUBLIC_ENDPOINT_PORT || '3001';
    const protocol = process.env.NEXT_PUBLIC_ENDPOINT_PROTOCOL || 'http';
    const path = '/api/admin/agents';
    return `${protocol}://${host}:${port}${path}`;
  })();

  private authHeaders() {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('token')
        || localStorage.getItem('auth_token')
        || localStorage.getItem('session_token'))
      : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    } as Record<string, string>;
  }
  /**
   * Buscar todos os agentes do sistema (admin) - via API backend
   */
  async getAllAgents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'active' | 'inactive' | 'online' | 'offline';
  }): Promise<AdminAgentsResponse> {
    try {
      const page = params?.page || 1;
      const limit = params?.limit || 50;
      const search = params?.search || '';
      const status = params?.status || 'all';
      const url = new URL(this.baseUrl);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));
      if (search) url.searchParams.set('search', search);
      if (status) url.searchParams.set('status', status);
      // Forçar não cache
      url.searchParams.set('t', String(Date.now()));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.authHeaders(),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = errJson.message || `Erro HTTP ${response.status}`;
        if (response.status === 401) {
          // limpar credenciais inválidas para forçar novo login
          try {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('auth_token');
              localStorage.removeItem('session_token');
            }
          } catch {}
          const err = new Error('Token expirado');
          (err as any).code = 401;
          throw err;
        }
        throw new Error(message);
      }

      const result = await response.json();
      const data = result.data as any[];
      const formatted: AdminAgent[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        extension: item.extension,
        callerId: item.callerId,
        userId: item.userId,
        userName: item.userName,
        userCompany: item.userCompany,
        isActive: item.isActive,
        lastSeen: item.lastSeen,
        sipPassword: item.sipPassword || item.password || item.senha,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt || item.lastSeen,
      }));

      const pagination = result.pagination || {};
      return {
        agents: formatted,
        total: pagination.total || formatted.length,
        page: pagination.page || page,
        limit: pagination.limit || limit,
      };
    } catch (error) {
      console.error('❌ Erro ao buscar agentes (API backend):', error);
      throw error;
    }
  }

  /**
   * Buscar agente por ID - via API backend
   */
  async getAgentById(id: string): Promise<AdminAgent> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: this.authHeaders(),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result?.message || `Erro HTTP ${response.status}`;
        throw new Error(message);
      }
      const a = result.data || {};
      return {
        id: a.id,
        name: a.name,
        extension: a.extension,
        callerId: a.callerId,
        userId: a.userId,
        userName: a.userName,
        userCompany: a.userCompany,
        isActive: a.isActive,
        lastSeen: a.lastSeen,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        sipPassword: a.sipPassword || a.password || a.senha,
      } as AdminAgent;

    } catch (error) {
      console.error('❌ Erro ao buscar agente por ID:', error);
      throw error;
    }
  }

  /**
   * Atualizar agente - via API backend (PUT) com fallback GET/DELETE/POST
   */
  async updateAgent(id: string, data: Partial<AdminAgent>): Promise<AdminAgent> {
    try {
      const payload: any = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.callerId !== undefined) payload.callerId = data.callerId;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      // Tenta PUT (pode não existir no backend)
      try {
        const response = await fetch(`${this.baseUrl}/${id}`, {
          method: 'PUT',
          headers: this.authHeaders(),
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          // Se método não permitido/rota inexistente, cai para fallback
          if (response.status === 404 || response.status === 405) throw new Error('METHOD_NOT_ALLOWED');
          throw new Error(result.message || `Erro ao atualizar agente`);
        }

        const a = result.data || {};
        return {
          id: a.id,
          name: a.name,
          extension: a.extension,
          callerId: a.callerId,
          userId: a.userId,
          isActive: a.isActive,
          updatedAt: a.updatedAt,
          createdAt: a.createdAt || '',
        } as AdminAgent;
      } catch (err: any) {
        if (typeof err?.message === 'string' && err.message !== 'METHOD_NOT_ALLOWED') {
          // Se erro não é de método, propaga
          // ainda assim tentaremos fallback apenas se explicitamente 404/405 acima
        }
        // Fallback para design sem PUT: GET atual, DELETE, POST novo
        // Buscar agente atual (se houver endpoint GET /:id)
        let current: AdminAgent | null = null;
        try {
          const resGet = await fetch(`${this.baseUrl}/${id}`, { headers: this.authHeaders() });
          if (resGet.ok) {
            const j = await resGet.json();
            current = j.data as AdminAgent;
          }
        } catch {}

        const merged = {
          id,
          name: payload.name ?? current?.name,
          extension: current?.extension, // extensão não deve mudar em update
          callerId: payload.callerId ?? current?.callerId,
          userId: current?.userId,
          isActive: payload.isActive ?? current?.isActive,
        } as any;

        // Delete
        await this.deleteAgent(id);
        // Post (criar novamente)
        const created = await this.createAgent({
          name: merged.name,
          extension: merged.extension,
          callerId: merged.callerId,
          userId: merged.userId,
        });

        // Se precisarmos alterar ativo/inativo, chamar toggle se divergir
        if (typeof merged.isActive === 'boolean' && created.isActive !== merged.isActive) {
          await this.toggleAgentStatus(created.id, created.isActive);
          created.isActive = merged.isActive;
        }
        return created;
      }
    } catch (error) {
      console.error(`❌ Erro ao atualizar agente ${id}:`, error);
      throw error;
    }
  }

  /**
   * Ativar/Desativar agente - via API backend (usa updateAgent)
   */
  async toggleAgentStatus(id: string, currentIsActive: boolean): Promise<AdminAgent> {
    // Alterna com base no estado atual fornecido pelo chamador
    return this.updateAgent(id, { isActive: !currentIsActive });
  }

  /**
   * Buscar estatísticas dos agentes - desabilitado (sem acesso direto ao DB)
   * Se necessário, implementar endpoint dedicado no backend: GET /api/admin/agents/stats
   */
  async getAgentsStats(): Promise<{ total: number; active: number; inactive: number; online: number; offline: number; }> {
    throw new Error('getAgentsStats indisponível: usar endpoint do backend quando disponível');
  }

  /**
   * Buscar apenas a contagem de agentes por usuário (admin)
   * Usa a rota backend /api/admin/agents com filtro userId e lê pagination.total
   */
  async getAgentCountByUserId(userId: string): Promise<number> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('page', '1');
      url.searchParams.set('limit', '1');
      url.searchParams.set('userId', userId);
      url.searchParams.set('t', String(Date.now()));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || `Erro HTTP ${response.status}`);
      }
      const pagination = payload?.pagination || {};
      const total = Number(pagination.total ?? 0);
      return isNaN(total) ? 0 : total;
    } catch (error) {
      console.error('❌ Erro ao buscar contagem de agentes por usuário:', error);
      return 0; // Fallback para não quebrar UI
    }
  }

  /**
   * Criar novo agente
   */
  async createAgent(data: {
    name: string;
    extension: string;
    callerId?: string;
    userId: string;
  }): Promise<AdminAgent> {
    try {
      // Normaliza e valida dados
      const payload = {
        name: String(data?.name ?? '').trim(),
        extension: String(data?.extension ?? '').trim(),
        callerId: data?.callerId?.trim() || undefined,
        userId: String(data?.userId ?? '').trim(),
      } as Record<string, any>;

      if (!payload.userId) throw new Error('userId é obrigatório');
      if (!payload.name || payload.name.length < 2) {
        throw new Error('Nome do agente é obrigatório (mín. 2 caracteres).');
      }
      if (!payload.extension || !/^[0-9]{2,10}$/.test(payload.extension)) {
        throw new Error('Extensão inválida. Use apenas dígitos (2 a 10).');
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({} as any));

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(result?.message || 'Extensão já existe no sistema');
        }
        if (response.status === 400) {
          throw new Error(result?.message || 'Dados inválidos ao criar agente');
        }
        if (response.status === 401) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        throw new Error(result?.message || `Erro ao criar agente (HTTP ${response.status})`);
      }

      const a = (result as any).data ?? result;
      const formatted: AdminAgent = {
        id: a.id,
        name: a.name ?? a.agente_name,
        extension: a.extension ?? a.ramal,
        callerId: a.callerId ?? a.callerid ?? a.ramal,
        userId: a.userId ?? a.user_id,
        userName: a.userName,
        userCompany: a.userCompany,
        isActive: Boolean(a.isActive ?? !a.bloqueio),
        lastSeen: a.lastSeen ?? a.updated_at,
        sipPassword: a.sipPassword ?? a.password ?? a.senha,
        createdAt: a.createdAt ?? a.created_at,
        updatedAt: a.updatedAt ?? a.updated_at ?? a.created_at,
      };
      return formatted;

    } catch (error) {
      console.error('❌ Erro ao criar agente:', error);
      throw error;
    }
  }

  /**
   * Excluir agente - via API backend
   */
  async deleteAgent(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao excluir agente');
      }
    } catch (error) {
      console.error(`❌ Erro ao excluir agente ${id}:`, error);
      throw error;
    }
  }
}

// Instância singleton
export const adminAgentsService = new AdminAgentsService();
