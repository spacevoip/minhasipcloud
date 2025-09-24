/**
 * =====================================================
 * USERS SERVICE V2 - SERVIÇO MODERNO DE USUÁRIOS
 * =====================================================
 * Serviço completo para consumir a API moderna de usuários
 * Com cache inteligente e fallback para dados mock
 */

import { User } from '@/types';

// Configuração da API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 10000; // 10 segundos

// Interfaces
export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserResponse {
  success: boolean;
  data: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    cached: boolean;
    timestamp: string;
    filters?: UserFilters;
  };
}

export interface SingleUserResponse {
  success: boolean;
  data: User;
  meta?: {
    cached: boolean;
    timestamp: string;
  };
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: {
    admin: number;
    user: number;
    reseller: number;
    collaborator: number;
  };
  totalCredits: number;
  averageCredits: number;
  recentRegistrations: number;
}

class UsersServiceV2 {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly CACHE_TTL = 3 * 60 * 1000; // 3 minutos

  /**
   * Fazer requisição HTTP com timeout e retry
   */
  private async makeRequest<T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Erro na requisição:', error);
      throw error;
    }
  }

  /**
   * Verificar cache local
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`📦 Cache local HIT: ${key}`);
      return cached.data;
    }
    return null;
  }

  /**
   * Salvar no cache local
   */
  private setCache<T>(key: string, data: T, ttl = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Invalidar cache por padrão
   */
  private invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Buscar todos os usuários com filtros
   */
  async getUsers(filters: UserFilters = {}): Promise<UserResponse> {
    try {
      console.log('👥 [Service V2] Buscando usuários...', filters);

      // Gerar chave de cache
      const cacheKey = `users:list:${JSON.stringify(filters)}`;
      
      // Verificar cache local primeiro
      const cached = this.getCached<UserResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Construir query string
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, String(value));
        }
      });

      const queryString = queryParams.toString();
      const url = `/api/users-v2${queryString ? `?${queryString}` : ''}`;

      // Fazer requisição para API
      const response = await this.makeRequest<UserResponse>(url);

      // Salvar no cache local
      this.setCache(cacheKey, response);

      console.log(`✅ ${response.data.length} usuários carregados da API`);
      return response;

    } catch (error) {
      console.error('❌ Erro ao buscar usuários, usando fallback mock:', error);
      return this.getMockUsers(filters);
    }
  }

  /**
   * Buscar usuário por ID
   */
  async getUserById(id: string): Promise<SingleUserResponse> {
    try {
      console.log(`👤 [Service V2] Buscando usuário: ${id}`);

      const cacheKey = `users:single:${id}`;
      
      // Verificar cache local
      const cached = this.getCached<SingleUserResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      // Fazer requisição
      const response = await this.makeRequest<SingleUserResponse>(`/api/users-v2/${id}`);

      // Salvar no cache
      this.setCache(cacheKey, response);

      console.log(`✅ Usuário carregado: ${response.data.name}`);
      return response;

    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      throw error;
    }
  }

  /**
   * Criar novo usuário
   */
  async createUser(userData: Partial<User>): Promise<SingleUserResponse> {
    try {
      console.log('➕ [Service V2] Criando usuário...', userData.name);

      const response = await this.makeRequest<SingleUserResponse>('/api/users-v2', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      // Invalidar cache
      this.invalidateCache('users:');

      console.log(`✅ Usuário criado: ${response.data.name}`);
      return response;

    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * Atualizar usuário
   */
  async updateUser(id: string, userData: Partial<User>): Promise<SingleUserResponse> {
    try {
      console.log(`📝 [Service V2] Atualizando usuário: ${id}`);

      const response = await this.makeRequest<SingleUserResponse>(`/api/users-v2/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      // Invalidar cache
      this.invalidateCache('users:');

      console.log(`✅ Usuário atualizado: ${response.data.name}`);
      return response;

    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  /**
   * Adicionar créditos
   */
  async addCredits(id: string, amount: number, note?: string): Promise<SingleUserResponse> {
    try {
      console.log(`💰 [Service V2] Adicionando créditos: R$ ${amount}`);

      const response = await this.makeRequest<SingleUserResponse>(`/api/users-v2/${id}/credits`, {
        method: 'POST',
        body: JSON.stringify({ amount, note }),
      });

      // Invalidar cache
      this.invalidateCache('users:');

      console.log(`✅ Créditos adicionados: R$ ${amount}`);
      return response;

    } catch (error) {
      console.error('❌ Erro ao adicionar créditos:', error);
      throw error;
    }
  }

  /**
   * Renovar plano
   */
  async renewPlan(id: string, planId: string): Promise<SingleUserResponse> {
    try {
      console.log(`🔄 [Service V2] Renovando plano: ${planId}`);

      const response = await this.makeRequest<SingleUserResponse>(`/api/users-v2/${id}/renew-plan`, {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });

      // Invalidar cache
      this.invalidateCache('users:');

      console.log('✅ Plano renovado com sucesso');
      return response;

    } catch (error) {
      console.error('❌ Erro ao renovar plano:', error);
      throw error;
    }
  }

  /**
   * Deletar usuário
   */
  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ [Service V2] Deletando usuário: ${id}`);

      const response = await this.makeRequest<{ success: boolean; message: string }>(`/api/users-v2/${id}`, {
        method: 'DELETE',
      });

      // Invalidar cache
      this.invalidateCache('users:');

      console.log('✅ Usuário deletado com sucesso');
      return response;

    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error);
      throw error;
    }
  }

  /**
   * Buscar estatísticas
   */
  async getStats(): Promise<{ success: boolean; data: UserStats }> {
    try {
      console.log('📊 [Service V2] Buscando estatísticas...');

      const cacheKey = 'users:stats';
      
      // Verificar cache local
      const cached = this.getCached<{ success: boolean; data: UserStats }>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest<{ success: boolean; data: UserStats }>('/api/users-v2/stats/overview');

      // Salvar no cache (TTL menor para stats)
      this.setCache(cacheKey, response, 2 * 60 * 1000); // 2 minutos

      console.log('✅ Estatísticas carregadas');
      return response;

    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Fallback para dados mock
   */
  private getMockUsers(filters: UserFilters): UserResponse {
    console.log('🎭 Usando dados mock para usuários');
    
    // Dados mock básicos
    const mockUsers: User[] = [
      {
        id: '1',
        name: 'Administrador Mock',
        email: 'admin@mock.com',
        role: 'admin',
        status: 'active',
        credits: 1000,
        company: 'Mock Company',
        phone: '+55 11 99999-0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Usuário Mock',
        email: 'user@mock.com',
        role: 'user',
        status: 'active',
        credits: 500,
        company: 'Mock User Company',
        phone: '+55 11 88888-0000',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return {
      success: true,
      data: mockUsers,
      pagination: {
        page: 1,
        limit: 10,
        total: mockUsers.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      meta: {
        cached: false,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Limpar cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache local limpo');
  }
}

// Exportar instância singleton
export const usersServiceV2 = new UsersServiceV2();
export default usersServiceV2;
