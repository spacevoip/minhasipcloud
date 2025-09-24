'use client';

import { useEffect, useState } from 'react';
import { Store, Users, Plus, Edit, Eye, EyeOff, Trash2, Building, X, Upload, Save } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { usersService } from '@/services/usersService';
import { supabase } from '@/lib/supabase';

interface ResellerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  // Optional/unknown fields shown as '-'
  totalClients?: number | null;
  activeClients?: number | null;
}

export default function AdminResellerPage() {
  const toast = useToast();
  const [showNewResellerModal, setShowNewResellerModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newReseller, setNewReseller] = useState({
    user: '',
    name: '',
    company: '',
    whatsapp: '',
    logo: '',
    status: 'active' as 'active' | 'inactive' | 'suspended',
    plan: 'Basic',
    password: ''
  });

  // Real data
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  async function loadResellers() {
    try {
      setLoading(true);
      const { users } = await usersService.getAllUsers({ role: 'reseller', page: 1, limit: 100 });
      const mapped: ResellerRow[] = users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        company: u.company || '',
        status: (u.status as any) || 'active',
        totalClients: null,
        activeClients: null,
      }));

      // ✅ Contabilizar clientes por revenda
      if (mapped.length > 0) {
        const resellerIds = mapped.map(r => r.id);
        // Buscar todos os usuários (clientes) vinculados a esses revendedores
        const { data: clients, error } = await supabase
          .from('users_pabx')
          .select('id, status, parent_reseller_id')
          .eq('role', 'user')
          .in('parent_reseller_id', resellerIds);

        if (!error && clients) {
          // Agrupar por parent_reseller_id
          const totals = new Map<string, { total: number; active: number }>();
          for (const c of clients as Array<{ id: string; status: string; parent_reseller_id: string }>) {
            const rid = c.parent_reseller_id;
            if (!rid) continue;
            const prev = totals.get(rid) || { total: 0, active: 0 };
            prev.total += 1;
            if (c.status === 'active') prev.active += 1;
            totals.set(rid, prev);
          }

          // Mesclar nos revendedores
          const withCounts = mapped.map(r => {
            const t = totals.get(r.id);
            return {
              ...r,
              totalClients: t ? t.total : 0,
              activeClients: t ? t.active : 0,
            } as ResellerRow;
          });
          setResellers(withCounts);
        } else {
          // Falha ao contabilizar clientes por revenda; mantendo lista básica
          setResellers(mapped);
        }
      } else {
        setResellers(mapped);
      }
    } catch (e: any) {
      // Erro ao carregar revendedores
      toast.error('Erro', 'Falha ao carregar revendedores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#64748b';
      case 'suspended': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'suspended': return 'Suspenso';
      default: return status;
    }
  };

  // Removed tier and revenue helpers (no longer used)

  // Funções para o modal de novo revendedor
  const openNewResellerModal = () => {
    setNewReseller({
      user: '',
      name: '',
      company: '',
      whatsapp: '',
      logo: '',
      status: 'active',
      plan: 'Basic',
      password: ''
    });
    setShowNewResellerModal(true);
    setShowPassword(false);
  };

  const closeNewResellerModal = () => {
    setShowNewResellerModal(false);
    setNewReseller({
      user: '',
      name: '',
      company: '',
      whatsapp: '',
      logo: '',
      status: 'active',
      plan: 'Basic',
      password: ''
    });
    setShowPassword(false);
  };

  const handleNewResellerSubmit = async () => {
    // Validações
    if (!newReseller.user.trim()) {
      toast.error('Erro', 'Usuário é obrigatório');
      return;
    }
    if (!newReseller.name.trim()) {
      toast.error('Erro', 'Nome é obrigatório');
      return;
    }
    if (!newReseller.company.trim()) {
      toast.error('Erro', 'Empresa é obrigatória');
      return;
    }
    if (newReseller.password.length < 8) {
      toast.error('Erro', 'Senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newReseller.whatsapp && !/^\d+$/.test(newReseller.whatsapp.replace(/\D/g, ''))) {
      toast.error('Erro', 'WhatsApp deve conter apenas números');
      return;
    }

    try {
      await usersService.createUser({
        name: newReseller.name,
        username: newReseller.user.split('@')[0] || newReseller.user,
        email: newReseller.user,
        password: newReseller.password,
        company: newReseller.company,
        phone: newReseller.whatsapp,
        role: 'reseller',
        status: newReseller.status,
      } as any);

      closeNewResellerModal();
      toast.success('Sucesso', 'Revendedor criado com sucesso!');
      await loadResellers();
    } catch (error) {
      console.error('Erro ao criar revendedor:', error);
      toast.error('Erro', 'Erro ao criar revendedor. Tente novamente.');
    }
  };

  const isPasswordWeak = (password: string) => {
    // Verifica senhas fracas
    const weakPatterns = [
      /^0+$/, /^1+$/, /^2+$/, /^3+$/, /^4+$/, /^5+$/, /^6+$/, /^7+$/, /^8+$/, /^9+$/,
      /^(.)\1+$/, // Caracteres repetidos
      /^123+/, // Sequência 123...
      /^abc+/i, // Sequência abc...
    ];
    
    return weakPatterns.some(pattern => pattern.test(password));
  };

  // Estatísticas
  const totalResellers = resellers.length;
  const activeResellers = resellers.filter(r => r.status === 'active').length;

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
              Gerenciamento de Revendedores
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Gerencie sua rede de revendedores e acompanhe performance
            </p>
          </div>
          
          <button
            onClick={openNewResellerModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Plus style={{ width: '1rem', height: '1rem' }} />
            Novo Revendedor
          </button>
        </div>

        {/* Stats Cards (real data only) */}
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Store size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {loading ? '...' : totalResellers}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Revendedores</p>
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
                <Users size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {loading ? '...' : activeResellers}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Revendedores Ativos</p>
          </div>
        </div>
        {/* Charts removed (depended on mock data) */}

        {/* Resellers Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
              Revendedores Cadastrados
            </h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Revendedor</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Empresa</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Clientes</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((reseller) => {
                  return (
                    <tr key={reseller.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b' }}>
                              {reseller.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>{reseller.name}</div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{reseller.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Building style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
                          <div>
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>{reseller.company}</div>
                            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{reseller.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: `${getStatusColor(reseller.status)}20`,
                          color: getStatusColor(reseller.status)
                        }}>
                          {getStatusLabel(reseller.status)}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{reseller.activeClients ?? '-'}</div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>de {reseller.totalClients ?? '-'}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              color: '#64748b'
                            }}
                            title="Visualizar"
                          >
                            <Eye style={{ width: '1rem', height: '1rem' }} />
                          </button>
                          <button
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              color: '#64748b'
                            }}
                            title="Editar"
                          >
                            <Edit style={{ width: '1rem', height: '1rem' }} />
                          </button>
                          <button
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              color: '#ef4444'
                            }}
                            title="Excluir"
                          >
                            <Trash2 style={{ width: '1rem', height: '1rem' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {resellers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Store size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Nenhum revendedor cadastrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Novo Revendedor */}
      {showNewResellerModal && (
        <div style={{
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
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '1rem',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(20px)',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header do Modal */}
            <div style={{
              padding: '1.5rem 1.5rem 1rem 1.5rem',
              borderBottom: '1px solid rgba(226, 232, 240, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>Novo Revendedor</h2>
              <button
                onClick={closeNewResellerModal}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                {/* Campo Usuário */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Usuário *</label>
                  <input
                    type="text"
                    value={newReseller.user}
                    onChange={(e) => setNewReseller(prev => ({ ...prev, user: e.target.value }))}
                    placeholder="Digite o nome de usuário"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Campo Nome */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Nome Completo *</label>
                  <input
                    type="text"
                    value={newReseller.name}
                    onChange={(e) => setNewReseller(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Digite o nome completo"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                {/* Campo Empresa */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Empresa *</label>
                  <input
                    type="text"
                    value={newReseller.company}
                    onChange={(e) => setNewReseller(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Nome da empresa"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Campo WhatsApp */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>WhatsApp</label>
                  <input
                    type="text"
                    value={newReseller.whatsapp}
                    onChange={(e) => {
                      const numbersOnly = e.target.value.replace(/\D/g, '');
                      setNewReseller(prev => ({ ...prev, whatsapp: numbersOnly }));
                    }}
                    placeholder="Ex: 11999998888 (apenas números)"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)',
                      fontFamily: 'monospace'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                {/* Campo Logo */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Logo (URL)</label>
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}>
                    <input
                      type="url"
                      value={newReseller.logo}
                      onChange={(e) => setNewReseller(prev => ({ ...prev, logo: e.target.value }))}
                      placeholder="https://exemplo.com/logo.png"
                      style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        border: '1px solid rgba(209, 213, 219, 0.8)',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        background: 'rgba(255, 255, 255, 0.8)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      style={{
                        padding: '0.75rem',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title="Fazer upload da logo"
                    >
                      <Upload style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                </div>

                {/* Campo Status */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Status</label>
                  <select
                    value={newReseller.status}
                    onChange={(e) => setNewReseller(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'suspended' }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="suspended">Suspenso</option>
                  </select>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {/* Campo Plano */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Plano</label>
                  <select
                    value={newReseller.plan}
                    onChange={(e) => setNewReseller(prev => ({ ...prev, plan: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#6366f1';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="Basic">Basic</option>
                    <option value="Pro">Pro</option>
                    <option value="Premium">Premium</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Campo Senha */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Senha *</label>
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newReseller.password}
                      onChange={(e) => setNewReseller(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      style={{
                        width: '100%',
                        padding: '0.75rem 3rem 0.75rem 1rem',
                        border: `1px solid ${newReseller.password.length > 0 && newReseller.password.length < 8 ? '#ef4444' : newReseller.password.length > 0 && isPasswordWeak(newReseller.password) ? '#f59e0b' : 'rgba(209, 213, 219, 0.8)'}`,
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        background: 'rgba(255, 255, 255, 0.8)'
                      }}
                      onFocus={(e) => {
                        if (newReseller.password.length === 0 || (newReseller.password.length >= 8 && !isPasswordWeak(newReseller.password))) {
                          e.target.style.borderColor = '#6366f1';
                          e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: '0.25rem',
                        borderRadius: '0.25rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      {showPassword ? <EyeOff style={{ width: '1rem', height: '1rem' }} /> : <Eye style={{ width: '1rem', height: '1rem' }} />}
                    </button>
                  </div>
                  {newReseller.password.length > 0 && newReseller.password.length < 8 && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#ef4444',
                      marginTop: '0.25rem',
                      margin: '0.25rem 0 0 0'
                    }}>
                      Senha deve ter no mínimo 8 caracteres
                    </p>
                  )}
                  {newReseller.password.length >= 8 && isPasswordWeak(newReseller.password) && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#f59e0b',
                      marginTop: '0.25rem',
                      margin: '0.25rem 0 0 0'
                    }}>
                      Senha muito fraca. Evite sequências ou repetições simples.
                    </p>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={closeNewResellerModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(243, 244, 246, 0.8)',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    color: '#374151',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(229, 231, 235, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(243, 244, 246, 0.8)';
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleNewResellerSubmit}
                  disabled={!newReseller.user.trim() || !newReseller.name.trim() || !newReseller.company.trim() || newReseller.password.length < 8 || isPasswordWeak(newReseller.password)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: (!newReseller.user.trim() || !newReseller.name.trim() || !newReseller.company.trim() || newReseller.password.length < 8 || isPasswordWeak(newReseller.password)) 
                      ? 'rgba(156, 163, 175, 0.5)' 
                      : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: (!newReseller.user.trim() || !newReseller.name.trim() || !newReseller.company.trim() || newReseller.password.length < 8 || isPasswordWeak(newReseller.password)) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: (!newReseller.user.trim() || !newReseller.name.trim() || !newReseller.company.trim() || newReseller.password.length < 8 || isPasswordWeak(newReseller.password)) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!(!newReseller.user.trim() || !newReseller.name.trim() || !newReseller.company.trim() || newReseller.password.length < 8 || isPasswordWeak(newReseller.password))) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(99, 102, 241, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(!newReseller.user.trim() || !newReseller.name.trim() || !newReseller.company.trim() || newReseller.password.length < 8 || isPasswordWeak(newReseller.password))) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <Save style={{ width: '1rem', height: '1rem' }} />
                  Criar Revendedor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
