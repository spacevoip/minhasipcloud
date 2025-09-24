// =====================================================
// UNIFIED AUTH SERVICE - Sistema de Autenticação Consolidado
// =====================================================

import { supabase } from './supabase';
import { errorHandler } from './errorHandler';
import { logger } from '@/lib/logger';
import { userRealtimeService } from '@/services/userRealtimeService';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

// Types
export type UserRole = 'user' | 'admin' | 'collaborator' | 'reseller' | 'agent';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface BaseUser {
  id: string;
  email?: string;
  name: string;
  role: UserRole;
  status?: UserStatus;
}

export interface AdminUser extends BaseUser {
  role: 'user' | 'admin' | 'collaborator' | 'reseller';
  email: string;
  credits: number;
  planId?: string;
  planExpiresAt?: string;
}

export interface AgentUser extends BaseUser {
  role: 'agent';
  ramal: string;
  agente_name: string;
  callerid: string;
  webrtc: boolean;
  status_sip: string;
  chamadas_total?: number;
  chamadas_hoje?: number;
  user_id: string;
  user_name: string;
  user_role: string;
  blocked?: boolean;
  auto_discagem?: boolean;
}

export type UnifiedUser = AdminUser | AgentUser;

export interface LoginCredentials {
  email?: string;
  ramal?: string;
  password: string;
  senha?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: UnifiedUser;
  token?: string;
  message?: string;
  userType: 'admin' | 'agent';
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

class UnifiedAuthService {
  private currentUserType: 'admin' | 'agent' | null = null;
  // Absolute session limit: 1 hour (3600000 ms) or 5 hours if keepLoggedIn is enabled
  private readonly SESSION_MAX_AGE_MS = 60 * 60 * 1000;
  private readonly EXTENDED_SESSION_MAX_AGE_MS = 5 * 60 * 60 * 1000; // 5 hours

  /**
   * Detect login type based on credentials
   */
  private detectLoginType(credentials: LoginCredentials): 'admin' | 'agent' {
    return credentials.ramal || credentials.senha ? 'agent' : 'admin';
  }

  /**
   * Universal login method
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const loginType = this.detectLoginType(credentials);
    this.currentUserType = loginType;

    if (loginType === 'agent') {
      return this.loginAgent({
        ramal: credentials.ramal!,
        senha: credentials.senha || credentials.password
      });
    } else {
      return this.loginAdmin({
        email: credentials.email!,
        password: credentials.password
      });
    }
  }

  /**
   * Admin login
   */
  private async loginAdmin(credentials: { email: string; password: string }): Promise<LoginResponse> {
    try {
      logger.info('🔐 Admin login attempt for:', credentials.email);

      const response = await fetch(`${API_BASE_URL}/api/auth-v2/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const result = await response.json();

      if (!response.ok) {
        logger.error('❌ Admin login error:', result);
        return {
          success: false,
          message: result.message || 'Erro ao fazer login',
          userType: 'admin'
        };
      }

      const user: AdminUser = {
        id: result.data.user.id,
        email: result.data.user.email,
        name: result.data.user.name,
        role: result.data.user.role,
        credits: result.data.user.credits || 0,
        planId: result.data.user.planId,
        planExpiresAt: result.data.user.planExpiresAt,
        status: result.data.user.status || 'active'
      };

      if (result.data.token) {
        this.storeAuthData('admin', result.data.token, user);
      }

      return {
        success: true,
        user,
        token: result.data.token,
        userType: 'admin'
      };

    } catch (error) {
      const appError = errorHandler.handle(error, {
        component: 'unifiedAuthService',
        action: 'loginAdmin'
      });
      
      return {
        success: false,
        message: appError.userMessage,
        userType: 'admin'
      };
    }
  }

  /**
   * Agent login
   */
  private async loginAgent(credentials: { ramal: string; senha: string }): Promise<LoginResponse> {
    try {
      logger.info('🔐 Agent login attempt for ramal:', credentials.ramal);

      const response = await fetch(`${API_BASE_URL}/api/agent-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          message: result.message || 'Erro ao fazer login',
          userType: 'agent'
        };
      }

      const user: AgentUser = {
        ...result.data.agent,
        role: 'agent' as const,
        name: result.data.agent.agente_name
      };

      if (result.data.token) {
        this.storeAuthData('agent', result.data.token, user);
      }

      return {
        success: true,
        user,
        token: result.data.token,
        userType: 'agent'
      };

    } catch (error) {
      logger.error('Agent login error:', error);
      return {
        success: false,
        message: 'Erro de conexão com o servidor',
        userType: 'agent'
      };
    }
  }

  /**
   * Register (admin only)
   */
  async register(data: RegisterInput): Promise<LoginResponse> {
    try {
      logger.info('🆕 Registration attempt for:', data.email);

      const response = await fetch(`${API_BASE_URL}/api/auth-v2/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          termsAccepted: data.termsAccepted ? 'true' : 'false'
        })
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        const text = await response.text();
        throw new Error(text || 'Invalid response');
      }

      if (!response.ok) {
        let message = result?.message || result?.error || 'Erro ao criar conta';
        if (result?.errors?.length) {
          const first = result.errors[0];
          const field = first?.path || first?.param;
          const msg = first?.msg || first?.message;
          message = msg ? `${msg}${field ? ` (${field})` : ''}` : message;
        }
        return { success: false, message, userType: 'admin' };
      }

      const user: AdminUser = {
        id: result.data.user.id,
        email: result.data.user.email,
        name: result.data.user.name,
        role: result.data.user.role,
        credits: result.data.user.credits || 0,
        planId: result.data.user.planId,
        planExpiresAt: result.data.user.planExpiresAt,
        status: result.data.user.status || 'active'
      };

      if (result.data.token) {
        this.storeAuthData('admin', result.data.token, user);
      }

      return { success: true, user, token: result.data.token, userType: 'admin' };
    } catch (error) {
      const appError = errorHandler.handle(error, {
        component: 'unifiedAuthService',
        action: 'register'
      });
      
      return { success: false, message: appError.userMessage, userType: 'admin' };
    }
  }

  /**
   * Universal logout
   */
  async logout(): Promise<void> {
    try {
      const userType = this.getCurrentUserType();
      const token = this.getToken();

      if (token && userType) {
        const endpoint = userType === 'admin' ? '/api/auth-v2/logout' : '/api/agent-auth/logout';
        
        try {
          const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            logger.warn('⚠️ Server logout failed, continuing with local logout');
          }
        } catch (error) {
          logger.warn('⚠️ Network error during logout, continuing with local logout:', error);
        }
      }
    } catch (error) {
      errorHandler.handle(error, {
        component: 'unifiedAuthService',
        action: 'logout'
      });
    } finally {
      this.clearAuthData();
    }
  }

  /**
   * Check authentication status
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('unified_token') || localStorage.getItem('token') || localStorage.getItem('agent_token');
    const user = localStorage.getItem('unified_user') || localStorage.getItem('user') || localStorage.getItem('agent_data');
    return !!(token && user);
  }

  /**
   * Get current user
   */
  getCurrentUser(): UnifiedUser | null {
    if (typeof window === 'undefined') return null;
    
    try {
      // Try unified storage first, then fallback to legacy
      let userStr = localStorage.getItem('unified_user');
      if (!userStr) {
        userStr = localStorage.getItem('user') || localStorage.getItem('agent_data');
      }
      
      if (!userStr) return null;
      
      const userData = JSON.parse(userStr);
      
      // Normalize agent data to match UnifiedUser interface
      if (userData.ramal && userData.agente_name) {
        return {
          ...userData,
          role: 'agent' as const,
          name: userData.agente_name
        } as AgentUser;
      }
      
      return userData as UnifiedUser;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'unifiedAuthService',
        action: 'getCurrentUser'
      });
      return null;
    }
  }

  /**
   * Get current user type
   */
  getCurrentUserType(): 'admin' | 'agent' | null {
    const user = this.getCurrentUser();
    if (!user) return null;
    
    return user.role === 'agent' ? 'agent' : 'admin';
  }

  /**
   * Get authentication token
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    return localStorage.getItem('unified_token') || 
           localStorage.getItem('token') || 
           localStorage.getItem('agent_token');
  }

  /**
   * Session timing helpers
   */
  private getSessionStartedAt(): number | null {
    if (typeof window === 'undefined') return null;
    const unified = localStorage.getItem('unified_session_started_at');
    const legacy = localStorage.getItem('session_started_at');
    const raw = unified || legacy;
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  getSessionAgeMs(): number | null {
    const started = this.getSessionStartedAt();
    if (!started) return null;
    return Date.now() - started;
  }

  isSessionExpired(): boolean {
    const age = this.getSessionAgeMs();
    if (age == null) return false;
    
    // Check if extended session is enabled
    const preferences = this.getLoginPreferences();
    const maxAge = preferences?.keepLoggedIn ? this.EXTENDED_SESSION_MAX_AGE_MS : this.SESSION_MAX_AGE_MS;
    
    return age >= maxAge;
  }

  /**
   * Get login preferences from localStorage
   */
  private getLoginPreferences(): { keepLoggedIn?: boolean; saveCredentials?: boolean } | null {
    try {
      if (typeof window === 'undefined') return null;
      const preferences = localStorage.getItem('login_preferences');
      return preferences ? JSON.parse(preferences) : null;
    } catch {
      return null;
    }
  }

  /**
   * If expired, perform logout and return true; else false
   */
  async checkAndHandleExpiry(): Promise<boolean> {
    if (this.isSessionExpired()) {
      try {
        await this.logout();
      } finally {
        // Best effort redirect to login for client contexts
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new Event('app:force-logout'));
          } catch {}
          window.location.assign('/login');
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Check user roles
   */
  hasRole(requiredRole: UserRole | UserRole[]): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(user.role);
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.hasRole(['admin', 'collaborator', 'reseller']);
  }

  /**
   * Check if user is agent
   */
  isAgent(): boolean {
    return this.hasRole('agent');
  }

  /**
   * Check if user is suspended
   */
  isSuspended(): boolean {
    const user = this.getCurrentUser();
    return user?.status === 'suspended';
  }

  /**
   * Check if user can perform CRUD operations
   */
  canPerformCRUD(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    return user.status !== 'suspended';
  }

  /**
   * Get fresh user data from API
   */
  async getCurrentUserFromAPI(): Promise<UnifiedUser | null> {
    try {
      const token = this.getToken();
      const userType = this.getCurrentUserType();
      
      if (!token || !userType) return null;

      const endpoint = userType === 'admin' ? '/api/auth-v2/me' : '/api/agent-auth/me';
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (userType === 'agent') {
        return result.data?.agent ? {
          ...result.data.agent,
          role: 'agent' as const,
          name: result.data.agent.agente_name
        } as AgentUser : null;
      } else {
        return result.user || null;
      }
    } catch (error) {
      logger.warn('⚠️ Error fetching fresh user data:', error);
      return null;
    }
  }

  /**
   * Store authentication data
   */
  private storeAuthData(type: 'admin' | 'agent', token: string, user: UnifiedUser): void {
    if (typeof window === 'undefined') return;

    // Store in unified format
    localStorage.setItem('unified_token', token);
    localStorage.setItem('unified_user', JSON.stringify(user));
    localStorage.setItem('unified_type', type);
    // Session start timestamp (absolute)
    localStorage.setItem('unified_session_started_at', String(Date.now()));

    // Maintain backward compatibility
    if (type === 'admin') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('session_started_at', String(Date.now()));
    } else {
      localStorage.setItem('agent_token', token);
      localStorage.setItem('agent_data', JSON.stringify(user));
      localStorage.setItem('session_started_at', String(Date.now()));
    }

    // Set auth cookie
    if (typeof document !== 'undefined') {
      const maxAge = 60 * 60 * 24 * 7; // 7 days
      document.cookie = `auth=1; path=/; max-age=${maxAge}; samesite=lax`;
    }

    logger.info('💾 Auth data stored successfully');

    // Start realtime subscription for user status (suspension)
    try {
      // For admin: subscribe to their own users_pabx row (id)
      // For agent: subscribe to the OWNER users_pabx row (user_id)
      const isAgent = (user as any)?.role === 'agent';
      const targetUserId = isAgent ? (user as any)?.user_id : (user as any)?.id;
      if (targetUserId) {
        userRealtimeService.start(targetUserId, async () => {
          try {
            await this.logout();
          } finally {
            try {
              if (typeof window !== 'undefined') {
                try { window.dispatchEvent(new Event('app:force-logout')); } catch {}
                window.location.assign('/login');
              }
            } catch {}
          }
        });
      }
    } catch (e) {
      logger.warn('⚠️ Falha ao iniciar realtime de status do usuário:', e);
    }
  }

  /**
   * Clear authentication data
   */
  private clearAuthData(): void {
    if (typeof window === 'undefined') return;

    // Clear unified storage
    localStorage.removeItem('unified_token');
    localStorage.removeItem('unified_user');
    localStorage.removeItem('unified_type');
    localStorage.removeItem('unified_session_started_at');

    // Clear legacy storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('agent_token');
    localStorage.removeItem('agent_data');
    localStorage.removeItem('session_started_at');

    // Clear auth cookie
    if (typeof document !== 'undefined') {
      document.cookie = 'auth=; path=/; max-age=0; samesite=lax';
    }

    // Stop realtime user subscription to avoid leaks
    try {
      userRealtimeService.stop();
    } catch {}

    this.currentUserType = null;
    logger.info('✅ Auth data cleared');
  }
}

export const unifiedAuthService = new UnifiedAuthService();
