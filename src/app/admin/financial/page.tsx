'use client';

import { useEffect, useMemo, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Download, Calendar, Filter, CreditCard, Users, Building, ArrowUpRight, ArrowDownRight, Plus, X, Save, Eye, Receipt } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { ResponsiveCard, useIsMobile } from '@/components/ui/responsive-card';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { DataExport } from '@/components/ui/data-export';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { financeService, FinanceRecord } from '@/lib/financeService';
import { usersService } from '@/services/usersService';
import { plansService } from '@/services/plansService';

interface Transaction {
  id: string;
  userName: string;
  beneficiaryName?: string;
  type: 'payment' | 'upgrade' | 'downgrade' | 'refund' | 'debit' | 'credit' | 'subscription' | string;
  amount: number;
  plan: string;
  status: 'completed' | 'pending' | 'failed' | string;
  date: Date;
}

interface RevenueData {
  month: string;
  revenue: number;
  transactions: number;
}

export default function AdminFinancialPage() {
  const [dateRange, setDateRange] = useState('30');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionData, setTransactionData] = useState({
    clientId: '',
    type: 'credit' as 'credit' | 'plan_renewal' | 'plan_upgrade' | 'other',
    amount: '',
    note: ''
  });
  const [statusFilter, setStatusFilter] = useState('all');

  // Transações reais (carregadas da API)
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks UX
  const toast = useToast();
  const isMobile = useIsMobile();
  const { currentPage, totalPages, currentData, nextPage, prevPage, goToPage } = usePagination(transactions, 10);

  // Dados agregados reais para gráficos (derivados de transactions)
  const revenueData: RevenueData[] = useMemo(() => {
    // Agregar por mês/ano (YYYY-MM)
    const map = new Map<string, { revenue: number; transactions: number; date: Date }>();
    transactions
      .filter(t => t.status === 'completed' && t.amount > 0 && t.type !== 'debit')
      .forEach(t => {
        const d = new Date(t.date.getFullYear(), t.date.getMonth(), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const cur = map.get(key) || { revenue: 0, transactions: 0, date: d };
        cur.revenue += t.amount;
        cur.transactions += 1;
        map.set(key, cur);
      });
    // Ordenar por chave (tempo)
    const ordered = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, v]) => ({
        month: v.date.toLocaleDateString('pt-BR', { month: 'short' }),
        revenue: v.revenue,
        transactions: v.transactions
      }));
    return ordered;
  }, [transactions]);

  const planDistribution = useMemo(() => {
    // Agregar valores por plano (usando nome do plano resolvido em transaction.plan)
    const map = new Map<string, number>();
    transactions
      .filter(t => t.status === 'completed' && t.amount > 0 && t.type !== 'debit')
      .forEach(t => {
        const name = t.plan || 'Sem Plano';
        map.set(name, (map.get(name) || 0) + t.amount);
      });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    const palette = ['#64748b', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#0ea5e9', '#a78bfa'];
    return Array.from(map.entries()).map(([name, value], idx) => ({
      name,
      value: Math.round((value / total) * 100),
      color: palette[idx % palette.length]
    }));
  }, [transactions]);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    return matchesStatus;
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await financeService.list({ orderBy: 'created_at', order: 'desc', limit: 100 });
        const records = (res.data || []);

        // Map inicial com placeholders
        const mapped: Transaction[] = records.map((r: FinanceRecord) => ({
          id: String(r.id),
          userName: r.user_id ? `Usuário ${r.user_id}` : r.reseller_id ? `Revenda ${r.reseller_id}` : '—',
          beneficiaryName: (r.customer_id || r.user_id) ? `Cliente ${r.customer_id || r.user_id}` : '—',
          type: mapType(r.type),
          amount: r.amount || 0,
          plan: r.product || (r.plan_id ? `Plano ${r.plan_id}` : (r.description || '—')),
          status: (r.status as any) || 'completed',
          date: new Date(r.created_at)
        }));

        // Resolver nomes reais (quem realizou e beneficiário)
        const performerIds = Array.from(new Set(records.map(r => r.user_id).filter(Boolean))) as string[];
        const beneficiaryIds = Array.from(new Set(records.map(r => (r.customer_id || r.user_id)).filter(Boolean))) as string[];

        // Resolver nomes de planos por plan_id
        const planIds = Array.from(new Set(records.map(r => r.plan_id).filter(Boolean))) as string[];

        const [performers, beneficiaries, plans] = await Promise.all([
          Promise.all(performerIds.map(id => usersService.getUserById(id).catch(() => null))),
          Promise.all(beneficiaryIds.map(id => usersService.getUserById(id).catch(() => null))),
          Promise.all(planIds.map(id => plansService.getPlanById(id).catch(() => null)))
        ]);

        const performerMap = new Map<string, string>();
        performers.forEach((u, idx) => { if (u) performerMap.set(performerIds[idx], u.name || `Usuário ${performerIds[idx]}`); });
        const beneficiaryMap = new Map<string, string>();
        beneficiaries.forEach((u, idx) => { if (u) beneficiaryMap.set(beneficiaryIds[idx], u.name || `Cliente ${beneficiaryIds[idx]}`); });

        const planMap = new Map<string, string>();
        plans.forEach((p, idx) => { if (p) planMap.set(planIds[idx], p.name); });

        const enriched = mapped.map((t, i) => {
          const r = records[i];
          const beneficiaryId = r.customer_id || r.user_id || null;
          return {
            ...t,
            userName: r.user_id ? (performerMap.get(r.user_id) || t.userName) : t.userName,
            beneficiaryName: beneficiaryId ? (beneficiaryMap.get(beneficiaryId) || t.beneficiaryName) : t.beneficiaryName,
            plan: r.plan_id ? (planMap.get(r.plan_id) || t.plan) : t.plan,
          };
        });

        setTransactions(enriched);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Erro ao carregar transações');
        toast.error('Erro', e.message || 'Erro ao carregar transações');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  function mapType(type: string | null | undefined): Transaction['type'] {
    if (!type) return 'payment';
    const t = type.toLowerCase();
    if (t.includes('debit')) return 'debit';
    if (t.includes('subscription')) return 'subscription';
    if (t.includes('credit')) return 'credit';
    if (t.includes('upgrade')) return 'upgrade';
    if (t.includes('downgrade')) return 'downgrade';
    if (t.includes('refund')) return 'refund';
    if (t.includes('payment') || t.includes('plan') || t.includes('charge')) return 'payment';
    return type;
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'payment': return '#10b981';
      case 'upgrade': return '#3b82f6';
      case 'downgrade': return '#f59e0b';
      case 'refund': return '#ef4444';
      case 'credit': return '#16a34a';
      case 'subscription': return '#16a34a';
      case 'debit': return '#dc2626';
      default: return '#64748b';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'payment': return 'Pagamento';
      case 'upgrade': return 'Upgrade';
      case 'downgrade': return 'Downgrade';
      case 'refund': return 'Reembolso';
      case 'credit': return 'Crédito';
      case 'subscription': return 'Assinatura';
      case 'debit': return 'Débito';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'paid': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Mock data para clientes (para o seletor)
  const mockClients = [
    { id: '1', name: 'João Silva', company: 'Empresa ABC' },
    { id: '2', name: 'Maria Santos', company: 'Tech Solutions' },
    { id: '3', name: 'Carlos Oliveira', company: 'StartUp Inovação' },
    { id: '4', name: 'Ana Costa', company: 'Consultoria Pro' },
    { id: '5', name: 'Pedro Almeida', company: 'Vendas & Cia' }
  ];

  // Funções para o modal de lançamento
  const openTransactionModal = () => {
    setTransactionData({
      clientId: '',
      type: 'credit',
      amount: '',
      note: ''
    });
    setShowTransactionModal(true);
  };

  const closeTransactionModal = () => {
    setShowTransactionModal(false);
    setTransactionData({
      clientId: '',
      type: 'credit',
      amount: '',
      note: ''
    });
  };

  const handleTransactionSubmit = async () => {
    // Validações
    if (!transactionData.clientId) {
      toast.error('Erro', 'Selecione um cliente');
      return;
    }
    
    if (!transactionData.amount.trim() || isNaN(Number(transactionData.amount))) {
      toast.error('Erro', 'Valor deve ser um número válido');
      return;
    }
    
    if (Number(transactionData.amount) <= 0) {
      toast.error('Erro', 'Valor deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        customer_id: transactionData.clientId,
        amount: Number(transactionData.amount),
        type: transactionData.type,
        description: transactionData.note || null,
        product: null,
        plan_id: null,
        status: 'completed' as const
      };

      const resp = await financeService.create(payload);
      const r = resp.data;

      const created: Transaction = {
        id: String(r.id),
        userName: r.user_id ? `Usuário ${r.user_id}` : r.reseller_id ? `Revenda ${r.reseller_id}` : '—',
        beneficiaryName: (r.customer_id || r.user_id) ? `Cliente ${r.customer_id || r.user_id}` : '—',
        type: mapType(r.type),
        amount: r.amount || 0,
        plan: r.product || (r.plan_id ? `Plano ${r.plan_id}` : (r.description || '—')),
        status: (r.status as any) || 'completed',
        date: new Date(r.created_at)
      };

      setTransactions(prev => [created, ...prev]);
      closeTransactionModal();
      toast.success('Sucesso', 'Lançamento realizado com sucesso!');
    } catch (error) {
      console.error('Erro ao realizar lançamento:', error);
      toast.error('Erro', 'Erro ao realizar lançamento. Tente novamente.');
    }
    finally {
      setLoading(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'credit': return 'Recarga Crédito';
      case 'plan_renewal': return 'Plano Renovação';
      case 'plan_upgrade': return 'Upgrade Plano';
      case 'other': return 'Outros';
      default: return type;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR');
  };

  // Cálculos para estatísticas
  const totalRevenue = transactions
    .filter(t => t.status === 'completed' && t.amount > 0 && t.type !== 'debit')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const pendingAmount = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalTransactions = transactions.filter(t => t.status === 'completed').length;
  
  const averageTicket = totalRevenue / totalTransactions;

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
              Gestão Financeira
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Acompanhe receitas, transações e análises financeiras
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={openTransactionModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '1rem', height: '1rem' }} />
              Realizar Lançamento
            </button>
            
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
              Exportar Relatório
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
              <TrendingUp style={{ width: '1.25rem', height: '1.25rem', color: '#10b981' }} />
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(totalRevenue)}
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
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CreditCard size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(pendingAmount)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Valores Pendentes</p>
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Receipt size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {totalTransactions}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Transações</p>
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
                <TrendingUp size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(averageTicket)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Ticket Médio</p>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
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
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value), 'Receita']}
                    labelStyle={{ color: '#1e293b' }}
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
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
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
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  backgroundColor: 'white'
                }}
              >
                <option value="all">Todos os Status</option>
                <option value="completed">Concluído</option>
                <option value="pending">Pendente</option>
                <option value="failed">Falhou</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
              Transações Recentes
            </h3>
          </div>
          {/* Spinner keyframes for loading animation */}
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
          
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '2rem'
            }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                border: '3px solid #e2e8f0',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ color: '#64748b' }}>Carregando transações...</span>
            </div>
          ) : isMobile ? (
            // Mobile Cards
            <div style={{ padding: '1rem' }}>
              {currentData.map((transaction) => (
                <ResponsiveCard
                  key={transaction.id}
                  title={transaction.userName}
                  subtitle={formatDate(transaction.date)}
                  status={{
                    label: getStatusLabel(transaction.status),
                    color: getStatusColor(transaction.status),
                    bgColor: `${getStatusColor(transaction.status)}20`
                  }}
                  fields={[
                    {
                      label: 'Tipo',
                      value: (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: `${getTypeColor(transaction.type)}20`,
                          color: getTypeColor(transaction.type)
                        }}>
                          {getTypeLabel(transaction.type)}
                        </span>
                      )
                    },
                    {
                      label: 'Beneficiário',
                      value: transaction.beneficiaryName || '—'
                    },
                    {
                      label: 'Valor',
                      value: (() => {
                        const isDebit = transaction.type === 'debit';
                        const amt = Math.abs(transaction.amount);
                        const sign = isDebit ? '-' : '+';
                        const color = isDebit ? '#ef4444' : '#10b981';
                        return (
                          <span style={{ fontWeight: '500', color }}>
                            {sign}{formatCurrency(amt)}
                          </span>
                        );
                      })(),
                      highlight: true
                    },
                    {
                      label: 'Plano',
                      value: transaction.plan
                    }
                  ]}
                  actions={
                    <button
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                      title="Visualizar Detalhes"
                    >
                      <Eye style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            // Desktop Table
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Quem Realizou ?</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Beneficiário</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Tipo</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Valor</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Plano</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Data</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((transaction) => (
                    <tr key={transaction.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>
                        {transaction.userName}
                      </td>
                      <td style={{ padding: '1rem', color: '#1e293b' }}>
                        {transaction.beneficiaryName || '—'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: `${getTypeColor(transaction.type)}20`,
                          color: getTypeColor(transaction.type)
                        }}>
                          {getTypeLabel(transaction.type)}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>
                        {(() => {
                          const isDebit = transaction.type === 'debit';
                          const amt = Math.abs(transaction.amount);
                          const sign = isDebit ? '-' : '+';
                          const color = isDebit ? '#ef4444' : '#10b981';
                          return (
                            <span style={{ color }}>
                              {sign}{formatCurrency(amt)}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b' }}>
                        {transaction.plan}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: `${getStatusColor(transaction.status)}20`,
                          color: getStatusColor(transaction.status)
                        }}>
                          {getStatusLabel(transaction.status)}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b' }}>
                        {formatDate(transaction.date)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#64748b'
                          }}
                          title="Visualizar Detalhes"
                        >
                          <Eye style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredTransactions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <DollarSign size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Nenhuma transação encontrada</p>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ marginTop: '2rem' }}>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal Realizar Lançamento */}
      {showTransactionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeTransactionModal();
            }
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1f2937'
                }}
              >
                Realizar Lançamento
              </h2>
              <button
                onClick={closeTransactionModal}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem'
                }}
              >
                {/* Seletor de Cliente */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Cliente *
                  </label>
                  <select
                    value={transactionData.clientId}
                    onChange={(e) => setTransactionData(prev => ({ ...prev, clientId: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Selecione um cliente</option>
                    {mockClients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - {client.company}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Lançamento */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Tipo de Lançamento *
                  </label>
                  <select
                    value={transactionData.type}
                    onChange={(e) => setTransactionData(prev => ({ ...prev, type: e.target.value as any }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="credit">Recarga Crédito</option>
                    <option value="plan_renewal">Plano Renovação</option>
                    <option value="plan_upgrade">Upgrade Plano</option>
                    <option value="other">Outros</option>
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transactionData.amount}
                    onChange={(e) => setTransactionData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="100.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Anotação */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Anotação
                  </label>
                  <textarea
                    value={transactionData.note}
                    onChange={(e) => setTransactionData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Observações sobre o lançamento..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '80px'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '2rem',
                  justifyContent: 'flex-end'
                }}
              >
                <button
                  onClick={closeTransactionModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleTransactionSubmit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(22, 163, 74, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)';
                  }}
                >
                  <Save style={{ width: '1rem', height: '1rem' }} />
                  Realizar Lançamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
