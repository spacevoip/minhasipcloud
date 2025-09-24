/**
 * Hook customizado para consolidar dados do layout
 * Otimizado com cache profissional e polling inteligente
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { authService } from '@/lib/auth';
import { plansService } from '@/services/plansService';
import { layoutCache } from '@/lib/cache';
import { supabase } from '@/lib/supabase';
import { computeDaysRemainingUTC } from '@/lib/planUtils';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  credits: number;
  planId?: string;
  planExpiresAt?: string;
  planStatus?: boolean;
  // Preferido do backend
  daysRemaining?: number;
  // Datas adicionais expostas pelo backend
  planActivatedAt?: string;
}

interface PlanData {
  id: string;
  name: string;
  price?: number;
  maxAgents?: number;
  periodDays?: number;
  features?: string[];
  description?: string;
}

interface LayoutData {
  userData: UserData | null;
  planData: PlanData | null;
  notifications: any[];
  loading: boolean;
  error: string | null;
}

interface PollingConfig {
  interval: number;
  maxInterval: number;
  backoffMultiplier: number;
  enabled: boolean;
}

export const useLayoutData = () => {
  const [data, setData] = useState<LayoutData>({
    userData: null,
    planData: null,
    notifications: [],
    loading: true,
    error: null
  });

  const [pollingConfig, setPollingConfig] = useState<PollingConfig>({
    interval: 120000, // 2 minutos inicial
    maxInterval: 300000, // 5 minutos máximo
    backoffMultiplier: 1.5,
    enabled: true
  });

  // Função para buscar dados do usuário com cache (preferindo dados frescos da API)
  const fetchUserData = useCallback(async (): Promise<UserData | null> => {
    const cached = layoutCache.get('USER_DATA') as UserData | null;
    if (cached) return cached;

    try {
      // 1) Tentar dados FRESCOS do backend
      const fresh = await authService.getCurrentUserFromAPI();
      if (fresh) {
        layoutCache.set('USER_DATA', fresh as unknown as UserData, 3600000); // 1 hora
        return fresh as unknown as UserData;
      }

      // 2) Fallback: dados locais
      const local = await authService.getCurrentUser();
      if (local) {
        layoutCache.set('USER_DATA', local as unknown as UserData, 3600000);
        return local as unknown as UserData;
      }
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      throw error;
    }
    return null;
  }, []);

  // Função para buscar dados do plano com cache e fallback direto ao banco
  const fetchPlanData = useCallback(async (userData: UserData): Promise<PlanData> => {
    if (!userData?.planId) {
      return { name: 'Plano Básico', id: '1' };
    }

    const cacheKey = `PLAN_DATA_${userData.planId}`;
    const cached = layoutCache.get(cacheKey) as PlanData | null;
    if (cached) return cached;

    try {
      // 1. Tentar buscar via API primeiro
      const planData = await plansService.getPlanById(userData.planId);
      if (planData) {
        layoutCache.set(cacheKey, planData, 3600000); // 1 hora
        return planData;
      }

      // 2. Se API falhar, buscar direto no Supabase
      console.warn('⚠️ API falhou, buscando plano direto no banco...');
      const { data: directPlan, error } = await supabase
        .from('planos_pabx')
        .select('*')
        .eq('id', userData.planId)
        .eq('status', true)
        .single();

      if (error) throw error;

      if (directPlan) {
        const convertedPlan = {
          id: directPlan.id,
          name: directPlan.name || 'Plano Sem Nome',
          price: directPlan.price || 0,
          maxAgents: directPlan.max_agents || 0,
          periodDays: directPlan.period_days || 30,
          features: directPlan.features || [],
          description: directPlan.description || ''
        };
        
        layoutCache.set(cacheKey, convertedPlan, 3600000); // 1 hora
        return convertedPlan;
      }

      // 3. Fallback final
      return { name: 'Plano Básico', id: '1' };
    } catch (error) {
      console.error('Erro ao buscar dados do plano:', error);
      // Retornar fallback ao invés de propagar erro
      return { name: 'Plano Básico', id: '1' };
    }
  }, []);

  // Função para buscar notificações com cache
  const fetchNotifications = useCallback(async (): Promise<any[]> => {
    const cached = layoutCache.get('NOTIFICATIONS') as any[] | null;
    if (cached) return cached;

    try {
      // Mock data para notificações
      const notifications: any[] = [];
      layoutCache.set('NOTIFICATIONS', notifications, 3600000); // 1 hora
      return notifications;
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      return [];
    }
  }, []);

  // Função consolidada para buscar todos os dados
  const fetchAllData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const userData = await fetchUserData();
      if (!userData) {
        throw new Error('Usuário não autenticado');
      }

      // Buscar dados do plano se o usuário tiver planId
      let planData;
      if (userData?.planId) {
        planData = await fetchPlanData(userData);
      }

      // Buscar notificações
      const notificationsData = await fetchNotifications();

      setData({
        userData,
        planData: planData || { name: 'Plano Básico', id: '1' },
        notifications: notificationsData,
        loading: false,
        error: null
      });

      // Reset polling interval em caso de sucesso
      setPollingConfig(prev => ({
        ...prev,
        interval: 120000 // Volta para 2 minutos
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setData(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));

      // Implementar backoff em caso de erro
      setPollingConfig(prev => ({
        ...prev,
        interval: Math.min(prev.interval * prev.backoffMultiplier, prev.maxInterval)
      }));

      console.error('Erro ao buscar dados do layout:', error);
    }
  }, [fetchUserData, fetchPlanData, fetchNotifications]);

  // Função para invalidar cache específico
  const invalidateCache = useCallback((type?: string) => {
    if (type) {
      if (type === 'PLAN_DATA' && data.userData?.planId) {
        layoutCache.delete(`PLAN_DATA_${data.userData.planId}`);
      } else {
        layoutCache.delete(type);
      }
    } else {
      // Invalidar todo o cache relacionado ao layout
      layoutCache.delete('USER_DATA');
      layoutCache.delete('NOTIFICATIONS');
      if (data.userData?.planId) {
        layoutCache.delete(`PLAN_DATA_${data.userData.planId}`);
      }
    }
    
    // Refetch após invalidação
    fetchAllData();
  }, [data.userData?.planId, fetchAllData]);

  // Polling inteligente com backoff
  useEffect(() => {
    if (!pollingConfig.enabled) return;

    const timer = setInterval(() => {
      // Só faz polling se não estiver carregando
      if (!data.loading) {
        fetchAllData();
      }
    }, pollingConfig.interval);

    return () => clearInterval(timer);
  }, [pollingConfig.interval, pollingConfig.enabled, data.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carregamento inicial
  useEffect(() => {
    fetchAllData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cálculos memoizados para performance
  const memoizedCalculations = useMemo(() => {
    const calculateDaysRemaining = () => {
      // 1) Prefer backend-provided days (camelCase or snake_case). Accept numeric strings too.
      const raw = (data.userData as any)?.daysRemaining ?? (data.userData as any)?.days_remaining;
      if (typeof raw === 'number' && !Number.isNaN(raw)) {
        return Math.max(0, raw);
      }
      if (typeof raw === 'string') {
        const parsed = Number(raw);
        if (!Number.isNaN(parsed)) {
          return Math.max(0, parsed);
        }
      }

      // 2) Fallback: compute with UTC-midnight boundaries to match backend
      return computeDaysRemainingUTC(data.userData?.planExpiresAt);
    };

    const getPlanName = () => {
      return data.planData?.name || 'Plano Básico';
    };

    const isPlanActive = () => {
      const daysRemaining = calculateDaysRemaining();
      const status = data.userData?.planStatus;
      return (status === true && daysRemaining > 0) || (status === undefined && daysRemaining > 0);
    };

    const getPlanStatusText = () => {
      const status = data.userData?.planStatus;
      const daysRemaining = calculateDaysRemaining();
      
      if (status === false || daysRemaining === 0) {
        return 'Vencido';
      } else if (status === true && daysRemaining > 0) {
        return 'Ativo';
      } else {
        return 'Indefinido';
      }
    };

    const getNotificationCount = () => {
      return data.notifications.filter(n => n.recipient_status !== 'read').length;
    };

    return {
      daysRemaining: calculateDaysRemaining(),
      planName: getPlanName(),
      isPlanActive: isPlanActive(),
      planStatusText: getPlanStatusText(),
      notificationCount: getNotificationCount()
    };
  }, [data.userData, data.planData, data.notifications]);

  // Setter estável para evitar recriação por render e updates desnecessários
  const setPollingEnabled = useCallback((enabled: boolean) => {
    setPollingConfig(prev => (prev.enabled === enabled ? prev : { ...prev, enabled }));
  }, []);

  return {
    ...data,
    ...memoizedCalculations,
    refetch: fetchAllData,
    invalidateCache,
    setPollingEnabled
  };
};
