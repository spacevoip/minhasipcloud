import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User } from '@/types';
import { authService, LoginResponse } from '../lib/auth';
import { errorHandler } from '../lib/errorHandler';
import { logger } from '@/lib/logger';
import { setUserId as matomoSetUserId, resetUserId as matomoResetUserId, trackEvent as matomoTrackEvent, setCustomDimension as matomoSetDim } from '@/lib/matomo';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    cpfCnpj?: string;
    referral?: string;
    termsAccepted: boolean;
  }) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setSession: (session: any) => void;
  hydrate: () => void;
  isHydrated: boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,

      hydrate: () => {
        // Verificar se há dados válidos no localStorage
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          const userStr = localStorage.getItem('user');
          
          if (token && userStr) {
            try {
              const user = JSON.parse(userStr);
              logger.info('🔄 Hidratando autenticação do localStorage:', user.name);
              set({
                user,
                token,
                isAuthenticated: true,
                isHydrated: true
              });
              
              // Garantir que o cookie auth esteja definido
              const maxAge = 60 * 60 * 24 * 7; // 7 dias
              document.cookie = `auth=1; path=/; max-age=${maxAge}; samesite=lax`;
              return;
            } catch (error) {
              errorHandler.handle(error, {
                component: 'AuthStore',
                action: 'hydrate'
              });
              // Limpar dados corrompidos
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              document.cookie = 'auth=; path=/; max-age=0; samesite=lax';
            }
          }
        }
        
        set({ isHydrated: true });
      },

      login: async (email: string, password: string) => {
        try {
          logger.info('🔐 Iniciando login real...', { email });
          
          // Usar serviço de autenticação correto
          const result = await authService.login({ email, password });
          
          if (result.success && result.user) {
            logger.info('✅ Login bem-sucedido!', { user: result.user.name, role: result.user.role });
            
            set({
              user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                credits: result.user.credits,
                planId: result.user.planId,
                planExpiresAt: result.user.planExpiresAt,
                status: result.user.status // 🚫 CAMPO STATUS OBRIGATÓRIO PARA BLOQUEIO
              },
              token: result.token || null,
              isAuthenticated: true,
              isHydrated: true
            });

            // Matomo: identificar usuário e marcar evento de login
            try {
              matomoSetUserId(result.user.id);
              if (result.user.role) matomoSetDim(1, String(result.user.role));
              if (result.user.planId) matomoSetDim(2, String(result.user.planId));
              matomoTrackEvent('auth', 'login', 'success');
            } catch {}
          } else {
            logger.warn('❌ Login falhou:', result.message);
          }
          
          // Retornar a resposta completa para tratamento no frontend
          return result;
        } catch (error) {
          logger.error('❌ Erro no login:', error);
          return {
            success: false,
            message: 'Erro interno do servidor'
          };
        }
      },

      register: async (data) => {
        try {
          logger.info('🆕 Iniciando cadastro...', { email: data.email });
          const result = await authService.register(data);
          if (result.success && result.user) {
            set({
              user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                credits: result.user.credits,
                planId: result.user.planId,
                planExpiresAt: result.user.planExpiresAt,
                status: result.user.status
              },
              token: result.token || null,
              isAuthenticated: true,
              isHydrated: true
            });

            // Matomo: identificar usuário e marcar evento de cadastro
            try {
              matomoSetUserId(result.user.id);
              if (result.user.role) matomoSetDim(1, String(result.user.role));
              if (result.user.planId) matomoSetDim(2, String(result.user.planId));
              matomoTrackEvent('auth', 'signup', 'success');
            } catch {}
          } else {
            logger.warn('❌ Cadastro falhou:', result.message);
          }
          return result;
        } catch (error) {
          logger.error('❌ Erro no cadastro:', error);
          return { success: false, message: 'Erro interno do servidor' };
        }
      },

      logout: async () => {
        try {
          logger.info('🚪 Fazendo logout...');
          await authService.logout();
          logger.info('✅ Logout realizado com sucesso');
        } catch (error) {
          logger.error('❌ Erro no logout:', error);
        } finally {
          // Matomo: evento de logout e reset do userId
          try {
            matomoTrackEvent('auth', 'logout');
            matomoResetUserId();
          } catch {}
          set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      setSession: (session: any) => {
        // Método para compatibilidade, mas não usado no padrão atual
        logger.info('🔄 Sessão definida:', session);
      }
    }),
    {
      name: 'pabx-auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isHydrated: state.isHydrated
      })
    }
  )
);
