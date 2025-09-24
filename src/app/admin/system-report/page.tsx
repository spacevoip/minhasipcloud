'use client';

import { useState } from 'react';
import { BarChart3, Users, DollarSign, Phone, TrendingUp, TrendingDown, Calendar, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalAgents: number;
  activeAgents: number;
  totalCalls: number;
  totalRevenue: number;
  averageCallDuration: number;
  systemUptime: number;
}

interface MonthlyData {
  month: string;
  users: number;
  revenue: number;
  calls: number;
  agents: number;
}

export default function AdminSystemReportPage() {
  const [dateRange, setDateRange] = useState('thisYear');
  const [reportType, setReportType] = useState('overview');

  // Mock data para métricas do sistema
  const systemMetrics: SystemMetrics = {
    totalUsers: 198,
    activeUsers: 156,
    totalAgents: 847,
    activeAgents: 623,
    totalCalls: 125420,
    totalRevenue: 89750.50,
    averageCallDuration: 245, // segundos
    systemUptime: 99.8
  };

  // Mock data para dados mensais
  const monthlyData: MonthlyData[] = [
    { month: 'Jan', users: 145, revenue: 65420, calls: 95420, agents: 678 },
    { month: 'Fev', users: 152, revenue: 68750, calls: 98750, agents: 712 },
    { month: 'Mar', users: 159, revenue: 72100, calls: 102100, agents: 745 },
    { month: 'Abr', users: 163, revenue: 74800, calls: 105800, agents: 768 },
    { month: 'Mai', users: 171, revenue: 78600, calls: 110600, agents: 789 },
    { month: 'Jun', users: 178, revenue: 81900, calls: 115900, agents: 812 },
    { month: 'Jul', users: 182, revenue: 84200, calls: 119200, agents: 825 },
    { month: 'Ago', users: 186, revenue: 86800, calls: 121800, agents: 834 },
    { month: 'Set', users: 191, revenue: 88500, calls: 123500, agents: 841 },
    { month: 'Out', users: 194, revenue: 89200, calls: 124200, agents: 845 },
    { month: 'Nov', users: 196, revenue: 89600, calls: 124600, agents: 846 },
    { month: 'Dez', users: 198, revenue: 89750, calls: 125420, agents: 847 }
  ];

  // Distribuição por planos
  const planDistribution = [
    { name: 'Basic', value: 35, users: 69, color: '#64748b' },
    { name: 'Business', value: 28, users: 55, color: '#3b82f6' },
    { name: 'Premium', value: 25, users: 50, color: '#8b5cf6' },
    { name: 'Enterprise', value: 12, users: 24, color: '#ef4444' }
  ];

  // Status do sistema
  const systemStatus = [
    { service: 'API Principal', status: 'online', uptime: 99.9 },
    { service: 'Base de Dados', status: 'online', uptime: 99.8 },
    { service: 'Servidor de Mídia', status: 'online', uptime: 99.7 },
    { service: 'Gateway SIP', status: 'warning', uptime: 98.5 },
    { service: 'Sistema de Backup', status: 'online', uptime: 99.9 },
    { service: 'Monitoramento', status: 'online', uptime: 100.0 }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'offline': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'offline': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const getGrowthPercentage = (current: number, previous: number) => {
    return ((current - previous) / previous * 100).toFixed(1);
  };

  // Calcular crescimento mensal
  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData[monthlyData.length - 2];
  
  const userGrowth = getGrowthPercentage(currentMonth.users, previousMonth.users);
  const revenueGrowth = getGrowthPercentage(currentMonth.revenue, previousMonth.revenue);
  const callGrowth = getGrowthPercentage(currentMonth.calls, previousMonth.calls);

  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh', 
        background: '#f8fafc'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
              Relatório do Sistema
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Visão geral completa do sistema: usuários, agentes, financeiro e performance
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                backgroundColor: 'white'
              }}
            >
              <option value="thisMonth">Este Mês</option>
              <option value="lastMonth">Mês Passado</option>
              <option value="thisYear">Este Ano</option>
              <option value="lastYear">Ano Passado</option>
            </select>
            
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Download style={{ width: '1rem', height: '1rem' }} />
              Exportar
            </button>
          </div>
        </div>

        {/* Main Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem' 
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
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
                <Users size={20} style={{ color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <TrendingUp style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '500' }}>
                  +{userGrowth}%
                </span>
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {systemMetrics.totalUsers}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Total de Usuários ({systemMetrics.activeUsers} ativos)
            </p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
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
                <DollarSign size={20} style={{ color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <TrendingUp style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '500' }}>
                  +{revenueGrowth}%
                </span>
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(systemMetrics.totalRevenue)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Receita Total</p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
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
                <Phone size={20} style={{ color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <TrendingUp style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '500' }}>
                  +{callGrowth}%
                </span>
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {systemMetrics.totalCalls.toLocaleString()}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Chamadas</p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
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
                <BarChart3 size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {systemMetrics.systemUptime}%
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Uptime do Sistema</p>
          </div>
        </div>

        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Growth Chart */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem' }}>
              Crescimento Anual
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Usuários"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="agents" 
                    stackId="2"
                    stroke="#10b981" 
                    fill="#10b981"
                    fillOpacity={0.6}
                    name="Agentes"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem' }}>
              Distribuição por Plano
            </h3>
            <div style={{ height: '200px', marginBottom: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    dataKey="value"
                  >
                    {planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {planDistribution.map((plan) => (
                <div key={plan.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      borderRadius: '50%',
                      backgroundColor: plan.color
                    }} />
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{plan.name}</span>
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e293b' }}>
                    {plan.users}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
              Status dos Serviços
            </h3>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <RefreshCw style={{ width: '1rem', height: '1rem' }} />
              Atualizar
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {systemStatus.map((service) => {
              const StatusIcon = getStatusIcon(service.status);
              return (
                <div
                  key={service.service}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <StatusIcon 
                      style={{ 
                        width: '1.25rem', 
                        height: '1.25rem', 
                        color: getStatusColor(service.status) 
                      }} 
                    />
                    <div>
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{service.service}</div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Uptime: {service.uptime}%
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: `${getStatusColor(service.status)}20`,
                    color: getStatusColor(service.status),
                    textTransform: 'capitalize'
                  }}>
                    {service.status === 'online' ? 'Online' : service.status === 'warning' ? 'Atenção' : 'Offline'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue Chart */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem' }}>
            Evolução da Receita
          </h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(value), 'Receita']}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
