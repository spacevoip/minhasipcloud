import { authService } from './auth';

export interface FinanceFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  user_id?: string;
  reseller_id?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface FinanceRecord {
  id: string;
  user_id: string | null;
  reseller_id: string | null;
  customer_id?: string | null;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | string;
  created_at: string;
  type: string | null;
  description: string | null;
  product: string | null;
  plan_id: string | null;
}

export interface FinanceResponse {
  success: boolean;
  data: FinanceRecord[];
  pagination?: { total: number; limit: number; offset: number };
  message?: string;
}

const API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:3001';

export interface CreateFinancePayload {
  customer_id?: string | null;
  amount: number;
  type?: string;
  description?: string | null;
  product?: string | null;
  plan_id?: string | null;
  status?: 'completed' | 'pending' | 'failed' | string;
}

export interface CreateFinanceResponse {
  success: boolean;
  data: FinanceRecord;
  message?: string;
}

export const financeService = {
  async list(filters: FinanceFilters = {}): Promise<FinanceResponse> {
    const token = authService.getToken();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });

    const res = await fetch(`${API_BASE}/api/finance?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      cache: 'no-store'
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.message || 'Erro ao buscar transações');
    }
    return json as FinanceResponse;
  },

  async create(payload: CreateFinancePayload): Promise<CreateFinanceResponse> {
    const token = authService.getToken();
    const res = await fetch(`${API_BASE}/api/finance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.message || 'Erro ao criar transação');
    }
    return json as CreateFinanceResponse;
  }
};
