// =====================================================
// USER SERVICE - Serviço de Usuário Atual
// =====================================================

import { supabase } from './supabase';
import { logger } from '@/lib/logger';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'collaborator' | 'reseller';
  credits: number;
  company?: string;
  phone?: string;
  planId?: string;
  planExpiresAt?: string;
  planActivatedAt?: string;
  planStatus?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

class UserService {
  /**
   * Mapear role do usuário para texto legível
   */
  mapRole(role: string): string {
    const roleMap: Record<string, string> = {
      'admin': 'Administrador',
      'user': 'Usuário',
      'reseller': 'Revendedor',
      'collaborator': 'Colaborador'
    };
    return roleMap[role] || role;
  }

  /**
   * Obter dados do usuário atual do localStorage
   */
  getCurrentUser(): CurrentUser | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      
      return JSON.parse(userStr) as CurrentUser;
    } catch (error) {
      logger.error('❌ Erro ao obter usuário atual:', error);
      return null;
    }
  }

  /**
   * Buscar dados atualizados do usuário no Supabase
   */
  async getCurrentUserData(): Promise<CurrentUser | null> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        logger.warn('⚠️ Nenhum usuário logado encontrado');
        return null;
      }

      logger.info('🔄 Buscando dados do usuário:', currentUser.id);

      const { data, error } = await supabase
        .from('users_pabx')
        .select(`
          id,
          name,
          email,
          role,
          credits,
          company,
          phone,
          plan_id,
          plan_expires_at,
          plan_activated_at,
          plan_status,
          last_login_at,
          created_at,
          updated_at
        `)
        .eq('id', currentUser.id)
        .single();

      if (error) {
        logger.error('❌ Erro ao buscar dados do usuário:', error);
        return null;
      }

      if (!data) {
        logger.warn('⚠️ Usuário não encontrado no banco');
        return null;
      }

      const userData: CurrentUser = {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        credits: data.credits || 0,
        company: data.company,
        phone: data.phone,
        planId: data.plan_id,
        planExpiresAt: data.plan_expires_at,
        planActivatedAt: data.plan_activated_at,
        planStatus: data.plan_status,
        lastLoginAt: data.last_login_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      // Atualizar localStorage com dados frescos
      localStorage.setItem('user', JSON.stringify(userData));

      logger.info('✅ Dados do usuário carregados:', userData.name);
      return userData;

    } catch (error) {
      logger.error('❌ Erro ao buscar dados do usuário:', error);
      return null;
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
   * Obter token de autenticação
   */
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  /**
   * Verificar se usuário tem role específica
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
   * Verificar se usuário é colaborador
   */
  isCollaborator(): boolean {
    return this.hasRole('collaborator');
  }

  /**
   * Atualizar dados do usuário no localStorage
   */
  updateLocalUser(updates: Partial<CurrentUser>): void {
    if (typeof window === 'undefined') return;
    
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return;

      const updatedUser = { ...currentUser, ...updates };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      logger.info('✅ Dados do usuário atualizados no localStorage');
    } catch (error) {
      logger.error('❌ Erro ao atualizar dados do usuário:', error);
    }
  }

  /**
   * Limpar dados do usuário (logout)
   */
  clearUser(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    logger.info('✅ Dados do usuário limpos');
  }

  /**
   * Obter ID do usuário atual
   */
  getCurrentUserId(): string | null {
    const user = this.getCurrentUser();
    return user?.id || null;
  }

  /**
   * Obter nome do usuário atual
   */
  getCurrentUserName(): string | null {
    const user = this.getCurrentUser();
    return user?.name || null;
  }

  /**
   * Obter créditos do usuário atual
   */
  getCurrentUserCredits(): number {
    const user = this.getCurrentUser();
    return user?.credits || 0;
  }

  /**
   * Obter plano do usuário atual
   */
  getCurrentUserPlan(): { planId?: string; planExpiresAt?: string; planStatus?: boolean } {
    const user = this.getCurrentUser();
    return {
      planId: user?.planId,
      planExpiresAt: user?.planExpiresAt,
      planStatus: user?.planStatus
    };
  }
}

export const userService = new UserService();
