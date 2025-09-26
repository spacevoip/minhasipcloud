// =====================================================
// AUTH SERVICE - Sistema de Autenticação
// =====================================================

import { supabase } from './supabase';
import { errorHandler } from './errorHandler';
import { logger } from '@/lib/logger';
import { logApiUrl } from './apiUrlLogger';

const API_BASE_URL = logApiUrl('auth.ts').replace(/\/$/, '');

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'collaborator' | 'reseller';
  credits: number;
  planId?: string;
  planExpiresAt?: string;
  // Optional backend-provided remaining days for the current plan
  daysRemaining?: number;
  status?: 'active' | 'inactive' | 'pending' | 'suspended'; // 🚫 CAMPO STATUS OBRIGATÓRIO PARA BLOQUEIO
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  message?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  cpfCnpj?: string;
  referral?: string;
  termsAccepted: boolean;
}

class AuthService {
  /**
   * Realizar login do usuário (usando API do backend)
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      logger.info('🔐 Tentando login via API backend para:', credentials.email);

      // Chamar API de login do backend
      const response = await fetch(`${API_BASE_URL}/api/auth-v2/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        })
      });

      const result = await response.json();

      if (!response.ok) {
        logger.error('❌ Erro no login:', result);
        return {
          success: false,
          message: result.message || 'Erro ao fazer login'
        };
      }

      logger.info('✅ Login bem-sucedido:', result);

      // Extrair dados do usuário e token
      const user: AuthUser = {
        id: result.data.user.id,
        email: result.data.user.email,
        name: result.data.user.name,
        role: result.data.user.role,
        credits: result.data.user.credits || 0,
        planId: result.data.user.planId,
        planExpiresAt: result.data.user.planExpiresAt,
        daysRemaining: result.data.user.daysRemaining,
        // ensure plan status is persisted for first-load calculations
        // backend returns planStatus in auth-v2
        // typing allows optional, so keep it if present
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        planStatus: result.data.user.planStatus,
        status: result.data.user.status || 'active' // 🚫 CAPTURAR STATUS DO BACKEND PARA BLOQUEIO
      };

      // Salvar token JWT no localStorage
      if (result.data.token) {
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(user));
        // Mark session start (client-side absolute session window)
        localStorage.setItem('session_started_at', String(Date.now()));
        logger.info('💾 Token JWT e dados do usuário salvos no localStorage');
        // Definir cookie leve para o middleware do Next.js identificar autenticação
        if (typeof document !== 'undefined') {
          const maxAge = 60 * 60 * 24 * 7; // 7 dias
          document.cookie = `auth=1; path=/; max-age=${maxAge}; samesite=lax`;
        }
      }

      return {
        success: true,
        user,
        token: result.data.token
      };

    } catch (error) {
      const appError = errorHandler.handle(error, {
        component: 'authService',
        action: 'login'
      });
      
      return {
        success: false,
        message: appError.userMessage
      };
    }
  }

  /**
   * Realizar cadastro público (usando API do backend) e auto-login
   */
  async register(data: RegisterInput): Promise<LoginResponse> {
    try {
      logger.info('🆕 Tentando cadastro via API backend para:', data.email);

      const response = await fetch(`${API_BASE_URL}/api/auth-v2/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone || null,
          cpfCnpj: data.cpfCnpj || null,
          referral: data.referral || '',
          // backend valida equals('true'), então enviar string 'true' quando aceito
          termsAccepted: data.termsAccepted ? 'true' : 'false'
        })
      });

      // Tenta ler JSON; se vazio ou inválido, tenta texto
      let result: any = null;
      let rawText: string | null = null;
      try {
        result = await response.json();
      } catch (_) {
        try {
          rawText = await response.text();
        } catch {}
      }

      if (!response.ok) {
        const statusInfo = `HTTP ${response.status} ${response.statusText}`;
        const payloadInfo = result && Object.keys(result).length ? result : (rawText || '(sem corpo)');
        logger.error('❌ Erro no cadastro:', statusInfo, payloadInfo);
        let message = (result && (result.message || result.error)) || rawText || 'Erro ao criar conta';
        if (result && Array.isArray(result.errors) && result.errors.length) {
          const first = result.errors[0];
          const field = first?.path || first?.param;
          const msg = first?.msg || first?.message;
          message = msg ? `${msg}${field ? ` (${field})` : ''}` : message;
        }
        return { success: false, message };
      }

      const user: AuthUser = {
        id: result.data.user.id,
        email: result.data.user.email,
        name: result.data.user.name,
        role: result.data.user.role,
        credits: result.data.user.credits || 0,
        planId: result.data.user.planId,
        planExpiresAt: result.data.user.planExpiresAt,
        daysRemaining: result.data.user.daysRemaining,
        status: result.data.user.status || 'active'
      };

      if (result.data.token) {
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('session_started_at', String(Date.now()));
        if (typeof document !== 'undefined') {
          const maxAge = 60 * 60 * 24 * 7;
          document.cookie = `auth=1; path=/; max-age=${maxAge}; samesite=lax`;
        }
      }

      return { success: true, user, token: result.data.token };
    } catch (error) {
      const appError = errorHandler.handle(error, {
        component: 'authService',
        action: 'register'
      });
      
      return { success: false, message: appError.userMessage };
    }
  }

  /**
   * Realizar logout do usuário
   */
  async logout(): Promise<void> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth-v2/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            logger.warn('⚠️ Falha ao invalidar token no backend (continuando logout local):', body?.message || res.statusText);
          }
        } catch (requestError) {
          logger.warn('⚠️ Erro de rede ao chamar /logout (continuando logout local):', requestError);
        }
      }
    } catch (error) {
      errorHandler.handle(error, {
        component: 'authService',
        action: 'logout'
      });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('session_started_at');
        localStorage.removeItem('user_role'); // ✅ Limpar cache do role no logout
      }
      // Limpar cookie de autenticação para o middleware do Next.js
      if (typeof document !== 'undefined') {
        document.cookie = 'auth=; path=/; max-age=0; samesite=lax';
      }
      logger.info('✅ Logout realizado (token local removido)');
    }
  }

  /**
   * Verificar se usuário está autenticado
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  /**
   * Obter usuário atual do localStorage
   */
  getCurrentUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      
      return JSON.parse(userStr) as AuthUser;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'authService',
        action: 'getCurrentUser'
      });
      return null;
    }
  }

  /**
   * Obter token atual
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  /**
   * Verificar se usuário tem permissão específica
   */
  hasRole(requiredRole: string | string[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(user.role);
  }

  /**
   * Verificar se usuário é administrador
   */
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  /**
   * Verificar se usuário é revendedor
   */
  isReseller(): boolean {
    return this.hasRole('reseller');
  }

  /**
   * Verificar se usuário está suspenso
   */
  isSuspended(): boolean {
    const user = this.getCurrentUser();
    return user?.status === 'suspended';
  }

  /**
   * Buscar dados atualizados do usuário da API
   */
  async getCurrentUserFromAPI(): Promise<AuthUser | null> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) return null;

      const response = await fetch(`${API_BASE_URL}/api/auth-v2/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token inválido, limpar dados locais
          this.logout();
          return null;
        }
        throw new Error(`Erro HTTP ${response.status}`);
      }

      const result = await response.json();
      // Backend /me returns { success, data: userData }
      const apiUser: AuthUser | null = (result && (result.data || result.user)) || null;

      // Persist fresh user data locally to keep UI consistent
      if (apiUser && typeof window !== 'undefined') {
        try {
          // merge with current user to preserve any optional fields if backend omits
          const currentStr = localStorage.getItem('user');
          const current: Partial<AuthUser> = currentStr ? JSON.parse(currentStr) : {};
          const merged = { ...current, ...apiUser } as AuthUser;
          localStorage.setItem('user', JSON.stringify(merged));
        } catch {}
      }

      return apiUser;
    } catch (error) {
      logger.warn('⚠️ Erro ao buscar dados atualizados do usuário:', error);
      return null;
    }
  }

  /**
   * Verificar se usuário pode realizar operações CRUD
   * Bloquear apenas quando status === 'suspended'
   */
  canPerformCRUD(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    // Bloquear apenas usuários suspensos
    if (user.status === 'suspended') {
      return false;
    }
    
    // Permitir para todos os outros status (active, undefined, etc.)
    return true;
  }
}

export const authService = new AuthService();
