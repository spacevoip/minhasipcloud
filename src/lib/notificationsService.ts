// =====================================================
// Notifications Service - Frontend
// =====================================================

import { authService } from './auth';

const API_BASE = 'http://localhost:3001/api/notifications';

export type AudienceType = 'all' | 'users' | 'resellers' | 'reseller_users';
export type NotificationStatus = 'draft' | 'active' | 'archived';
export type RecipientStatus = 'pending' | 'delivered' | 'read' | 'dismissed';

export interface NotificationInput {
  title: string;
  message: string;
  status?: NotificationStatus;
  audience_type: AudienceType;
  target_reseller_id?: string | null;
  expires_at?: string | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  status: NotificationStatus;
  audience_type: AudienceType;
  target_reseller_id?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}

export interface NotificationRecipientRow {
  id?: string;
  user_id: string;
  notification_id: string;
  status: RecipientStatus;
  delivered_at?: string | null;
  read_at?: string | null;
  dismissed_at?: string | null;
  created_at?: string;
}

function authHeaders() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;
}

function buildQuery(params: Record<string, any> = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export const notificationsService = {
  async list(params: { status?: NotificationStatus; audience_type?: AudienceType; target_reseller_id?: string; limit?: number; offset?: number } = {}) {
    const ts = Date.now();
    const url = `${API_BASE}${buildQuery(params as any)}${(Object.keys(params||{}).length ? '&' : '?')}_ts=${ts}`;
    const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Erro ao listar notificações');
    // Normalize audience_type from backend 'type' or 'audience'
    const normalized = {
      ...data,
      data: (data?.data || []).map((n: any) => ({
        ...n,
        audience_type: n.audience_type || n.type || n.audience,
      }))
    };
    return normalized as { success: boolean; pagination: any; data: NotificationItem[] };
  },

  async get(id: string) {
    const res = await fetch(`${API_BASE}/${id}?_ts=${Date.now()}`, { headers: authHeaders(), cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Erro ao buscar notificação');
    const normalized = {
      ...data,
      data: {
        ...data?.data,
        audience_type: data?.data?.audience_type || data?.data?.type || data?.data?.audience,
      }
    };
    return normalized as { success: boolean; data: NotificationItem };
  },

  async listRecipients(id: string) {
    const res = await fetch(`${API_BASE}/${id}/recipients?_ts=${Date.now()}`, { headers: authHeaders(), cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Erro ao listar destinatários');
    return data as { success: boolean; data: NotificationRecipientRow[] };
  },

  async create(payload: NotificationInput) {
    // Sanitize: remove optional fields when null/empty to satisfy backend validators
    const body: any = { ...payload };
    if (!body.expires_at) delete body.expires_at;
    if (!body.target_reseller_id) delete body.target_reseller_id;
    if (body.audience_type !== 'reseller_users') delete body.target_reseller_id;
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const detail = (data as any)?.errors?.[0]?.msg || (data as any)?.error || (data as any)?.message;
      throw new Error(detail || 'Erro ao criar notificação');
    }
    const normalized = {
      ...data,
      data: {
        ...data?.data,
        audience_type: data?.data?.audience_type || data?.data?.type || data?.data?.audience,
      }
    };
    return normalized as { success: boolean; data: NotificationItem };
  },

  async update(id: string, payload: Partial<NotificationInput>) {
    const body: any = { ...payload };
    if (body.expires_at === null || body.expires_at === '') delete body.expires_at;
    if (body.target_reseller_id === null || body.target_reseller_id === '') delete body.target_reseller_id;
    if (body.audience_type && body.audience_type !== 'reseller_users') delete body.target_reseller_id;
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const detail = (data as any)?.errors?.[0]?.msg || (data as any)?.error || (data as any)?.message;
      throw new Error(detail || 'Erro ao atualizar notificação');
    }
    const normalized = {
      ...data,
      data: {
        ...data?.data,
        audience_type: data?.data?.audience_type || data?.data?.type || data?.data?.audience,
      }
    };
    return normalized as { success: boolean; data: NotificationItem };
  },

  async remove(id: string) {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Erro ao excluir notificação');
    return data as { success: boolean };
  },

  // User-facing
  async my(params: { limit?: number; offset?: number } = {}) {
    const ts = Date.now();
    const url = `${API_BASE}/my${buildQuery(params as any)}${(Object.keys(params||{}).length ? '&' : '?')}_ts=${ts}`;
    const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Erro ao listar minhas notificações');
    const normalized = {
      ...data,
      data: (data?.data || []).map((n: any) => ({
        ...n,
        audience_type: n.audience_type || n.type || n.audience,
      }))
    };
    return normalized as { success: boolean; pagination: any; data: (NotificationItem & { recipient_status: RecipientStatus; delivered_at?: string; read_at?: string; dismissed_at?: string })[] };
  },

  async markDelivered(id: string) {
    const res = await fetch(`${API_BASE}/${id}/delivered`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any)?.message || 'Erro ao marcar entregue');
    }
    return { success: true };
  },

  async markRead(id: string) {
    const res = await fetch(`${API_BASE}/${id}/read`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any)?.message || 'Erro ao marcar lida');
    }
    return { success: true };
  },

  async dismiss(id: string) {
    const res = await fetch(`${API_BASE}/${id}/dismiss`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as any)?.message || 'Erro ao dispensar');
    }
    return { success: true };
  },
};

export default notificationsService;
