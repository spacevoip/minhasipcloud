/**
 * SERVIÇO DE PLANOS REAL - BACKEND SUPABASE
 * Este arquivo contém as funções para gerenciar planos reais
 */

import { Plan } from '@/types';
import { logger } from '@/lib/logger';

// =====================================================
// CONFIGURAÇÃO DA API REAL
// =====================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Interface para resposta da API
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown[];
}

// Requisições para a API v2 com retry logic
async function apiRequestV2<T>(
  endpoint: string,
  options: RequestInit = {},
  retries: number = 2
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken') || '')
        : '';

      // Guard: não tente chamar API protegida sem token
      if (!token) {
        throw new Error('Não autenticado: token ausente');
      }
      
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...config,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // tentar extrair JSON de erro
        try {
          const data = await response.json();
          throw new Error((data && (data.message || data.error || 'Erro desconhecido')) || `Erro HTTP ${response.status}`);
        } catch {
          throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      lastError = error;
      
      // Se é o último retry ou erro não relacionado a timeout/rede, propagar imediatamente
      if (attempt === retries || 
          (err?.name !== 'AbortError' && !err?.message?.includes('Failed to fetch') && err?.name !== 'TypeError')) {
        
        // Log apenas para erros críticos (timeout, backend down)
        if (err?.name === 'AbortError') {
          logger.warn('⚠️ Timeout na API v2:', endpoint);
          throw new Error('Timeout: Backend não respondeu em 15 segundos');
        }
        if ((err?.message && err.message.includes('Failed to fetch')) || err?.name === 'TypeError') {
          logger.warn('⚠️ Backend indisponível:', endpoint);
          throw new Error('Backend indisponível: Verifique se o servidor está rodando');
        }
        
        // Para 403/404, apenas propagar sem log vermelho
        throw error;
      }
      
      // Aguardar antes do próximo retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError;
}

// Resposta de listagem v2 com paginação
interface V2ListResponse<T> {
  success: boolean;
  countsIncluded?: boolean;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  data: T[];
}

// Resposta de detalhe v2
interface V2DetailResponse<T> {
  success: boolean;
  data?: T;
}

// Interface para plano do backend (Supabase) - baseada na resposta real da API
interface BackendPlan {
  id: string;
  name: string;
  price: number;
  maxAgents: number;
  periodDays: number;
  features: string[];
  description: string;
  status: 'active' | 'inactive';
  createdBy?: string;
  resellerId?: string;
  createdAt: string;
  updatedAt: string;
  userCount?: number; // Contagem de usuários retornada pela API
  calls_unlimited?: boolean; // Campo do banco de dados
  max_concurrent_calls?: number; // Campo do banco de dados
}

// Função para converter plano do backend para o formato do frontend
function convertBackendPlan(backendPlan: BackendPlan): Plan {
  // Validação defensiva para evitar erros
  if (!backendPlan) {
    logger.error('❌ backendPlan está undefined ou null');
    throw new Error('Dados do plano inválidos');
  }
  
  if (!backendPlan.name) {
    logger.error('❌ backendPlan.name está undefined:', backendPlan);
    throw new Error('Nome do plano não encontrado');
  }
  
  const planName = backendPlan.name || 'Plano Sem Nome';
  
  return {
    id: backendPlan.id,
    name: planName,
    slug: planName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), // Gerar slug a partir do nome
    price: backendPlan.price || 0,
    currency: 'BRL', // Padrão para o sistema PABX
    maxAgents: backendPlan.maxAgents || 0,
    periodDays: backendPlan.periodDays || 30,
    callsUnlimited: backendPlan.calls_unlimited !== false, // Usar valor real do banco
    maxConcurrentCalls: backendPlan.max_concurrent_calls || backendPlan.maxAgents, // Usar valor do banco ou fallback para maxAgents
    description: backendPlan.description || '',
    shortDescription: backendPlan.description?.substring(0, 100) || '',
    isPopular: planName.toLowerCase().includes('premium'), // Premium é popular
    isFeatured: planName.toLowerCase().includes('exclusive'), // Exclusive é featured
    color: getColorByPlanName(planName),
    icon: getIconByPlanName(planName),
    displayOrder: getDisplayOrderByPlanName(planName),
    status: backendPlan.status || 'active',
    visibility: 'public' as const,
    subscribersCount: backendPlan.userCount || 0,
    trialDays: 0, // Sem trial por padrão
    setupFee: 0, // Sem taxa de setup por padrão
    maxStorageGb: 10, // 10GB padrão
    recordingEnabled: true, // Gravação habilitada por padrão
    apiAccess: true, // API habilitada por padrão
    prioritySupport: backendPlan.name.toLowerCase().includes('exclusive'), // Apenas Exclusive tem suporte prioritário
    createdBy: backendPlan.createdBy,
    resellerId: backendPlan.resellerId,
    createdAt: backendPlan.createdAt,
    updatedAt: backendPlan.updatedAt,
    features: backendPlan.features || [],
    metadata: {}
  };
}

// Funções auxiliares para mapear dados baseados no nome do plano
function getColorByPlanName(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('basico')) return '#10b981'; // Verde
  if (lowerName.includes('premium')) return '#3b82f6'; // Azul
  if (lowerName.includes('exclusive')) return '#8b5cf6'; // Roxo
  return '#6b7280'; // Cinza padrão
}

function getIconByPlanName(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('basico')) return 'package';
  if (lowerName.includes('premium')) return 'star';
  if (lowerName.includes('exclusive')) return 'crown';
  return 'package';
}

function getDisplayOrderByPlanName(name: string): number {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('basico')) return 1;
  if (lowerName.includes('premium')) return 2;
  if (lowerName.includes('exclusive')) return 3;
  return 99;
}

// Função para fazer requisições HTTP com fallback robusto
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    // Verificar se a URL está acessível
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...config,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Se o servidor retornou erro HTTP, tentar parsear a resposta
      try {
        const data = await response.json();
        throw new Error(data.message || `Erro HTTP ${response.status}`);
      } catch {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();
    return data;
    
  } catch (error: unknown) {
    // Log detalhado do erro para debug
    const err = error as { name?: string; message?: string };
    logger.error('🔴 Erro na API de Planos:', {
      endpoint,
      error: err?.message || String(error),
      type: err?.name,
      url: `${API_BASE_URL}${endpoint}`
    });
    
    // Verificar se é erro de rede/conexão
    if (err?.name === 'AbortError') {
      throw new Error('Timeout: Backend não respondeu em 15 segundos');
    }
    
    if ((err?.message && err.message.includes('Failed to fetch')) || err?.name === 'TypeError') {
      throw new Error('Backend indisponível: Verifique se o servidor está rodando');
    }
    
    throw error;
  }
}

// =====================================================
// SERVIÇO DE PLANOS REAL
// =====================================================

export const plansService = {
  // Buscar todos os planos
  async getAllPlans(): Promise<Plan[]> {
    try {
      logger.info('🔄 Buscando todos os planos...');
      
      const response = await apiRequestV2<V2ListResponse<BackendPlan>>('/api/v2/plans');
      
      // Verificar se a resposta tem a estrutura correta
      if (response.success && response.data && Array.isArray(response.data)) {
        const plans = response.data.map(convertBackendPlan) as Plan[];
        logger.info('✅ Planos carregados:', plans.length);
        return plans;
      }
      
      logger.warn('⚠️ Resposta da API inválida ou vazia');
      return [];
    } catch (error) {
      logger.error('❌ Erro ao buscar planos:', error);
      
      // Fallback gracioso: retornar array vazio ao invés de propagar erro
      if (error instanceof Error && error.message.includes('Timeout')) {
        logger.warn('⚠️ Timeout ao buscar planos - retornando lista vazia temporariamente');
        return [];
      }
      
      throw error;
    }
  },

  // Buscar planos ativos com fallback gracioso
  async getActivePlans(): Promise<Plan[]> {
    try {
      logger.info('🔄 Buscando planos ativos...');
      
      const response = await apiRequestV2<V2ListResponse<BackendPlan>>('/api/v2/plans/active');
      
      if (response.success && response.data) {
        const plans = response.data.map(convertBackendPlan) as Plan[];
        logger.info('✅ Planos ativos carregados:', plans.length);
        return plans;
      }
      
      return [];
    } catch (error) {
      logger.error('❌ Erro ao buscar planos ativos:', error);
      
      // Fallback gracioso para timeout
      if (error instanceof Error && error.message.includes('Timeout')) {
        logger.warn('⚠️ Timeout ao buscar planos ativos - retornando lista vazia temporariamente');
        return [];
      }
      
      throw error;
    }
  },

  // Buscar plano por ID
  async getPlanById(id: string): Promise<Plan | null> {
    try {
      logger.info('🔄 Buscando plano por ID:', id);
      
      // Guard: evitar request se não houver token no cliente
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token') || localStorage.getItem('jwt') || localStorage.getItem('authToken');
        if (!token) {
          logger.warn('⚠️ Token ausente ao buscar plano por ID - retornando null');
          return null;
        }
      }

      const response = await apiRequestV2<V2DetailResponse<BackendPlan>>(`/api/v2/plans/${id}`);
      
      if (response.success && response.data) {
        const plan = convertBackendPlan(response.data);
        logger.info('✅ Plano encontrado:', plan.name);
        return plan;
      }
      
      return null;
    } catch (error: any) {
      // Se for 403/404, usuário não tem acesso ao plano ou plano não existe
      if (error?.message?.includes('403') || error?.message?.includes('404')) {
        logger.warn('⚠️ Plano não encontrado ou sem permissão - retornando null');
        return null;
      }
      
      // Para outros erros, logar mas retornar null ao invés de propagar
      logger.warn('⚠️ Erro ao buscar plano (retornando null):', error?.message || error);
      return null;
    }
  },

  // Buscar planos públicos (para seleção de usuários)
  async getPublicPlans(): Promise<Plan[]> {
    try {
      logger.info('🔄 Buscando planos públicos...');
      
      const response = await apiRequestV2<V2ListResponse<BackendPlan>>('/api/v2/plans/active');
      
      if (response.success && response.data) {
        const plans = response.data
          .map(convertBackendPlan)
          .sort((a: Plan, b: Plan) => a.displayOrder - b.displayOrder);
        logger.info('✅ Planos públicos carregados:', plans.length);
        return plans;
      }
      
      return [];
    } catch (error) {
      logger.error('❌ Erro ao buscar planos públicos:', error);
      throw error;
    }
  },

  // Buscar planos de um revendedor
  async getResellerPlans(resellerId: string): Promise<Plan[]> {
    try {
      logger.info('🔄 Buscando planos do revendedor:', resellerId);
      
      const response = await apiRequestV2<V2ListResponse<BackendPlan>>(`/api/v2/plans?reseller_id=${resellerId}`);
      
      if (response.success && response.data) {
        const plans = response.data.map(convertBackendPlan) as Plan[];
        logger.info('✅ Planos do revendedor carregados:', plans.length);
        return plans;
      }
      
      return [];
    } catch (error) {
      logger.error('❌ Erro ao buscar planos do revendedor:', error);
      throw error;
    }
  },

  // Criar plano via backend v2 (RBAC e ownership no servidor)
  async createPlan(planData: Partial<Plan>): Promise<Plan> {
    try {
      logger.info('🛡️ [BACKEND V2] Criando plano via API segura:', planData.name);

      const response = await apiRequestV2<V2DetailResponse<BackendPlan>>(`/api/v2/plans`, {
        method: 'POST',
        body: JSON.stringify(planData)
      });

      if (response.success && response.data) {
        const plan = convertBackendPlan(response.data);
        logger.info('✅ Plano criado com sucesso:', plan.name);
        return plan;
      }
      
      throw new Error('Erro ao criar plano');
      
    } catch (error) {
      logger.error('❌ [SECURE FRONTEND] Erro na criação segura:', error);
      throw error;
    }
  },

  // Atualizar plano
  async updatePlan(id: string, planData: Partial<Plan>): Promise<Plan> {
    try {
      logger.info('🔄 Atualizando plano:', id);
      
      const response = await apiRequestV2<V2DetailResponse<BackendPlan>>(`/api/v2/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(planData)
      });
      
      if (response.success && response.data) {
        const plan = convertBackendPlan(response.data);
        logger.info('✅ Plano atualizado com sucesso:', plan.name);
        return plan;
      }
      
      throw new Error('Erro ao atualizar plano');
    } catch (error) {
      logger.error('❌ Erro ao atualizar plano:', error);
      throw error;
    }
  },

  // Excluir plano
  async deletePlan(id: string): Promise<boolean> {
    try {
      logger.info('🔄 Excluindo plano:', id);
      
      const response = await apiRequestV2<{ success: boolean }>(`/api/v2/plans/${id}`, {
        method: 'DELETE'
      });
      
      if (response && response.success) {
        logger.info('✅ Plano excluído com sucesso');
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('❌ Erro ao excluir plano:', error);
      throw error;
    }
  },

  // Buscar estatísticas de planos
  async getPlansStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    totalSubscribers: number;
    totalRevenue: number;
  }> {
    try {
      logger.info('🔄 Buscando estatísticas de planos...');
      // v2 endpoint retorna { success, data: { ... } }
      const response = await apiRequestV2<{ success: boolean; data?: {
        total: number;
        active: number;
        inactive: number;
        total_subscribers: number;
        total_revenue: number;
      } }>("/api/v2/plans/stats");

      if (response && (response as any).success && (response as any).data) {
        const data = (response as any).data as {
          total: number;
          active: number;
          inactive: number;
          total_subscribers: number;
          total_revenue: number;
        };
        const stats = {
          total: data.total,
          active: data.active,
          inactive: data.inactive,
          totalSubscribers: data.total_subscribers,
          totalRevenue: data.total_revenue
        };
        logger.info('✅ Estatísticas carregadas (v2):', stats);
        return stats;
      }
      
      return {
        total: 0,
        active: 0,
        inactive: 0,
        totalSubscribers: 0,
        totalRevenue: 0
      };
    } catch (error) {
      logger.error('❌ Erro ao buscar estatísticas:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        totalSubscribers: 0,
        totalRevenue: 0
      };
    }
  }
};

// =====================================================
// CACHE E VARIÁVEIS GLOBAIS
// =====================================================

// Cache para evitar múltiplas requisições
let plansCache: { data: Plan[] | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_DURATION = 30000; // 30 segundos
let isLoadingPlans = false;

// =====================================================
// SERVIÇO REAL COM CACHE OTIMIZADO
// =====================================================

export const realPlansService = {
  async getAllPlans(): Promise<Plan[]> {
    // Verificar cache primeiro
    const now = Date.now();
    if (plansCache.data && (now - plansCache.timestamp) < CACHE_DURATION) {
      logger.info('📦 Usando planos do cache (evita requisições excessivas)');
      return plansCache.data;
    }

    // Evitar múltiplas requisições simultâneas
    if (isLoadingPlans) {
      logger.info('⏳ Aguardando requisição em andamento...');
      // Aguardar um pouco e tentar novamente
      await new Promise(resolve => setTimeout(resolve, 100));
      if (plansCache.data) return plansCache.data;
    }

    logger.info('🔄 Buscando planos REAIS do Supabase...');
    isLoadingPlans = true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const apiResponse: V2ListResponse<BackendPlan> = await response.json();
      
      if (!apiResponse.success || !apiResponse.data) {
        throw new Error('Erro ao buscar planos');
      }
      
      // 🛡️ VALIDAÇÃO ROBUSTA: Garantir que data seja um array
      let plansData = apiResponse.data as unknown as BackendPlan[];
      
      // Se data não é um array, pode ser um objeto único ou dados malformados
      if (!Array.isArray(plansData)) {
        logger.warn('⚠️ apiResponse.data não é um array:', typeof plansData, plansData);
        
        // Se é um objeto único, transformar em array
        if (plansData && typeof plansData === 'object') {
          logger.info('🔄 Convertendo objeto único em array');
          plansData = [plansData] as BackendPlan[];
        } else {
          // Se não é nem array nem objeto, usar fallback
          logger.error('❌ Dados inválidos recebidos da API, usando fallback mock');
          throw new Error('Formato de dados inválido recebido da API');
        }
      }
      
      // Validar se o array não está vazio
      if (plansData.length === 0) {
        logger.warn('⚠️ Array de planos está vazio');
      }
      
      const realPlans = plansData.map(convertBackendPlan);
      logger.info('✅ Planos reais carregados:', realPlans.length, 'planos');
      
      // Atualizar cache
      plansCache = { data: realPlans, timestamp: now };
      return realPlans;
      
    } catch (error) {
      logger.error('❌ Erro ao buscar planos reais:', error);
      
      // 🛡️ PROTEÇÃO ADICIONAL: Limpar cache contaminado se necessário
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes('não é um array') || errorMessage?.includes('map is not a function')) {
        logger.info('🧹 Limpando cache contaminado...');
        try {
          await fetch(`${API_BASE_URL}/cache/clear`, { method: 'POST' });
          logger.info('✅ Cache limpo com sucesso');
        } catch (clearError) {
          logger.warn('⚠️ Não foi possível limpar o cache:', clearError);
        }
      }
      
      // Retornar array vazio em caso de erro
      logger.error('❌ Erro ao buscar planos reais - retornando array vazio');
      plansCache = { data: [], timestamp: now };
      return [];
    } finally {
      isLoadingPlans = false;
    }
  },

  async getActivePlans(): Promise<Plan[]> {
    const allPlans = await this.getAllPlans();
    return allPlans.filter((p: Plan) => p.status === 'active');
  },

  async getPlanById(id: string): Promise<Plan | null> {
    logger.info(`🔍 Buscando plano real por ID: ${id}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/plans/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const apiResponse: V2DetailResponse<BackendPlan> = await response.json();
      
      if (!apiResponse.success || !apiResponse.data) {
        return null;
      }
      const realPlan = convertBackendPlan(apiResponse.data as BackendPlan);
      logger.info('✅ Plano real encontrado:', realPlan.name);
      return realPlan;
      
    } catch (error) {
      logger.error(`❌ Erro ao buscar plano ${id}:`, error);
      throw error;
    }
  },

  async getPublicPlans(): Promise<Plan[]> {
    const allPlans = await this.getAllPlans();
    return allPlans.filter((p: Plan) => p.visibility === 'public' && p.status === 'active');
  },

  // Método para verificar se o backend está disponível
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },

  // Método para reativar backend quando necessário
  async enableBackend(): Promise<void> {
    logger.info('🔄 Reativando tentativas de conexão com backend...');
    // Implementar lógica para reativar backend quando necessário
  }
};
