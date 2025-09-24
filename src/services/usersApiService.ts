/**
 * USERS API SERVICE - Substituição do acesso direto ao Supabase
 * ============================================================
 * Centraliza todas as chamadas para a API de usuários
 */

import { authService } from '@/lib/auth';
import { errorHandler } from '@/lib/errorHandler';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  company?: string;
  role: 'user' | 'admin' | 'reseller' | 'collaborator';
  status: 'active' | 'inactive' | 'suspended';
  credits: number;
  plan_id?: string;
  plan_name?: string;
  created_at: string;
  updated_at: string;
}

class UsersApiService {
  private getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Buscar usuário por ID
   */
  async getUserById(id: string): Promise<ApiUser | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users-v2/${id}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'UsersApiService',
        action: 'getUserById'
      });
      return null;
    }
  }

  /**
   * Buscar múltiplos usuários por IDs
   */
  async getUsersByIds(ids: string[]): Promise<ApiUser[]> {
    try {
      if (ids.length === 0) return [];

      // Para múltiplos IDs, fazemos chamadas paralelas
      const promises = ids.map(id => this.getUserById(id));
      const results = await Promise.all(promises);
      
      return results.filter(user => user !== null) as ApiUser[];
    } catch (error) {
      errorHandler.handle(error, {
        component: 'UsersApiService',
        action: 'getUsersByIds',
      });
      return [];
    }
  }

  /**
   * Buscar usuários com filtros e paginação
   */
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  } = {}): Promise<{
    users: ApiUser[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.search) queryParams.set('search', params.search);
      if (params.role) queryParams.set('role', params.role);
      if (params.status) queryParams.set('status', params.status);

      const response = await fetch(`${API_BASE_URL}/api/users-v2?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Erro na API');
      }

      return {
        users: result.data || [],
        total: result.total || 0,
        page: result.page || 1,
        totalPages: result.totalPages || 1
      };
    } catch (error) {
      errorHandler.handle(error, {
        component: 'UsersApiService',
        action: 'getUsers',
      });
      
      return {
        users: [],
        total: 0,
        page: 1,
        totalPages: 1
      };
    }
  }

  /**
   * Criar usuário
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    company?: string;
    role?: string;
    phone?: string;
    cpf_cnpj?: string;
  }): Promise<ApiUser | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users-v2`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'UsersApiService',
        action: 'createUser',
      });
      return null;
    }
  }

  /**
   * Atualizar usuário
   */
  async updateUser(id: string, userData: Partial<ApiUser>): Promise<ApiUser | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users-v2/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'UsersApiService',
        action: 'updateUser',
      });
      return null;
    }
  }

  /**
   * Excluir usuário
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users-v2/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'UsersApiService',
        action: 'deleteUser',
      });
      return false;
    }
  }
}

export const usersApiService = new UsersApiService();
