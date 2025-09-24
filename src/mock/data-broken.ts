import { faker } from '@faker-js/faker';
import { Agent, Call, CDR, DashboardStats, CallsByHour, AgentReport, SystemConfig } from '@/types';

// Configuração do Faker para português brasileiro (nova API)
// faker.setDefaultRefDate() pode ser usado se necessário

// Gerar agentes mockados
export const generateMockAgents = (count: number = 15): Agent[] => {
  const agents: Agent[] = [];
  const departments = ['Vendas', 'Suporte', 'Financeiro', 'Atendimento', 'Técnico'];
  const statuses: Agent['status'][] = ['online', 'offline', 'busy', 'away'];

  for (let i = 0; i < count; i++) {
    const loginTime = faker.datatype.boolean() ? faker.date.recent({ days: 1 }) : undefined;
    const totalCalls = faker.number.int({ min: 0, max: 150 });
    
    agents.push({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      extension: `${1000 + i}`,
      email: faker.internet.email(),
      status: faker.helpers.arrayElement(statuses),
      department: faker.helpers.arrayElement(departments),
      lastActivity: faker.date.recent({ days: 7 }),
      totalCalls,
      averageCallDuration: faker.number.int({ min: 120, max: 900 }), // 2-15 minutos
      loginTime
    });
  }

  return agents;
};

// Gerar chamadas mockadas
export const generateMockCalls = (count: number = 100): Call[] => {
  const calls: Call[] = [];
  const statuses: Call['status'][] = ['answered', 'missed', 'busy', 'ongoing'];
  const directions: Call['direction'][] = ['inbound', 'outbound'];

  for (let i = 0; i < count; i++) {
    const startTime = faker.date.recent({ days: 30 });
    const duration = faker.number.int({ min: 30, max: 1800 }); // 30s a 30min
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const status = faker.helpers.arrayElement(statuses);

    calls.push({
      id: faker.string.uuid(),
      from: faker.phone.number('(##) #####-####'),
      to: faker.phone.number('(##) #####-####'),
      startTime,
      endTime: status === 'ongoing' ? undefined : endTime,
      duration: status === 'ongoing' ? 0 : duration,
      status,
      agentId: faker.datatype.boolean() ? faker.string.uuid() : undefined,
      direction: faker.helpers.arrayElement(directions),
      recording: faker.datatype.boolean() ? faker.internet.url() : undefined
    });
  }

  return calls;
};

// Gerar CDRs mockados
export const generateMockCDRs = (count: number = 500): CDR[] => {
  const cdrs: CDR[] = [];
  const statuses: CDR['status'][] = ['answered', 'missed', 'busy'];
  const directions: CDR['direction'][] = ['inbound', 'outbound'];
  const agentNames = [
    'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Lima',
    'Fernanda Souza', 'Roberto Alves', 'Juliana Pereira', 'Marcos Ferreira', 'Lucia Rodrigues'
  ];

  for (let i = 0; i < count; i++) {
    const startTime = faker.date.recent({ days: 90 }); // últimos 90 dias
    const duration = faker.number.int({ min: 30, max: 1800 });
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const hasAgent = faker.datatype.boolean();

    cdrs.push({
      id: faker.string.uuid(),
      callId: faker.string.uuid(),
      from: faker.phone.number('(##) #####-####'),
      to: faker.phone.number('(##) #####-####'),
      startTime,
      endTime,
      duration,
      status: faker.helpers.arrayElement(statuses),
      agentId: hasAgent ? faker.string.uuid() : undefined,
      agentName: hasAgent ? faker.helpers.arrayElement(agentNames) : undefined,
      direction: faker.helpers.arrayElement(directions),
      cost: faker.number.float({ min: 0.05, max: 5.50, fractionDigits: 2 })
    });
  }

  return cdrs.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
};

// Gerar estatísticas do dashboard
export const generateDashboardStats = (): DashboardStats => {
  const totalCalls = faker.number.int({ min: 1000, max: 5000 });
  const answeredCalls = faker.number.int({ min: Math.floor(totalCalls * 0.7), max: Math.floor(totalCalls * 0.9) });
  const missedCalls = totalCalls - answeredCalls;

  return {
    totalCalls,
    activeCalls: faker.number.int({ min: 0, max: 25 }),
    onlineAgents: faker.number.int({ min: 8, max: 15 }),
    offlineAgents: faker.number.int({ min: 0, max: 7 }),
    answeredCalls,
    missedCalls,
    averageWaitTime: faker.number.int({ min: 15, max: 180 }), // segundos
    averageCallDuration: faker.number.int({ min: 180, max: 600 }) // segundos
  };
};

// Gerar dados de chamadas por hora
export const generateCallsByHour = (): CallsByHour[] => {
  const data: CallsByHour[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const total = faker.number.int({ min: 10, max: 100 });
    const answered = faker.number.int({ min: Math.floor(total * 0.6), max: Math.floor(total * 0.9) });
    const missed = total - answered;

    data.push({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      answered,
      missed,
      total
    });
  }

  return data;
};

// Gerar relatórios de agentes
export const generateAgentReports = (agents: Agent[]): AgentReport[] => {
  return agents.map(agent => {
    const totalCalls = faker.number.int({ min: 50, max: 200 });
    const answeredCalls = faker.number.int({ min: Math.floor(totalCalls * 0.7), max: Math.floor(totalCalls * 0.95) });
    const missedCalls = totalCalls - answeredCalls;
    const totalDuration = faker.number.int({ min: 3600, max: 28800 }); // 1-8 horas em segundos
    const loginTime = faker.number.int({ min: 240, max: 480 }); // 4-8 horas em minutos

    return {
      agentId: agent.id,
      agentName: agent.name,
      totalCalls,
      answeredCalls,
      missedCalls,
      averageDuration: Math.floor(totalDuration / answeredCalls),
      totalDuration,
      loginTime,
      efficiency: Math.floor((answeredCalls / totalCalls) * 100)
    };
  });
};

// Configuração padrão do sistema
export const defaultSystemConfig: SystemConfig = {
  language: 'pt-BR',
  theme: 'light',
  timezone: 'America/Sao_Paulo',
  callRecording: true,
  maxCallDuration: 3600, // 1 hora
  autoAnswer: false,
  notifications: {
    email: true,
    browser: true,
    sound: true
  }
};

// Instâncias dos dados mockados (singleton)
export const mockAgents = generateMockAgents();
export const mockCalls = generateMockCalls();
export const mockCDRs = generateMockCDRs();
export const mockDashboardStats = generateDashboardStats();
export const mockCallsByHour = generateCallsByHour();
export const mockAgentReports = generateAgentReports(mockAgents);
