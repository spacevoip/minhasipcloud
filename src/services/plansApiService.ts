/**
 * PLANS API SERVICE - Substituição do acesso direto ao Supabase
 * ============================================================
 * Centraliza todas as chamadas para a API de planos
 */

import { authService } from '@/lib/auth';
import { errorHandler } from '@/lib/errorHandler';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiPlan {
  id: string;
  name: string;
  price: number;
  maxAgents: number;
  periodDays: number;
  features: string[];
  status: 'active' | 'inactive';
  created_by?: string;
  userCount?: number;
  created_at: string;
  updated_at: string;
}

class PlansApiService {
  private getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Buscar todos os planos (com filtros para revendedor)
   */
  async getAllPlans(params: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive';
  } = {}): Promise<{
    plans: ApiPlan[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.status) queryParams.set('status', params.status);

      const response = await fetch(`${API_BASE_URL}/api/v2/plans?${queryParams}`, {
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
        plans: result.data || [],
        total: result.total || 0,
        page: result.page || 1,
        totalPages: result.totalPages || 1
      };
    } catch (error) {
      errorHandler.handle(error, {
        component: 'PlansApiService',
        action: 'getAllPlans'
      });
      
      return {
        plans: [],
        total: 0,
        page: 1,
        totalPages: 1
      };
    }
  }

  /**
   * Buscar apenas planos ativos
   */
  async getActivePlans(): Promise<ApiPlan[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans/active`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data || [] : [];
    } catch (error) {
      errorHandler.handle(error, {
        component: 'PlansApiService',
        action: 'getActivePlans'
      });
      return [];
    }
  }

  /**
   * Buscar plano por ID
   */
  async getPlanById(id: string): Promise<ApiPlan | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans/${id}`, {
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
        component: 'PlansApiService',
        action: 'getPlanById'
      });
      return null;
    }
  }

  /**
   * Criar plano
   */
  async createPlan(planData: {
    name: string;
    price: number;
    maxAgents: number;
    periodDays: number;
    features: string[];
    status?: 'active' | 'inactive';
  }): Promise<ApiPlan | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'PlansApiService',
        action: 'createPlan'
      });
      return null;
    }
  }

  /**
   * Atualizar plano
   */
  async updatePlan(id: string, planData: Partial<ApiPlan>): Promise<ApiPlan | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(planData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      errorHandler.handle(error, {
        component: 'PlansApiService',
        action: 'updatePlan'
      });
      return null;
    }
  }

  /**
   * Excluir plano
   */
  async deletePlan(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans/${id}`, {
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
        component: 'PlansApiService',
        action: 'deletePlan'
      });
      return false;
    }
  }

  /**
   * Estatísticas de planos
   */
  async getPlansStats(): Promise<{
    totalPlans: number;
    activePlans: number;
    totalSubscribers: number;
    totalRevenue: number;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans/stats`, {
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

      return result.data || {
        totalPlans: 0,
        activePlans: 0,
        totalSubscribers: 0,
        totalRevenue: 0
      };
    } catch (error) {
      errorHandler.handle(error, {
        component: 'PlansApiService',
        action: 'getPlansStats'
      });
      
      return {
        totalPlans: 0,
        activePlans: 0,
        totalSubscribers: 0,
        totalRevenue: 0
      };
    }
  }
}

export const plansApiService = new PlansApiService();
