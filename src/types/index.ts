// Tipos principais do sistema PABX

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'collaborator' | 'reseller';
  avatar?: string;
  username?: string;
  company?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'pending' | 'suspended';
  credits?: number;
  planId?: string;
  parentResellerId?: string;
  maxConcurrentCalls?: number;
  timezone?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  // Novos campos de ativação de plano
  planActivatedAt?: string;
  planExpiresAt?: string;
  planStatus?: boolean; // TRUE = válido/ativo, FALSE = vencido
}

export interface Agent {
  id: string;
  name: string;
  extension: string;
  password?: string;
  callerId?: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  isActive?: boolean;
  createdAt?: Date | string;
  lastActivity?: Date | string | null;
  totalCalls?: number;
  todayCalls?: number;
  averageCallDuration?: number;
  webrtc?: boolean;
  blocked?: boolean;
  autoDiscagem?: boolean;
  upAudio?: boolean;
  smsEnvio?: boolean;
  userId?: string;
}

export interface Call {
  id: string;
  from: string;
  to: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // em segundos
  status: 'answered' | 'missed' | 'busy' | 'ongoing';
  agentId?: string;
  direction: 'inbound' | 'outbound';
  recording?: string;
}

export interface CDR {
  id: string;
  callId: string;
  from: string;
  to: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'answered' | 'missed' | 'busy' | 'completed' | 'failed' | 'no_answer';
  agentId?: string;
  agentName?: string;
  extension?: string;
  callerId?: string;
  direction: 'inbound' | 'outbound';
  cost?: number;
}

export interface DashboardStats {
  totalCalls: number;
  activeCalls: number;
  onlineAgents: number;
  totalAgents: number;
  offlineAgents: number;
  answeredCalls: number;
  missedCalls: number;
  averageWaitTime: number;
  avgCallDuration: number; // Corrigido para match com o código
  systemUptime: number;
  queueWaitTime: number;
  busyAgents: number;
  pausedAgents: number;
}

export interface CallsByHour {
  hour: string;
  answered: number;
  missed: number;
  total: number;
  calls: number; // Adicionado para match com o código
}

export interface AgentReport {
  agentId: string;
  agentName: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  averageDuration: number;
  totalDuration: number;
  loginTime: number; // em minutos
  efficiency: number; // percentual
}

export interface SystemConfig {
  language: 'pt-BR' | 'en-US' | 'es-ES';
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  callRecording: boolean;
  maxCallDuration: number;
  autoAnswer: boolean;
  notifications: {
    email: boolean;
    browser: boolean;
    sound: boolean;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  maxAgents: number;
  periodDays: number;
  callsUnlimited: boolean;
  description: string;
  shortDescription?: string;
  isPopular: boolean;
  isFeatured: boolean;
  color: string;
  icon: string;
  displayOrder: number;
  status: 'active' | 'inactive' | 'draft';
  visibility: 'public' | 'private' | 'reseller_only';
  subscribersCount: number;
  trialDays: number;
  setupFee: number;
  maxStorageGb: number;
  maxConcurrentCalls?: number;
  recordingEnabled: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  createdBy?: string;
  resellerId?: string;
  createdAt: string;
  updatedAt: string;
  features: string[];
  metadata: Record<string, any>;
}

export interface FilterOptions {
  dateFrom?: Date;
  dateTo?: Date;
  agentId?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
  search?: string;
}
