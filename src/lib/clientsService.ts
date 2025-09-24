// =====================================================
// CLIENTS SERVICE - Gerenciamento de Clientes do Revendedor
// =====================================================
// USANDO SUPABASE DIRETO - Endpoints backend incompletos
// =====================================================

import { userService } from './userService';
import { plansService } from '@/services/plansService';
import { supabase } from './supabase';

// Configuração da API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 10000; // 10 segundos
const __DEV__ = process.env.NODE_ENV !== 'production';
const dlog = (...args: any[]) => { if (__DEV__) console.log(...args); };
const dwarn = (...args: any[]) => { if (__DEV__) console.warn(...args); };

// Interfaces
export interface CreateClientData {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  plan_id: string;
  notes?: string;
  credits?: number;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface UpdateClientData {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  plan_id?: string;
  notes?: string;
  credits?: number;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface ClientData {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  plan_id?: string;
  plan?: string; // Nome do plano
  plan_name?: string; // Alias para compatibilidade
  notes?: string;
  credits: number;
  status: 'active' | 'inactive' | 'suspended';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  plan_expires_at?: string; // Data de expiração do plano
  plan_activated_at?: string; // Data de ativação do plano
  agents?: number; // Limite de agentes do plano
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any[];
}

// Função auxiliar para fazer requisições à API
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return result;

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Erro na requisição API:', error);
    throw error;
  }
}

class ClientsService {
  /**
   * Criar novo cliente vinculado ao revendedor
   */
  async createClient(clientData: CreateClientData): Promise<ClientData> {
    try {
      const currentUser = userService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'reseller') {
        throw new Error('Usuário não autorizado para criar clientes');
      }

      dlog('🔄 [API] Criando cliente via backend para revendedor:', currentUser.id);

      // Chamar API backend para criar cliente
      const response = await apiRequest<any>('/api/users/reseller/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: clientData.name,
          email: clientData.email,
          company: clientData.company,
          phone: clientData.phone,
          plan_id: clientData.plan_id,
          credits: clientData.credits || 0
        })
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao criar cliente');
      }

      const newClient = response.data;
      dlog('✅ [API] Cliente criado com sucesso:', newClient.name);

      // Retornar dados do cliente criado (já inclui plan_expires_at e plan_activated_at)
      return {
        id: newClient.id,
        name: newClient.name,
        company: newClient.company,
        email: newClient.email,
        phone: newClient.phone,
        plan_id: newClient.plan_id,
        notes: clientData.notes,
        credits: newClient.credits,
        status: newClient.status === 'active' ? 'active' : 'inactive',
        created_by: newClient.created_by,
        created_at: newClient.created_at,
        updated_at: newClient.updated_at,
        plan_expires_at: newClient.plan_expires_at,
        plan_activated_at: newClient.plan_activated_at
      };

    } catch (error) {
      console.error('❌ [API] Erro ao criar cliente:', error);
      
      // Fallback mock em caso de erro
      dwarn('⚠️ [FALLBACK] Usando dados mock para criar cliente');
      const currentUser = userService.getCurrentUser();
      const mockClient: ClientData = {
        id: 'mock_' + Date.now(),
        name: clientData.name,
        company: clientData.company,
        email: clientData.email,
        phone: clientData.phone,
        plan_id: clientData.plan_id,
        notes: clientData.notes,
        credits: clientData.credits || 0,
        status: 'active',
        created_by: currentUser?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        plan_activated_at: new Date().toISOString()
      };
      return mockClient;
    }
  }

  /**
   * Buscar clientes do revendedor
   */
  async getResellerClients(): Promise<ClientData[]> {
    try {
      const currentUser = userService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'reseller') {
        throw new Error('Usuário não autorizado');
      }

      dlog('🔄 [SUPABASE] Buscando clientes para revendedor:', currentUser.id);

      // Buscar clientes vinculados a este revendedor via parent_reseller_id
      const { data: clients, error } = await supabase
        .from('users_pabx')
        .select(`
          id,
          name,
          email,
          company,
          phone,
          plan_id,
          credits,
          status,
          created_by,
          created_at,
          updated_at,
          plan_expires_at,
          plan_activated_at
        `)
        .eq('parent_reseller_id', currentUser.id)
        .eq('role', 'user'); // Apenas usuários normais, não outros revendedores

      if (error) {
        console.error('❌ [SUPABASE] Erro ao buscar clientes:', error);
        throw new Error('Erro ao buscar clientes do revendedor');
      }

      dlog(`✅ [SUPABASE] ${clients?.length || 0} clientes encontrados`);

      // Buscar todos os planos para resolver nomes
      let allPlans: any[] = [];
      try {
        dlog('🔄 Buscando planos para resolver nomes...');
        allPlans = await plansService.getAllPlans();
        dlog(`✅ ${allPlans.length} planos carregados para resolução de nomes`);
      } catch (planError) {
        console.error('⚠️ Erro ao carregar planos para resolução de nomes:', planError);
      }

      // Buscar contagem de agentes para cada cliente
      const clientsWithAgents = await Promise.all((clients || []).map(async (client: any) => {
        // Resolver nome do plano
        const plan = allPlans.find(p => p.id === client.plan_id);
        const planName = plan ? plan.name : (client.plan_id ? 'Plano Desconhecido' : 'Sem Plano');
        
        const processedCredits = parseFloat(client.credits || '0');

        // Contar agentes deste cliente específico
        let agentsCount = 0;
        try {
          const { count, error: agentsError } = await supabase
            .from('agentes_pabx')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', client.id);

          if (!agentsError && count !== null) {
            agentsCount = count;
          }
        } catch (agentErr) {
          console.warn('⚠️ Erro ao contar agentes do cliente:', client.id, agentErr);
        }
        
        return {
          id: client.id,
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone,
          plan_id: client.plan_id,
          plan: planName, // Nome do plano resolvido
          plan_name: planName, // Alias para compatibilidade
          credits: processedCredits,
          status: client.status as 'active' | 'inactive',
          created_by: client.created_by,
          created_at: client.created_at,
          updated_at: client.updated_at,
          plan_expires_at: client.plan_expires_at,
          plan_activated_at: client.plan_activated_at,
          agents: agentsCount // Contagem real de agentes
        };
      }));
      
      const mappedClients = clientsWithAgents;
      
      dlog(`🔍 Debug - Total de clientes mapeados: ${mappedClients.length}`);
      return mappedClients;

    } catch (error) {
      console.error('❌ [SUPABASE] Erro ao buscar clientes:', error);
      throw error;
    }
  }

  /**
   * Atualizar cliente
   */
  async updateClient(clientId: string, updates: UpdateClientData): Promise<ClientData> {
    try {
      const currentUser = userService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'reseller') {
        throw new Error('Usuário não autorizado');
      }

      dlog('🔄 [API] Atualizando cliente via backend:', clientId);

      // Chamar API backend para atualizar cliente
      const response = await apiRequest<any>(`/api/users/reseller/clients/${clientId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao atualizar cliente');
      }

      const updatedClient = response.data;
      dlog('✅ [API] Cliente atualizado com sucesso:', updatedClient.name);

      return {
        id: updatedClient.id,
        name: updatedClient.name,
        company: updatedClient.company,
        email: updatedClient.email,
        phone: updatedClient.phone,
        plan_id: updatedClient.plan_id,
        credits: updatedClient.credits || 0,
        status: updatedClient.status || 'active',
        created_by: updatedClient.created_by,
        created_at: updatedClient.created_at,
        updated_at: updatedClient.updated_at,
        plan_expires_at: updatedClient.plan_expires_at,
        plan_activated_at: updatedClient.plan_activated_at
      };

    } catch (error) {
      console.error('❌ [API] Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  /**
   * Adicionar créditos ao cliente
   */
  async addCredits(clientId: string, amount: number, note?: string): Promise<void> {
    try {
      const currentUser = userService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'reseller') {
        throw new Error('Usuário não autorizado');
      }

      dlog('🔄 [API] Adicionando créditos via backend:', clientId, amount);

      // Chamar API backend para adicionar créditos
      const response = await apiRequest<any>(`/api/users/reseller/clients/${clientId}/credits`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: amount,
          note: note || ''
        })
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao adicionar créditos');
      }

      dlog('✅ [API] Créditos adicionados com sucesso:', response.data);

    } catch (error) {
      console.error('❌ [API] Erro ao adicionar créditos:', error);
      throw error; // Propagar erro ao invés de usar fallback mock
    }
  }

  /**
   * Excluir cliente
   */
  async deleteClient(clientId: string): Promise<void> {
    try {
      const currentUser = userService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'reseller') {
        throw new Error('Usuário não autorizado');
      }

      dlog('🔄 [API] Excluindo cliente via backend:', clientId);

      // Chamar API backend para excluir cliente
      const response = await apiRequest<any>(`/api/users/reseller/clients/${clientId}`, {
        method: 'DELETE'
      });

      if (!response.success) {
        throw new Error(response.error || 'Erro ao excluir cliente');
      }

      dlog('✅ [API] Cliente excluído com sucesso');

    } catch (error) {
      console.error('❌ [API] Erro ao excluir cliente:', error);
      throw error; // Propagar erro ao invés de usar fallback mock
    }
  }

  /**
   * Buscar estatísticas dos clientes do revendedor
   */
  async getClientStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalCredits: number;
  }> {
    try {
      const clients = await this.getResellerClients();
      
      return {
        total: clients.length,
        active: clients.filter(c => c.status === 'active').length,
        inactive: clients.filter(c => c.status === 'inactive').length,
        totalCredits: clients.reduce((sum, c) => sum + (c.credits || 0), 0)
      };

    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return { total: 0, active: 0, inactive: 0, totalCredits: 0 };
    }
  }

  /**
   * Contar total de agentes dos clientes do revendedor
   */
  async getResellerAgentsCount(): Promise<number> {
    try {
      const currentUser = userService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'reseller') {
        throw new Error('Usuário não autorizado');
      }

      dlog('🔄 [SUPABASE] Contando agentes dos clientes do revendedor:', currentUser.id);

      // Primeiro, buscar IDs dos clientes do revendedor
      const { data: clients, error: clientsError } = await supabase
        .from('users_pabx')
        .select('id')
        .eq('parent_reseller_id', currentUser.id)
        .eq('role', 'user');

      if (clientsError) {
        console.error('❌ [SUPABASE] Erro ao buscar clientes para contagem de agentes:', clientsError);
        return 0;
      }

      if (!clients || clients.length === 0) {
        dlog('ℹ️ Revendedor não possui clientes');
        return 0;
      }

      const clientIds = clients.map(c => c.id);
      dlog(`🔍 Contando agentes para ${clientIds.length} clientes`);

      // Contar agentes de todos os clientes
      const { count, error: agentsError } = await supabase
        .from('agentes_pabx')
        .select('*', { count: 'exact', head: true })
        .in('user_id', clientIds);

      if (agentsError) {
        console.error('❌ [SUPABASE] Erro ao contar agentes:', agentsError);
        return 0;
      }

      const totalAgents = count || 0;
      dlog(`✅ [SUPABASE] Total de agentes encontrados: ${totalAgents}`);
      
      return totalAgents;

    } catch (error) {
      console.error('❌ [SUPABASE] Erro ao contar agentes do revendedor:', error);
      return 0;
    }
  }
}

export const clientsService = new ClientsService();
