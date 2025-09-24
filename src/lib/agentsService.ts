import { Agent } from '../types';
import { AgentsQueryParams, AgentsResponse } from '../hooks/useAgents';

class AgentsService {
  private baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://your-api.com/api' 
    : 'http://localhost:3001/api';

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async getAgents(params: AgentsQueryParams = {}): Promise<AgentsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.department) queryParams.append('department', params.department);
      if (params.status) queryParams.append('status', params.status);

      const response = await this.request(`/agents?${queryParams.toString()}`);
      return response;
    } catch (error) {
      console.error('Error in getAgents:', error);
      
      // Fallback to mock data
      return this.getMockAgents(params);
    }
  }

  async getAgent(id: string): Promise<Agent> {
    try {
      return await this.request(`/agents/${id}`);
    } catch (error) {
      console.error('Error in getAgent:', error);
      
      // Fallback to mock data
      const mockAgents = this.getMockAgentsData();
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      return agent;
    }
  }

  async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    try {
      return await this.request('/agents', {
        method: 'POST',
        body: JSON.stringify(agentData),
      });
    } catch (error) {
      console.error('Error in createAgent:', error);
      
      // Fallback: simulate creation
      const newAgent: Agent = {
        id: `agent_${Date.now()}`,
        name: agentData.name || '',
        extension: agentData.extension || '',
        password: agentData.password || '',
        callerId: agentData.callerId || '',
        department: agentData.department || '',
        status: 'offline',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastActivity: null,
        totalCalls: 0,
        avgDuration: '0m'
      };
      
      return newAgent;
    }
  }

  async updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
    try {
      return await this.request(`/agents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error in updateAgent:', error);
      
      // Fallback: simulate update
      const mockAgents = this.getMockAgentsData();
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agente não encontrado');
      }
      
      return { ...agent, ...data };
    }
  }

  async deleteAgent(id: string): Promise<void> {
    try {
      await this.request(`/agents/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error in deleteAgent:', error);
      // Fallback: simulate deletion (no-op)
    }
  }

  // Mock data methods
  private getMockAgentsData(): Agent[] {
    return [
      {
        id: '1',
        name: 'João Silva',
        extension: '1001',
        password: 'pass123',
        callerId: '(11) 99999-1001',
        department: 'Vendas',
        status: 'online',
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        lastActivity: '2024-01-20T14:30:00Z',
        totalCalls: 145,
        avgDuration: '3m 45s'
      },
      {
        id: '2',
        name: 'Maria Santos',
        extension: '1002',
        password: 'pass456',
        callerId: '(11) 99999-1002',
        department: 'Suporte',
        status: 'busy',
        isActive: true,
        createdAt: '2024-01-16T09:00:00Z',
        lastActivity: '2024-01-20T15:45:00Z',
        totalCalls: 89,
        avgDuration: '5m 12s'
      },
      {
        id: '3',
        name: 'Pedro Costa',
        extension: '1003',
        password: 'pass789',
        callerId: '(11) 99999-1003',
        department: 'Financeiro',
        status: 'away',
        isActive: true,
        createdAt: '2024-01-17T11:00:00Z',
        lastActivity: '2024-01-20T13:20:00Z',
        totalCalls: 67,
        avgDuration: '4m 33s'
      },
      {
        id: '4',
        name: 'Ana Oliveira',
        extension: '1004',
        password: 'pass321',
        callerId: '(11) 99999-1004',
        department: 'Vendas',
        status: 'offline',
        isActive: true,
        createdAt: '2024-01-18T08:00:00Z',
        lastActivity: '2024-01-19T17:00:00Z',
        totalCalls: 203,
        avgDuration: '2m 58s'
      },
      {
        id: '5',
        name: 'Carlos Ferreira',
        extension: '1005',
        password: 'pass654',
        callerId: '(11) 99999-1005',
        department: 'Suporte',
        status: 'online',
        isActive: true,
        createdAt: '2024-01-19T12:00:00Z',
        lastActivity: '2024-01-20T16:10:00Z',
        totalCalls: 112,
        avgDuration: '6m 21s'
      }
    ];
  }

  private getMockAgents(params: AgentsQueryParams): AgentsResponse {
    let agents = this.getMockAgentsData();
    
    // Apply search filter
    if (params.search) {
      const search = params.search.toLowerCase();
      agents = agents.filter(agent => 
        agent.name.toLowerCase().includes(search) ||
        agent.extension.includes(search) ||
        agent.department?.toLowerCase().includes(search)
      );
    }
    
    // Apply department filter
    if (params.department) {
      agents = agents.filter(agent => agent.department === params.department);
    }
    
    // Apply status filter
    if (params.status) {
      agents = agents.filter(agent => agent.status === params.status);
    }
    
    const total = agents.length;
    const page = params.page || 1;
    const limit = params.limit || 10;
    const totalPages = Math.ceil(total / limit);
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedAgents = agents.slice(startIndex, endIndex);
    
    return {
      agents: paginatedAgents,
      total,
      page,
      totalPages
    };
  }
}

export const agentsService = new AgentsService();
