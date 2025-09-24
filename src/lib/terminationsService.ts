// =====================================================
// TERMINATIONS SERVICE - Integração com API Backend
// =====================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 15000; // 15s

export interface TerminationStats {
  total: number;
  answered: number;
  no_answer: number;
  busy: number;
  failed: number;
  other: number;
  successRate: number; // 0-100
}

export interface TerminationItem {
  id: string; // derivado de name
  name: string;
  ip?: string | null;
  status?: string | null;
  tarifa?: number | string | null; // custo
  stats: TerminationStats;
}

interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  meta?: any;
}

interface ApiDetailResponse<T> {
  success: boolean;
  data: T;
  meta?: any;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('token'); } catch { return null; }
}

async function apiFetch<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      const message = (json && (json.error || json.message)) || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export const terminationsService = {
  async list(params?: { startDate?: string; endDate?: string; all?: boolean }): Promise<TerminationItem[]> {
    const query: string[] = [];
    if (params?.startDate) query.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params?.endDate) query.push(`endDate=${encodeURIComponent(params.endDate)}`);
    if (params?.all) query.push(`all=true`);
    const qs = query.length ? `?${query.join('&')}` : '';
    const resp = await apiFetch<ApiListResponse<any>>(`/api/terminations${qs}`);
    const items = Array.isArray(resp.data) ? resp.data : [];
    return items.map((t: any) => ({
      id: String(t.name || ''),
      name: String(t.name || ''),
      ip: t.ip ?? t.match ?? null,
      status: t.status ?? null,
      tarifa: t.tarifa ?? null,
      stats: {
        total: Number(t?.stats?.total || 0),
        answered: Number(t?.stats?.answered || 0),
        no_answer: Number(t?.stats?.no_answer || 0),
        busy: Number(t?.stats?.busy || 0),
        failed: Number(t?.stats?.failed || 0),
        other: Number(t?.stats?.other || 0),
        successRate: Number(t?.stats?.successRate || 0),
      },
    }));
  },

  async detail(name: string, params?: { startDate?: string; endDate?: string; all?: boolean }): Promise<TerminationItem | null> {
    if (!name) return null;
    const query: string[] = [];
    if (params?.startDate) query.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params?.endDate) query.push(`endDate=${encodeURIComponent(params.endDate)}`);
    if (params?.all) query.push(`all=true`);
    const qs = query.length ? `?${query.join('&')}` : '';
    const resp = await apiFetch<ApiDetailResponse<any>>(`/api/terminations/${encodeURIComponent(name)}${qs}`);
    const t = resp.data;
    return {
      id: String(t.name || ''),
      name: String(t.name || ''),
      ip: t.ip ?? t.match ?? null,
      status: t.status ?? null,
      tarifa: t.tarifa ?? null,
      stats: {
        total: Number(t?.stats?.total || 0),
        answered: Number(t?.stats?.answered || 0),
        no_answer: Number(t?.stats?.no_answer || 0),
        busy: Number(t?.stats?.busy || 0),
        failed: Number(t?.stats?.failed || 0),
        other: Number(t?.stats?.other || 0),
        successRate: Number(t?.stats?.successRate || 0),
      },
    };
  },
};
