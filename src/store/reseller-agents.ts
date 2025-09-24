import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ResellerAgent {
  id: string;
  name: string;
  email: string;
  extension: string;
  callerId: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  department: string;
  skills: string[];
  callsToday: number;
  avgCallTime: string;
  lastActivity: string;
  joinDate: string;
  notes?: string;
}

export interface CreateAgentData {
  name: string;
  email: string;
  extension: string;
  callerId: string;
  department: string;
  skills: string[];
  notes?: string;
}

export interface UpdateAgentData {
  id: string;
  name: string;
  email: string;
  extension: string;
  callerId: string;
  department: string;
  skills: string[];
  status: 'online' | 'offline' | 'busy' | 'away';
  notes?: string;
}

interface ResellerAgentsStore {
  agents: ResellerAgent[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  statusFilter: string;
  departmentFilter: string;

  // Actions
  fetchAgents: () => Promise<void>;
  createAgent: (data: CreateAgentData) => Promise<ResellerAgent>;
  updateAgent: (data: UpdateAgentData) => Promise<ResellerAgent>;
  deleteAgent: (id: string) => Promise<void>;
  
  // Filters
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setDepartmentFilter: (department: string) => void;
  getFilteredAgents: () => ResellerAgent[];
  getAgentStats: () => {
    total: number;
    online: number;
    offline: number;
    busy: number;
    away: number;
    totalCallsToday: number;
    avgCallTime: string;
  };
}

// Mock data
const mockAgents: ResellerAgent[] = [
  {
    id: '1',
    name: 'Maria Silva',
    email: 'maria.silva@empresa.com',
    extension: '1001',
    callerId: '11987654321',
    status: 'online',
    department: 'Vendas',
    skills: ['Vendas', 'Atendimento', 'Suporte'],
    callsToday: 15,
    avgCallTime: '4:32',
    lastActivity: new Date().toISOString().split('T')[0],
    joinDate: '2024-01-15',
    notes: 'Agente experiente em vendas'
  },
  {
    id: '2',
    name: 'João Santos',
    email: 'joao.santos@empresa.com',
    extension: '1002',
    callerId: '11987654322',
    status: 'busy',
    department: 'Suporte',
    skills: ['Suporte Técnico', 'Resolução de Problemas'],
    callsToday: 23,
    avgCallTime: '6:15',
    lastActivity: new Date().toISOString().split('T')[0],
    joinDate: '2024-02-10',
    notes: 'Especialista em suporte técnico'
  },
  {
    id: '3',
    name: 'Ana Costa',
    email: 'ana.costa@empresa.com',
    extension: '1003',
    callerId: '11987654323',
    status: 'away',
    department: 'Atendimento',
    skills: ['Atendimento ao Cliente', 'Relacionamento'],
    callsToday: 8,
    avgCallTime: '3:45',
    lastActivity: new Date().toISOString().split('T')[0],
    joinDate: '2024-03-05',
    notes: 'Foco em relacionamento com cliente'
  },
  {
    id: '4',
    name: 'Carlos Oliveira',
    email: 'carlos.oliveira@empresa.com',
    extension: '1004',
    callerId: '11987654324',
    status: 'offline',
    department: 'Vendas',
    skills: ['Vendas Corporativas', 'Negociação'],
    callsToday: 0,
    avgCallTime: '5:20',
    lastActivity: '2024-01-30',
    joinDate: '2023-12-01',
    notes: 'Especialista em vendas corporativas'
  },
  {
    id: '5',
    name: 'Fernanda Lima',
    email: 'fernanda.lima@empresa.com',
    extension: '1005',
    callerId: '11987654325',
    status: 'online',
    department: 'Suporte',
    skills: ['Suporte Avançado', 'Treinamento'],
    callsToday: 12,
    avgCallTime: '7:10',
    lastActivity: new Date().toISOString().split('T')[0],
    joinDate: '2024-01-20',
    notes: 'Responsável por treinamentos'
  }
];

export const useResellerAgentsStore = create<ResellerAgentsStore>()(
  persist(
    (set, get) => ({
      agents: mockAgents,
      isLoading: false,
      error: null,
      searchTerm: '',
      statusFilter: 'all',
      departmentFilter: 'all',

      fetchAgents: async () => {
        // Dados já carregados estaticamente para performance máxima
        // Sem delay artificial conforme otimização solicitada
        set({ isLoading: false, error: null });
      },

      createAgent: async (data: CreateAgentData) => {
        try {
          const newAgent: ResellerAgent = {
            id: Math.random().toString(36).substr(2, 9),
            ...data,
            status: 'offline',
            callsToday: 0,
            avgCallTime: '0:00',
            lastActivity: new Date().toISOString().split('T')[0],
            joinDate: new Date().toISOString().split('T')[0]
          };

          set(state => ({
            agents: [...state.agents, newAgent],
            isLoading: false,
            error: null
          }));

          return newAgent;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao criar agente' 
          });
          throw error;
        }
      },

      updateAgent: async (data: UpdateAgentData) => {
        try {
          const { id, ...updateData } = data;
          
          set(state => ({
            agents: state.agents.map(agent => 
              agent.id === id 
                ? { ...agent, ...updateData, lastActivity: new Date().toISOString().split('T')[0] }
                : agent
            ),
            isLoading: false,
            error: null
          }));

          const updatedAgent = get().agents.find(a => a.id === id);
          if (!updatedAgent) throw new Error('Agente não encontrado');
          
          return updatedAgent;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao atualizar agente' 
          });
          throw error;
        }
      },

      deleteAgent: async (id: string) => {
        try {
          set(state => ({
            agents: state.agents.filter(agent => agent.id !== id),
            isLoading: false,
            error: null
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao excluir agente' 
          });
          throw error;
        }
      },

      setSearchTerm: (term: string) => set({ searchTerm: term }),
      setStatusFilter: (status: string) => set({ statusFilter: status }),
      setDepartmentFilter: (department: string) => set({ departmentFilter: department }),

      getFilteredAgents: () => {
        const { agents, searchTerm, statusFilter, departmentFilter } = get();
        
        return agents.filter(agent => {
          const matchesSearch = !searchTerm || 
            agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.extension.includes(searchTerm) ||
            agent.department.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
          const matchesDepartment = departmentFilter === 'all' || agent.department === departmentFilter;
          
          return matchesSearch && matchesStatus && matchesDepartment;
        });
      },

      getAgentStats: () => {
        const { agents } = get();
        
        const stats = agents.reduce((acc, agent) => {
          acc.total++;
          acc[agent.status]++;
          acc.totalCallsToday += agent.callsToday;
          return acc;
        }, {
          total: 0,
          online: 0,
          offline: 0,
          busy: 0,
          away: 0,
          totalCallsToday: 0
        });

        // Calcular tempo médio de chamada
        const totalSeconds = agents.reduce((acc, agent) => {
          const [minutes, seconds] = agent.avgCallTime.split(':').map(Number);
          return acc + (minutes * 60) + seconds;
        }, 0);
        
        const avgSeconds = agents.length > 0 ? Math.round(totalSeconds / agents.length) : 0;
        const avgMinutes = Math.floor(avgSeconds / 60);
        const remainingSeconds = avgSeconds % 60;
        
        return {
          ...stats,
          avgCallTime: `${avgMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
        };
      }
    }),
    {
      name: 'reseller-agents-store',
      partialize: (state) => ({ 
        agents: state.agents,
        searchTerm: state.searchTerm,
        statusFilter: state.statusFilter,
        departmentFilter: state.departmentFilter
      })
    }
  )
);
