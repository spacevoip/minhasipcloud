export interface ClassificationPayload {
  rating: number; // 1..5
  reason?: string | null;
  number: string; // phone
  duration?: number; // seconds
}

class ClassificationService {
  private baseUrl: string;
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  async submit(payload: ClassificationPayload): Promise<{ success: boolean; message?: string }> {
    try {
      const token =
        (typeof window !== 'undefined' && (localStorage.getItem('agent_token') || localStorage.getItem('unified_token') || localStorage.getItem('token'))) ||
        null;

      if (!token) {
        return { success: false, message: 'Token não encontrado' };
      }

      const res = await fetch(`${this.baseUrl}/api/classification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: payload.rating,
          reason: payload.reason ?? null,
          number: payload.number,
          duration: Math.max(0, Math.floor(payload.duration || 0)),
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error('[classificationService] HTTP error:', res.status, txt);
        return { success: false, message: txt || 'Erro HTTP' };
      }

      const data = await res.json();
      return { success: !!data?.success, message: data?.message };
    } catch (e: any) {
      console.error('[classificationService] Error:', e?.message || e);
      return { success: false, message: e?.message || 'Erro desconhecido' };
    }
  }
}

export const classificationService = new ClassificationService();
