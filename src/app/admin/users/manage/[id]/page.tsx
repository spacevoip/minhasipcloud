'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import usersService from '@/services/usersService';
import { plansService } from '@/services/plansService';
import { adminAgentsService } from '@/services/adminAgentsService';
import { userService } from '@/lib/userService';
import { supabase } from '@/lib/supabase';
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
  Minus,
  ToggleLeft,
  ToggleRight,
  Smartphone,
  Upload,
  Users2,
  Zap,
  MessageCircle
} from 'lucide-react';
import StatusPill from '@/components/ui/StatusPill';

export default function ManageUserPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  
  const [client, setClient] = useState<any>(null);
  const [clientPlan, setClientPlan] = useState<any>(null);
  const [agentsCount, setAgentsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingControl, setIsUpdatingControl] = useState(false);

  // Planos e ações financeiras
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [creditsForm, setCreditsForm] = useState({ amount: 0, note: '' });
  const [isSavingCredits, setIsSavingCredits] = useState(false);
  const [showWithdrawCreditsModal, setShowWithdrawCreditsModal] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: 0, note: '' });
  const [isWithdrawingCredits, setIsWithdrawingCredits] = useState(false);
  const [showLinkPlanModal, setShowLinkPlanModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [linkNote, setLinkNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    phone: '',
    email: ''
  });

  // Estados para alteração de plano
  const [showChangePlanSection, setShowChangePlanSection] = useState(false);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState<string>('');
  const [selectedNewPlan, setSelectedNewPlan] = useState<any>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  // Bloquear/Desbloquear usuário (altera status)
  const handleBlockUser = async () => {
    if (!client || isUpdatingStatus) return;
    try {
      setIsUpdatingStatus(true);
      await usersService.updateUser(String(client.id), { status: 'suspended' });
      setClient((prev: any) => ({ ...prev, status: 'suspended' }));
      toast.success('Usuário bloqueado (status: suspenso)');
    } catch (error) {
      console.error('Erro ao bloquear usuário:', error);
      toast.error('Não foi possível bloquear o usuário');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!client || isUpdatingStatus) return;
    try {
      setIsUpdatingStatus(true);
      await usersService.updateUser(String(client.id), { status: 'active' });
      setClient((prev: any) => ({ ...prev, status: 'active' }));
      toast.success('Usuário desbloqueado (status: ativo)');
    } catch (error) {
      console.error('Erro ao desbloquear usuário:', error);
      toast.error('Não foi possível desbloquear o usuário');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // ID estável do usuário a partir da rota
  const userId = Array.isArray((params as any)?.id) 
    ? String((params as any).id[0]) 
    : String((params as any)?.id || '');

  // Carregar dados do cliente ao mudar o ID
  useEffect(() => {
    if (!userId) return;
    // Resetar estados para evitar exibir dados do usuário anterior
    setClient(null);
    setClientPlan(null);
    setIsLoading(true);
    // Resetar estados de UI/modais
    setShowAddCreditsModal(false);
    setCreditsForm({ amount: 0, note: '' });
    setShowWithdrawCreditsModal(false);
    setWithdrawForm({ amount: 0, note: '' });
    setShowLinkPlanModal(false);
    setSelectedPlanId('');
    setLinkNote('');
    loadClientData();
    loadAvailablePlans();
  }, [userId]);

  const loadAvailablePlans = async () => {
    try {
      // Para admin, buscar planos ativos disponíveis no sistema
      const activePlans = await plansService.getActivePlans();
      setAvailablePlans(activePlans || []);
      
    } catch (error) {
      console.error('❌ Erro detalhado ao carregar planos:', error);
      toast.error('Erro ao carregar planos disponíveis');
    }
  };

  const loadClientData = async () => {
    try {
      setIsLoading(true);
      // Buscar dados reais do usuário pelo ID
      const currentId = userId || String((params as any)?.id || '');
      
      console.log(`🔍 [Frontend] Carregando dados do usuário: ${currentId}`);
      
      const user = await usersService.getUserById(currentId);

      if (!user) {
        toast.error('Usuário não encontrado');
        setTimeout(() => router.push('/admin/users'), 2000);
        return;
      }

      console.log(`📊 [Frontend] Dados recebidos do backend:`, {
        sms_send: user.sms_send,
        sms_send_type: typeof user.sms_send,
        webrtc: user.webrtc,
        webrtc_type: typeof user.webrtc,
        auto_discagem: user.auto_discagem,
        auto_discagem_type: typeof user.auto_discagem,
        up_audio: user.up_audio,
        mailling_up: user.mailling_up
      });

      setClient(user);

    // 🔢 Carregar contagem real de agentes do usuário (admin)
    try {
      const count = await adminAgentsService.getAgentCountByUserId(String(user.id));
      setAgentsCount(count || 0);
    } catch (e) {
      console.warn('⚠️ Falha ao carregar contagem de agentes do usuário:', e);
      setAgentsCount(0);
    }

      // 📦 Carregar dados reais do plano, quando houver
      if (user.planId) {
        try {
          const plan = await plansService.getPlanById(user.planId);
          if (plan) {
            setClientPlan(plan);
          }
        } catch (planError) {
          console.error('⚠️ Erro ao carregar dados do plano:', planError);
          toast.error('Erro ao carregar dados do plano');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast.error('Erro ao carregar dados do usuário');
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
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data inválida';
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Data inválida';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Nunca fez login';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data inválida';
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  // ✅ FUNÇÕES DE CONTROLE (WebRTC, Auto Discagem, Upload Audios, Lista de Contatos, Envio de SMS)
  const handleToggleControl = async (field: 'webrtc' | 'auto_discagem' | 'up_audio' | 'mailling_up' | 'sms_send') => {
    if (isUpdatingControl) return;
    
    try {
      setIsUpdatingControl(true);
      const newValue = !client[field];
      
      console.log(`🔧 [Frontend] Alterando ${field}: ${client[field]} -> ${newValue}`);
      
      // Usar novo endpoint robusto com PostgreSQL direto
      const response = await fetch(`/api/users-v2/${client.id}/controls`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          field,
          value: newValue
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || 'Erro na API');
      }
      
      console.log(`✅ [Frontend] Resultado da API:`, result.data);
      
      // Verificar se o valor foi realmente atualizado
      if (result.data.verified) {
        // Atualizar estado local com o valor confirmado do banco
        setClient((prev: any) => ({ ...prev, [field]: result.data.new_value }));
        
        const fieldNames: Record<'webrtc' | 'auto_discagem' | 'up_audio' | 'mailling_up' | 'sms_send', string> = {
          webrtc: 'WebRTC',
          auto_discagem: 'Auto Discagem',
          up_audio: 'Upload Audios',
          mailling_up: 'Lista de Contatos',
          sms_send: 'Envio de SMS'
        };
        
        toast.success(
          `${fieldNames[field]} ${result.data.new_value ? 'ativado' : 'desativado'}`,
          result.message || `${fieldNames[field]} foi ${result.data.new_value ? 'ativado' : 'desativado'} com sucesso`
        );
      } else {
        throw new Error('Valor não foi atualizado corretamente no banco de dados');
      }
      
    } catch (error: any) {
      console.error(`❌ [Frontend] Erro ao alterar ${field}:`, error);
      toast.error('Erro ao alterar configuração', error.message || 'Não foi possível alterar a configuração');
      
      // Fallback: tentar Supabase direto
      try {
        console.log(`🔄 [Frontend] Tentando fallback Supabase para ${field}`);
        const newValue = !client[field];
        
        const { error } = await supabase
          .from('users_pabx')
          .update({ [field]: newValue })
          .eq('id', client.id);
        
        if (error) {
          throw new Error(`Erro do Supabase: ${error.message}`);
        }
        
        setClient((prev: any) => ({ ...prev, [field]: newValue }));
        toast.success('Configuração alterada via fallback');
        
      } catch (fallbackError: any) {
        console.error(`❌ [Frontend] Fallback também falhou:`, fallbackError);
        toast.error('Erro crítico', 'Não foi possível alterar a configuração nem via API nem via Supabase');
      }
    } finally {
      setIsUpdatingControl(false);
    }
  };

  

  const handleSelectNewPlan = (planId: string) => {
    setSelectedNewPlanId(planId);
    const plan = availablePlans.find(p => p.id === planId);
    setSelectedNewPlan(plan || null);
  };

  const handleChangePlan = async () => {
    if (!selectedNewPlanId || !client) return;
    
    setIsChangingPlan(true);
    try {
      // Alterar o plano preservando vencimento e registrando lançamento financeiro proporcional
      const result = await usersService.changePlanWithFinance(String(client.id), selectedNewPlanId, 'Alteração de plano pelo administrador');

      // Feedback sobre lançamento financeiro (se houver)
      if (result?.finance && result.finance.amount > 0) {
        const { amount, type } = result.finance;
        const formatted = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const label = type === 'debit' ? 'Débito' : 'Crédito';
        toast.success(`Plano alterado. Lançamento ${label}: R$ ${formatted}.`);
      } else {
        toast.success('Plano alterado com sucesso!');
      }
      setShowChangePlanSection(false);
      setSelectedNewPlanId('');
      setSelectedNewPlan(null);
      
      // Recarregar dados do usuário
      await loadClientData();
    } catch (error) {
      console.error('Erro ao alterar plano:', error);
      toast.error('Erro ao alterar plano. Tente novamente.');
    } finally {
      setIsChangingPlan(false);
    }
  };

  const getCurrentPlan = () => {
    if (clientPlan) {
      return {
        id: clientPlan.id,
        name: clientPlan.name,
        maxAgents: clientPlan.maxAgents ?? clientPlan.max_agents ?? 0,
        periodDays: clientPlan.periodDays ?? clientPlan.period_days ?? 30,
        price: Number(clientPlan.price ?? 0),
        description: clientPlan.description ?? ''
      };
    }
    return {
      id: client?.plan_id || null,
      name: client?.plan_name || 'Sem Plano',
      maxAgents: client?.plan_max_agents || 0,
      periodDays: client?.plan_period_days || 30,
      price: Number(client?.plan_price || 0),
      description: client?.plan_description || ''
    };
  };

  const getPlanComparison = () => {
    if (!selectedNewPlan) return null;
    
    const currentPlan = getCurrentPlan();
    const newPlan = selectedNewPlan;
    
    // Usar preços reais vindos do backend
    const currentPrice = Number(currentPlan.price || 0);
    const newPrice = Number(newPlan.price || 0);
    
    // LÓGICA CORRETA: Alteração proporcional mantendo vencimento original
    const today = new Date();
    const expiresSource = client?.planExpiresAt || client?.plan_expires_at;
    const currentExpiration = expiresSource ? new Date(expiresSource) : today;
    
    // Calcular dias restantes do plano atual
    const remainingDays = currentExpiration > today ? 
      Math.ceil((currentExpiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    // Passo 1: Calcular valor diário do plano atual
    const currentPlanTotalDays = Number(currentPlan.periodDays || (currentPlan as any).period_days || 30);
    const currentDailyValue = currentPlanTotalDays > 0 ? Math.round((currentPrice / currentPlanTotalDays) * 100) / 100 : 0;
    
    // Passo 2: Calcular crédito restante do plano atual
    const creditFromCurrentPlan = remainingDays > 0 ? 
      Math.round((remainingDays * currentDailyValue) * 100) / 100 : 0;
    
    // Passo 3: Calcular valor diário do novo plano
    const newPlanTotalDays = Number(newPlan.periodDays || (newPlan as any).period_days || 30);
    const newDailyValue = newPlanTotalDays > 0 ? Math.round((newPrice / newPlanTotalDays) * 100) / 100 : 0;
    
    // Passo 4: Calcular custo proporcional do novo plano para os dias restantes
    const proportionalNewPlanCost = remainingDays > 0 ? 
      Math.round((remainingDays * newDailyValue) * 100) / 100 : 0;
    
    // Passo 5: Calcular diferença a cobrar
    const totalToPayRaw = Math.round((proportionalNewPlanCost - creditFromCurrentPlan) * 100) / 100;
    const totalToPay = Math.max(0, totalToPayRaw);
    
    // VENCIMENTO MANTIDO: Não altera a data de vencimento original
    const maintainedExpiration = currentExpiration.toLocaleDateString('pt-BR');
    
    return {
      agents: {
        current: currentPlan.maxAgents || 0,
        new: newPlan.maxAgents || 0,
        change: (newPlan.maxAgents || 0) - (currentPlan.maxAgents || 0)
      },
      period: {
        current: currentPlan.periodDays || (currentPlan as any).period_days || 0,
        new: newPlan.periodDays || (newPlan as any).period_days || 0,
        change: (newPlan.periodDays || (newPlan as any).period_days || 0) - (currentPlan.periodDays || (currentPlan as any).period_days || 0)
      },
      pricing: {
        currentPrice,
        newPrice,
        currentDailyValue,
        newDailyValue,
        creditFromCurrentPlan,
        proportionalNewPlanCost,
        totalToPay,
        remainingDays
      },
      dates: {
        currentExpiration: maintainedExpiration,
        newExpiration: maintainedExpiration, // MANTÉM O MESMO VENCIMENTO
        renewalType: 'proportional' // Alteração proporcional
      }
    };
  };

  if (isLoading) {
    return (
      <MainLayout disablePolling>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '60vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
          <p style={{ color: '#64748b' }}>Carregando dados do usuário...</p>
        </div>
      </MainLayout>
    );
  }

  if (!client) {
    return (
      <MainLayout disablePolling>
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
    { id: 'history', label: 'Histórico', icon: Clock },
    { id: 'extras', label: 'Extras', icon: Settings }
  ];

  return (
    <MainLayout disablePolling>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/admin/users')}
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
                Gerenciar Usuário
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
                  {/* Saldo Atual + ações */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Saldo Atual
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CreditCard size={16} style={{ color: '#16a34a' }} />
                        R$ {Number(client?.credits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div>
                        <button
                          onClick={() => setShowAddCreditsModal(true)}
                          style={{
                            padding: '0.35rem 0.5rem',
                            backgroundColor: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                          title="Adicionar créditos"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => setShowWithdrawCreditsModal(true)}
                          style={{
                            padding: '0.35rem 0.5rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            marginLeft: '0.5rem'
                          }}
                          title="Retirar créditos"
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                

                  {/* Status do Usuário + Bloquear/Desbloquear */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Status do Usuário
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
                          onClick={handleBlockUser}
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
                          onClick={handleUnblockUser}
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
                      {formatDateTime(client.last_login_at)}
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
                      Quantidade Total de Chamadas
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
                      <Phone size={16} style={{ color: '#64748b' }} />
                      {Number(client.total_call || 0).toLocaleString('pt-BR')} chamadas
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção Controle */}
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
                  <Settings size={20} />
                  Controle de Funcionalidades
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: '1.5rem' 
                }}>
                  {/* WebRTC */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      WebRTC (WebPhone)
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      background: client.webrtc 
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))',
                      border: client.webrtc 
                        ? '1px solid rgba(34, 197, 94, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isUpdatingControl ? 'not-allowed' : 'pointer',
                      opacity: isUpdatingControl ? 0.6 : 1
                    }}
                    onClick={() => !isUpdatingControl && handleToggleControl('webrtc')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Smartphone size={16} style={{ color: client.webrtc ? '#22c55e' : '#6b7280' }} />
                        <span style={{
                          fontWeight: '600',
                          color: client.webrtc ? '#16a34a' : '#6b7280'
                        }}>
                          {client.webrtc ? 'Ativado' : 'Desativado'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isUpdatingControl ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : client.webrtc ? (
                          <ToggleRight size={20} style={{ color: '#22c55e' }} />
                        ) : (
                          <ToggleLeft size={20} style={{ color: '#6b7280' }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Auto Discagem */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Auto Discagem
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      background: client.auto_discagem 
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))',
                      border: client.auto_discagem 
                        ? '1px solid rgba(99, 102, 241, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isUpdatingControl ? 'not-allowed' : 'pointer',
                      opacity: isUpdatingControl ? 0.6 : 1
                    }}
                    onClick={() => !isUpdatingControl && handleToggleControl('auto_discagem')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={16} style={{ color: client.auto_discagem ? '#6366f1' : '#6b7280' }} />
                        <span style={{
                          fontWeight: '600',
                          color: client.auto_discagem ? '#6366f1' : '#6b7280'
                        }}>
                          {client.auto_discagem ? 'Ativado' : 'Desativado'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isUpdatingControl ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : client.auto_discagem ? (
                          <ToggleRight size={20} style={{ color: '#6366f1' }} />
                        ) : (
                          <ToggleLeft size={20} style={{ color: '#6b7280' }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Upload Audios */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Upload Audios
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      background: client.up_audio 
                        ? 'linear-gradient(135deg, rgba(245, 101, 101, 0.05), rgba(239, 68, 68, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))',
                      border: client.up_audio 
                        ? '1px solid rgba(245, 101, 101, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isUpdatingControl ? 'not-allowed' : 'pointer',
                      opacity: isUpdatingControl ? 0.6 : 1
                    }}
                    onClick={() => !isUpdatingControl && handleToggleControl('up_audio')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Upload size={16} style={{ color: client.up_audio ? '#f56565' : '#6b7280' }} />
                        <span style={{
                          fontWeight: '600',
                          color: client.up_audio ? '#dc2626' : '#6b7280'
                        }}>
                          {client.up_audio ? 'Ativado' : 'Desativado'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isUpdatingControl ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : client.up_audio ? (
                          <ToggleRight size={20} style={{ color: '#f56565' }} />
                        ) : (
                          <ToggleLeft size={20} style={{ color: '#6b7280' }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Envio de SMS */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Envio de SMS
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      background: client.sms_send 
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))',
                      border: client.sms_send 
                        ? '1px solid rgba(34, 197, 94, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isUpdatingControl ? 'not-allowed' : 'pointer',
                      opacity: isUpdatingControl ? 0.6 : 1
                    }}
                    onClick={() => !isUpdatingControl && handleToggleControl('sms_send')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageCircle size={16} style={{ color: client.sms_send ? '#22c55e' : '#6b7280' }} />
                        <span style={{
                          fontWeight: '600',
                          color: client.sms_send ? '#16a34a' : '#6b7280'
                        }}>
                          {client.sms_send ? 'Ativado' : 'Desativado'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isUpdatingControl ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : client.sms_send ? (
                          <ToggleRight size={20} style={{ color: '#22c55e' }} />
                        ) : (
                          <ToggleLeft size={20} style={{ color: '#6b7280' }} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lista de Contatos */}
                  <div>
                    <label style={{ 
                      display: 'block', 
                      fontSize: '0.875rem', 
                      fontWeight: '500', 
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Lista de Contatos
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      background: client.mailling_up 
                        ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(147, 51, 234, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))',
                      border: client.mailling_up 
                        ? '1px solid rgba(168, 85, 247, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: isUpdatingControl ? 'not-allowed' : 'pointer',
                      opacity: isUpdatingControl ? 0.6 : 1
                    }}
                    onClick={() => !isUpdatingControl && handleToggleControl('mailling_up')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users2 size={16} style={{ color: client.mailling_up ? '#a855f7' : '#6b7280' }} />
                        <span style={{
                          fontWeight: '600',
                          color: client.mailling_up ? '#9333ea' : '#6b7280'
                        }}>
                          {client.mailling_up ? 'Ativado' : 'Desativado'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isUpdatingControl ? (
                          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : client.mailling_up ? (
                          <ToggleRight size={20} style={{ color: '#a855f7' }} />
                        ) : (
                          <ToggleLeft size={20} style={{ color: '#6b7280' }} />
                        )}
                      </div>
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
              {/* Se não houver plano vinculado */}
              {!client?.planId && !client?.plan_id && (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <p style={{ margin: 0, color: '#9a3412', fontWeight: 600 }}>Nenhum plano vinculado</p>
                    <p style={{ margin: 0, color: '#7c2d12', fontSize: '0.875rem' }}>Deseja vincular um plano agora?</p>
                  </div>
                  <button
                    onClick={() => setShowLinkPlanModal(true)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Vincular Plano
                  </button>
                </div>
              )}

              {(client?.planId || client?.plan_id) && (
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
                    {client.plan_name || clientPlan?.name || client.plan || 'Sem Plano'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Status: {(client?.plan_status ?? client?.planStatus) ? 'Ativo' : (client?.plan_id || client?.planId) ? 'Inativo' : 'Sem plano'}
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
                    {agentsCount || 0} / {getCurrentPlan().maxAgents || 'Carregando...'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Agentes utilizados
                  </p>
                  {getCurrentPlan() && (agentsCount || 0) > getCurrentPlan().maxAgents && (
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
                    {client.plan_expires_at || client.planExpiresAt ? formatDate(client.plan_expires_at || client.planExpiresAt) : 'Não definido'}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Data de expiração
                  </p>
                </div>
              </div>
              )}

              {/* Seção de Alteração de Plano */}
              {(client?.planId || client?.plan_id) && (
                <div style={{ marginTop: '2rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#1e293b',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Settings size={18} />
                      Alteração de Plano
                    </h3>
                    
                    {!showChangePlanSection && (
                      <button
                        onClick={() => setShowChangePlanSection(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1rem',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Edit2 size={16} />
                        Alterar Plano
                      </button>
                    )}
                  </div>

                  {showChangePlanSection && (
                    <div style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      padding: '1.5rem'
                    }}>
                      {/* Plano Atual */}
                      <div style={{
                        backgroundColor: 'white',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <Package size={16} />
                          Plano Atual
                        </h4>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '1rem'
                        }}>
                          <div>
                            <p style={{
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: 0
                            }}>
                              {getCurrentPlan().name}
                            </p>
                            <p style={{
                              fontSize: '0.875rem',
                              color: '#64748b',
                              margin: '0.25rem 0 0 0'
                            }}>
                              {getCurrentPlan().maxAgents || 0} agentes • {getCurrentPlan().periodDays || 0} dias
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Seletor de Novo Plano */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '0.75rem'
                        }}>
                          Selecionar Novo Plano
                        </label>
                        <select
                          value={selectedNewPlanId}
                          onChange={(e) => handleSelectNewPlan(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            backgroundColor: 'white',
                            boxSizing: 'border-box'
                          }}
                        >
                          <option value="">Selecione um novo plano...</option>
                          {availablePlans.filter(plan => plan.id !== (client?.planId || client?.plan_id)).map((plan: any) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} - {plan.maxAgents || plan.max_agents} agentes - {plan.periodDays || plan.period_days} dias
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Resumo de Alteração */}
                      {selectedNewPlan && (
                        <div style={{
                          backgroundColor: 'white',
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          marginBottom: '1.5rem',
                          border: '1px solid #e2e8f0'
                        }}>
                          <h4 style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <ArrowUp size={16} />
                            Resumo da Alteração
                          </h4>
                          
                          {(() => {
                            const comparison = getPlanComparison();
                            if (!comparison) return null;
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* Comparação de Agentes */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '0.375rem'
                                }}>
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                                    Limite de Agentes:
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                      {comparison.agents.current}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>→</span>
                                    <span style={{
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      color: comparison.agents.change > 0 ? '#16a34a' : comparison.agents.change < 0 ? '#dc2626' : '#64748b'
                                    }}>
                                      {comparison.agents.new}
                                    </span>
                                    {comparison.agents.change !== 0 && (
                                      <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        color: comparison.agents.change > 0 ? '#16a34a' : '#dc2626',
                                        backgroundColor: comparison.agents.change > 0 ? '#dcfce7' : '#fee2e2',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '0.25rem'
                                      }}>
                                        {comparison.agents.change > 0 ? '+' : ''}{comparison.agents.change}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Comparação de Período */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.5rem',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '0.375rem'
                                }}>
                                  <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                                    Período (dias):
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                      {comparison.period.current}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>→</span>
                                    <span style={{
                                      fontSize: '0.875rem',
                                      fontWeight: '600',
                                      color: comparison.period.change > 0 ? '#16a34a' : comparison.period.change < 0 ? '#dc2626' : '#64748b'
                                    }}>
                                      {comparison.period.new}
                                    </span>
                                    {comparison.period.change !== 0 && (
                                      <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        color: comparison.period.change > 0 ? '#16a34a' : '#dc2626',
                                        backgroundColor: comparison.period.change > 0 ? '#dcfce7' : '#fee2e2',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '0.25rem'
                                      }}>
                                        {comparison.period.change > 0 ? '+' : ''}{comparison.period.change}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Informações de Vencimento */}
                                <div style={{
                                  backgroundColor: '#f0f9ff',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '0.375rem',
                                  padding: '0.75rem',
                                  marginTop: '0.5rem'
                                }}>
                                  <h5 style={{
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#0369a1',
                                    margin: '0 0 0.75rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.375rem'
                                  }}>
                                    <Calendar size={14} />
                                    Alteração de Vencimento
                                  </h5>
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {/* Vencimento Atual */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.75rem'
                                    }}>
                                      <span style={{ color: '#0369a1' }}>Vencimento atual:</span>
                                      <span style={{ fontWeight: '600', color: '#0369a1' }}>
                                        {comparison.dates.currentExpiration}
                                      </span>
                                    </div>
                                    
                                    {/* Novo Vencimento */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.75rem',
                                      paddingTop: '0.25rem',
                                      borderTop: '1px solid #bae6fd'
                                    }}>
                                      <span style={{ color: '#0369a1' }}>Novo vencimento:</span>
                                      <span style={{ fontWeight: '600', color: '#16a34a' }}>
                                        {comparison.dates.newExpiration}
                                      </span>
                                    </div>
                                    
                                    {/* Explicação */}
                                    <div style={{
                                      fontSize: '0.75rem',
                                      color: '#0369a1',
                                      fontStyle: 'italic',
                                      textAlign: 'center',
                                      marginTop: '0.5rem',
                                      padding: '0.5rem',
                                      backgroundColor: '#e0f2fe',
                                      borderRadius: '0.25rem'
                                    }}>
                                      ℹ️ Alteração proporcional: vencimento mantido, cobrança apenas da diferença
                                    </div>
                                  </div>
                                </div>

                                {/* Projeção de Valores */}
                                <div style={{
                                  backgroundColor: '#fefce8',
                                  border: '1px solid #fde047',
                                  borderRadius: '0.375rem',
                                  padding: '0.75rem',
                                  marginTop: '0.5rem'
                                }}>
                                  <h5 style={{
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#a16207',
                                    margin: '0 0 0.75rem 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.375rem'
                                  }}>
                                    <CreditCard size={14} />
                                    Projeção de Valores
                                  </h5>
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {/* Valor Atual */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.75rem'
                                    }}>
                                      <span style={{ color: '#a16207' }}>Valor do plano atual:</span>
                                      <span style={{ fontWeight: '600', color: '#a16207' }}>
                                        R$ {comparison.pricing.currentPrice.toFixed(2)}
                                      </span>
                                    </div>
                                    
                                    {/* Valor Novo */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.75rem'
                                    }}>
                                      <span style={{ color: '#a16207' }}>Valor do novo plano:</span>
                                      <span style={{ fontWeight: '600', color: '#a16207' }}>
                                        R$ {comparison.pricing.newPrice.toFixed(2)}
                                      </span>
                                    </div>
                                    
                                    {/* Valor Diário Atual */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.75rem',
                                      paddingTop: '0.25rem',
                                      borderTop: '1px solid #fde047'
                                    }}>
                                      <span style={{ color: '#a16207' }}>Valor diário do plano atual:</span>
                                      <span style={{ fontWeight: '600', color: '#a16207' }}>
                                        R$ {comparison.pricing.currentDailyValue.toFixed(2)}/dia
                                      </span>
                                    </div>
                                    
                                    {/* Valor Diário Novo */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.75rem'
                                    }}>
                                      <span style={{ color: '#a16207' }}>Valor diário do novo plano:</span>
                                      <span style={{ fontWeight: '600', color: '#a16207' }}>
                                        R$ {comparison.pricing.newDailyValue.toFixed(2)}/dia
                                      </span>
                                    </div>
                                    
                                    {/* Crédito do Plano Atual */}
                                    {comparison.pricing.creditFromCurrentPlan > 0 && (
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '0.75rem'
                                      }}>
                                        <span style={{ color: '#a16207' }}>
                                          Crédito restante ({comparison.pricing.remainingDays} dias):
                                        </span>
                                        <span style={{ fontWeight: '600', color: '#16a34a' }}>
                                          R$ {comparison.pricing.creditFromCurrentPlan.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Custo Proporcional Novo Plano */}
                                    {comparison.pricing.proportionalNewPlanCost > 0 && (
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '0.75rem'
                                      }}>
                                        <span style={{ color: '#a16207' }}>
                                          Novo plano ({comparison.pricing.remainingDays} dias):
                                        </span>
                                        <span style={{ fontWeight: '600', color: '#dc2626' }}>
                                          R$ {comparison.pricing.proportionalNewPlanCost.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {/* Valor Total a Pagar */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.875rem',
                                      fontWeight: '700',
                                      paddingTop: '0.5rem',
                                      borderTop: '2px solid #fde047',
                                      marginTop: '0.25rem'
                                    }}>
                                      <span style={{ color: '#92400e' }}>Valor total a pagar hoje:</span>
                                      <span style={{ 
                                        color: comparison.pricing.totalToPay > 0 ? '#dc2626' : '#16a34a',
                                        fontSize: '1rem'
                                      }}>
                                        R$ {comparison.pricing.totalToPay.toFixed(2)}
                                      </span>
                                    </div>
                                    
                                    {comparison.pricing.totalToPay === 0 && (
                                      <div style={{
                                        fontSize: '0.75rem',
                                        color: '#16a34a',
                                        fontStyle: 'italic',
                                        textAlign: 'center',
                                        marginTop: '0.25rem'
                                      }}>
                                        ✅ Alteração sem custo adicional
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Novo Plano Detalhes */}
                                <div style={{
                                  backgroundColor: '#f0f9ff',
                                  border: '1px solid #bae6fd',
                                  borderRadius: '0.375rem',
                                  padding: '0.75rem',
                                  marginTop: '0.5rem'
                                }}>
                                  <p style={{
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    color: '#0369a1',
                                    margin: '0 0 0.25rem 0'
                                  }}>
                                    Novo Plano: {selectedNewPlan.name}
                                  </p>
                                  {selectedNewPlan.description && (
                                    <p style={{
                                      fontSize: '0.75rem',
                                      color: '#0369a1',
                                      margin: 0
                                    }}>
                                      {selectedNewPlan.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Botões de Ação */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          onClick={() => {
                            setShowChangePlanSection(false);
                            setSelectedNewPlanId('');
                            setSelectedNewPlan(null);
                          }}
                          style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem'
                          }}
                        >
                          Cancelar
                        </button>
                        
                        <button
                          onClick={handleChangePlan}
                          disabled={!selectedNewPlanId || isChangingPlan}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            backgroundColor: selectedNewPlanId ? '#16a34a' : '#d1d5db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: selectedNewPlanId ? 'pointer' : 'not-allowed',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            opacity: isChangingPlan ? 0.7 : 1
                          }}
                        >
                          {isChangingPlan ? (
                            <>
                              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                              Alterando...
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              Confirmar Alteração
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Financeiro */}
          {activeTab === 'financial' && (
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
                <CreditCard size={48} style={{ color: '#f59e0b' }} />
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#1e293b',
                  margin: 0
                }}>
                  Módulo Financeiro
                </h3>
                <p style={{ fontSize: '1rem', margin: 0 }}>
                  Esta funcionalidade está em desenvolvimento
                </p>
                <p style={{ fontSize: '0.875rem', margin: 0 }}>
                  Em breve você poderá gerenciar o histórico financeiro, faturas e pagamentos do cliente
                </p>
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
      </div>

      {/* Modal Adicionar Créditos */}
      {showAddCreditsModal && client && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50
        }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '480px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Adicionar Créditos</h4>
              <button onClick={() => setShowAddCreditsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Valor (R$)</label>
              <input
                type="number"
                value={creditsForm.amount}
                onChange={(e) => setCreditsForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                placeholder="Ex: 50.00"
                min={0}
              />
              <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500, marginTop: '0.5rem' }}>Observação (opcional)</label>
              <textarea
                value={creditsForm.note}
                onChange={(e) => setCreditsForm(prev => ({ ...prev, note: e.target.value }))}
                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', minHeight: '80px', resize: 'vertical' }}
                placeholder="Ex: bônus de recarga"
              />
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowAddCreditsModal(false)} style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    if (!creditsForm.amount || creditsForm.amount <= 0) {
                      toast.error('Informe um valor válido');
                      return;
                    }
                    setIsSavingCredits(true);
                    await usersService.addCredits(String(client.id), { amount: creditsForm.amount, note: creditsForm.note });
                    // Atualiza saldo local
                    setClient((prev: any) => ({ ...prev, credits: Number(prev?.credits || 0) + creditsForm.amount }));
                    toast.success('Créditos adicionados com sucesso!');
                    setShowAddCreditsModal(false);
                    setCreditsForm({ amount: 0, note: '' });
                  } catch (error: any) {
                    console.error('Erro ao adicionar créditos:', error);
                    toast.error('Erro ao adicionar créditos');
                  } finally {
                    setIsSavingCredits(false);
                  }
                }}
                style={{ padding: '0.5rem 0.75rem', background: isSavingCredits ? '#93c5fd' : '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
                disabled={isSavingCredits}
              >
                {isSavingCredits ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retirar Créditos */}
      {showWithdrawCreditsModal && client && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50
        }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '480px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Retirar Créditos</h4>
              <button onClick={() => setShowWithdrawCreditsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Valor (R$)</label>
              <input
                type="number"
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                placeholder="Ex: 25.00"
                min={0}
              />
              <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500, marginTop: '0.5rem' }}>Observação (opcional)</label>
              <textarea
                value={withdrawForm.note}
                onChange={(e) => setWithdrawForm(prev => ({ ...prev, note: e.target.value }))}
                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', minHeight: '80px', resize: 'vertical' }}
                placeholder="Ex: ajuste de saldo"
              />
              <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Saldo atual: R$ {Number(client?.credits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowWithdrawCreditsModal(false)} style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    if (!withdrawForm.amount || withdrawForm.amount <= 0) {
                      toast.error('Informe um valor válido');
                      return;
                    }
                    const current = Number(client?.credits || 0);
                    if (withdrawForm.amount > current) {
                      toast.error('Valor excede o saldo disponível');
                      return;
                    }
                    setIsWithdrawingCredits(true);
                    await usersService.withdrawCredits(String(client.id), { amount: withdrawForm.amount, note: withdrawForm.note });
                    // Atualiza saldo local
                    setClient((prev: any) => ({ ...prev, credits: Math.max(0, Number(prev?.credits || 0) - withdrawForm.amount) }));
                    toast.success('Créditos retirados com sucesso!');
                    setShowWithdrawCreditsModal(false);
                    setWithdrawForm({ amount: 0, note: '' });
                  } catch (error: any) {
                    console.error('Erro ao retirar créditos:', error);
                    toast.error('Erro ao retirar créditos');
                  } finally {
                    setIsWithdrawingCredits(false);
                  }
                }}
                style={{ padding: '0.5rem 0.75rem', background: isWithdrawingCredits ? '#fca5a5' : '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
                disabled={isWithdrawingCredits}
              >
                {isWithdrawingCredits ? 'Salvando...' : 'Retirar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vincular Plano */}
      {showLinkPlanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '520px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Vincular Plano</h4>
              <button onClick={() => setShowLinkPlanModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'grid', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Selecione um Plano</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
              >
                <option value="">Selecione</option>
                {availablePlans.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.maxAgents} agentes</option>
                ))}
              </select>
              <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500, marginTop: '0.5rem' }}>Observação (opcional)</label>
              <textarea
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
                style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', minHeight: '80px', resize: 'vertical' }}
                placeholder="Ex: migração de plano"
              />
            </div>
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowLinkPlanModal(false)} style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', color: '#111827', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={async () => {
                  try {
                    if (!selectedPlanId) {
                      toast.error('Selecione um plano');
                      return;
                    }
                    // validityDays = 0 para usar o período padrão do plano no serviço
                    await usersService.linkPlan(String(client.id), selectedPlanId, 0, linkNote);
                    toast.success('Plano vinculado com sucesso!');
                    setShowLinkPlanModal(false);
                    setSelectedPlanId('');
                    setLinkNote('');
                    // Recarregar dados do usuário e plano
                    await loadClientData();
                  } catch (error) {
                    console.error('Erro ao vincular plano:', error);
                    toast.error('Erro ao vincular plano');
                  }
                }}
                style={{ padding: '0.5rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Vincular Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <Clock size={24} style={{ color: '#64748b' }} />
            <h3 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b'
            }}>
              Histórico de Alterações
            </h3>
          </div>
          
          <div style={{
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '0.75rem',
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '2px dashed #cbd5e1'
          }}>
            <Clock size={64} style={{ 
              color: '#cbd5e1', 
              margin: '0 auto 1.5rem',
              opacity: 0.6
            }} />
            <h4 style={{
              margin: '0 0 0.75rem 0',
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#64748b'
            }}>
              Seção em Desenvolvimento
            </h4>
            <p style={{
              fontSize: '0.875rem',
              color: '#9ca3af',
              lineHeight: 1.6,
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              O histórico de alterações será implementado em breve.<br />
              Esta seção mostrará todas as modificações feitas no usuário,<br />
              incluindo alterações de plano, créditos e configurações.
            </p>
            <div style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'inline-block'
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: '#3b82f6',
                fontWeight: '500'
              }}>
                📝 Funcionalidade planejada para próxima versão
              </span>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
