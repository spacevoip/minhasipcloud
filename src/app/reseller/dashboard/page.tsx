'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Users,
  DollarSign,
  Phone,
  TrendingUp,
  UserCheck,
  CreditCard,
  Building,
  Target,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Eye
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { clientsService, type ClientData } from '@/lib/clientsService';
import { financeService, type FinanceRecord } from '@/lib/financeService';
import { userService } from '@/lib/userService';

export default function ResellerDashboardPage() {
  // State: dados reais
  const [clients, setClients] = useState<ClientData[]>([]);
  const [availableCredit, setAvailableCredit] = useState<number>(0);
  const [activeAgents, setActiveAgents] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [revenue, setRevenue] = useState<FinanceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Carregar créditos do revendedor (usuário atual)
        const user = await userService.getCurrentUserData();
        if (user && mounted) setAvailableCredit(user.credits || 0);

        // Carregar clientes do revendedor
        const list = await clientsService.getResellerClients();
        if (mounted) setClients(list);

        // Carregar contagem de agentes dos clientes
        const agentsCount = await clientsService.getResellerAgentsCount();
        if (mounted) setActiveAgents(agentsCount);

        // Carregar transações financeiras recentes (últimos 6 meses)
        try {
          const now = new Date();
          const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
          const res = await financeService.list({
            status: 'completed',
            startDate: sixMonthsAgo.toISOString().slice(0, 10),
            endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
            limit: 1000,
          });
          if (mounted) setRevenue(res.data || []);
        } catch (finErr) {
          console.warn('⚠️ Finance: usando sem gráfico devido a erro', finErr);
        }
      } catch (e: any) {
        console.error('❌ Erro ao carregar dashboard do revendedor:', e);
        if (mounted) setError(e?.message || 'Erro ao carregar dados');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Estatísticas derivadas
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const clientsGrowth = 0; // Sem série histórica no momento
  const revenueGrowth = 0; // Sem série histórica no momento

  // Receita mensal agregada por mês (últimos 6 meses)
  const revenueData = useMemo(() => {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const map = new Map<string, number>();
    revenue.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${months[d.getMonth()]}-${d.getFullYear()}`;
      map.set(key, (map.get(key) || 0) + (Number(r.amount) || 0));
    });
    // Construir últimos 6 meses em ordem
    const now = new Date();
    const series: { month: string; revenue: number; clients: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[dt.getMonth()]}-${dt.getFullYear()}`;
      series.push({ month: months[dt.getMonth()], revenue: map.get(key) || 0, clients: 0 });
    }
    return series;
  }, [revenue]);

  // Distribuição de planos a partir dos clientes
  const plansData = useMemo(() => {
    const counts = new Map<string, number>();
    clients.forEach((c) => {
      const name = c.plan_name || c.plan || 'Sem Plano';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    // cores ciclando
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return Array.from(counts.entries()).map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  }, [clients]);

  // Clientes recentes
  const recentClients = useMemo(() => {
    const sorted = [...clients].sort((a, b) => (new Date(b.created_at || '').getTime()) - (new Date(a.created_at || '').getTime()));
    return sorted.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      plan: c.plan_name || c.plan || 'Sem Plano',
      agents: c.agents || 0,
      status: c.status,
      joinDate: c.created_at || new Date().toISOString(),
    }));
  }, [clients]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'inactive': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'inactive': return 'Inativo';
      default: return status;
    }
  };

  return (
    <MainLayout>
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: '#1e293b', 
            marginBottom: '0.5rem' 
          }}>
            Dashboard do Revendedor
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Visão geral do seu negócio e performance de vendas
          </p>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div style={{ marginBottom: '1rem', color: '#64748b' }}>Carregando dados...</div>
        )}
        {!loading && error && (
          <div style={{ marginBottom: '1rem', color: '#ef4444' }}>Erro: {error}</div>
        )}

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem' 
        }}>
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building size={20} style={{ color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowUpRight size={16} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '500' }}>
                  +{clientsGrowth}%
                </span>
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {totalClients}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Clientes</p>
          </div>

          {/* Agentes Ativos */}
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
                <UserCheck size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>{activeAgents}</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Agentes Ativos</p>
          </div>

          {/* Receita Mensal */}
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
                <DollarSign size={20} style={{ color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowUpRight size={16} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '500' }}>
                  +{revenueGrowth}%
                </span>
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(revenueData.at(-1)?.revenue || 0)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Receita Mensal</p>
          </div>

          {/* Crédito Disponível */}
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
                <CreditCard size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(availableCredit)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Crédito Disponível</p>
          </div>
        </div>

        {/* Charts Section */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
          gap: '2rem', 
          marginBottom: '2rem' 
        }}>
          {/* Gráfico de Receita */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
              Evolução da Receita
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '0.5rem' 
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value,
                    name === 'revenue' ? 'Receita' : 'Clientes'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição de Planos */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
              Distribuição de Planos
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={plansData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {plansData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '0.5rem' 
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
              {plansData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: item.color
                  }} />
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {item.name} ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clientes Recentes */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
              Clientes Recentes
            </h3>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Novo Cliente
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                    Cliente
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                    Plano
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                    Agentes
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                    Status
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                    Data
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentClients.map((client) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: '500', color: '#1e293b' }}>{client.name}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {client.plan}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                      {client.agents}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: client.status === 'active' ? '#dcfce7' : '#fef3c7',
                        color: getStatusColor(client.status),
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {getStatusLabel(client.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#64748b' }}>
                      {new Date(client.joinDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        style={{
                          padding: '0.5rem',
                          backgroundColor: 'transparent',
                          border: '1px solid #e2e8f0',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: '#64748b'
                        }}
                      >
                        <Eye size={16} />
                      </button>
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
