// src/services/workSessionsService.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ActiveResponse = {
  success: boolean;
  data?: {
    session: {
      id: string;
      agent_id: string;
      owner_user_id: string;
      agent_name?: string;
      started_at: string;
      ended_at: string | null;
    } | null;
    break: {
      id: string;
      session_id: string;
      reason_code?: string | null;
      reason_text?: string | null;
      started_at: string;
      ended_at: string | null;
    } | null;
    closed_break_seconds?: number;
    server_time: string;
  };
  message?: string;
};

export type WorkSession = NonNullable<ActiveResponse['data']>['session'];
export type WorkBreak = NonNullable<ActiveResponse['data']>['break'];

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('agent_token');
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} - ${text}`);
  }
  return res.json() as Promise<T>;
}

export const workSessionsService = {
  async getActive() {
    return api<ActiveResponse>('/api/work-sessions/active', { method: 'GET' });
  },
  async start() {
    return api<ActiveResponse>('/api/work-sessions/start', { method: 'POST' });
  },
  async pause(reason_code?: string, reason_text?: string) {
    return api<ActiveResponse>('/api/work-sessions/pause', {
      method: 'POST',
      body: JSON.stringify({ reason_code: reason_code || null, reason_text: reason_text || null }),
    });
  },
  async resume() {
    return api<ActiveResponse>('/api/work-sessions/resume', { method: 'POST' });
  },
  async stop() {
    return api<ActiveResponse>('/api/work-sessions/stop', { method: 'POST' });
  },
  async todaySummary(tz?: string) {
    const qs = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    return api<{ success: boolean; data?: { total_seconds: number; break_seconds: number; net_seconds: number } }>(
      `/api/work-sessions/today-summary${qs}`,
      { method: 'GET' }
    );
  },
};
