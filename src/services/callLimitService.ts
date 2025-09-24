interface CallLimitStats {
  planName: string;
  callLimit: number;
  totalUsers: number;
  suspendedUsers: number;
  activeUsers: number;
}

interface CallLimitCheckResult {
  userId: string;
  wasSuspended: boolean;
  message: string;
}

interface CallLimitBatchResult {
  totalChecked: number;
  suspended: number;
}

interface UserCallCount {
  userId: string;
  callCount: number;
}

class CallLimitService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${this.baseUrl}/api/call-limit${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Verifica e aplica limite de chamadas para um usuário específico
   */
  async checkUserLimit(userId: string): Promise<CallLimitCheckResult> {
    return this.makeRequest<CallLimitCheckResult>(`/check/${userId}`, {
      method: 'POST',
    });
  }

  /**
   * Verifica todos os usuários com planos de teste (apenas admin)
   */
  async checkAllUsers(): Promise<CallLimitBatchResult> {
    return this.makeRequest<CallLimitBatchResult>('/check-all', {
      method: 'POST',
    });
  }

  /**
   * Obtém estatísticas de planos de teste (apenas admin)
   */
  async getStats(): Promise<CallLimitStats[]> {
    return this.makeRequest<CallLimitStats[]>('/stats');
  }

  /**
   * Obtém contagem de chamadas de um usuário específico
   */
  async getUserCallCount(userId: string): Promise<UserCallCount> {
    return this.makeRequest<UserCallCount>(`/user/${userId}/calls`);
  }
}

export const callLimitService = new CallLimitService();
export type { CallLimitStats, CallLimitCheckResult, CallLimitBatchResult, UserCallCount };
