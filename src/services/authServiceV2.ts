/**
 * =====================================================
 * AUTH SERVICE V2 - SERVIÇO DE AUTENTICAÇÃO MODERNO
 * =====================================================
 * Serviço completo para consumir a API moderna de autenticação
 * Com JWT, cache inteligente e fallback para dados mock
 */

import { User } from '@/types';

// Configuração da API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 10000; // 10 segundos

// Interfaces
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
    expiresIn: string;
  };
  meta?: {
    timestamp: string;
    sessionId: string;
  };
}

export interface UserResponse {
  success: boolean;
  data: User;
  meta?: {
    timestamp: string;
    tokenValid: boolean;
  };
}

export interface SessionInfo {
  currentSession: {
    userId: string;
    email: string;
    role: string;
    loginAt: string;
    ip: string;
    userAgent: string;
  } | null;
  activeSessions: number;
}

class AuthServiceV2 {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private tokenRefreshPromise: Promise<string | null> | null = null;

  /**
   * Fazer requisição HTTP com timeout e retry
   */
  private async makeRequest<T>(
    url: string, 
    options: RequestInit = {},
    includeAuth = true
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
      };

      // Adicionar token se necessário
      if (includeAuth) {
        const token = this.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Se token expirado, tentar renovar
        if (response.status === 401 && includeAuth) {
          const newToken = await this.refreshToken();
          if (newToken) {
            // Tentar novamente com novo token
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
              ...options,
              headers,
            });
            
            if (retryResponse.ok) {
              return await retryResponse.json();
            }
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Erro na requisição:', error);
      throw error;
    }
  }

  /**
   * Obter token do localStorage
   */
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  /**
   * Salvar token no localStorage
   */
  private setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
  }

  /**
   * Remover token do localStorage
   */
  private removeToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  /**
   * Verificar se token está próximo do vencimento
   */
  private isTokenExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      // Renovar se faltam menos de 10 minutos
      return timeUntilExpiration < 10 * 60 * 1000;
    } catch (error) {
      return true; // Se não conseguir decodificar, considerar como expirando
    }
  }

  /**
   * Renovar token automaticamente
   */
  private async refreshToken(): Promise<string | null> {
    // Evitar múltiplas renovações simultâneas
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      try {
        console.log('🔄 Renovando token...');
        
        const response = await this.makeRequest<{ success: boolean; data: { token: string } }>(
          '/api/auth-v2/refresh',
          { method: 'POST' },
          true // incluir auth
        );

        if (response.success && response.data.token) {
          this.setToken(response.data.token);
          console.log('✅ Token renovado com sucesso');
          return response.data.token;
        }

        return null;
      } catch (error) {
        console.error('❌ Erro ao renovar token:', error);
        this.logout(); // Forçar logout se não conseguir renovar
        return null;
      } finally {
        this.tokenRefreshPromise = null;
      }
    })();

    return this.tokenRefreshPromise;
  }

  /**
   * Verificar cache local
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`📦 Cache local HIT: ${key}`);
      return cached.data;
    }
    return null;
  }

  /**
   * Salvar no cache local
   */
  private setCache<T>(key: string, data: T, ttl = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Realizar login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log('🔐 [Auth V2] Realizando login...', credentials.email);

      const response = await this.makeRequest<LoginResponse>(
        '/api/auth-v2/login',
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        },
        false // não incluir auth no login
      );

      if (response.success && response.data) {
        // Salvar token e dados do usuário
        this.setToken(response.data.token);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        // Limpar cache
        this.cache.clear();

        console.log(`✅ Login realizado: ${response.data.user.name} (${response.data.user.role})`);
      }

      return response;

    } catch (error) {
      console.error('❌ Erro no login:', error);
      return {
        success: false,
        message: 'Erro ao realizar login. Tente novamente.'
      };
    }
  }

  /**
   * Realizar logout
   */
  async logout(): Promise<void> {
    try {
      console.log('🚪 [Auth V2] Realizando logout...');

      // Tentar fazer logout na API
      try {
        await this.makeRequest('/api/auth-v2/logout', {
          method: 'POST'
        });
      } catch (error) {
        console.log('⚠️ Erro no logout da API, continuando logout local...');
      }

      // Limpar dados locais
      this.removeToken();
      this.cache.clear();

      console.log('✅ Logout realizado com sucesso');

    } catch (error) {
      console.error('❌ Erro no logout:', error);
      // Mesmo com erro, limpar dados locais
      this.removeToken();
      this.cache.clear();
    }
  }

  /**
   * Obter dados do usuário atual
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const token = this.getToken();
      if (!token) {
        return null;
      }

      // Verificar se token está expirando e renovar se necessário
      if (this.isTokenExpiringSoon(token)) {
        await this.refreshToken();
      }

      const cacheKey = 'auth:current-user';

      // Verificar cache local (somente se completo)
      const cached = this.getCached<UserResponse>(cacheKey);
      if (cached && cached.success) {
        const u: any = cached.data as any;
        const hasSmsFlag = u && (('sms_send' in u) || ('smsEnvio' in u));
        if (hasSmsFlag) {
          return cached.data;
        }
        // Cache está desatualizado (antes de expor sms_send). Ignorar e buscar novamente.
      }

      // Buscar da API
      const response = await this.makeRequest<UserResponse>('/api/auth-v2/me');

      if (response && response.success && response.data) {
        // Salvar no cache
        this.setCache(cacheKey, response);
        // Atualizar localStorage para compatibilidade com outros módulos
        if (typeof window !== 'undefined') {
          try { localStorage.setItem('user', JSON.stringify(response.data)); } catch {}
        }
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar usuário atual:', error);

      // Fallback para localStorage
      if (typeof window !== 'undefined') {
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            return JSON.parse(userStr);
          }
        } catch (parseError) {
          console.error('❌ Erro ao parsear usuário do localStorage:', parseError);
        }
      }
      return null;
    }
  }

  /**
   * Verificar se usuário está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) {
        return false;
      }

      const user = await this.getCurrentUser();
      return user !== null;

    } catch (error) {
      console.error('❌ Erro ao verificar autenticação:', error);
      return false;
    }
  }

  /**
   * Obter informações da sessão
   */
  async getSessionInfo(): Promise<SessionInfo | null> {
    try {
      console.log('📊 [Auth V2] Buscando informações da sessão...');

      const response = await this.makeRequest<{ success: boolean; data: SessionInfo }>('/api/auth-v2/sessions');

      if (response.success) {
        return response.data;
      }

      return null;

    } catch (error) {
      console.error('❌ Erro ao buscar informações da sessão:', error);
      return null;
    }
  }

  /**
   * Verificar permissões do usuário
   */
  async hasPermission(requiredRoles: string[]): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      if (!user) {
        return false;
      }

      return requiredRoles.includes(user.role);

    } catch (error) {
      console.error('❌ Erro ao verificar permissões:', error);
      return false;
    }
  }

  /**
   * Obter token atual (para uso externo)
   */
  getAuthToken(): string | null {
    return this.getToken();
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache de autenticação limpo');
  }

  /**
   * Verificar se token é válido (sem fazer requisição)
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000;
      return Date.now() < expirationTime;
    } catch (error) {
      return false;
    }
  }
}

// Exportar instância singleton
export const authServiceV2 = new AuthServiceV2();
export default authServiceV2;
