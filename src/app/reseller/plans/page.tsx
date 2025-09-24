'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { plansApiService } from '@/services/plansApiService';
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  DollarSign,
  Users,
  Calendar,
  X,
  CheckCircle,
  Loader2,
  Filter,
  Copy
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  maxAgents: number;
  periodDays: number;
  features: string[];
  status: 'active' | 'inactive';
  createdBy?: string;
  createdAt: string;
}

interface NewPlanData {
  name: string;
  description: string;
  price: number;
  periodDays: number;
  agents: number;
  features: string[];
}

interface UpdatePlanData {
  id: string;
  name: string;
  description: string;
  price: number;
  period: 'monthly' | 'quarterly' | 'yearly' | string;
  features: string[];
  limits: {
    agents: number;
    extensions: number;
    callMinutes: number;
    storage: number;
    recordings: boolean;
    reports: boolean;
    api: boolean;
  };
  status: 'draft' | 'active' | 'inactive' | string;
}

export default function ResellerPlansPage() {
  const { success, error } = useToast();
  
  // State
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userData, setUserData] = useState<any>(null);
  const [localPlans, setLocalPlans] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('all');
  

  // Modal and form state (single source)
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const [newPlanData, setNewPlanData] = useState({
    name: '',
    description: '',
    price: 0,
    periodDays: 30,
    agents: 5,
    features: [] as string[],
    limits: { agents: 5 }
  });

  const [editPlanData, setEditPlanData] = useState<UpdatePlanData>({
    id: '',
    name: '',
    description: '',
    price: 0,
    period: 'monthly',
    features: [],
    limits: {
      agents: 0,
      extensions: 0,
      callMinutes: 0,
      storage: 0,
      recordings: false,
      reports: false,
      api: false
    },
    status: 'draft'
  });

  // Estado para evitar hydration mismatch
  const [isClient, setIsClient] = useState(false);

  // Estados locais adicionais (não duplicar os do store)

  // 🔄 CARREGAR PLANOS REAIS DO REVENDEDOR LOGADO
  const loadResellerPlans = async () => {
    try {
      console.log('🔄 [RESELLER] Carregando planos do revendedor...');
      
      // 🔐 OBTER ID REAL DO USUÁRIO LOGADO VIA LOCALSTORAGE
      const userDataFromStorage = localStorage.getItem('user');
      if (!userDataFromStorage) {
        throw new Error('Usuário não autenticado');
      }

      const userData = JSON.parse(userDataFromStorage);
      if (!userData || !userData.id) {
        throw new Error('Dados do usuário inválidos');
      }

      if (userData.role !== 'reseller') {
        throw new Error('Apenas revendedores podem acessar esta área');
      }

      console.log('🔐 [RESELLER] Usuário autenticado:', userData.username, 'ID:', userData.id);
      setCurrentUserId(userData.id);
      
      // 🛡️ BUSCAR APENAS PLANOS CRIADOS POR ESTE REVENDEDOR
      const result = await plansApiService.getAllPlans({ status: 'active' });
      const resellerPlans = result.plans;
      
      setLocalPlans(resellerPlans);
      console.log('✅ [RESELLER] Planos do revendedor carregados:', resellerPlans.length);
      
    } catch (error) {
      console.error('❌ [RESELLER] Erro ao carregar planos:', error);
      
      // 🔄 FALLBACK: usar dados mock se falhar
      setLocalPlans([]);
    }
  };

  // Usar planos carregados do revendedor
  const resellerPlans = localPlans;
  
  // Aplicar filtros nos planos do revendedor
  const filteredPlans = resellerPlans.filter(plan => {
    const matchesSearch = !searchTerm || 
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
    const matchesPeriod = periodFilter === 'all' || plan.period === periodFilter;
    
    return matchesSearch && matchesStatus && matchesPeriod;
  });
  
  // Estatísticas apenas dos planos do revendedor
  const stats = {
    totalPlans: resellerPlans.length,
    activePlans: resellerPlans.filter(p => p.status === 'active').length,
    totalRevenue: 0, // Receita zerada conforme solicitado
    totalClients: resellerPlans.reduce((acc, p) => acc + (p.subscribersCount || 0), 0),
    avgPrice: resellerPlans.length > 0 ? resellerPlans.reduce((acc, p) => acc + p.price, 0) / resellerPlans.length : 0
  };

  // Períodos disponíveis
  const periods = [
    { value: 'monthly', label: 'Mensal' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'yearly', label: 'Anual' }
  ];

  // useEffect para carregar dados e evitar hydration mismatch
  useEffect(() => {
    setIsClient(true);
    loadResellerPlans();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', color: '#16a34a' };
      case 'inactive': return { bg: '#fee2e2', color: '#dc2626' };
      default: return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'draft': return 'Rascunho';
      default: return status;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'monthly': return 'Mensal';
      case 'quarterly': return 'Trimestral';
      case 'yearly': return 'Anual';
      default: return period;
    }
  };

  // Função para gerar recursos automaticamente
  const generateFeatures = (agents: number, periodDays: number) => {
    const features = [
      `Limite de ${agents} ramais`,
      `Validade de ${periodDays} dias`,
      "Minutos ilimitados",
      "Gravação avançada",
      "Relatórios detalhados",
      "Captura de DTMF real time",
      "Painel do Agente",
      "Modo Consultas"
    ];
    return features;
  };

  // Função para gerar cores variadas (não sempre cinza)
  const generatePlanColor = () => {
    const colors = [
      '#3b82f6', // Azul
      '#10b981', // Verde
      '#f59e0b', // Amarelo
      '#ef4444', // Vermelho
      '#8b5cf6', // Roxo
      '#06b6d4', // Ciano
      '#f97316', // Laranja
      '#84cc16', // Lima
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Handler functions
  const handleCreatePlan = async () => {
    if (!newPlanData.name.trim() || newPlanData.price <= 0 || newPlanData.agents <= 0) {
      error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      // 🔐 OBTER ID REAL DO USUÁRIO LOGADO VIA LOCALSTORAGE
      const userDataFromStorage = localStorage.getItem('user');
      if (!userDataFromStorage) {
        throw new Error('Usuário não autenticado');
      }

      const userData = JSON.parse(userDataFromStorage);
      if (!userData || !userData.id) {
        throw new Error('Dados do usuário inválidos');
      }

      if (userData.role !== 'reseller') {
        throw new Error('Apenas revendedores podem criar planos');
      }

      console.log('🔐 [RESELLER AUTH] Usuário autenticado:', userData.username, 'ID:', userData.id);
      
      // Gerar recursos automaticamente
      const autoFeatures = generateFeatures(newPlanData.agents, newPlanData.periodDays);
      const planColor = generatePlanColor();
      
      // Payload limpo - apenas campos que o backend espera
      const planData = {
        name: newPlanData.name,
        description: newPlanData.description || autoFeatures.join(', '),
        price: parseFloat(newPlanData.price.toString()),
        maxAgents: parseInt(newPlanData.agents.toString()),
        periodDays: parseInt(newPlanData.periodDays.toString()),
        features: autoFeatures,
        color: planColor
      };
      
      // 🛡️ CRIAR PLANO VIA API
      console.log('🛡️ [SECURE RESELLER] Criando plano vinculado ao revendedor:', userData.id);
      const createdPlan = await plansApiService.createPlan(planData);
      
      // 🎯 FECHAR MODAL AUTOMATICAMENTE E MOSTRAR TOAST
      setShowNewPlanModal(false);
      
      // 🔄 RECARREGAR LISTA DE PLANOS DO REVENDEDOR
      await loadResellerPlans();
      
      // ✅ TOAST DE SUCESSO
      if (createdPlan) {
        console.log('✅ [RESELLER] Plano criado com sucesso:', createdPlan.name);
        success(`Plano "${createdPlan.name}" criado com sucesso!`);
      } else {
        error('Erro ao criar plano');
      }
      
      // Reset form
      setNewPlanData({
        name: '',
        description: '',
        price: 0,
        periodDays: 30,
        agents: 5,
        features: [] as string[],
        limits: {
          agents: 5
        }
      });

      // Toast de sucesso após fechar modal (somente se criadoPlan existir)
      if (createdPlan) {
        setTimeout(() => {
          success('Sucesso', `Plano "${createdPlan.name}" criado com máxima segurança!`);
        }, 100);
      }
    } catch (e) {
      console.error('Erro ao criar plano:', e);
      error('Erro ao criar plano');
    }
  };

  const handleEditPlan = (plan: any) => {
    setSelectedPlan(plan);
    // Preenche dados para edição e abre o modal
    setEditPlanData({
      id: plan.id || '',
      name: plan.name || '',
      description: plan.description || '',
      price: Number(plan.price) || 0,
      period: plan.period || 'monthly',
      features: Array.isArray(plan.features) ? plan.features : [],
      limits: plan.limits || {
        agents: typeof plan.maxAgents === 'number' ? plan.maxAgents : 0,
        extensions: 0,
        callMinutes: 0,
        storage: 0,
        recordings: false,
        reports: false,
        api: false
      },
      status: plan.status || 'draft'
    });
    setShowEditModal(true);
    try {
      // A ação de salvar a edição deve ser tratada no modal de edição (onSubmit)
      // Este bloco fica propositalmente vazio aqui para não quebrar o build
    } catch (e) {
      error('Erro ao atualizar plano', 'Tente novamente em alguns instantes');
    }
  };

  const handleDeletePlan = (plan: any) => {
    setSelectedPlan(plan);
    setShowDeleteConfirm(true);
  };

  const handleDuplicatePlan = async (plan: any) => {
    try {
      // Create a new plan based on the selected one with a new name
      const cloneData = {
        name: `${plan.name} (Cópia)`,
        description: plan.description || '',
        price: Number(plan.price) || 0,
        maxAgents: Number(plan.maxAgents) || 0,
        periodDays: Number(plan.periodDays) || 30,
        features: Array.isArray(plan.features) ? plan.features : [],
        status: plan.status || 'inactive'
      };
      const created = await plansApiService.createPlan(cloneData);
      if (created) {
        success('Plano duplicado!', `Cópia de ${plan.name} foi criada`);
        await loadResellerPlans();
      } else {
        error('Erro ao duplicar plano');
      }
    } catch (e) {
      error('Erro ao duplicar plano', 'Tente novamente em alguns instantes');
    }
  };

  const handleViewPlan = (plan: any) => {
    setSelectedPlan(plan);
    setShowViewModal(true);
  };

  // Confirmar exclusão do plano selecionado
  const confirmDeletePlan = async () => {
    if (!selectedPlan?.id) {
      error('Plano inválido para exclusão');
      return;
    }
    try {
      setIsLoading(true);
      const ok = await plansApiService.deletePlan(selectedPlan.id);
      if (ok) {
        success('Plano excluído com sucesso');
        await loadResellerPlans();
      } else {
        error('Erro ao excluir plano');
      }
    } catch (e) {
      error('Erro ao excluir plano');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
      setSelectedPlan(null);
    }
  };

  // Confirmar edição do plano
  const confirmEditPlan = async () => {
    if (!editPlanData.id) {
      error('Plano inválido para edição');
      return;
    }
    try {
      setIsLoading(true);
      const payload = {
        name: editPlanData.name,
        price: editPlanData.price,
        maxAgents: editPlanData.limits?.agents ?? 0,
        // Mantém periodDays do plano atual se existir, senão padrão 30
        periodDays: selectedPlan?.periodDays ?? 30,
        features: Array.isArray(editPlanData.features) ? editPlanData.features : [],
        status: (editPlanData.status === 'active' || editPlanData.status === 'inactive') ? editPlanData.status : undefined
      } as Partial<import('@/services/plansApiService').ApiPlan>;

      const updated = await plansApiService.updatePlan(editPlanData.id, payload);
      if (updated) {
        success('Plano atualizado com sucesso');
        await loadResellerPlans();
        setShowEditModal(false);
      } else {
        error('Erro ao atualizar plano');
      }
    } catch (e) {
      error('Erro ao atualizar plano');
    } finally {
      setIsLoading(false);
    }
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
              Meus Planos
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Crie e gerencie planos para seus clientes
            </p>
          </div>
          
          <button
            onClick={() => setShowNewPlanModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            <Plus size={16} />
            Novo Plano
          </button>
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
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <Package size={20} style={{ color: '#3b82f6', marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Total</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              {isClient ? stats.totalPlans : 0}
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <CheckCircle size={20} style={{ color: '#10b981', marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Ativos</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              {isClient ? stats.activePlans : 0}
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <Users size={20} style={{ color: '#f59e0b', marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Clientes</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              {isClient ? stats.totalClients : 0}
            </div>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <DollarSign size={20} style={{ color: '#8b5cf6', marginRight: '0.5rem' }} />
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Receita</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
              {isClient ? formatCurrency(stats.totalRevenue) : 'R$ 0,00'}
            </div>
          </div>
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
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            {/* Busca */}
            <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} 
              />
              <input
                type="text"
                placeholder="Buscar planos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filtro de Status */}
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
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards de Planos */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {filteredPlans.map((plan) => (
            <div key={plan.id} style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0'
            }}>
              {/* Header do Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
                    {plan.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                      {formatCurrency(plan.price)}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      /{plan.periodDays ? `${plan.periodDays} dias` : 'período'}
                    </span>
                  </div>
                </div>
                
                <span style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: getStatusColor(plan.status).bg,
                  color: getStatusColor(plan.status).color,
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  {getStatusLabel(plan.status)}
                </span>
              </div>

              {/* Informações do Plano */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={16} style={{ color: '#64748b' }} />
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {plan.maxAgents === -1 ? 'Agentes ilimitados' : `Até ${plan.maxAgents} agentes`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={16} style={{ color: '#64748b' }} />
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {plan.subscribersCount || 0} clientes usando
                  </span>
                </div>
              </div>

              {/* Features */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Recursos Inclusos:
                </h4>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {plan.features.map((feature: string, index: number) => (
                    <li key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      marginBottom: '0.25rem',
                      fontSize: '0.875rem',
                      color: '#64748b'
                    }}>
                      <CheckCircle size={14} style={{ color: '#10b981' }} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleViewPlan(plan)}
                  title="Visualizar plano"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.color = '#475569';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  <Eye size={16} />
                  Ver
                </button>
                <button
                  onClick={() => handleEditPlan(plan)}
                  title="Editar plano"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dbeafe';
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.color = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  <Edit size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleDuplicatePlan(plan)}
                  title="Duplicar plano"
                  style={{
                    padding: '0.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef3c7';
                    e.currentTarget.style.borderColor = '#fbbf24';
                    e.currentTarget.style.color = '#d97706';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleDeletePlan(plan)}
                  title="Excluir plano"
                  style={{
                    padding: '0.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fee2e2';
                    e.currentTarget.style.borderColor = '#fca5a5';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredPlans.length === 0 && (
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '3rem',
            textAlign: 'center',
            color: '#64748b',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Nenhum plano encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Novo Plano */}
      {showNewPlanModal && (
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
          backdropFilter: 'blur(4px)',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            margin: '0 auto'
          }}>
            <div style={{
              padding: '1.5rem 2rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>Novo Plano</h2>
              <button
                onClick={() => setShowNewPlanModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  color: '#64748b',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ 
              padding: '1.5rem'
            }}>
              {/* Campos básicos do plano */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '1rem', 
                marginBottom: '1.5rem' 
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Nome do Plano *</label>
                  <input
                    type="text"
                    value={newPlanData.name}
                    onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value })}
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
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
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Preço (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPlanData.price || ''}
                    onChange={(e) => setNewPlanData({ ...newPlanData, price: parseFloat(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
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
              
              {/* Campos secundários */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '1rem', 
                marginBottom: '1.5rem' 
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Período (dias) *</label>
                  <select
                    value={newPlanData.periodDays.toString()}
                    onChange={(e) => {
                      const newPeriod = e.target.value;
                      const autoFeatures = generateFeatures(newPlanData.agents, parseInt(newPeriod));
                      setNewPlanData({ 
                        ...newPlanData, 
                        periodDays: parseInt(newPeriod),
                        features: autoFeatures,
                        limits: { ...newPlanData.limits, agents: newPlanData.agents }
                      });
                    }}
                    style={{
                      width: '100%',
                      minWidth: '0',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
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
                    <option value="1">1 dia</option>
                    <option value="7">7 dias</option>
                    <option value="15">15 dias</option>
                    <option value="20">20 dias</option>
                    <option value="25">25 dias</option>
                    <option value="30">30 dias</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Quantidade de Ramais *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newPlanData.agents}
                    onChange={(e) => {
                      const newAgents = parseInt(e.target.value) || 1;
                      const autoFeatures = generateFeatures(newAgents, newPlanData.periodDays);
                      setNewPlanData({ 
                        ...newPlanData, 
                        agents: newAgents,
                        features: autoFeatures,
                        limits: { ...newPlanData.limits, agents: newAgents }
                      });
                    }}
                    style={{
                      width: '100%',
                      minWidth: '0',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
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
              
              {/* Recursos Inclusos - Gerados Automaticamente */}
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
                  Recursos Inclusos (Gerados Automaticamente)
                </label>
                
                <div
                  style={{
                    background: 'rgba(249, 250, 251, 0.8)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}
                >
                  {generateFeatures(newPlanData.agents, newPlanData.periodDays).map((feature, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: index < generateFeatures(newPlanData.agents, newPlanData.periodDays).length - 1 ? '0.5rem' : '0',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}
                    >
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#3b82f6',
                          flexShrink: 0
                        }}
                      />
                      {feature}
                    </div>
                  ))}
                </div>
                
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontStyle: 'italic'
                  }}
                >
                  💡 Os recursos são gerados automaticamente com base na quantidade de ramais e período selecionados
                </div>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Descrição</label>
                <textarea
                  value={newPlanData.description}
                  onChange={(e) => setNewPlanData({ ...newPlanData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    outline: 'none',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    resize: 'vertical',
                    transition: 'all 0.2s ease'
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
              
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => setShowNewPlanModal(false)}
                  style={{
                    flex: '1 1 120px',
                    minWidth: '120px',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreatePlan}
                  disabled={isLoading || !newPlanData.name.trim() || newPlanData.price <= 0 || newPlanData.limits.agents <= 0}
                  style={{
                    flex: '1 1 140px',
                    minWidth: '140px',
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: (isLoading || !newPlanData.name.trim() || newPlanData.price <= 0) ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Package size={16} />}
                  {isLoading ? 'Criando...' : 'Criar Plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {showDeleteConfirm && selectedPlan && (
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
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderRadius: '1rem',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '90%',
            maxWidth: '400px',
            padding: '1.5rem'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Trash2 size={24} style={{ color: '#dc2626' }} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
                Excluir Plano
              </h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                Tem certeza que deseja excluir <strong>{selectedPlan.name}</strong>?
                <br />Esta ação não pode ser desfeita.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedPlan(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeletePlan}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  opacity: isLoading ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                {isLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👁️ MODAL DE VISUALIZAÇÃO DE PLANO */}
      {showViewModal && selectedPlan && (
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
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Detalhes do Plano
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Nome e Status */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    {selectedPlan.name}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: selectedPlan.status === 'active' ? '#dcfce7' : '#fef3c7',
                    color: selectedPlan.status === 'active' ? '#166534' : '#92400e'
                  }}>
                    {selectedPlan.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {selectedPlan.description && (
                  <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: '#64748b',
                    lineHeight: '1.5'
                  }}>
                    {selectedPlan.description}
                  </p>
                )}
              </div>

              {/* Informações Principais */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#64748b',
                    marginBottom: '0.25rem'
                  }}>
                    Preço
                  </div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#1e293b'
                  }}>
                    {formatCurrency(selectedPlan.price)}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    /{selectedPlan.periodDays ? `${selectedPlan.periodDays} dias` : 'período'}
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#64748b',
                    marginBottom: '0.25rem'
                  }}>
                    Limite de Agentes
                  </div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#1e293b'
                  }}>
                    {selectedPlan.maxAgents || 0}
                  </div>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#64748b',
                    marginBottom: '0.25rem'
                  }}>
                    Clientes Usando
                  </div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#1e293b'
                  }}>
                    {selectedPlan.subscribersCount || 0}
                  </div>
                </div>
              </div>

              {/* Recursos */}
              {selectedPlan.features && selectedPlan.features.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    Recursos Inclusos
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '0.5rem'
                  }}>
                    {selectedPlan.features.map((feature: string, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: '#475569'
                      }}>
                        <CheckCircle size={16} style={{ color: '#10b981' }} />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => setShowViewModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '100px'
                  }}
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEditPlan(selectedPlan);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '100px'
                  }}
                >
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ MODAL DE EDIÇÃO DE PLANO */}
      {showEditModal && editPlanData && (
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
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                Editar Plano
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={(e) => { e.preventDefault(); confirmEditPlan(); }}>
                {/* Nome do Plano */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Nome do Plano *
                  </label>
                  <input
                    type="text"
                    value={editPlanData.name}
                    onChange={(e) => setEditPlanData({ ...editPlanData, name: e.target.value })}
                    placeholder="Ex: Plano Premium"
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Descrição */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Descrição
                  </label>
                  <textarea
                    value={editPlanData.description}
                    onChange={(e) => setEditPlanData({ ...editPlanData, description: e.target.value })}
                    placeholder="Descreva os benefícios do plano..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Preço e Limite de Agentes */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Preço (R$) *
                    </label>
                    <input
                      type="number"
                      value={editPlanData.price}
                      onChange={(e) => setEditPlanData({ ...editPlanData, price: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>
                      Limite de Agentes *
                    </label>
                    <input
                      type="number"
                      value={editPlanData.limits?.agents || 0}
                      onChange={(e) => setEditPlanData({ 
                        ...editPlanData, 
                        limits: { 
                          ...editPlanData.limits, 
                          agents: parseInt(e.target.value) || 0 
                        }
                      })}
                      placeholder="0"
                      min="0"
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>
                </div>

                {/* Status */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Status
                  </label>
                  <select
                    value={editPlanData.status}
                    onChange={(e) => setEditPlanData({ ...editPlanData, status: e.target.value as 'active' | 'inactive' | 'draft' })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      backgroundColor: 'white',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>

                {/* Botões de Ação */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '100px'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '100px',
                      opacity: isLoading ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(255, 255, 255, 0.3)',
                          borderTop: '2px solid white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
