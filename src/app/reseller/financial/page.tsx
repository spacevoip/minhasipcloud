'use client';

import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Calendar, 
  ArrowUpRight,
  Plus,
  Eye,
  Filter,
  X,
  Save,
  Building
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { financeService, type FinanceRecord } from '@/lib/financeService';

interface Transaction {
  id: string;
  type: 'credit_add' | 'plan_payment' | 'commission' | 'debit' | 'credit' | 'subscription' | string;
  clientName: string;
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed' | string;
}

export default function ResellerFinancialPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [creditData, setCreditData] = useState({
    clientId: '',
    amount: '',
    note: ''
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);

  // Placeholder para saldo (origem real não definida aqui)
  const availableCredit = 8500.0;

  // Load real transactions for the reseller
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const offset = (page - 1) * pageSize;
        const res = await financeService.list({ limit: pageSize, offset, orderBy: 'created_at', order: 'desc' });
        const items: FinanceRecord[] = res.data || [];
        const mapped: Transaction[] = items.map((r) => ({
          id: r.id,
          type: mapType(r.type),
          clientName: r.user_id ? `Cliente ${r.user_id}` : (r.reseller_id ? `Revenda ${r.reseller_id}` : 'Desconhecido'),
          amount: r.amount,
          description: r.description || r.product || (r.plan_id ? `Plano ${r.plan_id}` : 'Transação'),
          date: r.created_at,
          status: mapStatus(r.status)
        }));
        setTransactions(mapped);
        setTotal(res.pagination?.total || mapped.length);
      } catch (e: any) {
        console.error('Erro ao carregar transações do financeiro (revenda):', e);
        setError(e?.message || 'Erro ao carregar transações');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, pageSize]);

  // Agregações reais a partir das transações
  const totalRevenue = useMemo(() =>
    transactions
      .filter(t => t.status === 'completed' && t.amount > 0)
      .filter(t => t.type !== 'debit')
      .reduce((sum, t) => sum + t.amount, 0)
  , [transactions]);

  const pendingPayments = useMemo(() =>
    transactions.filter(t => t.status === 'pending' && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
  , [transactions]);

  const monthlyCommission = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    return transactions
      .filter(t => t.status === 'completed')
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      })
      .filter(t => mapType(t.type) === 'commission' || (t.description || '').toLowerCase().includes('comissão'))
      .reduce((sum, t) => sum + Math.max(0, t.amount), 0);
  }, [transactions]);

  const revenueData = useMemo(() => {
    type Agg = { revenue: number; commission: number; date: Date };
    const map = new Map<string, Agg>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      const keyDate = new Date(d.getFullYear(), d.getMonth(), 1);
      const key = `${keyDate.getFullYear()}-${String(keyDate.getMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(key) || { revenue: 0, commission: 0, date: keyDate };
      if (t.status === 'completed') {
        if (t.amount > 0 && t.type !== 'debit') cur.revenue += t.amount;
        const isCommission = mapType(t.type) === 'commission' || (t.description || '').toLowerCase().includes('comissão');
        if (isCommission) cur.commission += Math.max(0, t.amount);
      }
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, v]) => ({
        month: v.date.toLocaleDateString('pt-BR', { month: 'short' }),
        revenue: v.revenue,
        commission: v.commission
      }));
  }, [transactions]);

  // Mock data para clientes
  const mockClients = [
    { id: '1', name: 'Tech Solutions Ltda', currentCredit: 1250.00 },
    { id: '2', name: 'Consultoria Pro', currentCredit: 850.00 },
    { id: '3', name: 'StartUp Inovação', currentCredit: 200.00 }
  ];

  const filteredTransactions = transactions.filter(transaction => {
    return statusFilter === 'all' || transaction.status === statusFilter;
  });

  function mapType(type: string | null): Transaction['type'] {
    if (!type) return 'plan_payment';
    const t = type.toLowerCase();
    if (t.includes('commission')) return 'commission';
    if (t.includes('debit')) return 'debit';
    if (t.includes('subscription')) return 'subscription';
    if (t.includes('credit')) return 'credit';
    if (t.includes('plan') || t.includes('payment') || t.includes('charge')) return 'plan_payment';
    return type;
  }

  function mapStatus(status: string): Transaction['status'] {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'paid' || s === 'success') return 'completed';
    if (s === 'pending' || s === 'processing') return 'pending';
    if (s === 'failed' || s === 'error' || s === 'canceled') return 'failed';
    return status;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'plan_payment': return 'Pagamento Plano';
      case 'credit_add': return 'Adição Crédito';
      case 'credit': return 'Crédito';
      case 'debit': return 'Débito';
      case 'subscription': return 'Assinatura';
      case 'commission': return 'Comissão';
      default: return type;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'plan_payment': return { bg: '#dcfce7', color: '#16a34a' };
      case 'subscription': return { bg: '#dcfce7', color: '#16a34a' };
      case 'credit': return { bg: '#dcfce7', color: '#16a34a' };
      case 'debit': return { bg: '#fee2e2', color: '#dc2626' };
      case 'credit_add': return { bg: '#fef3c7', color: '#d97706' };
      case 'commission': return { bg: '#dbeafe', color: '#2563eb' };
      default: return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: '#dcfce7', color: '#16a34a' };
      case 'pending': return { bg: '#fef3c7', color: '#d97706' };
      case 'failed': return { bg: '#fee2e2', color: '#dc2626' };
      default: return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  const handleAddCreditSubmit = () => {
    if (!creditData.clientId || !creditData.amount.trim()) {
      alert('Selecione um cliente e informe o valor');
      return;
    }

    if (Number(creditData.amount) <= 0) {
      alert('Valor deve ser maior que zero');
      return;
    }

    if (Number(creditData.amount) > availableCredit) {
      alert('Saldo insuficiente para esta operação');
      return;
    }

    console.log('Adição de crédito:', creditData);
    setCreditData({ clientId: '', amount: '', note: '' });
    setShowAddCreditModal(false);
    alert('Crédito adicionado com sucesso!');
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
              Financeiro
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Gerencie seu saldo, créditos e receitas
            </p>
          </div>
          
          <button
            onClick={() => setShowAddCreditModal(true)}
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
            <Plus size={16} />
            Adicionar Crédito
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.5rem', 
          marginBottom: '2rem' 
        }}>
          {/* Saldo Disponível */}
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
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
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
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Saldo Disponível</p>
          </div>

          {/* Receita Total */}
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
                <DollarSign size={20} style={{ color: 'white' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ArrowUpRight size={16} style={{ color: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: '500' }}>
                  +18.2%
                </span>
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(totalRevenue)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Receita Total</p>
          </div>

          {/* Comissão Mensal */}
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
                <TrendingUp size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(monthlyCommission)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Comissão Mensal</p>
          </div>

          {/* Pagamentos Pendentes */}
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
                <Calendar size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(pendingPayments)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Pagamentos Pendentes</p>
          </div>
        </div>

        {/* Gráfico de Receita */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
            Evolução da Receita e Comissões
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
                  formatCurrency(value),
                  name === 'revenue' ? 'Receita' : 'Comissão'
                ]}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="commission" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Filtros */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: '#64748b' }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos os Status</option>
              <option value="completed">Concluído</option>
              <option value="pending">Pendente</option>
              <option value="failed">Falhou</option>
            </select>
          </div>
        </div>

        {/* Tabela de Transações */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              Histórico de Transações
            </h3>
          </div>

          {error && (
            <div style={{ color: '#dc2626', padding: '1rem 1.5rem', borderBottom: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
              {error}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Tipo
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Cliente
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Descrição
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Valor
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Status
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Data
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {(loading ? Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem' }}><div style={{ height: '1rem', width: '6rem', backgroundColor: '#f1f5f9', borderRadius: '0.25rem' }} /></td>
                    <td style={{ padding: '1rem' }}><div style={{ height: '1rem', width: '10rem', backgroundColor: '#f1f5f9', borderRadius: '0.25rem' }} /></td>
                    <td style={{ padding: '1rem' }}><div style={{ height: '1rem', width: '16rem', backgroundColor: '#f1f5f9', borderRadius: '0.25rem' }} /></td>
                    <td style={{ padding: '1rem' }}><div style={{ height: '1rem', width: '5rem', backgroundColor: '#f1f5f9', borderRadius: '0.25rem' }} /></td>
                    <td style={{ padding: '1rem' }}><div style={{ height: '1rem', width: '6rem', backgroundColor: '#f1f5f9', borderRadius: '0.25rem' }} /></td>
                    <td style={{ padding: '1rem' }}><div style={{ height: '1rem', width: '8rem', backgroundColor: '#f1f5f9', borderRadius: '0.25rem' }} /></td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ height: '2rem', width: '2rem', margin: '0 auto', backgroundColor: '#f1f5f9', borderRadius: '0.375rem' }} />
                    </td>
                  </tr>
                )) : filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: getTransactionTypeColor(transaction.type).bg,
                        color: getTransactionTypeColor(transaction.type).color,
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {getTransactionTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Building size={14} style={{ color: '#64748b' }} />
                        <span style={{ fontWeight: '500', color: '#1e293b' }}>{transaction.clientName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                      {transaction.description}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {(() => {
                        const isDebit = transaction.type === 'debit';
                        const amt = Math.abs(transaction.amount);
                        const sign = isDebit ? '-' : '+';
                        const color = isDebit ? '#ef4444' : '#16a34a';
                        return (
                          <span style={{ fontWeight: '600', color }}>
                            {sign}{formatCurrency(amt)}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        backgroundColor: getStatusColor(transaction.status).bg,
                        color: getStatusColor(transaction.status).color,
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {getStatusLabel(transaction.status)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
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
                )))}
              </tbody>
            </table>
          </div>

          {!loading && filteredTransactions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <DollarSign size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Nenhuma transação encontrada</p>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
              {total > 0 ? `Mostrando ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} de ${total}` : 'Sem registros'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', backgroundColor: page === 1 ? '#f8fafc' : 'white', color: '#374151', cursor: page === 1 || loading ? 'not-allowed' : 'pointer' }}
              >
                Anterior
              </button>
              <button
                disabled={page * pageSize >= total || loading}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', backgroundColor: page * pageSize >= total ? '#f8fafc' : 'white', color: '#374151', cursor: page * pageSize >= total || loading ? 'not-allowed' : 'pointer' }}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        {/* Modal Adicionar Crédito */}
        {showAddCreditModal && (
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
                setShowAddCreditModal(false);
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
                maxWidth: '500px'
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
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  Adicionar Crédito
                </h2>
                <button
                  onClick={() => setShowAddCreditModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '0.5rem'
                  }}
                >
                  <X style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
                </button>
              </div>

              {/* Content */}
              <div style={{ padding: '2rem' }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '0.5rem',
                  border: '1px solid #0ea5e9',
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#0c4a6e' }}>
                    <strong>Saldo Disponível:</strong> {formatCurrency(availableCredit)}
                  </p>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {/* Cliente */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Cliente *
                    </label>
                    <select
                      value={creditData.clientId}
                      onChange={(e) => setCreditData(prev => ({ ...prev, clientId: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Selecione um cliente</option>
                      {mockClients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} - Saldo: {formatCurrency(client.currentCredit)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Valor */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Valor (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={creditData.amount}
                      onChange={(e) => setCreditData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="100.00"
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Observação */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Observação
                    </label>
                    <textarea
                      value={creditData.note}
                      onChange={(e) => setCreditData(prev => ({ ...prev, note: e.target.value }))}
                      placeholder="Observações sobre a adição de crédito..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '2rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    onClick={() => setShowAddCreditModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'transparent',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  
                  <button
                    onClick={handleAddCreditSubmit}
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
                      cursor: 'pointer'
                    }}
                  >
                    <Save style={{ width: '1rem', height: '1rem' }} />
                    Adicionar Crédito
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
