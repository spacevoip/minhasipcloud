'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Phone, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    // Hidratar o estado de autenticação na primeira carga
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  useEffect(() => {
    // Só redirecionar após a hidratação estar completa
    if (isHydrated) {
      if (isAuthenticated && user) {
        console.log('🔄 Redirecionando usuário autenticado:', user.name);
        if (user.role === 'reseller') {
          router.push('/reseller/dashboard');
        } else {
          router.push('/dashboard');
        }
      } else {
        console.log('🔄 Redirecionando para login - usuário não autenticado');
        router.push('/login');
      }
    }
  }, [isHydrated, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-100 rounded-full">
            <Phone className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PABX Pro</h1>
        <p className="text-gray-600 mb-6">Sistema de Gerenciamento PABX</p>
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">
            {!isHydrated ? 'Verificando autenticação...' : 'Redirecionando...'}
          </span>
        </div>
      </div>
    </div>
  );
}
