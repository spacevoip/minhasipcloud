import { 
  User, 
  Agent, 
  Call, 
  CDR, 
  DashboardStats, 
  CallsByHour, 
  AgentReport, 
  SystemConfig,
  FilterOptions 
} from '@/types';
import { 
  generateMockAgents, 
  generateMockCalls, 
  generateMockCDRs, 
  generateDashboardStats, 
  generateCallsByHour, 
  generateAgentReports,
  getDefaultSystemConfig
} from '@/mock/data';

// Simulação de delay de rede
const delay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

// Dados em memória
let agents = generateMockAgents(15);
let calls = generateMockCalls(50);
let cdrs = generateMockCDRs(100);
let agentReports = generateAgentReports(10);
let systemConfig = getDefaultSystemConfig();

// Simulação de autenticação (MOCK - para compatibilidade)
export const authAPI = {
  async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
    await delay();
    
    // Credenciais de teste básicas para manter compatibilidade
    const testCredentials = [
      { email: 'admin@pabx.com', password: 'admin123', role: 'admin' as const, name: 'Administrador' },
      { email: 'agent@pabx.com', password: 'agent123', role: 'agent' as const, name: 'Agente Silva' },
      { email: 'reseller@pabx.com', password: 'reseller123', role: 'resale' as const, name: 'Revendedor Premium' }
    ];
    
    const credential = testCredentials.find(cred => cred.email === email && cred.password === password);
    
    if (credential) {
      const user: User = {
        id: Math.random().toString(36),
        name: credential.name,
        email: credential.email,
        role: credential.role,
        avatar: undefined
      };
      
      return {
        user,
        token: `fake-jwt-token-${user.id}`
      };
    }
    
    return null;
  },

  async validateToken(token: string): Promise<User | null> {
    await delay(200);
    
    if (token.startsWith('fake-jwt-token-')) {
      return {
        id: '1',
        name: 'Administrador',
        email: 'admin@pabx.com',
        role: 'admin',
        avatar: undefined
      };
    }
    
    return null;
  }
};

// API de agentes
export const agentsAPI = {
  async getAgents(): Promise<Agent[]> {
    await delay();
    return [...agents];
  },

  async getAgent(id: string): Promise<Agent | null> {
    await delay();
    return agents.find((agent: Agent) => agent.id === id) || null;
  },

  async updateAgentStatus(id: string, status: Agent['status']): Promise<Agent | null> {
    await delay();
    const agentIndex = agents.findIndex((agent: Agent) => agent.id === id);
    if (agentIndex !== -1) {
      agents[agentIndex] = { ...agents[agentIndex], status };
      return agents[agentIndex];
    }
    return null;
  },

  async searchAgents(query: string): Promise<Agent[]> {
    await delay();
    const filtered = agents.filter((agent: Agent) => 
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.email.toLowerCase().includes(query.toLowerCase()) ||
      agent.extension.includes(query)
    );
    return filtered;
  },

  async getAgentsByStatus(status: Agent['status']): Promise<Agent[]> {
    await delay();
    return agents.filter((a: Agent) => a.status === status);
  }
};

// API de chamadas
export const callsAPI = {
  async getCalls(): Promise<Call[]> {
    await delay();
    return calls.filter((call: Call) => call.status === 'ongoing');
  },

  async getAllCalls(): Promise<Call[]> {
    await delay();
    return calls.sort((a: Call, b: Call) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }
};

// API de CDR
export const cdrAPI = {
  async getCDRs(filters?: FilterOptions): Promise<{ data: CDR[]; total: number }> {
    await delay();
    let filteredCDRs = [...cdrs];

    if (filters?.search) {
      filteredCDRs = filteredCDRs.filter((cdr: CDR) =>
        cdr.from.includes(filters.search!) ||
        cdr.to.includes(filters.search!) ||
        cdr.agentName?.toLowerCase().includes(filters.search!.toLowerCase())
      );
    }

    if (filters?.status) {
      filteredCDRs = filteredCDRs.filter((cdr: CDR) => cdr.status === filters.status);
    }

    if (filters?.direction) {
      filteredCDRs = filteredCDRs.filter((cdr: CDR) => cdr.direction === filters.direction);
    }

    if (filters?.startDate) {
      filteredCDRs = filteredCDRs.filter((cdr: CDR) => 
        new Date(cdr.startTime) >= new Date(filters.startDate!)
      );
    }

    if (filters?.endDate) {
      filteredCDRs = filteredCDRs.filter((cdr: CDR) => 
        new Date(cdr.startTime) <= new Date(filters.endDate!)
      );
    }

    // Paginação
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedCDRs = filteredCDRs
      .sort((a: CDR, b: CDR) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(startIndex, endIndex);

    return {
      data: paginatedCDRs,
      total: filteredCDRs.length
    };
  },

  async exportCDRs(filters?: FilterOptions): Promise<string> {
    await delay(1000);
    // Simular exportação CSV
    return 'data:text/csv;base64,Q0RSIEV4cG9ydCBTaW11bGFkbw==';
  }
};

// API do dashboard
export const dashboardAPI = {
  async getStats(): Promise<DashboardStats> {
    await delay();
    return generateDashboardStats();
  },

  async getCallsByHour(): Promise<CallsByHour[]> {
    await delay();
    return generateCallsByHour();
  },

  async getRecentCalls(): Promise<Call[]> {
    await delay();
    return calls
      .sort((a: Call, b: Call) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10);
  }
};

// API de relatórios
export const reportsAPI = {
  async getAgentReports(filters?: FilterOptions): Promise<AgentReport[]> {
    await delay();
    let reports = [...agentReports];

    if (filters?.search) {
      reports = reports.filter((report: AgentReport) =>
        report.agentName.toLowerCase().includes(filters.search!.toLowerCase()) ||
        report.extension.includes(filters.search!)
      );
    }

    return reports.sort((a: AgentReport, b: AgentReport) => b.totalCalls - a.totalCalls);
  },

  async exportAgentReports(): Promise<string> {
    await delay(1000);
    // Simular exportação CSV
    return 'data:text/csv;base64,UmVsYXRvcmlvIGRlIEFnZW50ZXMgU2ltdWxhZG8=';
  }
};

// API de configurações
export const configAPI = {
  async getConfig(): Promise<SystemConfig> {
    await delay();
    return { ...systemConfig };
  },

  async updateConfig(newConfig: Partial<SystemConfig>): Promise<SystemConfig> {
    await delay();
    systemConfig = { ...systemConfig, ...newConfig };
    return { ...systemConfig };
  }
};
