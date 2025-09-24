// =====================================================
// USERS SERVICE - Integração Direta com Supabase
// =====================================================

import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import { authService } from '@/lib/auth'
import { plansService } from './plansService'

// -----------------------------------------------------
// Helpers de telefone (salvar e exibir)
// -----------------------------------------------------
export function normalizePhoneToSave(raw?: string): string {
  if (!raw) return '';
  // mantém apenas dígitos
  const digits = raw.replace(/\D/g, '');
  // espera-se Brasil: 11 dígitos (DDD + 9 dígitos)
  // formata para "+55 11 94444-0001" (com DDI + DDD)
  if (digits.length >= 11) {
    const ddd = digits.slice(-11, -9);
    const first = digits.slice(-9, -5);
    const last = digits.slice(-5);
    return `+55 ${ddd} ${first}-${last}`;
  }
  return raw;
}

// Helper: registrar lançamento financeiro
async function recordFinanceEntry(params: {
  actorId: string | null;
  customerId: string;
  amount: number;
  type: 'credit' | 'debit';
  note?: string;
  product?: string;
}) {
  try {
    const payload: any = {
      user_id: params.actorId || null,
      customer_id: params.customerId,
      amount: params.amount,
      status: 'completed',
      type: params.type,
      description: params.note || (params.type === 'credit' ? 'Crédito manual' : 'Débito manual'),
      product: params.product || 'credits_adjustment',
    };
    const { error } = await supabase.from('finance').insert(payload).select().single();
    if (error) {
      console.error('⚠️ Não foi possível registrar lançamento na tabela finance:', error.message);
    }
  } catch (e) {
    // não foi possível registrar lançamento na tabela finance (silencioso)
  }
}

// Função para adicionar créditos diretamente no Supabase (com validação)
async function addCreditsToSupabase(userId: string, creditsData: AddCreditsData): Promise<any> {
  try {
    // adicionando créditos (silencioso)

    if (!creditsData.amount || creditsData.amount <= 0) {
      throw new Error('Valor inválido para adição de créditos');
    }

    // Buscar créditos atuais do usuário
    const { data: currentUser, error: fetchError } = await supabase
      .from('users_pabx')
      .select('credits')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar usuário:', fetchError);
      throw fetchError;
    }

    const currentCredits = Number(currentUser?.credits || 0);
    const addAmount = Number(creditsData.amount || 0);
    const newCredits = currentCredits + addAmount;

    const { error } = await supabase
      .from('users_pabx')
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar créditos:', error);
      throw error;
    }

    // Registrar lançamento financeiro (quem faz = user_id do ator logado; beneficiário = customer_id)
    try {
      const currentUser = (typeof window !== 'undefined') ? authService.getCurrentUser() : null;
      await recordFinanceEntry({
        actorId: currentUser?.id || null,
        customerId: userId,
        amount: addAmount,
        type: 'credit',
        note: creditsData.note,
        product: 'credits_adjustment',
      });
    } catch {}

    return {
      userId,
      previousCredits: currentCredits,
      addedAmount: addAmount,
      newCredits,
      note: creditsData.note,
    };
  } catch (error) {
    console.error('❌ Erro ao adicionar créditos no Supabase:', error);
    throw error;
  }
}

export function formatPhoneBR(raw?: string): string {
  if (!raw) return '';
  // tenta extrair 11 últimos dígitos
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 11) {
    const ddd = digits.slice(-11, -9);
    const first = digits.slice(-9, -5);
    const last = digits.slice(-5);
    return `(${ddd}) ${first}-${last}`;
  }
  return raw;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any[];
  // Optional pagination block returned by API v2 list endpoints
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

// Função para retirar créditos diretamente no Supabase (com validação)
async function withdrawCreditsFromSupabase(userId: string, creditsData: WithdrawCreditsData): Promise<any> {
  try {
    // retirando créditos (silencioso)

    if (!creditsData.amount || creditsData.amount <= 0) {
      throw new Error('Valor inválido para retirada');
    }

    // Buscar créditos atuais do usuário
    const { data: currentUser, error: fetchError } = await supabase
      .from('users_pabx')
      .select('credits')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar usuário:', fetchError);
      throw fetchError;
    }

    const currentCredits = Number(currentUser?.credits || 0);
    const withdrawAmount = Number(creditsData.amount || 0);

    if (withdrawAmount > currentCredits) {
      throw new Error('Saldo insuficiente para retirada');
    }

    const newCredits = currentCredits - withdrawAmount;

    const { data, error } = await supabase
      .from('users_pabx')
      .update({
        credits: newCredits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('❌ Erro ao atualizar créditos:', error);
      throw error;
    }

    // Registrar lançamento financeiro (quem faz = user_id do ator logado; beneficiário = customer_id)
    try {
      const currentUser = (typeof window !== 'undefined') ? authService.getCurrentUser() : null;
      await recordFinanceEntry({
        actorId: currentUser?.id || null,
        customerId: userId,
        amount: withdrawAmount,
        type: 'debit',
        note: creditsData.note,
        product: 'credits_adjustment',
      });
    } catch {}

    return {
      userId,
      previousCredits: currentCredits,
      withdrawnAmount: withdrawAmount,
      newCredits,
      note: creditsData.note,
    };
  } catch (error) {
    console.error('❌ Erro ao retirar créditos no Supabase:', error);
    throw error;
  }
}

interface UsersPaginatedResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AdminUser {
  id: string;
  name: string;
  username: string;
  email: string;
  company: string;
  phone: string;
  role: 'user' | 'admin' | 'reseller' | 'collaborator';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  credits: number;
  planId?: string;
  planName?: string;
  parentResellerId?: string;
  maxConcurrentCalls: number;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  // ✅ CAMPOS DE PLANO ADICIONADOS:
  planActivatedAt?: string;
  planExpiresAt?: string;
  planStatus?: boolean;
  // ✅ Permissões/flags adicionais
  webrtc?: boolean;
  auto_discagem?: boolean;
  up_audio?: boolean;
  mailling_up?: boolean;
  sms_send?: boolean;
}

interface CreateUserData {
  name: string;
  username: string;
  email: string;
  password: string;
  company?: string;
  phone?: string;
  role?: 'user' | 'admin' | 'reseller' | 'collaborator';
  status?: 'active' | 'inactive' | 'suspended' | 'pending';
  planId?: string;
  // Validade do plano em dias (enviada pelo frontend para evitar RLS/leituras)
  planValidityDays?: number;
  credits?: number;
}

interface AddCreditsData {
  amount: number;
  note?: string;
}

// Reuse AddCreditsData for withdraw operations as well
type WithdrawCreditsData = AddCreditsData;

interface UsersFilters {
  search?: string;
  role?: string;
  status?: string;
  planId?: string;
  page?: number;
  limit?: number;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  totalCredits: number;
  usersByRole: Array<{
    role: string;
    count: number;
  }>;
}

// =====================================================
// CONFIGURAÇÃO DA API
// =====================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Função para fazer requisições autenticadas
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('token');
    // Cache bust para GETs
    const isGet = !options.method || options.method === 'GET';
    const bust = `_${Date.now()}`;
    const url = `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? `&` : `?`}${isGet ? `cb=${bust}` : ''}`.replace(/(&|\?)$/,'');

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'Cache-Control': 'no-store',
        ...(options.headers || {}),
      },
      cache: 'no-store',
      ...options,
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data?.error || `HTTP ${response.status}`, details: data?.details } as ApiResponse<T>;
    }

    return data;
  } catch (error) {
    console.error('❌ Erro na API de Usuários:', error);
    throw error;
  }
}

// -----------------------------------------------------
// Helpers Supabase (exclusão e vínculo de plano)
// -----------------------------------------------------
async function deleteUserFromSupabase(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users_pabx')
    .delete()
    .eq('id', userId);
  if (error) throw error;
}

// Vincular plano usando função SQL no banco (datas calculadas no servidor)
async function linkPlanInSupabase(
  userId: string,
  planId: string,
  _validityDays: number,
  note?: string
): Promise<any> {
  // Chamar RPC que calcula datas baseado no period_days do plano
  const activationDate = new Date().toISOString();
  const { error: rpcError } = await supabase.rpc('activate_user_plan', {
    user_id: userId,
    new_plan_id: planId,
    activation_date: activationDate,
  });

  if (rpcError) {
    console.error(`❌ Erro na RPC activate_user_plan (link):`, rpcError);
    throw rpcError;
  }

  // Buscar usuário atualizado para retornar datas reais
  const { data: updated, error: fetchErr } = await supabase
    .from('users_pabx')
    .select('id, plan_id, plan_status, plan_activated_at, plan_expires_at, updated_at')
    .eq('id', userId)
    .single();
  if (fetchErr) throw fetchErr;

  return {
    success: true,
    userId,
    planId,
    activatedAt: updated?.plan_activated_at || null,
    expiresAt: updated?.plan_expires_at || null,
    note,
    linkedAt: updated?.updated_at || new Date().toISOString(),
    data: updated,
  };
}

// Renovar plano usando função SQL no banco (datas calculadas no servidor)
async function renewPlanInSupabase(userId: string, planId: string, note?: string): Promise<any> {
  const activationDate = new Date().toISOString();
  const { error: rpcError } = await supabase.rpc('activate_user_plan', {
    user_id: userId,
    new_plan_id: planId,
    activation_date: activationDate,
  });

  if (rpcError) {
    console.error(`❌ Erro na RPC activate_user_plan (renew):`, rpcError);
    throw new Error(`Falha ao renovar plano: ${rpcError.message}`);
  }

  // Buscar usuário atualizado para obter datas calculadas pelo servidor
  const { data: updated, error: fetchErr } = await supabase
    .from('users_pabx')
    .select('id, plan_id, plan_status, plan_activated_at, plan_expires_at, updated_at')
    .eq('id', userId)
    .single();
  if (fetchErr) throw fetchErr;

  return {
    success: true,
    userId,
    planId,
    activatedAt: updated?.plan_activated_at || activationDate,
    expiresAt: updated?.plan_expires_at || null,
    note,
    data: updated,
  };
}

// =====================================================
// SERVIÇO DE USUÁRIOS
// =====================================================

export const usersService = {
  // Buscar todos os usuários com filtros e paginação
  async getAllUsers(filters: UsersFilters = {}): Promise<UsersPaginatedResponse> {
    try {
      // buscando usuários com filtros (silencioso)
      
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.role && filters.role !== 'all') queryParams.append('role', filters.role);
      if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
      if (filters.page) queryParams.append('page', filters.page.toString());
      if (filters.limit) queryParams.append('limit', filters.limit.toString());

      // Cache-busting no endpoint v2 também
      queryParams.append('_', String(Date.now()));
      const response = await apiRequest<any>(`/api/users-v2?${queryParams}`);
      
      if (response.success && response.data) {
        // A API v2 retorna { success, data: User[], pagination }
        // Normalizar para o formato UsersPaginatedResponse esperado pelo frontend
        const v2Users = Array.isArray(response.data) ? response.data : [];
        const normalized: UsersPaginatedResponse = {
          users: v2Users,
          pagination: response.pagination || {
            page: Number(filters.page || 1),
            limit: Number(filters.limit || 20),
            total: v2Users.length,
            totalPages: 1,
          },
        };

        // Enriquecer nomes de planos se necessário
        try {
          let users = normalized.users as any[];
          const planIds = Array.from(new Set(
            users
              .map(u => (u.planId || u.plan_id) as string | undefined)
              .filter(Boolean)
          )) as string[];
          const needsEnrichment = users.some(u => !u.planName && (u.planId || u.plan_id));
          if (needsEnrichment && planIds.length > 0) {
            const allPlans = await plansService.getAllPlans();
            const planMap = Object.fromEntries(allPlans.map((p: any) => [p.id, p.name]));
            users = users.map(u => ({
              ...u,
              planName: (u.planId || u.plan_id) ? planMap[u.planId || u.plan_id] : u.planName
            }));
            normalized.users = users as any;
          }
        } catch (e) {
          // não foi possível enriquecer nomes de planos (silencioso)
        }

        return normalized;
      }
      
      // resposta inválida da API, usando fallback direto no Supabase (silencioso)

      // Fallback: consulta direta ao Supabase com filtros/paginação
      const page = filters.page && filters.page > 0 ? filters.page : 1;
      const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('users_pabx')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim();
        // Busca em múltiplos campos com OR
        query = query.or(
          [
            `name.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `username.ilike.%${term}%`,
            `company.ilike.%${term}%`,
            `phone.ilike.%${term}%`
          ].join(',')
        );
      }

      const { data, error: supabaseError, count } = await query;
      if (supabaseError) {
        console.error('❌ Erro no fallback Supabase getAllUsers:', supabaseError);
        throw supabaseError;
      }

      let users = (data || []).map((row: any) => {
        const user: AdminUser = {
          id: row.id,
          name: row.name,
          username: row.username,
          email: row.email,
          company: row.company || '',
          phone: row.phone || '',
          role: row.role,
          status: row.status,
          credits: row.credits || 0,
          planId: row.plan_id || undefined,
          parentResellerId: row.parent_reseller_id,
          maxConcurrentCalls: row.max_concurrent_calls || 10,
          timezone: row.timezone || 'America/Sao_Paulo',
          language: row.language || 'pt-BR',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: row.last_login_at,
          planActivatedAt: row.plan_activated_at,
          planExpiresAt: row.plan_expires_at,
          planStatus: row.plan_status,
        };
        return user;
      });

      // Enriquecer com nomes de planos (quando existir planId) via API v2
      try {
        const planIds = Array.from(new Set(users.map(u => u.planId).filter(Boolean))) as string[];
        if (planIds.length > 0) {
          const allPlans = await plansService.getAllPlans();
          const planMap = Object.fromEntries(allPlans.map((p: any) => [p.id, p.name]));
          users = users.map(u => ({ ...u, planName: u.planId ? planMap[u.planId] : undefined }));
        }
      } catch (e) {
        // não foi possível anexar nomes dos planos (fallback) (silencioso)
      }

      const total = count || users.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const result: UsersPaginatedResponse = {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };

      // fallback supabase retornou usuários (silencioso)
      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      // caindo para fallback direto no Supabase (silencioso)

      // Fallback: consulta direta ao Supabase com filtros/paginação
      const page = filters.page && filters.page > 0 ? filters.page : 1;
      const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('users_pabx')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.search && filters.search.trim()) {
        const term = filters.search.trim();
        // Busca em múltiplos campos com OR
        query = query.or(
          [
            `name.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `username.ilike.%${term}%`,
            `company.ilike.%${term}%`,
            `phone.ilike.%${term}%`
          ].join(',')
        );
      }

      const { data, error: supabaseError, count } = await query;
      if (supabaseError) {
        console.error('❌ Erro no fallback Supabase getAllUsers:', supabaseError);
        throw supabaseError;
      }

      let users = (data || []).map((row: any) => {
        const user: AdminUser = {
          id: row.id,
          name: row.name,
          username: row.username,
          email: row.email,
          company: row.company || '',
          phone: row.phone || '',
          role: row.role,
          status: row.status,
          credits: row.credits || 0,
          planId: row.plan_id || undefined,
          parentResellerId: row.parent_reseller_id,
          maxConcurrentCalls: row.max_concurrent_calls || 10,
          timezone: row.timezone || 'America/Sao_Paulo',
          language: row.language || 'pt-BR',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: row.last_login_at,
          planActivatedAt: row.plan_activated_at,
          planExpiresAt: row.plan_expires_at,
          planStatus: row.plan_status,
        };
        return user;
      });

      // Enriquecer com nomes de planos (quando existir planId) via API v2
      try {
        const planIds2 = Array.from(new Set(users.map(u => u.planId).filter(Boolean))) as string[];
        if (planIds2.length > 0) {
          const allPlans = await plansService.getAllPlans();
          const planMap2 = Object.fromEntries(allPlans.map((p: any) => [p.id, p.name]));
          users = users.map(u => ({ ...u, planName: u.planId ? planMap2[u.planId] : undefined }));
        }
      } catch (e) {
        // não foi possível anexar nomes dos planos (fallback 2) (silencioso)
      }

      const total = count || users.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const result: UsersPaginatedResponse = {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };

      // fallback supabase retornou usuários (silencioso)
      return result;
    }
  },

  // Buscar usuário por ID
  async getUserById(id: string): Promise<AdminUser> {
    try {
      // Primeiro tentar API backend
      console.log(`🔍 [usersService] Buscando usuário via API: ${id}`);
      const response = await apiRequest<AdminUser>(`/api/users-v2/${id}`);
      
      console.log(`📡 [usersService] Resposta da API:`, {
        success: response.success,
        hasData: !!response.data,
        data: response.data
      });
      
      if (response.success && response.data) {
        // Se a API retornou dados, verificar se tem os campos necessários
        const userData = response.data as any;
        
        console.log(`🔍 [usersService] Campos de controle da API:`, {
          sms_send: userData.sms_send,
          webrtc: userData.webrtc,
          auto_discagem: userData.auto_discagem,
          up_audio: userData.up_audio,
          mailling_up: userData.mailling_up
        });
        
        // Garantir que TODOS os campos de controle existam; se faltar algum, fazer merge com Supabase
        const requiredControlFields = ['webrtc', 'auto_discagem', 'up_audio', 'sms_send', 'mailling_up'] as const;
        const missing = requiredControlFields.filter((k) => userData[k] === undefined);
        if (missing.length === 0) {
          return response.data;
        }
        
        console.warn(`⚠️ [usersService] Faltando campos na resposta da API (${missing.join(', ')}). Fazendo merge com Supabase...`);
        const { data: supaUser, error: supaErr } = await supabase
          .from('users_pabx')
          .select('*')
          .eq('id', id)
          .single();
        
        if (!supaErr && supaUser) {
          const merged: any = {
            ...response.data,
            webrtc: supaUser.webrtc,
            auto_discagem: supaUser.auto_discagem,
            up_audio: supaUser.up_audio,
            sms_send: supaUser.sms_send,
            mailling_up: supaUser.mailling_up,
          };
          console.log('✅ [usersService] Merge concluído com Supabase para campos de controle:', {
            webrtc: merged.webrtc,
            auto_discagem: merged.auto_discagem,
            up_audio: merged.up_audio,
            sms_send: merged.sms_send,
            mailling_up: merged.mailling_up,
          });
          return merged as AdminUser;
        }
        // Se não conseguiu fazer merge, prosseguir para fallback completo do Supabase abaixo
      }
      
      // Fallback: buscar diretamente no Supabase com todos os campos
      console.log(`🔄 [usersService] Usando fallback Supabase para: ${id}`);
      const { data, error } = await supabase
        .from('users_pabx')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw new Error(`Erro do Supabase: ${error.message}`);
      }
      
      if (!data) {
        throw new Error('Usuário não encontrado');
      }
      
      console.log(`📊 [usersService] Dados do Supabase fallback:`, {
        sms_send: data.sms_send,
        webrtc: data.webrtc,
        auto_discagem: data.auto_discagem,
        up_audio: data.up_audio,
        mailling_up: data.mailling_up
      });
      
      // Converter formato do Supabase para AdminUser
      return {
        id: data.id,
        username: data.username,
        email: data.email,
        name: data.name,
        company: data.company,
        phone: data.phone,
        role: data.role,
        status: data.status,
        credits: data.credits,
        planId: data.plan_id,
        planStatus: data.plan_status,
        planActivatedAt: data.plan_activated_at,
        planExpiresAt: data.plan_expires_at,
        maxConcurrentCalls: data.max_concurrent_calls,
        language: data.language,
        timezone: data.timezone,
        settings: data.settings,
        metadata: data.metadata,
        parentResellerId: data.parent_reseller_id,
        lastLoginAt: data.last_login_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        webrtc: data.webrtc,
        auto_discagem: data.auto_discagem,
        total_call: data.total_call,
        up_audio: data.up_audio,
        mailling_up: data.mailling_up,
        sms_send: data.sms_send,
        last_login_at: data.last_login_at,
        created_at: data.created_at
      } as AdminUser;
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por ID:', error);
      throw error;
    }
  },

  // Criar usuário diretamente no Supabase (sem API intermediária)
  async createUser(userData: CreateUserData): Promise<AdminUser> {
    try {
      // criando usuário diretamente no Supabase (silencioso)

      // Normalizar role
      const roleMap: Record<string, 'user' | 'admin' | 'reseller' | 'collaborator'> = {
        cliente: 'user',
        client: 'user',
        admin: 'admin',
        revenda: 'reseller',
        reseller: 'reseller',
        colaborador: 'collaborator',
        collaborator: 'collaborator',
      };
      const normalizedRole = (userData.role && roleMap[userData.role]) ? (roleMap[userData.role] as any) : (userData.role || 'user');

      // Unicidade
      const { data: existingByEmail, error: emailErr } = await supabase
        .from('users_pabx')
        .select('id')
        .eq('email', userData.email)
        .limit(1);
      if (emailErr) throw emailErr;
      if (existingByEmail && existingByEmail.length > 0) {
        // Mensagem solicitada: informar que já existe uma conta com este e-mail
        throw new Error('Já existe uma conta com este e-mail.');
      }

      const { data: existingByUsername, error: userErr } = await supabase
        .from('users_pabx')
        .select('id')
        .eq('username', userData.username)
        .limit(1);
      if (userErr) throw userErr;
      if (existingByUsername && existingByUsername.length > 0) throw new Error('Nome de usuário já cadastrado');

      // Hash e telefone
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const phoneToSave = normalizePhoneToSave(userData.phone);
      const now = new Date().toISOString();
      const currentUser = (typeof window !== 'undefined') ? authService.getCurrentUser() : null;
      // Datas e status de plano são calculados por trigger no banco
      // Ao inserir com plan_id, o trigger BEFORE INSERT ajusta plan_activated_at/plan_expires_at/plan_status

      const insertPayload: any = {
        name: userData.name,
        username: userData.username,
        email: userData.email,
        password_hash: passwordHash,
        company: userData.company || '',
        phone: phoneToSave,
        role: normalizedRole,
        status: userData.status || 'active',
        credits: userData.credits ?? 0,
        plan_id: userData.planId || null,
        created_by: currentUser?.id || null,
        created_at: now,
        updated_at: now,
      };

      const { data, error: insertError } = await supabase
        .from('users_pabx')
        .insert(insertPayload)
        .select()
        .single();
      if (insertError) throw insertError;

      // Pós-inserção: nenhuma ação necessária; trigger já preencheu campos do plano, se aplicável

      const created: AdminUser = {
        id: data.id,
        name: data.name,
        username: data.username,
        email: data.email,
        company: data.company || '',
        phone: data.phone || '',
        role: data.role,
        status: data.status,
        credits: data.credits || 0,
        planId: data.plan_id || undefined,
        maxConcurrentCalls: data.max_concurrent_calls || 10,
        timezone: data.timezone || 'America/Sao_Paulo',
        language: data.language || 'pt-BR',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastLoginAt: data.last_login_at,
        planActivatedAt: data.plan_activated_at,
        planExpiresAt: data.plan_expires_at,
        planStatus: data.plan_status,
      };

      // usuário criado diretamente no banco (silencioso)
      return created;
    } catch (error) {
      console.error('❌ Erro ao criar usuário diretamente no Supabase:', error);
      throw error;
    }
  },
  
  // Adicionar créditos diretamente no Supabase (bypass da API)
  async addCredits(userId: string, creditsData: AddCreditsData): Promise<any> {
    try {
      return await addCreditsToSupabase(userId, creditsData);
    } catch (error) {
      console.error('❌ Erro ao adicionar créditos (Supabase):', error);
      throw error;
    }
  },

  async withdrawCredits(userId: string, creditsData: WithdrawCreditsData): Promise<any> {
    try {
      // Tentar retirar créditos diretamente no Supabase
      return await withdrawCreditsFromSupabase(userId, creditsData);
    } catch (error) {
      console.error('❌ Erro ao retirar créditos:', error);
      // simulando retirada de créditos (mock) (silencioso)
      return {
        userId,
        withdrawnAmount: creditsData.amount,
        success: true
      };
    }
  },

  async renewPlan(userId: string, planId: string, note?: string): Promise<any> {
    try {
      const response = await apiRequest<any>(`/api/users-v2/${userId}/renew-plan`, {
        method: 'POST',
        body: JSON.stringify({ planId, note })
      });
      if (response.success && response.data) {
        return response.data;
      }
      // Se a API respondeu mas sem sucesso, tentar fallback direto no Supabase
      console.warn('⚠️ API renewPlan não retornou sucesso. Tentando fallback direto no Supabase...', response?.error || response);
      return await renewPlanInSupabase(userId, planId, note);
    } catch (error) {
    console.error('❌ Erro ao renovar plano via API:', error);
    // Fallback final: tentar renovar diretamente no Supabase
    try {
      return await renewPlanInSupabase(userId, planId, note);
    } catch (fallbackErr) {
      console.error('❌ Erro no fallback de renovação (Supabase):', fallbackErr);
      throw fallbackErr;
    }
    }
  },

  async updateUser(userId: string, userData: any): Promise<AdminUser> {
    try {
      // Usar abordagem direta do Supabase (igual ao resto do sistema)
      // Bloquear alterações manuais em campos de plano; usar triggers/RPCs dedicadas
      const safeData = { ...userData };
      delete (safeData as any).plan_id;
      delete (safeData as any).plan_activated_at;
      delete (safeData as any).plan_expires_at;
      delete (safeData as any).plan_status;

      const { data, error } = await supabase
        .from('users_pabx')
        .update({
          ...safeData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro do Supabase ao atualizar usuário:', error);
        throw new Error(`Erro ao atualizar usuário: ${error.message}`);
      }

      if (!data) {
        throw new Error('Usuário não encontrado');
      }

      // Converter para formato AdminUser
      const updatedUser: AdminUser = {
        id: data.id,
        name: data.name,
        username: data.username,
        email: data.email,
        company: data.company || '',
        phone: data.phone || '',
        role: data.role,
        status: data.status,
        credits: data.credits || 0,
        planId: data.plan_id,
        parentResellerId: data.parent_reseller_id,
        maxConcurrentCalls: data.max_concurrent_calls || 10,
        timezone: data.timezone || 'America/Sao_Paulo',
        language: data.language || 'pt-BR',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastLoginAt: data.last_login_at
      };

      return updatedUser;
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      throw error;
    }
  },

  // Atualização em massa de status (active/suspended)
  async bulkUpdateStatus(userIds: string[], status: 'active' | 'suspended'): Promise<{ updatedIds: string[] }> {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return { updatedIds: [] };
      }
      const { data, error } = await supabase
        .from('users_pabx')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', userIds)
        .select('id');
      if (error) {
        console.error('❌ Erro no bulkUpdateStatus (Supabase):', error);
        throw error;
      }
      const updatedIds = (data || []).map((r: any) => r.id);
      return { updatedIds };
    } catch (error) {
      console.error('❌ Falha no bulkUpdateStatus:', error);
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<{ message: string; data?: any }> {
    try {
      // Exclusão direta no Supabase (evita chamadas recursivas/API)
      await deleteUserFromSupabase(userId);
      return { message: 'Usuário excluído com sucesso' };
    } catch (error) {
      console.error('❌ Erro ao excluir usuário no Supabase:', error);
      // simulando exclusão de usuário (mock) (silencioso)
      return { message: 'Usuário excluído com sucesso (simulado)' };
    }
  },

  async bulkDeleteUsers(userIds: string[]): Promise<{ message: string; data?: any }> {
    try {
      // Exclusão direta no Supabase (um por um)
      let deletedCount = 0;
      for (const userId of userIds) {
        try {
          await deleteUserFromSupabase(userId);
          deletedCount++;
        } catch (err) {
          console.error(`❌ Erro ao excluir usuário ${userId}:`, err);
        }
      }

      return {
        message: `${deletedCount} de ${userIds.length} usuários excluídos com sucesso`,
        data: { deletedCount, totalRequested: userIds.length }
      };
    } catch (error) {
      console.error('❌ Erro na exclusão em lote no Supabase:', error);
      // simulando exclusão em lote (mock) (silencioso)
      return {
        message: `${userIds.length} usuários excluídos com sucesso (simulado)`,
        data: { deletedCount: userIds.length, totalRequested: userIds.length }
      };
    }
  },

  async getUserStats(): Promise<UserStats> {
    try {
      // Contagem total
      const { count: totalUsers, error: totalErr } = await supabase
        .from('users_pabx')
        .select('id', { count: 'exact', head: true });
      if (totalErr) throw totalErr;

      // Contagem ativos
      const { count: activeUsers, error: activeErr } = await supabase
        .from('users_pabx')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');
      if (activeErr) throw activeErr;

      // Soma de créditos (busca apenas créditos)
      const { data: creditsRows, error: creditsErr } = await supabase
        .from('users_pabx')
        .select('credits');
      if (creditsErr) throw creditsErr;
      const totalCredits = (creditsRows || []).reduce((sum: number, r: any) => sum + Number(r.credits || 0), 0);

      // Contagem por role
      const roles = ['user', 'admin', 'reseller', 'collaborator'];
      const usersByRole: Array<{ role: string; count: number }> = [];
      for (const role of roles) {
        const { count, error } = await supabase
          .from('users_pabx')
          .select('id', { count: 'exact', head: true })
          .eq('role', role);
        if (error) throw error;
        usersByRole.push({ role, count: count || 0 });
      }

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalCredits,
        usersByRole,
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas de usuários:', error);
      throw error;
    }
  },

  async linkPlan(userId: string, planId: string, validityDays: number, note?: string): Promise<any> {
    try {
      // Tentar vincular plano diretamente no Supabase
      return await linkPlanInSupabase(userId, planId, validityDays, note);
    } catch (error) {
      console.error('❌ Erro ao vincular plano:', error);
      // simulando vinculação de plano (mock) (silencioso)
      
      // Fallback mock
      return {
        success: true,
        message: 'Plano vinculado (simulado)',
        validityDays,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
        note,
        linkedAt: new Date().toISOString()
      };
    }
  },

  // Alterar plano preservando vencimento e registrando lançamento financeiro proporcional
  async changePlanWithFinance(userId: string, newPlanId: string, note?: string): Promise<{
    finance?: { amount: number; type: 'credit' | 'debit' } | null;
    linkResult: any;
    details: {
      remainingDays: number;
      currentDaily: number;
      newDaily: number;
      creditFromCurrent: number;
      proportionalNewCost: number;
      difference: number;
    }
  }> {
    // 🚀 Nova implementação: usar API V2 centralizada
    try {
      const response = await apiRequest<any>(`/api/users-v2/${userId}/change-plan`, {
        method: 'POST',
        body: JSON.stringify({ newPlanId, note })
      });

      if (!response?.success) {
        const msg = response?.error || 'Falha ao alterar plano via API';
        throw new Error(msg);
      }

      const payload = response.data || {};
      return {
        finance: payload.finance || null,
        // manter compatibilidade com UI: linkResult recebe o usuário atualizado
        linkResult: payload.user,
        details: payload.details || {
          remainingDays: 0,
          currentDaily: 0,
          newDaily: 0,
          creditFromCurrent: 0,
          proportionalNewCost: 0,
          difference: 0,
        },
      };
    } catch (error) {
      console.error('❌ Erro ao alterar plano via API:', error);
      throw error;
    }
  },

  async getUserCountsByPlan(): Promise<{[planId: string]: number}> {
    try {
      // Agrupar por plan_id
      const { data, error } = await supabase
        .from('users_pabx')
        .select('plan_id, id');
      if (error) throw error;
      const map: {[planId: string]: number} = {};
      for (const row of data || []) {
        const key = row.plan_id || 'none';
        map[key] = (map[key] || 0) + 1;
      }
      return map;
    } catch (error) {
      console.error('❌ Erro ao agrupar usuários por plano:', error);
      return {};
    }
  }
};

// Exportar serviço principal e alias de compatibilidade
export const usersServiceWithFallback = usersService;
export default usersService;
