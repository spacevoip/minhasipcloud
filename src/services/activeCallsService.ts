/**
 * =====================================================
 * ACTIVE CALLS SERVICE - FRONTEND
 * =====================================================
 * Serviço singleton para gerenciar chamadas ativas
 * com polling condicional baseado no contexto da página
 */

import { logger } from '@/lib/logger';
import { unifiedAuthService } from '@/lib/unifiedAuth';

export interface ActiveCall {
  id: string;
  extension: string;
  agentName: string;
  callerNumber: string;
  callerName?: string;
  userId?: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'talking' | 'hold' | 'transferring';
  duration: number;
  startTime: Date;
  queue?: string;
  destination?: string;
}

export interface ActiveCallsData {
  calls: ActiveCall[];
  count: number;
  lastUpdate: string;
  error?: string;
}

class ActiveCallsService {
  private baseUrl = (() => {
    const host = process.env.NEXT_PUBLIC_ENDPOINT_HOST || 'localhost';
    const port = process.env.NEXT_PUBLIC_ENDPOINT_PORT || '3001';
    const path = '/api/active-calls';
    const protocol = process.env.NEXT_PUBLIC_ENDPOINT_PROTOCOL || 'http';
    return `${protocol}://${host}:${port}${path}`;
  })();
  
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(data: ActiveCallsData) => void> = new Set();
  private lastData: ActiveCallsData | null = null;
  private isPolling = false;
  private fetchAll = false;

  /**
   * Helper: map ARI channel -> ActiveCall
   */
  private mapAriToActiveCall = (ch: any): ActiveCall => {
    const name: string = ch?.name || '';
    const isMasterLeg = name.toLowerCase().includes('master');
    const extMatch = name.match(/^PJSIP\/(.+?)-/i);
    const extension = extMatch ? extMatch[1] : '';

    const callerNumber: string = ch?.caller?.number || '';
    const connectedNumber: string = ch?.connected?.number || '';
    const destination: string = connectedNumber || ch?.dialplan?.exten || '';

    // Direction heuristic
    const direction: 'inbound' | 'outbound' = isMasterLeg ? 'outbound' : 'inbound';

    // Status mapping
    const state: string = (ch?.state || '').toLowerCase();
    let status: ActiveCall['status'] = 'transferring';
    if (state === 'up') status = 'talking';
    else if (state === 'ring' || state === 'ringing') status = 'ringing';
    else if (state === 'hold') status = 'hold';

    const start = ch?.creationtime ? new Date(ch.creationtime) : new Date();
    const duration = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));

    return {
      id: String(ch?.id || name || Math.random()),
      extension,
      agentName: '',
      callerNumber: direction === 'inbound' ? (callerNumber || connectedNumber) : (connectedNumber || callerNumber),
      callerName: '',
      userId: ch?.accountcode ? String(ch.accountcode) : undefined,
      direction,
      status,
      duration,
      startTime: start,
      queue: undefined,
      destination,
    };
  };

  /**
   * Buscar chamadas ativas do backend
   */
  async getActiveCalls(): Promise<ActiveCallsData> {
    try {
      const token = typeof window !== 'undefined' ? unifiedAuthService.getToken() : null;
      const currentUser = typeof window !== 'undefined' ? unifiedAuthService.getCurrentUser() : null;
      
      const params = new URLSearchParams();
      // Admin real-time calls view needs all calls
      if (this.fetchAll) {
        params.set('all', 'true');
      } else if (currentUser?.id) {
        // Para agentes, usar user_id (dono do ramal) em vez do ID do agente
        const accountId = currentUser.role === 'agent' 
          ? (currentUser as any).user_id 
          : currentUser.id;
        params.set('accountcode', String(accountId));
      }
      
      const timestamp = Date.now();
      const response = await fetch(`${this.baseUrl}?${params.toString()}&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn('⚠️ Rota de chamadas ativas não encontrada, usando fallback');
          return this.getFallbackData();
        }
        
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || `Erro HTTP ${response.status}`);
      }

      const json = await response.json();
      
      if (json?.success === false) {
        logger.error('❌ API retornou erro:', json);
        return this.getFallbackData();
      }

      // Para agentes, usar user_id (dono do ramal) em vez do ID do agente
      const accountId = currentUser?.role === 'agent' 
        ? (currentUser as any).user_id 
        : currentUser?.id;
      const userId = accountId ? String(accountId).trim().toLowerCase() : '';
      const allRows: any[] = Array.isArray(json?.data?.records) ? json.data.records : [];
      
      
      const rows = this.fetchAll
        ? allRows
        : allRows.filter((ch: any) => {
            if (!userId) return true;
            const acc = String(ch?.accountcode || '').trim().toLowerCase();
            const match = acc === userId;
            
            // Log detalhado para debug de segurança
            if (!match) {
              console.log(`[SECURITY] Chamada filtrada no backend: accountcode=${acc} !== userId=${userId}`);
            }
            
            return match;
          });


      // Enhanced filtering with better validation
      const filtered = rows.filter((ch: any) => {
        const name = String(ch?.name || '').toLowerCase();
        // Skip master legs
        if (name.includes('master')) return false;
        // Must be PJSIP channel
        const m = name.match(/^pjsip\/(.+?)-/);
        if (!m) return false;
        // Must be numeric extension (2+ digits)
        const ext = m[1];
        if (!/^\d{2,}$/.test(ext)) return false;
        // Must have valid state
        const state = String(ch?.state || '').toLowerCase();
        if (!state || state === 'down' || state === 'destroyed') return false;
        return true;
      });


      const calls = filtered.map(this.mapAriToActiveCall);
      
      // Log final do resultado para debug de segurança
      console.log(`[SECURITY] Backend retornando ${calls.length} chamadas para userId=${userId}`);
      calls.forEach((call, i) => {
        console.log(`[SECURITY] Chamada ${i + 1}: extension=${call.extension}, caller=${call.callerNumber}, userId=${call.userId}`);
      });
      
      return {
        calls,
        count: calls.length,
        lastUpdate: new Date().toISOString()
      };

    } catch (error: any) {
      if (error?.name === 'TimeoutError') {
        logger.warn('⌛ Timeout ao buscar chamadas ativas (15s). Usando fallback momentâneo.');
        return this.getFallbackData();
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.warn('⚠️ Backend não disponível, usando dados fallback');
        return this.getFallbackData();
      }

      logger.warn('⚠️ Falha ao buscar chamadas ativas. Usando fallback:', error?.message || error);
      return this.getFallbackData();
    }
  }

  /**
   * Dados fallback quando a API não está disponível
   */
  private getFallbackData(): ActiveCallsData {
    return {
      calls: [],
      count: 0,
      lastUpdate: new Date().toISOString(),
      error: 'API temporariamente indisponível'
    };
  }

  /**
   * Verificar se a página atual precisa de monitoramento de chamadas ativas
   */
  private shouldMonitorActiveCalls(pageContext?: string): boolean {
    if (typeof window === 'undefined') return false;
    
    const currentPath = window.location.pathname;
    const context = pageContext || currentPath;
    
    // Páginas que PRECISAM de chamadas ativas
    const needsActiveCallsPages = [
      '/active-calls',
      '/dashboard', // dashboard mostra contador de chamadas
      '/agent/dashboard', // dashboard do agente
      '/admin/real-time-calls'
    ];
    
    // Páginas que NÃO PRECISAM de chamadas ativas
    const noActiveCallsPages = [
      '/agents',
      '/cdr',
      '/reports', 
      '/config',
      '/admin/users',
      '/admin/plans',
      '/admin/financial',
      '/admin/terminations',
      '/admin/system-report',
      '/admin/agents-all',
      '/reseller'
    ];
    
    // Se está explicitamente na lista de "não precisa", retornar false
    if (noActiveCallsPages.some(page => context.includes(page))) {
      return false;
    }
    
    // Se está na lista de "precisa", retornar true
    if (needsActiveCallsPages.some(page => context.includes(page))) {
      return true;
    }
    
    // Por padrão, não monitorar (comportamento conservador)
    return false;
  }

  /**
   * Iniciar polling condicional de chamadas ativas
   */
  startPolling(pageContext?: string, interval: number = 5000) {
    if (this.isPolling) {
      return;
    }

    // Verificar se a página atual precisa de monitoramento
    if (!this.shouldMonitorActiveCalls(pageContext)) {
      logger.info('📄 Página não precisa de monitoramento de chamadas ativas, pulando...');
      return;
    }

    // Definir modo de busca (admin vê todas as chamadas)
    this.fetchAll = !!pageContext && pageContext.includes('/admin/real-time-calls');

    this.isPolling = true;
    
    // Primeira busca imediata
    this.updateActiveCalls();

    // Polling regular
    this.updateInterval = setInterval(() => {
      this.updateActiveCalls();
    }, interval);
    
    logger.info(`🔄 Monitoramento de chamadas ativas iniciado para: ${pageContext || 'página desconhecida'}`);
  }

  /**
   * Parar polling
   */
  stopPolling() {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    logger.info('🛑 Monitoramento de chamadas ativas parado');
  }

  /**
   * Atualizar chamadas ativas (método privado para polling)
   */
  private async updateActiveCalls() {
    try {
      const data = await this.getActiveCalls();
      this.lastData = data;
      this.listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('❌ Erro ao notificar listener:', error);
        }
      });
    } catch (error) {
      logger.error('❌ Erro ao atualizar chamadas ativas:', error);
    }
  }

  /**
   * Adicionar listener para mudanças
   */
  addListener(listener: (data: ActiveCallsData) => void) {
    this.listeners.add(listener);

    // Se já temos dados, notificar imediatamente
    if (this.lastData) {
      try {
        listener(this.lastData);
      } catch (error) {
        logger.error('❌ Erro no listener inicial:', error);
      }
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Remover listener
   */
  removeListener(listener: (data: ActiveCallsData) => void) {
    this.listeners.delete(listener);
  }

  /**
   * Obter último status conhecido
   */
  getLastData(): ActiveCallsData | null {
    return this.lastData;
  }

  /**
   * Obter contagem de chamadas ativas
   */
  getCount(): number {
    return this.lastData?.count || 0;
  }

  /**
   * Verificar se está fazendo polling
   */
  isActive(): boolean {
    return this.isPolling;
  }
}

// Instância singleton
export const activeCallsService = new ActiveCallsService();
