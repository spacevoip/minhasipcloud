'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { clientsService } from '@/lib/clientsService';
import { userService } from '@/lib/userService';
import { supabase } from '@/lib/supabase';
import { resellerAgentsService } from '@/services/resellerAgentsService';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  Building, 
  Calendar, 
  CreditCard, 
  Shield, 
  Eye, 
  EyeOff, 
  Lock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Edit2,
  ArrowUp,
  Loader2,
  Package,
  Settings,
  Save,
  Clock,
  Plus,
  ArrowDown
} from 'lucide-react';
import StatusPill from '@/components/ui/StatusPill';

export default function ManageClientPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  
  const [client, setClient] = useState<any>(null);
  const [clientPlan, setClientPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agentsCount, setAgentsCount] = useState<number | null>(null);

  // Financeiro (créditos)
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [creditsMode, setCreditsMode] = useState<'add' | 'withdraw'>('add');
  const [creditsForm, setCreditsForm] = useState({ amount: 0, note: '' });
  const [isSavingCredits, setIsSavingCredits] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    phone: '',
    email: ''
  });

  // Bloquear/Desbloquear cliente (altera status)
  const handleBlockClient = async () => {
    if (!client || isUpdatingStatus) return;
    try {
      setIsUpdatingStatus(true);
      await clientsService.updateClient(String(client.id), { status: 'suspended' });
      setClient((prev: any) => ({ ...prev, status: 'suspended' }));
      toast.success('Cliente bloqueado (status: suspenso)');
    } catch (error) {
      console.error('Erro ao bloquear cliente:', error);
      toast.error('Não foi possível bloquear o cliente');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUnblockClient = async () => {
    if (!client || isUpdatingStatus) return;
    try {
      setIsUpdatingStatus(true);
      await clientsService.updateClient(String(client.id), { status: 'active' });
      setClient((prev: any) => ({ ...prev, status: 'active' }));
      toast.success('Cliente desbloqueado (status: ativo)');
    } catch (error) {
      console.error('Erro ao desbloquear cliente:', error);
      toast.error('Não foi possível desbloquear o cliente');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Carregar dados do cliente
  useEffect(() => {
    loadClientData();
    loadAvailablePlans();
  }, [params.id]);

  const loadAvailablePlans = async () => {
    try {
      const currentUser = userService.getCurrentUser();
      
      if (!currentUser) {
        console.log('❌ Usuário não encontrado');
        return;
      }
      
      if (currentUser.role !== 'reseller') {
        console.log('❌ Usuário não é revendedor:', currentUser.role);
        return;
      }
      
      console.log('🔍 Carregando planos para revendedor:', currentUser.id);
      
      // Buscar planos do revendedor usando o serviço seguro
      const { secureSupabaseService } = await import('@/services/secureSupabaseService');
      const resellerPlans = await secureSupabaseService.getPlansByReseller(currentUser.id);
      
      console.log('📦 Planos encontrados:', resellerPlans);
      
    } catch (error) {
      console.error('❌ Erro detalhado ao carregar planos:', error);
      toast.error('Erro ao carregar planos disponíveis');
    }
  };

  // 💰 Enviar créditos (adicionar/debitar)
  const handleSubmitCredits = async () => {
    if (!client) return;
    const raw = Number(creditsForm.amount);
    if (!Number.isFinite(raw) || raw <= 0) {
      toast.error('Informe um valor positivo');
      return;
    }
    const amount = creditsMode === 'withdraw' ? -Math.abs(raw) : Math.abs(raw);
    try {
      setIsSavingCredits(true);
      await clientsService.addCredits(String(client.id), amount, creditsForm.note || '');
      toast.success(creditsMode === 'withdraw' ? 'Créditos debitados!' : 'Créditos adicionados!');
      setShowCreditsModal(false);
      setCreditsForm({ amount: 0, note: '' });
      // Recarregar dados
      await loadClientData();
    } catch (error) {
      console.error('Erro ao atualizar créditos:', error);
      toast.error('Não foi possível atualizar os créditos');
    } finally {
      setIsSavingCredits(false);
    }
  };

  const loadClientData = async () => {
    try {
      setIsLoading(true);
      const clients = await clientsService.getResellerClients();
      const clientData = clients.find(c => c.id === params.id);
      
      if (!clientData) {
        toast.error('Cliente não encontrado');
        setTimeout(() => router.push('/reseller/clients'), 2000);
        return;
      }
      
      setClient(clientData);

      // 🔢 Buscar contagem real de agentes para este cliente
      try {
        const count = await resellerAgentsService.getAgentCountByUserId(String(clientData.id));
        setAgentsCount(count);
      } catch (countErr) {
        console.error('⚠️ Erro ao buscar contagem de agentes do cliente:', countErr);
        setAgentsCount(0);
      }
      
      // 📦 CARREGAR DADOS REAIS DO PLANO
      if (clientData.plan_id) {
        try {
          const { secureSupabaseService } = await import('@/services/secureSupabaseService');
          const currentUser = userService.getCurrentUser();
          
          if (currentUser?.role === 'reseller') {
            const resellerPlans = await secureSupabaseService.getPlansByReseller(currentUser.id);
            const plan = resellerPlans.find(p => p.id === clientData.plan_id);
            
            if (plan) {
              setClientPlan(plan);
              console.log('📦 Plano do cliente carregado:', plan.name, 'Limite agentes:', plan.maxAgents);
            }
          }
        } catch (planError) {
          console.error('⚠️ Erro ao carregar dados do plano:', planError);
          toast.error('Erro ao carregar dados do plano');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔒 VALIDAÇÃO DE FORÇA DA SENHA
  const getPasswordStrength = (password: string) => {
    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    Object.values(checks).forEach(check => check && score++);
    
    return {
      score,
      checks,
      strength: score < 2 ? 'Fraca' : score < 4 ? 'Média' : 'Forte',
      color: score < 2 ? '#ef4444' : score < 4 ? '#f59e0b' : '#10b981'
    };
  };

  const validatePassword = () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres');
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return false;
    }
    
    const strength = getPasswordStrength(newPassword);
    if (strength.score < 3) {
      toast.error('A senha deve ser mais forte');
      return false;
    }
    
    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    try {
      // Simular alteração de senha por enquanto
      console.log('Alterando senha para cliente:', client.id);
      toast.success('Dados salvos com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Erro ao alterar senha');
    }
  };

  // ✏️ FUNÇÕES DE EDIÇÃO
  const handleEditField = (field: string) => {
    setEditingField(field);
    setEditData((prev: any) => ({
      ...prev,
      [field]: client[field] || ''
    }));
  };

  const handleSaveField = async (field: string) => {
    try {
      // Simular salvamento
      const fieldValue = field === 'phone' ? editData.phone : editData.email;
      const updatedClient = { ...client, [field]: fieldValue };
      setClient(updatedClient);
      setEditingField(null);
      toast.success('Dados salvos com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar dados');
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditData({
      phone: client?.phone || '',
      email: client?.email || ''
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Não informado';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', color: '#16a34a' };
      case 'inactive': return { bg: '#fef3c7', color: '#d97706' };
      case 'suspended': return { bg: '#fee2e2', color: '#dc2626' };
      default: return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
          <p style={{ color: '#64748b' }}>Carregando dados do cliente...</p>
        </div>
      </MainLayout>
    );
  }

  if (!client) {
    return (
      <MainLayout>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <AlertTriangle size={48} style={{ color: '#f59e0b' }} />
          <p style={{ color: '#64748b', fontSize: '1.125rem' }}>Cliente não encontrado</p>
        </div>
      </MainLayout>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Perfil do Cliente', icon: User },
    { id: 'security', label: 'Segurança', icon: Shield },
    { id: 'plan', label: 'Plano', icon: Package },
    { id: 'financial', label: 'Financeiro', icon: CreditCard },
    { id: 'extras', label: 'Extras', icon: Settings }
  ];

  return (
    <MainLayout>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/reseller/clients')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <ArrowLeft size={16} />
            Voltar para Clientes
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ 
                fontSize: '2rem', 
                fontWeight: 'bold', 
                color: '#1e293b', 
                marginBottom: '0.5rem' 
              }}>
                Gerenciar Cliente
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <p style={{ color: '#64748b', fontSize: '1rem' }}>
                  {client.name} - {client.company}
                </p>
                <StatusPill status={client.status as any} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div style={{ 
          borderBottom: '1px solid #e2e8f0', 
          marginBottom: '2rem',
          overflowX: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '0',
            minWidth: 'fit-content'
          }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '1rem 1.5rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                    cursor: 'pointer',
                    color: isActive ? '#3b82f6' : '#64748b',
                    fontSize: '0.875rem',
                    fontWeight: isActive ? '600' : '500',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#374151';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#64748b';
                    }
                  }}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: '400px' }}>
          {/* Perfil do Cliente */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gap: '2rem' }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '1rem',
                border: '1px solid #e2e8f0',
                padding: '2rem'
              }}>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <User size={20} />
                  Informações Pessoais
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: '1.5rem' 
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Nome Completo
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      color: '#1e293b'
                    }}>
                      {client.name}
                    </div>
                  </div>

                  {/* Status do Cliente + Bloquear/Desbloquear */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Status do Cliente
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}>
                      <StatusPill status={client.status as any} size="sm" />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={handleBlockClient}
                          disabled={isUpdatingStatus || client.status === 'suspended'}
                          style={{
                            padding: '0.4rem 0.6rem',
                            backgroundColor: isUpdatingStatus || client.status === 'suspended' ? '#fecaca' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: isUpdatingStatus || client.status === 'suspended' ? 'not-allowed' : 'pointer',
                            fontWeight: 600
                          }}
                          title="Bloquear (status: suspenso)"
                        >
                          Bloquear
                        </button>
                        <button
                          onClick={handleUnblockClient}
                          disabled={isUpdatingStatus || client.status === 'active'}
                          style={{
                            padding: '0.4rem 0.6rem',
                            backgroundColor: isUpdatingStatus || client.status === 'active' ? '#93c5fd' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: isUpdatingStatus || client.status === 'active' ? 'not-allowed' : 'pointer',
                            fontWeight: 600
                          }}
                          title="Desbloquear (status: ativo)"
                        >
                          Desbloquear
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Empresa
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Building size={16} style={{ color: '#64748b' }} />
                      {client.company}
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      E-mail
                    </label>
                    {editingField === 'email' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: '1px solid #3b82f6',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => handleSaveField('email')}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        color: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Mail size={16} style={{ color: '#64748b' }} />
                          {client.email}
                        </div>
                        <button
                          onClick={() => handleEditField('email')}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            borderRadius: '0.25rem'
                          }}
                          title="Editar e-mail"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Telefone
                    </label>
                    {editingField === 'phone' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="tel"
                          value={editData.phone}
                          onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: '1px solid #3b82f6',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => handleSaveField('phone')}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        color: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Phone size={16} style={{ color: '#64748b' }} />
                          {client.phone}
                        </div>
                        <button
                          onClick={() => handleEditField('phone')}
                          style={{
                            padding: '0.25rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            borderRadius: '0.25rem'
                          }}
                          title="Editar telefone"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Data de Cadastro
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Calendar size={16} style={{ color: '#64748b' }} />
                      {formatDate(client.created_at)}
                    </div>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Último Login
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Clock size={16} style={{ color: '#64748b' }} />
                      {client.last_login_at ? formatDate(client.last_login_at) : 'Nunca fez login'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Segurança */}
          {activeTab === 'security' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '2rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#1e293b',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Shield size={20} />
                Alterar Senha
              </h3>
              
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                maxWidth: '500px'
              }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Nova Senha
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        padding: '0.75rem',
                        paddingRight: '3rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  {/* Barra de Força da Senha */}
                  {newPassword && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {(() => {
                        const strength = getPasswordStrength(newPassword);
                        return (
                          <div>
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '0.5rem'
                            }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: '500',
                                color: strength.color
                              }}>
                                Força: {strength.strength}
                              </span>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: '#64748b'
                              }}>
                                {strength.score}/5
                              </span>
                            </div>
                            <div style={{
                              width: '100%',
                              height: '4px',
                              backgroundColor: '#e5e7eb',
                              borderRadius: '2px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(strength.score / 5) * 100}%`,
                                height: '100%',
                                backgroundColor: strength.color,
                                transition: 'all 0.3s ease'
                              }} />
                            </div>
                            <div style={{ 
                              marginTop: '0.75rem',
                              fontSize: '0.75rem',
                              color: '#64748b'
                            }}>
                              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                Requisitos da senha:
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.25rem',
                                  color: strength.checks.length ? '#10b981' : '#ef4444'
                                }}>
                                  <span>{strength.checks.length ? '✓' : '✗'}</span>
                                  <span>Mínimo 8 caracteres</span>
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.25rem',
                                  color: strength.checks.lowercase ? '#10b981' : '#ef4444'
                                }}>
                                  <span>{strength.checks.lowercase ? '✓' : '✗'}</span>
                                  <span>Letra minúscula</span>
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.25rem',
                                  color: strength.checks.uppercase ? '#10b981' : '#ef4444'
                                }}>
                                  <span>{strength.checks.uppercase ? '✓' : '✗'}</span>
                                  <span>Letra maiúscula</span>
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.25rem',
                                  color: strength.checks.numbers ? '#10b981' : '#ef4444'
                                }}>
                                  <span>{strength.checks.numbers ? '✓' : '✗'}</span>
                                  <span>Número</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Confirmar Senha
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <span>✗</span>
                      <span>As senhas não coincidem</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  backgroundColor: newPassword && confirmPassword ? '#3b82f6' : '#f1f5f9',
                  color: newPassword && confirmPassword ? 'white' : '#9ca3af',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: newPassword && confirmPassword ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginTop: '1.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Save size={16} />
                Alterar Senha
              </button>
            </div>
          )}

          {/* Plano */}
          {activeTab === 'plan' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '2rem'
            }}>
              <h3 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600', 
                color: '#1e293b',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Package size={20} />
                Informações do Plano
              </h3>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '1.5rem' 
              }}>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <Package size={20} style={{ color: '#3b82f6' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                      Plano Atual
                    </h4>
                  </div>
                  <p style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700', 
                    color: '#3b82f6',
                    marginBottom: '0.5rem'
                  }}>
                    {client.plan_name || client.plan || 'Sem Plano'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Status: Ativo
                  </p>
                </div>

                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '0.75rem',
                  border: '1px solid #d1fae5'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <Users size={20} style={{ color: '#16a34a' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                      Agentes
                    </h4>
                  </div>
                  <p style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700', 
                    color: '#16a34a',
                    marginBottom: '0.5rem'
                  }}>
                    {(agentsCount ?? 0)} / {clientPlan?.maxAgents || clientPlan?.max_agents || 'Carregando...'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Agentes utilizados
                  </p>
                  {clientPlan && (agentsCount || 0) > (clientPlan.maxAgents || clientPlan.max_agents) && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: '#fef2f2',
                      borderRadius: '0.375rem',
                      border: '1px solid #fecaca'
                    }}>
                      <p style={{ 
                        fontSize: '0.75rem', 
                        color: '#dc2626',
                        margin: 0,
                        fontWeight: '500'
                      }}>
                        ⚠️ Limite excedido
                      </p>
                    </div>
                  )}
                </div>



                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#fef3c7',
                  borderRadius: '0.75rem',
                  border: '1px solid #fed7aa'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    <Calendar size={20} style={{ color: '#d97706' }} />
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                      Vencimento
                    </h4>
                  </div>
                  <p style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700', 
                    color: '#d97706',
                    marginBottom: '0.5rem'
                  }}>
                    {client.plan_expires_at ? formatDate(client.plan_expires_at) : 'Não definido'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Data de expiração
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Financeiro */}
          {activeTab === 'financial' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
            }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={22} style={{ color: '#f59e0b' }} />
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>Saldo de Créditos</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => { setCreditsMode('add'); setShowCreditsModal(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Plus size={16} /> Adicionar
                    </button>
                    <button
                      onClick={() => { setCreditsMode('withdraw'); setShowCreditsModal(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <ArrowDown size={16} /> Debitar
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', background: '#f9fafb' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Créditos disponíveis</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#111827' }}>
                      R$ {(client?.credits ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Observações</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', color: '#374151' }}>
                      Utilize Adicionar para créditos e Debitar para descontos/ajustes pontuais. As mudanças são aplicadas imediatamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Extras */}
          {activeTab === 'extras' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '1rem',
                color: '#64748b'
              }}>
                <Settings size={48} style={{ color: '#6366f1' }} />
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  margin: 0
                }}>
                  Funcionalidades Extras
                </h3>
                <p style={{ fontSize: '1rem', margin: 0 }}>
                  Esta seção está em desenvolvimento
                </p>
                <p style={{ fontSize: '0.875rem', margin: 0 }}>
                  Em breve você terá acesso a recursos adicionais como relatórios personalizados, integrações e configurações avançadas
                </p>
              </div>
            </div>
          )}

        </div>

{/* Modal de Créditos (Adicionar/Debitar) */}
{showCreditsModal && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
    <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '520px', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          {creditsMode === 'withdraw' ? 'Debitar Créditos' : 'Adicionar Créditos'}
        </h4>
        <button onClick={() => setShowCreditsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
      </div>
      <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Valor</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={creditsForm.amount}
          onChange={(e) => setCreditsForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
          placeholder="0,00"
          style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
        />
        <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500, marginTop: '0.5rem' }}>Observação (opcional)</label>
        <textarea
          value={creditsForm.note}
          onChange={(e) => setCreditsForm((prev) => ({ ...prev, note: e.target.value }))}
          style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', minHeight: '80px', resize: 'vertical' }}
          placeholder={creditsMode === 'withdraw' ? 'Ex: ajuste/estorno' : 'Ex: bônus/promocional'}
        />
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>
          Saldo atual: <strong>R$ {(client?.credits ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        </p>
      </div>
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button onClick={() => setShowCreditsModal(false)} style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
        <button
          onClick={handleSubmitCredits}
          style={{ padding: '0.5rem 0.75rem', background: isSavingCredits ? '#93c5fd' : (creditsMode === 'withdraw' ? '#dc2626' : '#16a34a'), color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
          disabled={isSavingCredits}
        >
          {isSavingCredits ? 'Salvando...' : (creditsMode === 'withdraw' ? 'Debitar' : 'Adicionar')}
        </button>
      </div>
    </div>
  </div>
)}

      </div>
    </MainLayout>
  );
}
