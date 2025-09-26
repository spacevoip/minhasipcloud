import { errorHandler } from '@/lib/errorHandler';
import { logger } from '@/lib/logger';
import { logApiUrl } from '@/lib/apiUrlLogger';

interface AgentLoginData {
  ramal: string;
  senha: string;
}

export interface AgentData {
  id: string;
  ramal: string;
  agente_name: string;
  callerid: string;
  webrtc: boolean;
  status_sip: string;
  classification?: boolean;
  chamadas_total?: number;
  chamadas_hoje?: number;
  user_id: string;
  user_name: string;
  user_role: string;
  blocked?: boolean;
  auto_discagem?: boolean;
}

interface AgentAuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    agent: AgentData;
  };
}

class AgentAuthService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = logApiUrl('agentAuthService.ts');
    
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('agent_token');
    }
  }

  /**
   * Agent login
   */
  async login(loginData: AgentLoginData): Promise<AgentAuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agent-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        this.token = data.data.token;
        
        // Store token and agent data in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('agent_token', data.data.token);
          localStorage.setItem('agent_data', JSON.stringify(data.data.agent));
          
          // Set auth cookie for middleware compatibility
          document.cookie = 'auth=1; path=/; max-age=86400'; // 24 hours
        }
      }

      return data;
    } catch (error) {
      console.error('Agent login error:', error);
      return {
        success: false,
        message: 'Erro de conexão com o servidor'
      };
    }
  }

  /**
   * Agent logout - optimized for immediate local logout
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    // Clear local data immediately for instant logout
    const token = this.token;
    this.clearLocalData();

    // Send logout request in background (don't await)
    if (token) {
      fetch(`${this.baseUrl}/api/agent-auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(error => {
        console.warn('Background logout request failed:', error);
      });
    }

    return {
      success: true,
      message: 'Logout realizado'
    };
  }

  /**
   * Get current agent data
   */
  async getCurrentAgent(): Promise<{ success: boolean; data?: AgentData; message?: string }> {
    try {
      if (!this.token) {
        return { success: false, message: 'Token não encontrado' };
      }

      const response = await fetch(`${this.baseUrl}/api/agent-auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.data?.agent) {
        // Update localStorage with fresh data
        if (typeof window !== 'undefined') {
          localStorage.setItem('agent_data', JSON.stringify(data.data.agent));
        }
        
        // Return the agent data directly for consistency
        return {
          success: true,
          data: data.data.agent,
          message: data.message
        };
      }

      return data;
    } catch (error) {
      console.error('Get current agent error:', error);
      return {
        success: false,
        message: 'Erro de conexão com o servidor'
      };
    }
  }

  /**
   * Check if agent is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Get stored agent data from localStorage
   */
  getStoredAgentData(): AgentData | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const agentDataStr = localStorage.getItem('agent_data');
      return agentDataStr ? JSON.parse(agentDataStr) : null;
    } catch (error) {
      console.error('Error parsing stored agent data:', error);
      return null;
    }
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Clear local authentication data
   */
  private clearLocalData(): void {
    this.token = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agent_token');
      localStorage.removeItem('agent_data');
      
      // Clear auth cookie
      document.cookie = 'auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  }

  /**
   * Set token manually (for initialization)
   */
  setToken(token: string): void {
    this.token = token;
  }
}

// Export singleton instance
export const agentAuthService = new AgentAuthService();
export type { AgentLoginData, AgentData, AgentAuthResponse };
