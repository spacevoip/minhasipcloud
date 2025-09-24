'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package, Plus, Edit, Trash2, Users, DollarSign, Check, X, Star, Crown, Zap, Calendar, Save } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { ResponsiveCard, useIsMobile } from '@/components/ui/responsive-card';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { DataExport } from '@/components/ui/data-export';
import { plansService } from '@/services/plansService';
import { usersServiceWithFallback as usersService } from '@/services/usersService';
import { Plan } from '@/types';

export default function AdminPlansPage() {
  const toast = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false); // Cache resolve instantaneamente
  const [subscriberCountsState, setSubscriberCountsState] = useState<{[key: string]: number}>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [newPlan, setNewPlan] = useState({
    name: '',
    price: '',
    periodDays: 30, // Padrão 30 dias (número)
    agents: 5, // Quantidade de ramais padrão
    features: [] as string[], // Será gerado automaticamente
    isFreePlan: false, // Novo campo para plano gratis
    maxCalls: 100 // Para planos gratis - quantidade de chamadas
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  // Função otimizada para carregar planos E contadores em paralelo
  const loadPlansWithCounts = useCallback(async () => {
    try {
      setLoading(true);
      setCountsLoading(true);
      
      // Executar ambas as chamadas em paralelo para melhor performance
      const [plansData, countsData] = await Promise.all([
        plansService.getAllPlans(),
        usersService.getUserCountsByPlan()
      ]);
      
      setPlans(plansData);
      setSubscriberCountsState(countsData);
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast.error('Erro', 'Erro ao carregar planos e contadores');
      
      // Fallback para dados vazios em caso de erro
      setPlans([]);
      setSubscriberCountsState({});
    } finally {
      setLoading(false);
      setCountsLoading(false);
    }
  }, [toast]);

  // Carregar dados apenas uma vez na montagem
  useEffect(() => {
    loadPlansWithCounts();
  }, []); // Dependências vazias para evitar re-renders

  // Hooks UX
  const { currentPage, totalPages, currentData, goToPage } = usePagination(plans, 8);

  // Função para gerar recursos automaticamente (igual ao revendedor)
  const generateFeatures = useCallback((agents: number, periodDays: number) => {
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
  }, []);

  // Função para gerar cores variadas (não sempre cinza)
  const generatePlanColor = useCallback(() => {
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
  }, []);

  // Função memoizada para formatar moeda
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  }, []);

  // Funções para o modal de novo plano
  const openNewPlanModal = () => {
    setNewPlan({
      name: '',
      price: '',
      periodDays: 30,
      agents: 5,
      features: [],
      isFreePlan: false,
      maxCalls: 100
    });
    setShowNewPlanModal(true);
  };

  const closeNewPlanModal = () => {
    setShowNewPlanModal(false);
    setNewPlan({
      name: '',
      price: '',
      periodDays: 30,
      agents: 5,
      features: [],
      isFreePlan: false,
      maxCalls: 100
    });
  };

  // Função de validação robusta
  const validatePlanData = useCallback((data: typeof newPlan) => {
    const errors: string[] = [];
    
    // Validação do nome
    if (!data.name?.trim()) {
      errors.push('Nome do plano é obrigatório');
    } else if (data.name.trim().length < 3) {
      errors.push('Nome deve ter pelo menos 3 caracteres');
    } else if (data.name.trim().length > 50) {
      errors.push('Nome deve ter no máximo 50 caracteres');
    }
    
    // Validação do preço
    const price = parseFloat(data.price);
    if (!data.isFreePlan) {
      if (!data.price || isNaN(price)) {
        errors.push('Preço deve ser um número válido');
      } else if (price <= 0) {
        errors.push('Preço deve ser maior que zero');
      } else if (price > 10000) {
        errors.push('Preço não pode exceder R$ 10.000');
      }
    }
    
    // Validação dos agentes/chamadas
    if (data.isFreePlan) {
      // Para planos gratis, validar quantidade de chamadas
      if (data.maxCalls <= 0) {
        errors.push('Quantidade de chamadas deve ser maior que zero');
      } else if (data.maxCalls > 10000) {
        errors.push('Quantidade de chamadas não pode exceder 10.000');
      }
    } else {
      // Para planos pagos, validar quantidade de ramais
      if (data.agents <= 0) {
        errors.push('Quantidade de ramais deve ser maior que zero');
      } else if (data.agents > 1000) {
        errors.push('Quantidade de ramais não pode exceder 1000');
      }
    }
    
    // Validação do período
    if (data.periodDays <= 0) {
      errors.push('Período deve ser maior que zero');
    } else if (data.periodDays > 365) {
      errors.push('Período não pode exceder 365 dias');
    }
    
    // Verificar se já existe plano com mesmo nome
    const nameExists = plans.some(plan => 
      plan.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    );
    if (nameExists) {
      errors.push('Já existe um plano com este nome');
    }
    
    return errors;
  }, [plans]);

  const handleNewPlanSubmit = async () => {
    // Rate limiting - prevenir spam
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTime;
    const minInterval = 2000; // 2 segundos entre submissões
    
    if (timeSinceLastSubmit < minInterval) {
      toast.error('Erro', 'Aguarde alguns segundos antes de criar outro plano');
      return;
    }
    
    if (isSubmitting) {
      toast.error('Erro', 'Aguarde a conclusão da operação anterior');
      return;
    }
    
    // Validações robustas
    const validationErrors = validatePlanData(newPlan);
    
    if (validationErrors.length > 0) {
      toast.error('Erro de Validação', validationErrors[0]);
      return;
    }
    
    setIsSubmitting(true);
    setLastSubmitTime(now);

    try {
      // Gerar recursos automaticamente
      const autoFeatures = generateFeatures(newPlan.agents, newPlan.periodDays);
      const planColor = generatePlanColor();

      // Criar plano usando o serviço seguro
      const planData = {
        name: newPlan.name,
        price: newPlan.isFreePlan ? 0 : parseFloat(newPlan.price),
        max_agents: newPlan.isFreePlan ? 1 : newPlan.agents, // Planos gratis têm 1 ramal
        period_days: newPlan.periodDays,
        features: autoFeatures,
        description: autoFeatures.join(', '),
        short_description: newPlan.isFreePlan 
          ? `Plano ${newPlan.name} com ${newPlan.maxCalls} chamadas`
          : `Plano ${newPlan.name} com ${newPlan.agents} ramais`,
        calls_unlimited: !newPlan.isFreePlan, // Planos gratis têm chamadas limitadas
        max_concurrent_calls: newPlan.isFreePlan ? newPlan.maxCalls : undefined,
        is_popular: false,
        is_featured: false,
        color: planColor,
        icon: 'Package',
        status: 'active' as const,
        visibility: 'public' as const
      };

      // 🚀 USAR API BACKEND REAL para salvar no banco de dados
      const createdPlan = await plansService.createPlan(planData);
      
      // Atualizar lista local após sucesso na API
      setPlans(prevPlans => [...prevPlans, createdPlan]);
      
      // 🎯 FECHAR MODAL AUTOMATICAMENTE E MOSTRAR TOAST
      setShowNewPlanModal(false);
      setShowCreateModal(false);
      
      // Reset form
      setNewPlan({
        name: '',
        price: '',
        periodDays: 30,
        agents: 5,
        features: [],
        isFreePlan: false,
        maxCalls: 100
      });

      // Toast de sucesso após fechar modal
      setTimeout(() => {
        toast.success(`Plano "${createdPlan.name}" criado e salvo no banco com sucesso!`);
      }, 100);
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      toast.error('Erro ao criar plano');
    } finally {
      setIsSubmitting(false);
    }
  };



  // Memoizar cálculos pesados para evitar recálculos desnecessários
  const memoizedStats = useMemo(() => {
    const totalRevenue = plans.reduce((sum, plan) => {
      const subscribers = subscriberCountsState[plan.id] || 0;
      return sum + (plan.price * subscribers);
    }, 0);
    
    const totalSubscribers = Object.values(subscriberCountsState).reduce((sum, count) => sum + count, 0);
    const averageRevenue = plans.length > 0 ? totalRevenue / plans.length : 0;
    
    return {
      totalRevenue,
      totalSubscribers,
      averageRevenue
    };
  }, [plans, subscriberCountsState]);

  const { totalRevenue, totalSubscribers, averageRevenue } = memoizedStats;

  return (
    <MainLayout>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh', 
        background: '#f8fafc'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
              Gerenciamento de Planos
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Configure e gerencie os planos de assinatura
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <DataExport
              data={plans.map(plan => ({
                Nome: plan.name,
                'Preço': formatCurrency(plan.price),
                'Máx. Agentes': plan.maxAgents,
                'Período (dias)': plan.periodDays,
                Status: 'Ativo',
                Assinantes: subscriberCountsState[plan.id] || 0
              }))}
              filename="planos"
              title="Exportar Planos"
            />
            <button
              onClick={openNewPlanModal}
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
              <Plus style={{ width: '1rem', height: '1rem' }} />
              Novo Plano
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Package style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {plans.length}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Planos Ativos</p>
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
                <Users style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {totalSubscribers}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Assinantes</p>
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
                <DollarSign style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(totalRevenue)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Receita Mensal</p>
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
                <Star style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {formatCurrency(averageRevenue)}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Receita Média/Plano</p>
          </div>
        </div>

        {/* Plans Grid */}
        {loading ? (
          // Skeleton Loading para melhor UX
          <div style={{
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #e2e8f0',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}
              >
                {/* Header Skeleton */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    backgroundColor: '#f1f5f9',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: '1.5rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '0.25rem',
                      marginBottom: '0.5rem',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }} />
                    <div style={{
                      height: '1rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '0.25rem',
                      width: '60%',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }} />
                  </div>
                </div>

                {/* Stats Skeleton */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{
                      height: '3rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '0.5rem',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }} />
                  ))}
                </div>

                {/* Features Skeleton */}
                <div style={{ marginBottom: '1.5rem' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                      height: '1rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '0.25rem',
                      marginBottom: '0.5rem',
                      width: `${Math.random() * 40 + 60}%`,
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }} />
                  ))}
                </div>

                {/* Actions Skeleton */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{
                    flex: 1,
                    height: '2.5rem',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '0.5rem',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                  <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '0.5rem',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div style={{
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {currentData.map((plan) => {
            const IconComponent = plan.icon;
            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
                  border: plan.isPopular ? `2px solid ${plan.color}` : '1px solid #e2e8f0',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {plan.isPopular && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)`,
                    color: 'white',
                    padding: '0.5rem 1rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    borderBottomLeftRadius: '0.5rem'
                  }}>
                    MAIS POPULAR
                  </div>
                )}

                {/* Plan Header */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '0.75rem',
                      background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Package style={{ width: '20px', height: '20px', color: 'white' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
                        {plan.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: 'bold', color: plan.color }}>
                          {formatCurrency(plan.price)}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>/mês</span>
                      </div>
                    </div>
                  </div>

                  {/* Plan Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>{plan.maxAgents}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Agentes</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                        {plan.callsUnlimited === false 
                          ? `${plan.maxConcurrentCalls || 0}` 
                          : 'Ilimitadas'
                        }
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Chamadas</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                        {countsLoading ? '...' : (subscriberCountsState[plan.id] || 0)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Usuários</div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.75rem' }}>
                    Recursos Inclusos:
                  </h4>
                  {(() => {
                    // Tornar a lista de features resiliente: aceitar array, string JSON, ou gerar automaticamente
                    const rawFeatures: any = (plan as any).features;
                    let featuresArray: string[] = [];
                    if (Array.isArray(rawFeatures)) {
                      featuresArray = rawFeatures as string[];
                    } else if (typeof rawFeatures === 'string') {
                      try {
                        const parsed = JSON.parse(rawFeatures);
                        if (Array.isArray(parsed)) featuresArray = parsed as string[];
                      } catch {}
                    }
                    const featuresToShow = featuresArray.length > 0 
                      ? featuresArray 
                      : generateFeatures(plan.maxAgents, plan.periodDays);
                    return (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {featuresToShow.map((feature, index) => (
                          <li key={index} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            marginBottom: '0.5rem',
                            fontSize: '0.875rem',
                            color: '#64748b'
                          }}>
                            <Check style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: plan.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Edit style={{ width: '1rem', height: '1rem' }} />
                    Editar
                  </button>
                  <button
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#fef2f2',
                      color: '#ef4444',
                      border: '1px solid #fecaca',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 style={{ width: '1rem', height: '1rem' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </div>
        )}

        {/* Plan Comparison Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          marginTop: '2rem'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
              Comparação de Planos
            </h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Plano</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Preço</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Agentes</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Chamadas</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Assinantes</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Receita</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '2rem',
                          height: '2rem',
                          borderRadius: '0.5rem',
                          background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Package style={{ width: '14px', height: '14px', color: 'white' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{plan.name}</div>
                          {plan.isPopular && (
                            <div style={{ fontSize: '0.75rem', color: plan.color, fontWeight: '500' }}>Mais Popular</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>
                      {formatCurrency(plan.price)}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {plan.maxAgents}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {plan.callsUnlimited ? 'Chamadas Ilimitadas' : `${plan.maxConcurrentCalls || 100} chamadas simultâneas`}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {countsLoading ? '...' : (subscriberCountsState[plan.id] || 0)}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '500', color: '#10b981' }}>
                      {countsLoading ? '...' : formatCurrency(plan.price * (subscriberCountsState[plan.id] || 0))}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: plan.status === 'active' ? '#dcfce7' : '#fef3c7',
                        color: plan.status === 'active' ? '#166534' : '#92400e'
                      }}>
                        {plan.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Novo Plano */}
      {showNewPlanModal && (
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
              closeNewPlanModal();
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
                Novo Plano
              </h2>
              <button
                onClick={closeNewPlanModal}
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
            <div style={{ padding: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  maxWidth: '100%'
                }}
              >
                {/* Checkbox Plano Gratis */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <input
                    type="checkbox"
                    id="isFreePlan"
                    checked={newPlan.isFreePlan}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setNewPlan(prev => ({
                        ...prev,
                        isFreePlan: isChecked,
                        price: isChecked ? '0.00' : prev.price,
                        periodDays: isChecked ? 1 : 30,
                        agents: isChecked ? 1 : 5
                      }));
                    }}
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      cursor: 'pointer'
                    }}
                  />
                  <label
                    htmlFor="isFreePlan"
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: newPlan.isFreePlan ? '#dcfce7' : '#f1f5f9',
                      color: newPlan.isFreePlan ? '#166534' : '#64748b',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {newPlan.isFreePlan ? 'GRÁTIS' : 'PAGO'}
                    </span>
                    Plano Gratis
                  </label>
                </div>

                {/* Nome do Plano */}
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
                    Nome do Plano *
                  </label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Plano Premium"
                    style={{
                      width: '100%',
                      maxWidth: '100%',
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

                {/* Campos em linha - Valor e Período */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: '1rem'
                  }}
                >
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
                      value={newPlan.price}
                      onChange={(e) => setNewPlan(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="99.90"
                      disabled={newPlan.isFreePlan}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        background: newPlan.isFreePlan ? '#f9fafb' : 'rgba(255, 255, 255, 0.8)',
                        color: newPlan.isFreePlan ? '#9ca3af' : '#1f2937',
                        cursor: newPlan.isFreePlan ? 'not-allowed' : 'text',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        if (!newPlan.isFreePlan) {
                          e.target.style.borderColor = '#3b82f6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  {/* Quantidade de Ramais ou Chamadas */}
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
                      {newPlan.isFreePlan ? 'Quantidade de Chamadas *' : 'Quantidade de Ramais *'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={newPlan.isFreePlan ? "10000" : "100"}
                      value={newPlan.isFreePlan ? newPlan.maxCalls : newPlan.agents}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) || 1;
                        if (newPlan.isFreePlan) {
                          setNewPlan(prev => ({ 
                            ...prev, 
                            maxCalls: newValue,
                            features: generateFeatures(1, prev.periodDays) // Planos gratis sempre 1 ramal
                          }));
                        } else {
                          setNewPlan(prev => ({ 
                            ...prev, 
                            agents: newValue,
                            features: generateFeatures(newValue, prev.periodDays)
                          }));
                        }
                      }}
                      placeholder={newPlan.isFreePlan ? "100" : "5"}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
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

                  {/* Período em Dias */}
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
                      Período (dias) *
                    </label>
                    <select
                      value={newPlan.periodDays.toString()}
                      onChange={(e) => {
                        const newPeriod = parseInt(e.target.value);
                        setNewPlan(prev => ({ 
                          ...prev, 
                          periodDays: newPeriod,
                          features: generateFeatures(prev.isFreePlan ? 1 : prev.agents, newPeriod)
                        }));
                      }}
                      disabled={newPlan.isFreePlan}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        background: newPlan.isFreePlan ? '#f9fafb' : 'rgba(255, 255, 255, 0.8)',
                        color: newPlan.isFreePlan ? '#9ca3af' : '#1f2937',
                        cursor: newPlan.isFreePlan ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        if (!newPlan.isFreePlan) {
                          e.target.style.borderColor = '#3b82f6';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      {newPlan.isFreePlan ? (
                        <option value="1">1 dia</option>
                      ) : (
                        <>
                          <option value="1">1 dia</option>
                          <option value="7">7 dias</option>
                          <option value="15">15 dias</option>
                          <option value="20">20 dias</option>
                          <option value="25">25 dias</option>
                          <option value="30">30 dias</option>
                        </>
                      )}
                    </select>
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
                    {generateFeatures(newPlan.agents, newPlan.periodDays).map((feature, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: index < generateFeatures(newPlan.agents, newPlan.periodDays).length - 1 ? '0.5rem' : '0',
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
                  onClick={closeNewPlanModal}
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
                  onClick={handleNewPlanSubmit}
                  disabled={isSubmitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: isSubmitting 
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSubmitting 
                      ? '0 4px 12px rgba(156, 163, 175, 0.3)'
                      : '0 4px 12px rgba(59, 130, 246, 0.3)',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    }
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div style={{
                        width: '1rem',
                        height: '1rem',
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Save style={{ width: '1rem', height: '1rem' }} />
                      Criar Plano
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
