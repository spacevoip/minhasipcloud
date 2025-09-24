'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Phone, 
  Clock, 
  Calendar,
  Download,
  Filter,
  Building,
  Target,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function ResellerReportsPage() {
  const [dateRange, setDateRange] = useState('30');
  const [clientFilter, setClientFilter] = useState('all');

  // Mock data para métricas gerais
  const generalStats = {
    totalCalls: 15420,
    totalClients: 45,
    totalAgents: 128,
    avgCallDuration: 245, // segundos
    conversionRate: 68.5,
    clientSatisfaction: 4.2
  };

  // Mock data para chamadas por período
  const callsData = [
    { date: '01/01', calls: 450, duration: 12500 },
    { date: '02/01', calls: 520, duration: 14200 },
    { date: '03/01', calls: 480, duration: 13100 },
    { date: '04/01', calls: 610, duration: 16800 },
    { date: '05/01', calls: 580, duration: 15900 },
    { date: '06/01', calls: 650, duration: 17200 },
    { date: '07/01', calls: 720, duration: 19500 }
  ];

  // Mock data para performance por cliente
  const clientPerformance = [
    { name: 'Tech Solutions', calls: 2850, agents: 8, satisfaction: 4.5 },
    { name: 'Consultoria Pro', calls: 1920, agents: 5, satisfaction: 4.2 },
    { name: 'StartUp Inovação', calls: 1150, agents: 3, satisfaction: 3.8 },
    { name: 'Vendas & Marketing', calls: 3200, agents: 12, satisfaction: 4.7 },
    { name: 'Empresa ABC', calls: 1800, agents: 6, satisfaction: 4.1 }
  ];

  // Mock data para distribuição de chamadas por status
  const callStatusData = [
    { name: 'Atendidas', value: 10540, color: '#10b981' },
    { name: 'Perdidas', value: 2380, color: '#ef4444' },
    { name: 'Ocupado', value: 1850, color: '#f59e0b' },
    { name: 'Não Atendidas', value: 650, color: '#6b7280' }
  ];

  // Mock data para horários de pico
  const peakHoursData = [
    { hour: '08:00', calls: 120 },
    { hour: '09:00', calls: 280 },
    { hour: '10:00', calls: 350 },
    { hour: '11:00', calls: 420 },
    { hour: '12:00', calls: 180 },
    { hour: '13:00', calls: 150 },
    { hour: '14:00', calls: 380 },
    { hour: '15:00', calls: 450 },
    { hour: '16:00', calls: 480 },
    { hour: '17:00', calls: 320 },
    { hour: '18:00', calls: 220 }
  ];

  // Mock data para clientes (para filtro)
  const mockClients = [
    { id: '1', name: 'Tech Solutions Ltda' },
    { id: '2', name: 'Consultoria Pro' },
    { id: '3', name: 'StartUp Inovação' },
    { id: '4', name: 'Vendas & Marketing' },
    { id: '5', name: 'Empresa ABC' }
  ];

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  return (
    <MainLayout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#1e293b', 
              marginBottom: '0.5rem' 
            }}>
              Relatórios
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Análise completa de performance e métricas dos seus clientes
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filtro de Período */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>

            {/* Filtro de Cliente */}
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos os Clientes</option>
              {mockClients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              Exportar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem' 
        }}>
          {/* Total de Chamadas */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Phone size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatNumber(generalStats.totalCalls)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Chamadas</p>
          </div>

          {/* Total de Clientes */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {generalStats.totalClients}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Clientes Ativos</p>
          </div>

          {/* Total de Agentes */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {generalStats.totalAgents}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Agentes Ativos</p>
          </div>

          {/* Duração Média */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatDuration(generalStats.avgCallDuration)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Duração Média</p>
          </div>

          {/* Taxa de Conversão */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Target size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {generalStats.conversionRate}%
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Taxa de Conversão</p>
          </div>

          {/* Satisfação */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Activity size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {generalStats.clientSatisfaction}/5
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Satisfação Média</p>
          </div>
        </div>

        {/* Charts Section */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
          gap: '2rem', 
          marginBottom: '2rem' 
        }}>
          {/* Gráfico de Chamadas por Dia */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
              Chamadas por Dia
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={callsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '0.5rem' 
                  }}
                  formatter={(value: any, name: string) => [
                    formatNumber(value),
                    name === 'calls' ? 'Chamadas' : 'Duração (min)'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="calls" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição de Status das Chamadas */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
              Status das Chamadas
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={callStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {callStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '0.5rem' 
                  }}
                  formatter={(value: any) => [formatNumber(value), 'Chamadas']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {callStatusData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: item.color
                  }} />
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {item.name} ({formatNumber(item.value)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Horários de Pico */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
            Horários de Pico
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={peakHoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '0.5rem' 
                }}
                formatter={(value: any) => [formatNumber(value), 'Chamadas']}
              />
              <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance por Cliente */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
            Performance por Cliente
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Cliente
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Chamadas
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Agentes
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Satisfação
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientPerformance.map((client, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building size={16} style={{ color: '#64748b' }} />
                        <span style={{ fontWeight: '500', color: '#1e293b' }}>{client.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b', fontWeight: '500' }}>
                      {formatNumber(client.calls)}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b', fontWeight: '500' }}>
                      {client.agents}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '500', color: '#1e293b' }}>{client.satisfaction}/5</span>
                        <div style={{
                          width: '60px',
                          height: '6px',
                          backgroundColor: '#f1f5f9',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${(client.satisfaction / 5) * 100}%`,
                            height: '100%',
                            backgroundColor: client.satisfaction >= 4 ? '#10b981' : client.satisfaction >= 3 ? '#f59e0b' : '#ef4444'
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: client.calls > 2500 ? '#dcfce7' : client.calls > 1500 ? '#fef3c7' : '#fee2e2',
                        color: client.calls > 2500 ? '#16a34a' : client.calls > 1500 ? '#d97706' : '#dc2626',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {client.calls > 2500 ? 'Excelente' : client.calls > 1500 ? 'Bom' : 'Regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
