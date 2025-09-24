// =====================================================
// CONSOLIDATED SERVICES - Serviços unificados usando BaseService
// =====================================================

import { BaseService, type ApiResponse, type PaginatedResponse } from './baseService';

// =====================================================
// USER SERVICE
// =====================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'collaborator' | 'reseller';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  credits: number;
  planId?: string;
  planExpiresAt?: string;
  phone?: string;
  cpfCnpj?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
  cpfCnpj?: string;
  planId?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  credits?: number;
  planId?: string;
  phone?: string;
  cpfCnpj?: string;
}

class UsersService extends BaseService {
  constructor() {
    super('UsersService');
  }

  async getUsers(params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }): Promise<PaginatedResponse<User>> {
    return this.getPaginated<User>('/api/users', params?.page, params?.limit, {
      search: params?.search,
      role: params?.role,
      status: params?.status
    });
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return this.getById<User>('/api/users', id);
  }

  async createUser(userData: CreateUserData): Promise<ApiResponse<User>> {
    return this.create<User>('/api/users', userData);
  }

  async updateUser(id: string, userData: UpdateUserData): Promise<ApiResponse<User>> {
    return this.update<User>('/api/users', id, userData);
  }

  async deleteUser(id: string): Promise<ApiResponse<any>> {
    return this.remove('/api/users', id);
  }

  async suspendUser(id: string): Promise<ApiResponse<User>> {
    return this.patch<User>(`/api/users/${id}/suspend`);
  }

  async activateUser(id: string): Promise<ApiResponse<User>> {
    return this.patch<User>(`/api/users/${id}/activate`);
  }

  async adjustCredits(id: string, amount: number, operation: 'add' | 'subtract' | 'set'): Promise<ApiResponse<User>> {
    return this.patch<User>(`/api/users/${id}/credits`, { amount, operation });
  }
}

// =====================================================
// AGENTS SERVICE
// =====================================================

export interface Agent {
  id: string;
  ramal: string;
  agente_name: string;
  callerid: string;
  webrtc: boolean;
  status_sip: string;
  user_id: string;
  user_name: string;
  blocked: boolean;
  auto_discagem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentData {
  ramal: string;
  agente_name: string;
  callerid: string;
  webrtc?: boolean;
  user_id: string;
  senha: string;
}

export interface UpdateAgentData {
  agente_name?: string;
  callerid?: string;
  webrtc?: boolean;
  blocked?: boolean;
  auto_discagem?: boolean;
  senha?: string;
}

class AgentsService extends BaseService {
  constructor() {
    super('AgentsService');
  }

  async getAgents(params?: { page?: number; limit?: number; search?: string; userId?: string }): Promise<PaginatedResponse<Agent>> {
    return this.getPaginated<Agent>('/api/agents', params?.page, params?.limit, {
      search: params?.search,
      userId: params?.userId
    });
  }

  async getAgentById(id: string): Promise<ApiResponse<Agent>> {
    return this.getById<Agent>('/api/agents', id);
  }

  async createAgent(agentData: CreateAgentData): Promise<ApiResponse<Agent>> {
    return this.create<Agent>('/api/agents', agentData);
  }

  async updateAgent(id: string, agentData: UpdateAgentData): Promise<ApiResponse<Agent>> {
    return this.update<Agent>('/api/agents', id, agentData);
  }

  async deleteAgent(id: string): Promise<ApiResponse<any>> {
    return this.remove('/api/agents', id);
  }

  async blockAgent(id: string): Promise<ApiResponse<Agent>> {
    return this.patch<Agent>(`/api/agents/${id}/block`);
  }

  async unblockAgent(id: string): Promise<ApiResponse<Agent>> {
    return this.patch<Agent>(`/api/agents/${id}/unblock`);
  }
}

// =====================================================
// PLANS SERVICE
// =====================================================

export interface Plan {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  creditos: number;
  duracao_dias: number;
  ativo: boolean;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanData {
  nome: string;
  descricao: string;
  preco: number;
  creditos: number;
  duracao_dias: number;
  features?: string[];
}

export interface UpdatePlanData {
  nome?: string;
  descricao?: string;
  preco?: number;
  creditos?: number;
  duracao_dias?: number;
  ativo?: boolean;
  features?: string[];
}

class PlansService extends BaseService {
  constructor() {
    super('PlansService');
  }

  async getPlans(params?: { page?: number; limit?: number; active?: boolean }): Promise<PaginatedResponse<Plan>> {
    return this.getPaginated<Plan>('/api/plans', params?.page, params?.limit, {
      active: params?.active
    });
  }

  async getPlanById(id: string): Promise<ApiResponse<Plan>> {
    return this.getById<Plan>('/api/plans', id);
  }

  async createPlan(planData: CreatePlanData): Promise<ApiResponse<Plan>> {
    return this.create<Plan>('/api/plans', planData);
  }

  async updatePlan(id: string, planData: UpdatePlanData): Promise<ApiResponse<Plan>> {
    return this.update<Plan>('/api/plans', id, planData);
  }

  async deletePlan(id: string): Promise<ApiResponse<any>> {
    return this.remove('/api/plans', id);
  }

  async activatePlan(id: string): Promise<ApiResponse<Plan>> {
    return this.patch<Plan>(`/api/plans/${id}/activate`);
  }

  async deactivatePlan(id: string): Promise<ApiResponse<Plan>> {
    return this.patch<Plan>(`/api/plans/${id}/deactivate`);
  }
}

// =====================================================
// CDR SERVICE
// =====================================================

export interface CDRRecord {
  id: string;
  calldate: string;
  clid: string;
  src: string;
  dst: string;
  dcontext: string;
  channel: string;
  dstchannel: string;
  lastapp: string;
  lastdata: string;
  duration: number;
  billsec: number;
  disposition: string;
  amaflags: number;
  accountcode: string;
  uniqueid: string;
  userfield: string;
}

export interface CDRFilters {
  startDate?: string;
  endDate?: string;
  src?: string;
  dst?: string;
  disposition?: string;
  accountcode?: string;
  minDuration?: number;
  maxDuration?: number;
}

class CDRService extends BaseService {
  constructor() {
    super('CDRService');
  }

  async getCDRRecords(params?: { page?: number; limit?: number } & CDRFilters): Promise<PaginatedResponse<CDRRecord>> {
    return this.getPaginated<CDRRecord>('/api/cdr', params?.page, params?.limit, {
      startDate: params?.startDate,
      endDate: params?.endDate,
      src: params?.src,
      dst: params?.dst,
      disposition: params?.disposition,
      accountcode: params?.accountcode,
      minDuration: params?.minDuration,
      maxDuration: params?.maxDuration
    });
  }

  async getCDRStats(filters?: CDRFilters): Promise<ApiResponse<any>> {
    return this.get('/api/cdr/stats', { params: filters });
  }

  async exportCDR(filters?: CDRFilters, format: 'csv' | 'excel' = 'csv'): Promise<ApiResponse<any>> {
    return this.get(`/api/cdr/export/${format}`, { params: filters });
  }
}

// =====================================================
// NOTIFICATIONS SERVICE
// =====================================================

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationData {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

class NotificationsService extends BaseService {
  constructor() {
    super('NotificationsService');
  }

  async getNotifications(params?: { page?: number; limit?: number; userId?: string; read?: boolean }): Promise<PaginatedResponse<Notification>> {
    return this.getPaginated<Notification>('/api/notifications', params?.page, params?.limit, {
      userId: params?.userId,
      read: params?.read
    });
  }

  async createNotification(notificationData: CreateNotificationData): Promise<ApiResponse<Notification>> {
    return this.create<Notification>('/api/notifications', notificationData);
  }

  async markAsRead(id: string): Promise<ApiResponse<Notification>> {
    return this.patch<Notification>(`/api/notifications/${id}/read`);
  }

  async markAllAsRead(userId: string): Promise<ApiResponse<any>> {
    return this.patch(`/api/notifications/read-all`, { userId });
  }

  async deleteNotification(id: string): Promise<ApiResponse<any>> {
    return this.remove('/api/notifications', id);
  }
}

// =====================================================
// EXPORT INSTANCES
// =====================================================

export const usersService = new UsersService();
export const agentsService = new AgentsService();
export const plansService = new PlansService();
export const cdrService = new CDRService();
export const notificationsService = new NotificationsService();
