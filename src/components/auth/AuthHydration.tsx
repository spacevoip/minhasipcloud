'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { logger } from '@/lib/logger';
import { setUserId as matomoSetUserId, resetUserId as matomoResetUserId, setCustomDimension } from '@/lib/matomo';

/**
 * Componente para garantir hidratação do estado de autenticação
 * Deve ser usado no layout raiz para inicializar o estado antes de qualquer página
 */
export function AuthHydration({ children }: { children: React.ReactNode }) {
  const { isHydrated, hydrate, user } = useAuthStore();

  useEffect(() => {
    // Hidratar imediatamente na primeira carga
    if (!isHydrated) {
      logger.info('🔄 Iniciando hidratação de autenticação...');
      hydrate();
    }
  }, [isHydrated, hydrate]);

  // Informar o Matomo sobre o usuário autenticado (userId) após hidratação
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (user && user.id) {
        matomoSetUserId(user.id);
        // Dimensão 1: role; Dimensão 2: planId (ajuste os índices de acordo com seu Matomo)
        if (user.role) setCustomDimension(1, String(user.role));
        if (user.planId) setCustomDimension(2, String(user.planId));
      } else {
        matomoResetUserId();
      }
    } catch {}
  }, [isHydrated, user?.id, user?.role, user?.planId]);

  // Renderizar children apenas após hidratação para evitar flash de conteúdo
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
