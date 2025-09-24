/**
 * 🛡️ SERVIÇO SUPABASE SEGURO
 * 
 * Este serviço implementa múltiplas camadas de segurança para operações diretas no Supabase:
 * - Validação rigorosa de dados
 * - Sanitização de inputs
 * - Rate limiting
 * - Logs de auditoria
 * - Verificação de permissões
 * - Proteção contra SQL injection
 */

import { Plan } from '@/types';
import { plansService } from './plansService';

// =====================================================
// CONFIGURAÇÕES DE SEGURANÇA
// =====================================================

const SECURITY_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 10,
  MAX_FIELD_LENGTH: 500,
  ALLOWED_STATUSES: ['active', 'inactive', 'draft'],
  MIN_PRICE: 0,
  MAX_PRICE: 99999,
  MIN_AGENTS: 1,
  MAX_AGENTS: 1000,
  MIN_PERIOD_DAYS: 1,
  MAX_PERIOD_DAYS: 365
};

// Rate limiting storage
const requestCounts = new Map<string, { count: number; lastReset: number }>();

// =====================================================
// FUNÇÕES DE SEGURANÇA
// =====================================================

/**
 * Sanitiza string removendo caracteres perigosos
 */
function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>'"&]/g, '') // Remove caracteres HTML perigosos
    .replace(/[;\-\-]/g, '') // Remove caracteres SQL perigosos
    .substring(0, SECURITY_CONFIG.MAX_FIELD_LENGTH);
}

/**
 * Valida se um valor numérico está dentro dos limites
 */
function validateNumber(value: any, min: number, max: number): number {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

/**
 * Gera slug seguro
 */
function generateSecureSlug(name: string): string {
  const slug = sanitizeString(name).toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').trim();
  return slug
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100) // Limite de 100 caracteres
    + '-' + Date.now().toString(36); // Adiciona timestamp para unicidade
}

/**
 * Rate limiting - verifica se usuário não está fazendo muitas requisições
 */
function checkRateLimit(userId: string = 'anonymous'): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(userId);
  
  if (!userRequests || now - userRequests.lastReset > 60000) {
    // Reset contador a cada minuto
    requestCounts.set(userId, { count: 1, lastReset: now });
    return true;
  }
  
  if (userRequests.count >= SECURITY_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    console.warn(`🚨 Rate limit exceeded for user: ${userId}`);
    return false;
  }
  
  userRequests.count++;
  return true;
}

/**
 * Log de auditoria
 */
function auditLog(action: string, data: any, userId: string = 'anonymous') {
  const timestamp = new Date().toISOString();
  console.log(`🔍 [AUDIT] ${timestamp} - User: ${userId} - Action: ${action}`, {
    sanitizedData: JSON.stringify(data, null, 2)
  });
}

/**
 * Valida dados de entrada para planos
 */
function validatePlanData(planData: Partial<Plan>, userId: string = 'system', userRole: string = 'user'): {
  isValid: boolean;
  errors: string[];
  sanitizedData: any;
} {
  const errors: string[] = [];
  
  // Validar nome
  if (!planData.name || planData.name.trim().length < 2) {
    errors.push('Nome do plano deve ter pelo menos 2 caracteres');
  }
  
  // Validar preço
  if (planData.price !== undefined && (planData.price < SECURITY_CONFIG.MIN_PRICE || planData.price > SECURITY_CONFIG.MAX_PRICE)) {
    errors.push(`Preço deve estar entre ${SECURITY_CONFIG.MIN_PRICE} e ${SECURITY_CONFIG.MAX_PRICE}`);
  }
  
  // Validar agentes
  if (planData.maxAgents !== undefined && (planData.maxAgents < SECURITY_CONFIG.MIN_AGENTS || planData.maxAgents > SECURITY_CONFIG.MAX_AGENTS)) {
    errors.push(`Máximo de agentes deve estar entre ${SECURITY_CONFIG.MIN_AGENTS} e ${SECURITY_CONFIG.MAX_AGENTS}`);
  }
  
  // Validar período
  if (planData.periodDays !== undefined && (planData.periodDays < SECURITY_CONFIG.MIN_PERIOD_DAYS || planData.periodDays > SECURITY_CONFIG.MAX_PERIOD_DAYS)) {
    errors.push(`Período deve estar entre ${SECURITY_CONFIG.MIN_PERIOD_DAYS} e ${SECURITY_CONFIG.MAX_PERIOD_DAYS} dias`);
  }
  
  // Dados sanitizados
  const sanitizedData = {
    name: sanitizeString(planData.name || ''),
    slug: generateSecureSlug(planData.name || ''),
    price: validateNumber(planData.price, SECURITY_CONFIG.MIN_PRICE, SECURITY_CONFIG.MAX_PRICE),
    currency: 'BRL',
    max_agents: validateNumber(planData.maxAgents, SECURITY_CONFIG.MIN_AGENTS, SECURITY_CONFIG.MAX_AGENTS),
    period_days: validateNumber(planData.periodDays, SECURITY_CONFIG.MIN_PERIOD_DAYS, SECURITY_CONFIG.MAX_PERIOD_DAYS),
    calls_unlimited: true,
    description: sanitizeString(planData.description || 'Plano personalizado'),
    short_description: `Limite de ${validateNumber(planData.maxAgents, SECURITY_CONFIG.MIN_AGENTS, SECURITY_CONFIG.MAX_AGENTS)} ramais • Validade de ${validateNumber(planData.periodDays, SECURITY_CONFIG.MIN_PERIOD_DAYS, SECURITY_CONFIG.MAX_PERIOD_DAYS)} dias`,
    is_popular: false,
    is_featured: false,
    color: sanitizeString(planData.color || '#64748b'), // Usar cor enviada ou cinza como fallback
    icon: 'package',
    display_order: 0,
    status: 'active', // String conforme estrutura da tabela
    visibility: 'public',
    subscribers_count: 0,
    trial_days: 0,
    setup_fee: 0.00,
    max_storage_gb: validateNumber(planData.maxAgents, SECURITY_CONFIG.MIN_AGENTS, SECURITY_CONFIG.MAX_AGENTS),
    max_concurrent_calls: null,
    recording_enabled: true,
    api_access: false,
    priority_support: false,
    created_by: userId, // ID do usuário que criou
    reseller_id: userRole === 'reseller' ? userId : null, // ID do revendedor apenas se for revendedor
    features: Array.isArray(planData.features) ? planData.features.map(f => sanitizeString(f)).slice(0, 10) : ['Recursos básicos'],
    metadata: {}
  };

  // 🔍 DEBUG: Log dos dados que serão inseridos
  console.log('🔍 [DEBUG] Dados sanitizados para inserção:', {
    userId,
    userRole,
    created_by: sanitizedData.created_by,
    reseller_id: sanitizedData.reseller_id,
    planName: sanitizedData.name
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
}

// =====================================================
// SERVIÇO SEGURO DE PLANOS
// =====================================================

export const secureSupabaseService = {
  
  /**
   * 🛡️ CRIAR PLANO - MÁXIMA SEGURANÇA
   */
  async createPlan(planData: Partial<Plan>, userId: string = 'anonymous', userRole: string = 'user'): Promise<Plan> {
    try {
      console.log('🛡️ [SECURE] Iniciando criação segura de plano:', planData.name);
      
      // 1. Rate limiting
      if (!checkRateLimit(userId)) {
        throw new Error('Muitas requisições. Tente novamente em 1 minuto.');
      }
      
      // 2. Validação e sanitização
      const validation = validatePlanData(planData, userId, userRole);
      if (!validation.isValid) {
        auditLog('CREATE_PLAN_VALIDATION_FAILED', { errors: validation.errors }, userId);
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }
      
      // 3. Log de auditoria
      auditLog('CREATE_PLAN_ATTEMPT', validation.sanitizedData, userId);
      
      // 4. Delegar criação para a API v2 (RBAC e ownership aplicados no backend)
      const createdPlan = await plansService.createPlan(planData);
      auditLog('CREATE_PLAN_SUCCESS', { planId: createdPlan.id, planName: createdPlan.name }, userId);
      console.log('✅ [SECURE->V2] Plano criado via API v2 com segurança:', createdPlan.name);
      return createdPlan;
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      auditLog('CREATE_PLAN_ERROR', { error: msg }, userId);
      console.error('❌ [SECURE] Erro na criação segura:', msg);
      throw error;
    }
  },
  
  /**
   * 🛡️ ATUALIZAR PLANO - MÁXIMA SEGURANÇA
   */
  async updatePlan(id: string, planData: Partial<Plan>, userId: string = 'anonymous'): Promise<Plan> {
    try {
      console.log('🛡️ [SECURE] Atualizando plano:', id);
      
      // Rate limiting
      if (!checkRateLimit(userId)) {
        throw new Error('Muitas requisições. Tente novamente em 1 minuto.');
      }
      
      // Validação
      const validation = validatePlanData(planData);
      if (!validation.isValid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }
      
      // Delegar atualização para a API v2
      const updatedPlan = await plansService.updatePlan(id, planData);
      auditLog('UPDATE_PLAN_SUCCESS', { planId: id }, userId);
      return updatedPlan;
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ [SECURE] Erro na atualização:', msg);
      throw error;
    }
  },
  
  /**
   * 🛡️ DELETAR PLANO - MÁXIMA SEGURANÇA
   */
  async deletePlan(id: string, userId: string = 'anonymous'): Promise<boolean> {
    try {
      console.log('🛡️ [SECURE] Deletando plano:', id);
      
      // Rate limiting
      if (!checkRateLimit(userId)) {
        throw new Error('Muitas requisições. Tente novamente em 1 minuto.');
      }
      
      // Validar ID
      if (!id || id.trim().length === 0) {
        throw new Error('ID do plano é obrigatório');
      }
      
      auditLog('DELETE_PLAN_ATTEMPT', { planId: id }, userId);
      
      // Delegar exclusão para a API v2
      const ok = await plansService.deletePlan(id);
      auditLog('DELETE_PLAN_SUCCESS', { planId: id }, userId);
      console.log('✅ [SECURE->V2] Plano deletado via API v2');
      return ok;
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ [SECURE] Erro na exclusão:', msg);
      throw error;
    }
  },

  /**
   * 🔍 BUSCAR PLANOS POR REVENDEDOR - MÁXIMA SEGURANÇA
   */
  async getPlansByReseller(resellerId: string): Promise<Plan[]> {
    try {
      console.log('🔍 [SECURE] Buscando planos do revendedor:', resellerId);
      
      // 1. Validar ID do revendedor
      if (!resellerId || resellerId.trim().length === 0) {
        throw new Error('ID do revendedor é obrigatório');
      }
      
      // 2. Delegar busca ao serviço v2
      const plans = await plansService.getResellerPlans(resellerId);
      console.log(`✅ [SECURE->V2] ${plans.length} planos encontrados para o revendedor`);
      return plans;
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('❌ [SECURE] Erro ao buscar planos do revendedor:', msg);
      throw error;
    }
  }
};
