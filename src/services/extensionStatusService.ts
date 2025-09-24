/**
 * =====================================================
 * EXTENSION STATUS SERVICE - FRONTEND
 * =====================================================
 * Serviço para consumir status online/offline dos ramais
 * da API backend baseada na tabela ps_contacts
 */

import { logger } from '@/lib/logger';
import { authService } from '@/lib/auth';

export interface ExtensionStatus {
  agentId: string;
  extension: string;
  name: string;
  userId: string;
  status: 'online' | 'offline';
  isOnline: boolean;
  details?: {
    endpoint: string;
    status: string;
    uri: string;
    userAgent: string;
    expirationTime: number;
    lastSeen: string;
  } | null;
  lastChecked: string;
}

export interface ExtensionStatusData {
  extensions: Record<string, ExtensionStatus>;
  onlineCount: number;
  totalExtensions: number;
  lastUpdate: string;
  onlineExtensions: string[];
  error?: string;
}

export interface BatchStatusRequest {
  extensions: string[];
}

export interface MonitoringStats {
  isMonitoring: boolean;
  lastUpdate: string;
  cacheSize: number;
  onlineCount: number;
}

class ExtensionStatusService {
  private baseUrl = (() => {
    // Allow overriding via env variables for flexibility across environments
    const host = process.env.NEXT_PUBLIC_ENDPOINT_HOST || 'localhost';
    const port = process.env.NEXT_PUBLIC_ENDPOINT_PORT || '3001';
    const path = process.env.NEXT_PUBLIC_ENDPOINT_EXTENSION_STATUS || '/api/extension-status';
    const protocol = process.env.NEXT_PUBLIC_ENDPOINT_PROTOCOL || 'http';
    return `${protocol}://${host}:${port}${path}`;
  })();
  private updateInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(data: ExtensionStatusData) => void> = new Set();
  private lastData: ExtensionStatusData | null = null;

  /**
   * Buscar status de todos os ramais - SEMPRE FRESCO, SEM CACHE
   */
  async getAllExtensionStatus(forceRefresh = false): Promise<ExtensionStatusData> {
    try {
      // ✅ FORÇAR BUSCA FRESCA - SEM CACHE
      const timestamp = Date.now();
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const url = `${this.baseUrl}?t=${timestamp}${forceRefresh ? '&force=true' : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        // Timeout de 15 segundos (evitar TimeoutError no console em operações longas)
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        // Se for 404, significa que a rota não existe ainda
        if (response.status === 404) {
          logger.warn('⚠️ Rota de status de ramais não encontrada, usando fallback');
          return this.getFallbackData();
        }
        
        // Verificar se é erro de usuário suspenso
        if (response.status === 401) {
          const result = await response.json().catch(() => ({}));
          if (result.forceLogout) {
            await this.handleForceLogout();
            return this.getFallbackData();
          }
        }
        
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || `Erro HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data || result;
      
    } catch (error: any) {
      // Tratar timeout de forma silenciosa (apenas aviso)
      if (error?.name === 'TimeoutError') {
        logger.warn('⌛ Timeout ao buscar status de ramais (15s). Usando fallback momentâneo.');
        return this.getFallbackData();
      }

      // Se for erro de conexão, usar fallback
      if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.warn('⚠️ Backend não disponível, usando dados fallback');
        return this.getFallbackData();
      }

      logger.warn('⚠️ Falha ao buscar status dos ramais. Usando fallback:', error?.message || error);
      return this.getFallbackData();
    }
  }

  /**
   * Dados fallback quando a API não está disponível
   */
  private getFallbackData(): ExtensionStatusData {
    return {
      extensions: {},
      onlineCount: 0,
      totalExtensions: 0,
      lastUpdate: new Date().toISOString(),
      onlineExtensions: [],
      error: 'API temporariamente indisponível'
    };
  }

  /**
   * Buscar status de ramais em lote (máximo 7 por vez)
   */
  async getBatchExtensionStatus(extensions: string[]): Promise<Record<string, ExtensionStatus>> {
    try {
      // Limitar a 7 ramais por lote conforme paginação
      const limitedExtensions = extensions.slice(0, 7);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${this.baseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ extensions: limitedExtensions })
      });
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao buscar status dos ramais');
      }

      return result.data || {};
    } catch (error) {
      logger.error(`❌ Erro ao buscar status em lote:`, error);
      // Retornar fallback para todos os ramais solicitados
      const fallback: Record<string, ExtensionStatus> = {};
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
   * Buscar status de um ramal específico
   */
  async getExtensionStatus(extension: string): Promise<ExtensionStatus> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${this.baseUrl}/${extension}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao buscar status do ramal');
      }

      return result.data;
    } catch (error) {
      logger.error(`❌ Erro ao buscar status do ramal ${extension}:`, error);
      return {
        agentId: '',
        extension,
        name: '',
        userId: '',
        status: 'offline',
        isOnline: false,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Buscar estatísticas do monitoramento
   */
  async getMonitoringStats(): Promise<MonitoringStats> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${this.baseUrl}/stats/monitoring`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao buscar estatísticas');
      }

      return result.data;
    } catch (error) {
      logger.error('❌ Erro ao buscar estatísticas:', error);
      return {
        isMonitoring: false,
        lastUpdate: new Date().toISOString(),
        cacheSize: 0,
        onlineCount: 0
      };
    }
  }

  /**
   * Iniciar monitoramento no backend
   */
  async startMonitoring(): Promise<boolean> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${this.baseUrl}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao iniciar monitoramento');
      }

      logger.info('✅ Monitoramento iniciado no backend');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar monitoramento:', error);
      return false;
    }
  }

  /**
   * Parar monitoramento no backend
   */
  async stopMonitoring(): Promise<boolean> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`${this.baseUrl}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erro ao parar monitoramento');
      }

      logger.info('✅ Monitoramento parado no backend');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao parar monitoramento:', error);
      return false;
    }
  }

  /**
   * Iniciar atualização automática no frontend (a cada 7 segundos)
   * Apenas para páginas que realmente precisam de status de ramais
   */
  startAutoUpdate(pageContext?: string) {
    if (this.updateInterval) {
      return;
    }

    // Verificar se a página atual precisa de monitoramento de status
    if (!this.shouldMonitorStatus(pageContext)) {
      logger.info('📄 Página não precisa de monitoramento de status, pulando...');
      return;
    }

    // Primeira busca imediata
    this.updateStatus();

    // Atualização a cada 7 segundos (alinhado com /admin/agents-all)
    this.updateInterval = setInterval(() => {
      this.updateStatus();
    }, 7000);
    
    logger.info(`🔄 Monitoramento de status iniciado para: ${pageContext || 'página desconhecida'}`);
  }

  /**
   * Parar atualização automática no frontend
   */
  stopAutoUpdate() {
    if (!this.updateInterval) {
      return;
    }

    clearInterval(this.updateInterval);
    this.updateInterval = null;
  }

  /**
   * Atualizar status e notificar listeners
   */
  private async updateStatus() {
    try {
      // ✅ CORREÇÃO: Forçar refresh na primeira atualização
      const isFirstUpdate = this.lastData === null;
      const data = await this.getAllExtensionStatus(isFirstUpdate);
      this.lastData = data;

      // 🚨 VERIFICAÇÃO DE USUÁRIO SUSPENSO
      await this.checkUserSuspendedStatus();

      // Notificar todos os listeners
      this.listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('❌ Erro no listener de status:', error);
        }
      });

      // ⏰ LOG LIMPO: Apenas horário da última atualização
      const now = new Date();
      const timeString = now.toLocaleTimeString('pt-BR', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      logger.info(`⏰ [${timeString}] Frontend: ${data.onlineCount}/${data.totalExtensions} ramais online`);
    } catch (error) {
      logger.error('❌ Erro na atualização de status:', error);
    }
  }

  /**
   * Executar logout forçado quando backend detecta usuário suspenso
   */
  private async handleForceLogout() {
    try {
      // Parar polling imediatamente
      this.stopAutoUpdate();
      
      // Limpar listeners
      this.listeners.clear();
      
      // Executar logout
      await authService.logout();
      
      // Redirect imediato
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    } catch (error) {
      // Em caso de erro, ainda assim redirecionar
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    }
  }

  /**
   * Verificar se usuário foi suspenso e forçar logout
   */
  private async checkUserSuspendedStatus() {
    try {
      // Só verificar se estiver no browser e logado
      if (typeof window === 'undefined') return;
      
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return;

      // Buscar dados atualizados do usuário
      const updatedUser = await authService.getCurrentUserFromAPI();
      if (!updatedUser) return;

      // Se usuário está suspenso (independente do status anterior), forçar logout
      if (updatedUser.status === 'suspended') {
        // Parar polling imediatamente
        this.stopAutoUpdate();
        
        // Limpar listeners para evitar interferências
        this.listeners.clear();
        
        // Forçar logout completo
        await authService.logout();
        
        // Garantir redirect imediato
        setTimeout(() => {
          if (window.location.pathname !== '/login') {
            window.location.replace('/login');
          }
        }, 100);
        
        return;
      }
    } catch (error) {
      // Falha silenciosa para não interromper o polling principal
    }
  }

  /**
   * Adicionar listener para mudanças de status
   */
  addListener(listener: (data: ExtensionStatusData) => void) {
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
  removeListener(listener: (data: ExtensionStatusData) => void) {
    this.listeners.delete(listener);
  }

  /**
   * Obter último status conhecido
   */
  getLastStatus(): ExtensionStatusData | null {
    return this.lastData;
  }

  /**
   * Verificar se um ramal específico está online
   */
  isExtensionOnline(extension: string): boolean {
    if (!this.lastData) return false;
    return this.lastData.extensions[extension]?.isOnline || false;
  }

  /**
   * Obter contagem de ramais online
   */
  getOnlineCount(): number {
    return this.lastData?.onlineCount || 0;
  }

  /**
   * Obter lista de ramais online
   */
  getOnlineExtensions(): string[] {
    return this.lastData?.onlineExtensions || [];
  }

  /**
   * Verificar se a página atual precisa de monitoramento de status
   */
  private shouldMonitorStatus(pageContext?: string): boolean {
    if (typeof window === 'undefined') return false;
    
    const currentPath = window.location.pathname;
    const context = pageContext || currentPath;
    
    // Páginas que PRECISAM de status de ramais
    const needsStatusPages = [
      '/agents',
      '/admin/agents-all', 
      '/admin/real-time-calls',
      '/dashboard' // dashboard mostra ramais online
    ];
    
    // Páginas que NÃO PRECISAM de status de ramais
    const noStatusPages = [
      '/cdr',
      '/reports', 
      '/config',
      '/admin/users',
      '/admin/plans',
      '/admin/financial',
      '/admin/terminations',
      '/admin/system-report',
      '/reseller'
    ];
    
    // Se está explicitamente na lista de "não precisa", retornar false
    if (noStatusPages.some(page => context.includes(page))) {
      return false;
    }
    
    // Se está na lista de "precisa", retornar true
    if (needsStatusPages.some(page => context.includes(page))) {
      return true;
    }
    
    // Por padrão, não monitorar (comportamento conservador)
    return false;
  }

  /**
   * Atualizar status apenas de ramais específicos (em lote)
   */
  async updateBatchStatus(extensions: string[]): Promise<Record<string, ExtensionStatus>> {
    if (extensions.length === 0) return {};
    
    try {
      const batchData = await this.getBatchExtensionStatus(extensions);
      
      // Atualizar cache local apenas para os ramais consultados
      if (this.lastData) {
        Object.keys(batchData).forEach(ext => {
          this.lastData!.extensions[ext] = batchData[ext];
        });
      }
      
      return batchData;
    } catch (error) {
      logger.error('❌ Erro na atualização em lote:', error);
      return {};
    }
  }
}

// Instância singleton
export const extensionStatusService = new ExtensionStatusService();
