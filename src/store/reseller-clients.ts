import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: string;
  agents: number;
  status: 'active' | 'inactive' | 'pending';
  credits: number;
  joinDate: string;
  lastActivity: string;
  notes?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface CreateClientData {
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: string;
  notes?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface UpdateClientData extends Partial<CreateClientData> {
  id: string;
  status?: 'active' | 'inactive' | 'pending';
  credits?: number;
}

interface ResellerClientsStore {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchClients: () => Promise<void>;
  createClient: (data: CreateClientData) => Promise<Client>;
  updateClient: (data: UpdateClientData) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  addCredits: (id: string, amount: number, note?: string) => Promise<void>;
  
  // Filters and search
  searchTerm: string;
  statusFilter: string;
  planFilter: string;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setPlanFilter: (plan: string) => void;
  
  // Getters
  getFilteredClients: () => Client[];
  getClientById: (id: string) => Client | undefined;
  getClientStats: () => {
    total: number;
    active: number;
    pending: number;
    inactive: number;
    totalCredits: number;
  };
}

// Mock data inicial
const initialClients: Client[] = [
  {
    id: '1',
    name: 'João Silva',
    company: 'Tech Solutions Ltda',
    email: 'joao@techsolutions.com',
    phone: '(11) 98765-4321',
    plan: 'Premium',
    agents: 8,
    status: 'active',
    credits: 1250.00,
    joinDate: '2024-01-15',
    lastActivity: '2024-01-20',
    notes: 'Cliente premium com bom histórico de pagamentos',
    address: {
      street: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567'
    }
  },
  {
    id: '2',
    name: 'Maria Santos',
    company: 'Consultoria Pro',
    email: 'maria@consultoriapro.com',
    phone: '(11) 97654-3210',
    plan: 'Business',
    agents: 5,
    status: 'active',
    credits: 850.00,
    joinDate: '2024-01-12',
    lastActivity: '2024-01-19',
    notes: 'Empresa de consultoria em crescimento',
    address: {
      street: 'Av. Paulista, 456',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100'
    }
  },
  {
    id: '3',
    name: 'Carlos Oliveira',
    company: 'StartUp Inovação',
    email: 'carlos@startup.com',
    phone: '(11) 96543-2109',
    plan: 'Starter',
    agents: 3,
    status: 'pending',
    credits: 200.00,
    joinDate: '2024-01-10',
    lastActivity: '2024-01-18',
    notes: 'Startup em fase inicial, acompanhar crescimento',
    address: {
      street: 'Rua da Inovação, 789',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-890'
    }
  },
  {
    id: '4',
    name: 'Ana Costa',
    company: 'Vendas & Marketing',
    email: 'ana@vendasmarketing.com',
    phone: '(11) 95432-1098',
    plan: 'Premium',
    agents: 12,
    status: 'active',
    credits: 2100.00,
    joinDate: '2024-01-08',
    lastActivity: '2024-01-20',
    notes: 'Maior cliente, excelente relacionamento'
  },
  {
    id: '5',
    name: 'Roberto Lima',
    company: 'Empresa ABC',
    email: 'roberto@empresaabc.com',
    phone: '(11) 94321-0987',
    plan: 'Business',
    agents: 6,
    status: 'inactive',
    credits: 0.00,
    joinDate: '2024-01-05',
    lastActivity: '2024-01-15',
    notes: 'Cliente inativo, verificar motivo'
  }
];

export const useResellerClientsStore = create<ResellerClientsStore>()(
  persist(
    (set, get) => ({
      clients: initialClients,
      isLoading: false,
      error: null,
      searchTerm: '',
      statusFilter: 'all',
      planFilter: 'all',

      fetchClients: async () => {
        // Dados já carregados estaticamente para performance máxima
        // Sem delay artificial conforme otimização solicitada
        set({ isLoading: false, error: null });
      },

      createClient: async (data: CreateClientData) => {
        try {
          const newClient: Client = {
            id: Math.random().toString(36).substr(2, 9),
            ...data,
            agents: 0,
            status: 'pending',
            credits: 0,
            joinDate: new Date().toISOString().split('T')[0],
            lastActivity: new Date().toISOString().split('T')[0]
          };

          set(state => ({
            clients: [...state.clients, newClient],
            isLoading: false,
            error: null
          }));

          return newClient;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao criar cliente' 
          });
          throw error;
        }
      },

      updateClient: async (data: UpdateClientData) => {
        try {
          const { id, ...updateData } = data;
          
          set(state => ({
            clients: state.clients.map(client => 
              client.id === id 
                ? { ...client, ...updateData, lastActivity: new Date().toISOString().split('T')[0] }
                : client
            ),
            isLoading: false,
            error: null
          }));

          const updatedClient = get().clients.find(c => c.id === id);
          if (!updatedClient) throw new Error('Cliente não encontrado');
          
          return updatedClient;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao atualizar cliente' 
          });
          throw error;
        }
      },

      deleteClient: async (id: string) => {
        try {
          set(state => ({
            clients: state.clients.filter(client => client.id !== id),
            isLoading: false,
            error: null
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao excluir cliente' 
          });
          throw error;
        }
      },

      addCredits: async (id: string, amount: number, note?: string) => {
        try {
          set(state => ({
            clients: state.clients.map(client => 
              client.id === id 
                ? { 
                    ...client, 
                    credits: client.credits + amount,
                    lastActivity: new Date().toISOString().split('T')[0],
                    notes: note ? `${client.notes || ''}\n[${new Date().toLocaleDateString()}] Crédito adicionado: R$ ${amount.toFixed(2)} - ${note}` : client.notes
                  }
                : client
            ),
            isLoading: false,
            error: null
          }));
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Erro ao adicionar créditos' 
          });
          throw error;
        }
      },

      setSearchTerm: (term: string) => set({ searchTerm: term }),
      setStatusFilter: (status: string) => set({ statusFilter: status }),
      setPlanFilter: (plan: string) => set({ planFilter: plan }),

      getFilteredClients: () => {
        const { clients, searchTerm, statusFilter, planFilter } = get();
        
        return clients.filter(client => {
          const matchesSearch = searchTerm === '' || 
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email.toLowerCase().includes(searchTerm.toLowerCase());
            
          const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
          const matchesPlan = planFilter === 'all' || client.plan.toLowerCase() === planFilter.toLowerCase();
          
          return matchesSearch && matchesStatus && matchesPlan;
        });
      },

      getClientById: (id: string) => {
        return get().clients.find(client => client.id === id);
      },

      getClientStats: () => {
        const { clients } = get();
        
        return {
          total: clients.length,
          active: clients.filter(c => c.status === 'active').length,
          pending: clients.filter(c => c.status === 'pending').length,
          inactive: clients.filter(c => c.status === 'inactive').length,
          totalCredits: clients.reduce((sum, c) => sum + c.credits, 0)
        };
      }
    }),
    {
      name: 'reseller-clients-storage',
      partialize: (state) => ({
        clients: state.clients,
        searchTerm: state.searchTerm,
        statusFilter: state.statusFilter,
        planFilter: state.planFilter
      })
    }
  )
);
