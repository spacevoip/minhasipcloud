/**
 * =====================================================
 * RESELLER AGENTS SERVICE - FRONTEND
 * =====================================================
 * Serviço para o revendedor consultar agentes dos seus clientes via backend
 */

class ResellerAgentsService {
  private baseUrl = (() => {
    const host = process.env.NEXT_PUBLIC_ENDPOINT_HOST || 'localhost';
    const port = process.env.NEXT_PUBLIC_ENDPOINT_PORT || '3001';
    const protocol = process.env.NEXT_PUBLIC_ENDPOINT_PROTOCOL || 'http';
    const path = '/api/reseller/agents';
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
   * Buscar apenas a contagem de agentes por userId (revenda)
   * Usa /api/reseller/agents com filtro userId e lê pagination.total
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
      const pagination = (payload as any)?.pagination || {};
      const total = Number(pagination.total ?? 0);
      return isNaN(total) ? 0 : total;
    } catch (error) {
      console.error('❌ [ResellerAgentsService] Erro ao buscar contagem de agentes por usuário:', error);
      return 0;
    }
  }
}

export const resellerAgentsService = new ResellerAgentsService();
