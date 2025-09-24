import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ResellerPlan {
  id: string;
  resellerId: string; // ID do revendedor que criou o plano
  name: string;
  description: string;
  price: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  limits: {
    agents: number;
    extensions: number;
    callMinutes: number;
    storage: number; // GB
    recordings: boolean;
    reports: boolean;
    api: boolean;
  };
  status: 'active' | 'inactive' | 'draft';
  clientsCount: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanData {
  name: string;
  description: string;
  price: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  limits: {
    agents: number;
    extensions: number;
    callMinutes: number;
    storage: number;
    recordings: boolean;
    reports: boolean;
    api: boolean;
  };
}

export interface UpdatePlanData {
  id: string;
  name: string;
  description: string;
  price: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  limits: {
    agents: number;
    extensions: number;
    callMinutes: number;
    storage: number;
    recordings: boolean;
    reports: boolean;
    api: boolean;
  };
  status: 'active' | 'inactive' | 'draft';
}

interface ResellerPlansStore {
  plans: ResellerPlan[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  statusFilter: string;
  periodFilter: string;

  // Actions
  fetchPlans: () => Promise<void>;
  createPlan: (data: CreatePlanData & { resellerId: string }) => Promise<ResellerPlan>;
  updatePlan: (data: UpdatePlanData) => Promise<ResellerPlan>;
  deletePlan: (id: string) => Promise<void>;
  duplicatePlan: (id: string) => Promise<ResellerPlan>;
  
  // Filtro por revendedor
  getResellerPlans: (resellerId: string) => ResellerPlan[];
  
  // Filters
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setPeriodFilter: (period: string) => void;
  getFilteredPlans: () => ResellerPlan[];
  getPlanStats: () => {
    total: number;
    active: number;
    inactive: number;
    draft: number;
    totalRevenue: number;
    totalClients: number;
    avgPrice: number;
  };
}

// Mock data
const mockPlans: ResellerPlan[] = [
  {
    id: '1',
    resellerId: 'reseller-1', // ID do revendedor 1
    name: 'Plano Básico',
    description: 'Ideal para pequenas empresas que estão começando',
    price: 99.90,
    period: 'monthly',
    features: [
      'Até 5 agentes',
      'Até 10 ramais',
      '1000 minutos/mês',
      'Relatórios básicos',
      'Suporte por email'
    ],
    limits: {
      agents: 5,
      extensions: 10,
      callMinutes: 1000,
      storage: 1,
      recordings: false,
      reports: true,
      api: false
    },
    status: 'active',
    clientsCount: 12,
    revenue: 1198.80,
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20'
  },
  {
    id: '2',
    resellerId: 'reseller-1', // ID do revendedor 1
    name: 'Plano Profissional',
    description: 'Para empresas em crescimento que precisam de mais recursos',
    price: 199.90,
    period: 'monthly',
    features: [
      'Até 15 agentes',
      'Até 30 ramais',
      '3000 minutos/mês',
      'Gravação de chamadas',
      'Relatórios avançados',
      'Suporte prioritário',
      'API básica'
    ],
    limits: {
      agents: 15,
      extensions: 30,
      callMinutes: 3000,
      storage: 5,
      recordings: true,
      reports: true,
      api: true
    },
    status: 'active',
    clientsCount: 8,
    revenue: 1599.20,
    createdAt: '2024-01-10',
    updatedAt: '2024-01-25'
  },
  {
    id: '3',
    resellerId: 'reseller-2', // ID do revendedor 2
    name: 'Plano Empresarial',
    description: 'Solução completa para grandes empresas',
    price: 399.90,
    period: 'monthly',
    features: [
      'Agentes ilimitados',
      'Ramais ilimitados',
      'Minutos ilimitados',
      'Gravação completa',
      'Relatórios personalizados',
      'Suporte 24/7',
      'API completa',
      'Integração personalizada'
    ],
    limits: {
      agents: -1, // -1 = ilimitado
      extensions: -1,
      callMinutes: -1,
      storage: 50,
      recordings: true,
      reports: true,
      api: true
    },
    status: 'active',
    clientsCount: 3,
    revenue: 1199.70,
    createdAt: '2024-01-05',
    updatedAt: '2024-01-30'
  },
  {
    id: '4',
    resellerId: 'reseller-2', // ID do revendedor 2
    name: 'Plano Premium',
    description: 'Plano sob medida para necessidades específicas',
    price: 599.90,
    period: 'monthly',
    features: [
      'Configuração personalizada',
      'Recursos sob demanda',
      'Suporte dedicado',
      'SLA garantido'
    ],
    limits: {
      agents: 50,
      extensions: 100,
      callMinutes: 10000,
      storage: 100,
      recordings: true,
      reports: true,
      api: true
    },
    status: 'draft',
    clientsCount: 0,
    revenue: 0,
    createdAt: '2024-02-01',
    updatedAt: '2024-02-01'
  },
  {
    id: '5',
    resellerId: 'reseller-1', // ID do revendedor 1
    name: 'Plano Starter',
    description: 'Para testes e pequenos negócios',
    price: 49.90,
    period: 'monthly',
    features: [
      'Até 2 agentes',
      'Até 5 ramais',
      '500 minutos/mês',
      'Relatórios básicos'
    ],
    limits: {
      agents: 2,
      extensions: 5,
      callMinutes: 500,
      storage: 0.5,
      recordings: false,
      reports: true,
      api: false
    },
    status: 'inactive',
    clientsCount: 5,
    revenue: 249.50,
    createdAt: '2024-01-20',
    updatedAt: '2024-01-28'
  }
];

export const useResellerPlansStore = create<ResellerPlansStore>()(
  persist(
    (set, get) => ({
      plans: mockPlans,
      isLoading: false,
      error: null,
      searchTerm: '',
      statusFilter: 'all',
      periodFilter: 'all',

      fetchPlans: async () => {
        // Dados já carregados estaticamente para performance máxima
        // Sem delay artificial conforme otimização solicitada
        set({ isLoading: false, error: null });
      },

      createPlan: async (data: CreatePlanData & { resellerId: string }) => {
        try {
          const newPlan: ResellerPlan = {
            id: Math.random().toString(36).substr(2, 9),
            ...data,
            status: 'draft',
            clientsCount: 0,
            revenue: 0,
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0]
          };

          set(state => ({
            plans: [...state.plans, newPlan],
            isLoading: false,
            error: null
          }));

          return newPlan;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao criar plano' 
          });
          throw error;
        }
      },

      updatePlan: async (data: UpdatePlanData) => {
        try {
          const { id, ...updateData } = data;
          
          set(state => ({
            plans: state.plans.map(plan => 
              plan.id === id 
                ? { ...plan, ...updateData, updatedAt: new Date().toISOString().split('T')[0] }
                : plan
            ),
            isLoading: false,
            error: null
          }));

          const updatedPlan = get().plans.find(p => p.id === id);
          if (!updatedPlan) throw new Error('Plano não encontrado');
          
          return updatedPlan;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao atualizar plano' 
          });
          throw error;
        }
      },

      deletePlan: async (id: string) => {
        try {
          set(state => ({
            plans: state.plans.filter(plan => plan.id !== id),
            isLoading: false,
            error: null
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao excluir plano' 
          });
          throw error;
        }
      },

      duplicatePlan: async (id: string) => {
        try {
          const originalPlan = get().plans.find(p => p.id === id);
          if (!originalPlan) throw new Error('Plano não encontrado');

          const duplicatedPlan: ResellerPlan = {
            ...originalPlan,
            id: Math.random().toString(36).substr(2, 9),
            resellerId: originalPlan.resellerId, // Manter o mesmo revendedor
            name: `${originalPlan.name} (Cópia)`,
            status: 'draft',
            clientsCount: 0,
            revenue: 0,
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0]
          };

          set(state => ({
            plans: [...state.plans, duplicatedPlan],
            isLoading: false,
            error: null
          }));

          return duplicatedPlan;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao duplicar plano' 
          });
          throw error;
        }
      },

      setSearchTerm: (term: string) => set({ searchTerm: term }),
      setStatusFilter: (status: string) => set({ statusFilter: status }),
      setPeriodFilter: (period: string) => set({ periodFilter: period }),

      getFilteredPlans: () => {
        const { plans, searchTerm, statusFilter, periodFilter } = get();
        
        return plans.filter(plan => {
          const matchesSearch = !searchTerm || 
            plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.description.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
          const matchesPeriod = periodFilter === 'all' || plan.period === periodFilter;
          
          return matchesSearch && matchesStatus && matchesPeriod;
        });
      },

      getPlanStats: () => {
        const { plans } = get();
        
        const stats = plans.reduce((acc, plan) => {
          acc.total++;
          acc[plan.status]++;
          acc.totalRevenue += plan.revenue;
          acc.totalClients += plan.clientsCount;
          return acc;
        }, {
          total: 0,
          active: 0,
          inactive: 0,
          draft: 0,
          totalRevenue: 0,
          totalClients: 0
        });

        return {
          ...stats,
          avgPrice: stats.total > 0 ? stats.totalRevenue / stats.totalClients || 0 : 0
        };
      },

      // Filtrar planos apenas do revendedor logado
      getResellerPlans: (resellerId: string) => {
        const { plans } = get();
        return plans.filter(plan => plan.resellerId === resellerId);
      }
    }),
    {
      name: 'reseller-plans-store',
      partialize: (state) => ({ 
        plans: state.plans,
        searchTerm: state.searchTerm,
        statusFilter: state.statusFilter,
        periodFilter: state.periodFilter
      })
    }
  )
);
