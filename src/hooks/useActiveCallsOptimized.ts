import { useState, useEffect } from 'react';
import { activeCallsService, ActiveCallsData, ActiveCall } from '@/services/activeCallsService';

/**
 * Hook otimizado para chamadas ativas com polling condicional
 * Substitui o useActiveCalls original para evitar múltiplas instâncias
 */
export const useActiveCallsOptimized = (pageContext?: string, pollingInterval: number = 5000) => {
  const [data, setData] = useState<ActiveCallsData>({
    calls: [],
    count: 0,
    lastUpdate: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Iniciar polling condicional
    activeCallsService.startPolling(pageContext, pollingInterval);
    
    // Listener para atualizações
    const unsubscribe = activeCallsService.addListener((newData) => {
      setData(newData);
      setIsLoading(false);
    });

    // Dados iniciais se disponíveis
    const lastData = activeCallsService.getLastData();
    if (lastData) {
      setData(lastData);
      setIsLoading(false);
    }

    return () => {
      unsubscribe();
      // Não parar o polling aqui - deixar o serviço gerenciar
    };
  }, [pageContext, pollingInterval]);

  return {
    activeCalls: data.calls,
    isLoading,
    count: data.count,
    lastUpdate: data.lastUpdate,
    error: data.error,
    refetch: () => activeCallsService.getActiveCalls()
  };
};

export type { ActiveCall };
