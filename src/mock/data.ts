import { faker } from '@faker-js/faker';
import { Agent, Call, CDR, DashboardStats, CallsByHour, AgentReport, SystemConfig } from '@/types';

// Função auxiliar para gerar telefone brasileiro
const generateBrazilianPhone = () => {
  const area = faker.number.int({ min: 11, max: 99 });
  const number = faker.number.int({ min: 90000, max: 99999 });
  const suffix = faker.number.int({ min: 1000, max: 9999 });
  return `(${area}) ${number}-${suffix}`;
};

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
export const generateMockCalls = (count: number = 50): Call[] => {
  const calls: Call[] = [];
  const statuses: Call['status'][] = ['completed', 'missed', 'ongoing', 'failed'];
  const directions: Call['direction'][] = ['inbound', 'outbound'];

  for (let i = 0; i < count; i++) {
    const startTime = faker.date.recent({ days: 30 });
    const duration = faker.number.int({ min: 30, max: 1800 }); // 30s a 30min
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const status = faker.helpers.arrayElement(statuses);

    calls.push({
      id: faker.string.uuid(),
      from: generateBrazilianPhone(),
      to: generateBrazilianPhone(),
      startTime,
      endTime: status === 'ongoing' ? undefined : endTime,
      duration: status === 'ongoing' ? 0 : duration,
      status,
      agentId: faker.datatype.boolean() ? faker.string.uuid() : undefined,
      direction: faker.helpers.arrayElement(directions),
      recording: faker.datatype.boolean()
    });
  }

  return calls;
};

// Gerar CDRs mockados
export const generateMockCDRs = (count: number = 100): CDR[] => {
  const cdrs: CDR[] = [];
  const statuses: CDR['status'][] = ['answered', 'missed', 'busy', 'completed', 'failed', 'no_answer'];
  const directions: CDR['direction'][] = ['inbound', 'outbound'];

  for (let i = 0; i < count; i++) {
    const startTime = faker.date.recent({ days: 90 }); // últimos 90 dias
    const duration = faker.number.int({ min: 30, max: 1800 });
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const hasAgent = faker.datatype.boolean();
    const extension = `${faker.number.int({ min: 1000, max: 9999 })}`;
    const fromPhone = generateBrazilianPhone();

    cdrs.push({
      id: faker.string.uuid(),
      callId: faker.string.uuid(),
      from: fromPhone,
      to: generateBrazilianPhone(),
      startTime,
      endTime,
      duration,
      status: faker.helpers.arrayElement(statuses),
      direction: faker.helpers.arrayElement(directions),
      agentId: hasAgent ? faker.string.uuid() : undefined,
      agentName: hasAgent ? faker.person.fullName() : undefined,
      extension: hasAgent ? extension : undefined,
      callerId: fromPhone, // CallerID é o mesmo que o número de origem
      cost: faker.number.float({ min: 0.05, max: 2.50, fractionDigits: 2 })
    });
  }

  return cdrs;
};

// Gerar estatísticas do dashboard
export const generateDashboardStats = (): DashboardStats => {
  return {
    totalAgents: faker.number.int({ min: 10, max: 50 }),
    onlineAgents: faker.number.int({ min: 5, max: 25 }),
    totalCalls: faker.number.int({ min: 100, max: 1000 }),
    activeCalls: faker.number.int({ min: 0, max: 20 }),
    avgCallDuration: faker.number.int({ min: 180, max: 600 }), // 3-10 minutos
    callsAnswered: faker.number.int({ min: 80, max: 95 }), // % de atendimento
    systemUptime: faker.number.float({ min: 95, max: 99.9, fractionDigits: 1 }),
    queueWaitTime: faker.number.int({ min: 10, max: 120 }) // segundos
  };
};

// Gerar dados de chamadas por hora
export const generateCallsByHour = (): CallsByHour[] => {
  const data: CallsByHour[] = [];
  
  for (let hour = 0; hour < 24; hour++) {
    data.push({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      calls: faker.number.int({ min: 5, max: 50 }),
      answered: faker.number.int({ min: 3, max: 45 })
    });
  }

  return data;
};

// Gerar relatórios de agentes
export const generateAgentReports = (count: number = 10): AgentReport[] => {
  const reports: AgentReport[] = [];

  for (let i = 0; i < count; i++) {
    const totalCalls = faker.number.int({ min: 20, max: 150 });
    const answeredCalls = faker.number.int({ min: 15, max: totalCalls });
    
    reports.push({
      agentId: faker.string.uuid(),
      agentName: faker.person.fullName(),
      extension: `${1000 + i}`,
      totalCalls,
      answeredCalls,
      missedCalls: totalCalls - answeredCalls,
      avgCallDuration: faker.number.int({ min: 120, max: 900 }),
      totalTalkTime: faker.number.int({ min: 3600, max: 28800 }), // 1-8 horas
      efficiency: faker.number.float({ min: 75, max: 98, fractionDigits: 1 }),
      customerSatisfaction: faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 })
    });
  }

  return reports;
};

// Configuração padrão do sistema
export const getDefaultSystemConfig = (): SystemConfig => {
  return {
    companyName: 'PABX Pro Corporation',
    maxConcurrentCalls: faker.number.int({ min: 50, max: 200 }),
    recordCalls: faker.datatype.boolean(),
    callTimeout: faker.number.int({ min: 30, max: 120 }),
    queueMusic: faker.datatype.boolean(),
    voicemailEnabled: faker.datatype.boolean(),
    autoAttendant: faker.datatype.boolean(),
    callForwarding: faker.datatype.boolean(),
    nightMode: faker.datatype.boolean(),
    emailNotifications: faker.datatype.boolean(),
    smsNotifications: faker.datatype.boolean(),
    reportFrequency: faker.helpers.arrayElement(['daily', 'weekly', 'monthly']),
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h'
  };
};
