'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  UserPlus, 
  CreditCard, 
  Phone, 
  Mail, 
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Settings,
  Shield,
  ShieldOff
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import logger from '@/utils/logger';

// Função para formatar telefone brasileiro
const formatPhoneBrazil = (phone: string): string => {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos
  const numbers = phone.replace(/\D/g, '');
  
  // Aplica a formatação baseada no tamanho
  if (numbers.length <= 10) {
    // Formato: (11) 1234-5678
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else {
    // Formato: (11) 91234-5678
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
};

// Função para aplicar máscara durante digitação
const applyPhoneMask = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 2) {
    return `(${numbers}`;
  } else if (numbers.length <= 6) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  } else {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
};

// Função para obter cor do plano
const getPlanColor = (planName: string, plans: any[]): string => {
  const plan = plans.find(p => p.name === planName);
  return plan?.color || '#3b82f6'; // Azul padrão se não encontrar
};

// Função para formatar moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Função para formatar valor de input em tempo real
const formatInputValue = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  if (!numbers) return '';
  
  // Converte para número (centavos)
  const amount = parseInt(numbers) / 100;
  
  // Formata como moeda brasileira sem o símbolo R$
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Função para converter valor formatado de volta para número
const parseFormattedValue = (formattedValue: string): number => {
  if (!formattedValue) return 0;
  
  // Remove pontos de milhares e substitui vírgula por ponto
  const cleanValue = formattedValue.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
};

// Função para formatar data de vencimento
const formatExpirationDate = (dateString: string | null | undefined): { text: string; isExpired: boolean; isExpiringSoon: boolean } => {
  if (!dateString) {
    return { text: 'Sem vencimento', isExpired: false, isExpiringSoon: false };
  }
  
  const expirationDate = new Date(dateString);
  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const isExpired = diffDays < 0;
  const isExpiringSoon = diffDays >= 0 && diffDays <= 7;
  
  if (isExpired) {
    const expiredDays = Math.abs(diffDays);
    return { 
      text: `Vencido há ${expiredDays} dia${expiredDays !== 1 ? 's' : ''}`, 
      isExpired: true, 
      isExpiringSoon: false 
    };
  } else if (isExpiringSoon) {
    return { 
      text: diffDays === 0 ? 'Vence hoje' : `${diffDays} dia${diffDays !== 1 ? 's' : ''}`, 
      isExpired: false, 
      isExpiringSoon: true 
    };
  } else {
    return { 
      text: `${diffDays} dias`, 
      isExpired: false, 
      isExpiringSoon: false 
    };
  }
};

// Função para obter cor do status
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return { bg: '#dcfce7', color: '#166534' };
    case 'inactive':
      return { bg: '#fef2f2', color: '#991b1b' };
    case 'pending':
      return { bg: '#fef3c7', color: '#92400e' };
    default:
      return { bg: '#f3f4f6', color: '#374151' };
  }
};

// Função para obter label do status
const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'inactive':
      return 'Inativo';
    case 'pending':
      return 'Pendente';
    default:
      return 'Desconhecido';
  }
};

export default function ResellerClientsPage() {
  const { success, error: showError, warning } = useToast();
  
  // Store state (fallback para desenvolvimento)
  const {
    clients: storeClients,
    isLoading: storeLoading,
    error,
    getFilteredClients,
    getClientStats,
    createClient: storeCreateClient,
    updateClient: storeUpdateClient,
    deleteClient: storeDeleteClient,
    addCredits: storeAddCredits,
    fetchClients
  } = useResellerClientsStore();
  
  // Estados do componente
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Estados para API real
  const [realClients, setRealClients] = useState<any[]>([]);
  const [realPlans, setRealPlans] = useState<any[]>([]);
  const [resellerBalance, setResellerBalance] = useState<number>(0); // Saldo do revendedor
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Auth e planos do revendedor
  const { user } = useAuthStore();
  const { plans: allPlans, getResellerPlans } = useResellerPlansStore();
  
  // Filtrar apenas os planos do revendedor logado
  const resellerPlans = user?.id ? getResellerPlans(user.id) : [];

  // Local state for modals
  const [newClientData, setNewClientData] = useState<CreateClientData>({
    name: '',
    company: '',
    email: '',
    phone: '',
    plan: '',
    notes: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });

  // Handler para formatação de telefone em tempo real
  const handlePhoneChange = (value: string) => {
    const formatted = applyPhoneMask(value);
    setNewClientData(prev => ({ ...prev, phone: formatted }));
  };

  const handleEditPhoneChange = (value: string) => {
    const formatted = applyPhoneMask(value);
    setEditClientData(prev => ({ ...prev, phone: formatted }));
  };

  // Handler para formatação de valor monetário em tempo real
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Se o usuário apagar tudo, limpar os estados
    if (!inputValue) {
      setFormattedAmount('');
      setCreditData(prev => ({ ...prev, amount: 0 }));
      return;
    }
    
    // Formatar o valor
    const formatted = formatInputValue(inputValue);
    const numericValue = parseFormattedValue(formatted);
    
    // Atualizar estados
    setFormattedAmount(formatted);
    setCreditData(prev => ({ ...prev, amount: numericValue }));
  };



  // 🔄 CARREGAR DADOS REAIS DO REVENDEDOR (SEMPRE FRESCOS)
  const loadResellerData = async (forceRefresh = false) => {
    // Evitar múltiplas chamadas simultâneas (exceto se forçado)
    if (isLoading && !forceRefresh) {
      logger.debug('loadResellerData já está executando, ignorando chamada duplicada');
      return;
    }
    
    try {
      setIsLoading(true);
      const currentUser = userService.getCurrentUser();
      
      if (!currentUser || currentUser.role !== 'reseller') {
        logger.warn('Usuário não é revendedor');
        return;
      }

      setCurrentUserId(currentUser.id);

      // Carregar saldo atual do revendedor
      try {
        const resellerData = await userService.getCurrentUserData();
        setResellerBalance(resellerData?.credits || 0);
        logger.debug(`Saldo do revendedor: R$ ${resellerData?.credits || 0}`);
      } catch (balanceError) {
        logger.error('Erro ao carregar saldo do revendedor:', balanceError);
        setResellerBalance(0);
      }

      // Carregar clientes reais
      const clients = await clientsService.getResellerClients();
      setRealClients(clients);

      // Carregar planos reais do revendedor usando o mesmo método da página de planos
      try {
        logger.debug('Carregando planos reais do revendedor...');
        const { secureSupabaseService } = await import('@/services/secureSupabaseService');
        const resellerPlansFromAPI = await secureSupabaseService.getPlansByReseller(currentUser.id);
        
        console.log(`🔍 Encontrados ${resellerPlansFromAPI.length} planos do revendedor ${currentUser.id}`);
        
        setRealPlans(resellerPlansFromAPI);
        
        // Definir plano padrão se não estiver definido
        if (!newClientData.plan && resellerPlansFromAPI.length > 0) {
          setNewClientData(prev => ({
            ...prev,
            plan: resellerPlansFromAPI[0].id
          }));
        }
        
        console.log(`✅ Planos reais carregados: ${resellerPlansFromAPI.length} planos disponíveis para o revendedor`);
        
      } catch (plansError) {
        console.error('❌ Erro ao carregar planos reais, usando fallback:', plansError);
        
        // Fallback: usar planos do store se disponíveis
        if (resellerPlans.length > 0) {
          setRealPlans(resellerPlans);
          
          if (!newClientData.plan && resellerPlans.length > 0) {
            setNewClientData(prev => ({
              ...prev,
              plan: resellerPlans[0].id || resellerPlans[0].name
            }));
          }
          
          console.log(`✅ Fallback: usando ${resellerPlans.length} planos do store`);
        } else {
          // Se não há planos no store, tentar buscar diretamente via secureSupabaseService
          try {
            console.log('🔄 Fallback: buscando planos via secureSupabaseService...');
            const { secureSupabaseService } = await import('@/services/secureSupabaseService');
            const resellerSpecificPlans = await secureSupabaseService.getPlansByReseller(currentUser.id);
            setRealPlans(resellerSpecificPlans);
            
            if (!newClientData.plan && resellerSpecificPlans.length > 0) {
              setNewClientData(prev => ({
                ...prev,
                plan: resellerSpecificPlans[0].id
              }));
            }
            
            console.log(`✅ Fallback: usando ${resellerSpecificPlans.length} planos específicos do revendedor`);
          } catch (resellerPlansError) {
            console.error('❌ Erro ao carregar planos do revendedor:', resellerPlansError);
            setRealPlans([]);
            console.log('⚠️ Nenhum plano encontrado para este revendedor');
          }
        }
      }

      console.log(`✅ Dados carregados com sucesso: ${clients.length} clientes, ${realPlans.length} planos`);
      console.log('🔄 loadResellerData concluído - evitando loops futuros');

    } catch (error) {
      console.error('❌ Erro ao carregar dados do revendedor:', error);
      showError('Erro', 'Erro ao carregar dados. Usando dados mock.');
    } finally {
      setIsLoading(false);
      console.log('✅ loadResellerData finalizado - isLoading = false');
    }
  };

  // Carregar dados na inicialização  // 🔄 CARREGAR DADOS INICIAIS + RECARREGAMENTO AUTOMÁTICO
  useEffect(() => {
    loadResellerData();
    
    // 🚀 ATUALIZAÇÃO AUTOMÁTICA - Recarregar dados a cada 30 segundos
    const interval = setInterval(() => {
      console.log('🔄 Atualização automática de dados...');
      loadResellerData(true); // Forçar refresh
    }, 30000); // 30 segundos
    
    return () => clearInterval(interval);
  }, []);

  // 🔄 RECARREGAR AO FOCAR NA PÁGINA (quando usuário volta à aba)
  useEffect(() => {
    const handleFocus = () => {
      console.log('👁️ Página focada - recarregando dados...');
      loadResellerData(true);
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []); // Dependências vazias para executar apenas uma vez

  // Atualizar plano padrão quando os planos do revendedor carregarem (apenas quando realPlans mudar)
  useEffect(() => {
    if (realPlans.length > 0 && !newClientData.plan) {
      setNewClientData(prev => ({
        ...prev,
        plan: realPlans[0].id || realPlans[0].name
      }));
    }
  }, [realPlans.length]); // Apenas quando o número de planos mudar
  
  const [editClientData, setEditClientData] = useState<UpdateClientData>({
    id: '',
    name: '',
    company: '',
    email: '',
    phone: '',
    plan: '',
    status: 'active',
    notes: ''
  });
  
  const [creditsData, setCreditData] = useState({ amount: 0, note: '' });
  const [formattedAmount, setFormattedAmount] = useState('');
  const [statusAction, setStatusAction] = useState<'activate' | 'deactivate'>('activate');
  const [showViewClientModal, setShowViewClientModal] = useState(false);

  // Carregar dados reais na inicialização
  useEffect(() => {
    loadResellerData();
  }, []); // Carregar apenas dados reais
  
  // 🎯 FUNÇÃO PARA BUSCAR LIMITE DE AGENTES DO PLANO
  const getPlanAgentLimit = (planId: string): number => {
    if (!planId || !realPlans.length) return 0;
    
    const plan = realPlans.find(p => p.id === planId || p.name === planId);
    return plan?.maxAgents || plan?.max_agents || 0;
  };

  // Usar APENAS dados reais - sem fallback para mock
  const clientsToUse = realClients;
  const statsToUse = {
    total: realClients.length,
    active: realClients.filter(c => c.status === 'active').length,
    inactive: realClients.filter(c => c.status === 'inactive').length,
    pending: realClients.filter(c => c.status === 'pending').length,
    totalCredits: realClients.reduce((sum, c) => sum + (c.credits || 0), 0)
  };
  
  const itemsPerPage = 10;

  // Filtrar clientes baseado nos filtros locais
  const localFilteredClients = clientsToUse.filter((client: any) => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || client.status === selectedStatus;
    const matchesPlan = selectedPlan === 'all' || client.plan === selectedPlan || client.plan_name === selectedPlan;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Pagination
  const totalPages = Math.ceil(localFilteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = localFilteredClients.slice(startIndex, endIndex);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', color: '#16a34a' };
      case 'pending': return { bg: '#fef3c7', color: '#d97706' };
      case 'inactive': return { bg: '#fee2e2', color: '#dc2626' };
      default: return { bg: '#f1f5f9', color: '#64748b' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'inactive': return 'Inativo';
      default: return 'Desconhecido';
    }
  };

  // Função removida - usando getPlanColor global

  // Função auxiliar para resolver nome do plano
  const getPlanName = (planId: string | undefined) => {
    if (!planId) return 'Sem Plano';
    return realPlans.find(plan => plan.id === planId)?.name || 'Plano não encontrado';
  };

  // Função para formatar telefone brasileiro
  const formatPhoneBrazil = (value: string) => {
    // Remove tudo que não é dígito
    const cleaned = value.replace(/\D/g, '');
    
    // Aplica máscara baseada no tamanho
    if (cleaned.length <= 10) {
      // Telefone fixo: (11) 1234-5678
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      // Celular: (11) 91234-5678
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  // Função para obter cor do plano por ID
  const getPlanColorFromData = (planId: string | undefined) => {
    if (!planId) return '#6b7280';
    const plan = realPlans.find(p => p.id === planId);
    return plan?.color || '#6b7280';
  };

  // Função auxiliar para validar formulário
  const isFormValid = () => {
    return (
      newClientData.name.trim() && 
      newClientData.company.trim() && 
      newClientData.email.trim() && 
      newClientData.plan && 
      newClientData.plan !== ""
    );
  };

  // 🔄 CRUD FUNCTIONS COM API REAL
  const handleCreateClient = async () => {
    if (!newClientData.name.trim() || !newClientData.company.trim() || !newClientData.email.trim()) {
      showError('Erro de validação', 'Preencha todos os campos obrigatórios');
      return;
    }

    if (!newClientData.plan) {
      showError('Erro de validação', 'Selecione um plano para o cliente');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 Criando cliente com API real:', newClientData);

      // Buscar ID do plano selecionado
      const selectedPlan = realPlans.find(p => p.id === newClientData.plan || p.name === newClientData.plan);
      if (!selectedPlan) {
        throw new Error('Plano selecionado não encontrado');
      }

      // Criar cliente usando API real
      const newClient = await clientsService.createClient({
        name: newClientData.name,
        company: newClientData.company,
        email: newClientData.email,
        phone: newClientData.phone,
        plan_id: selectedPlan.id,
        notes: newClientData.notes,
        address: newClientData.address
      });

      console.log('✅ Cliente criado com sucesso, recarregando dados...');
      
      // Recarregar dados completos do revendedor (clientes + estatísticas)
      await loadResellerData();

      success('Cliente criado!', `${newClientData.company} foi adicionado com sucesso`);
      
      // Limpar formulário
      setNewClientData({
        name: '',
        company: '',
        email: '',
        phone: '',
        plan: realPlans.length > 0 ? realPlans[0].id : '',
        notes: '',
        address: { street: '', city: '', state: '', zipCode: '' }
      });
      
      setShowNewClientModal(false);

    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error);
      showError('Erro ao criar cliente', error instanceof Error ? error.message : 'Tente novamente em alguns instantes');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para ativar/desativar cliente
  const handleToggleClientStatus = (client: any) => {
    setSelectedClient(client);
    setStatusAction(client.status === 'active' ? 'deactivate' : 'activate');
    setShowStatusModal(true);
  };

  // Confirmar mudança de status
  const confirmStatusChange = async () => {
    if (!selectedClient) return;

    try {
      setIsLoading(true);
      const newStatus = statusAction === 'activate' ? 'active' : 'inactive';
      
      // Atualizar no banco via clientsService
      await clientsService.updateClient(selectedClient.id, {
        status: newStatus
      });

      // Atualizar lista local
      setRealClients(prev => 
        prev.map(client => 
          client.id === selectedClient.id 
            ? { ...client, status: newStatus }
            : client
        )
      );

      success(`Cliente ${statusAction === 'activate' ? 'ativado' : 'desativado'} com sucesso!`);
      setShowStatusModal(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('Erro ao alterar status do cliente:', error);
      showError('Erro ao alterar status do cliente');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClient = (client: any) => {
    console.log('🔧 Editando cliente:', client);
    console.log('📋 Planos disponíveis:', realPlans);
    
    // Determinar o plano correto - priorizar plan_id, depois plan_name, depois plan
    let currentPlan = '';
    if (client.plan_id) {
      // Se tem plan_id, usar ele diretamente
      currentPlan = client.plan_id;
      console.log('✅ Usando plan_id:', currentPlan);
    } else if (client.plan_name) {
      // Se tem plan_name, buscar o ID correspondente
      const planFound = realPlans.find(p => p.name === client.plan_name);
      currentPlan = planFound ? planFound.id : client.plan_name;
      console.log('✅ Usando plan_name, encontrado ID:', currentPlan);
    } else {
      // Fallback para plan
      currentPlan = client.plan || '';
      console.log('⚠️ Usando fallback plan:', currentPlan);
    }
    
    setSelectedClient(client);
    setEditClientData({
      id: client.id,
      name: client.name,
      company: client.company,
      email: client.email,
      phone: formatPhoneBrazil(client.phone),
      plan: currentPlan,
      status: client.status || 'active',
      notes: client.notes || ''
    });
    setShowEditClientModal(true);
  };

  // Função para visualizar cliente
  const handleViewClient = (client: any) => {
    setSelectedClient(client);
    setShowViewClientModal(true);
  };

  const handleUpdateClient = async () => {
    if (!editClientData.name?.trim() || !editClientData.company?.trim() || !editClientData.email?.trim()) {
      showError('Erro de validação', 'Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setIsLoading(true);
      
      // Atualizar cliente usando API real
      const updatedClient = await clientsService.updateClient(editClientData.id, {
        name: editClientData.name,
        company: editClientData.company,
        email: editClientData.email,
        phone: editClientData.phone,
        plan_id: editClientData.plan
      });
      
      console.log('✅ Cliente atualizado com sucesso, recarregando dados...');
      
      // Recarregar dados completos do revendedor (clientes + estatísticas)
      await loadResellerData();

      success('Cliente atualizado!', `${editClientData.company} foi atualizado com sucesso`);
      setShowEditClientModal(false);
      setSelectedClient(null);
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      showError('Erro ao atualizar cliente', error instanceof Error ? error.message : 'Tente novamente em alguns instantes');
      
      // Fallback para store mock
      try {
        await storeUpdateClient(editClientData);
        success('Cliente atualizado (mock)!', `${editClientData.company} foi atualizado com sucesso`);
        setShowEditClientModal(false);
      } catch (fallbackError) {
        console.error('❌ Erro no fallback mock:', fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClient = (client: any) => {
  setSelectedClient(client);
  setShowDeleteConfirm(true);
  };

  // 🎯 FUNÇÃO PARA GERENCIAR CLIENTE (Nova funcionalidade)
  const handleManageClient = (client: any) => {
    // Navegar para página dedicada de gerenciamento
    window.location.href = `/reseller/clients/manage/${client.id}`;
  };

  const confirmDeleteClient = async () => {
  if (!selectedClient) return;

  try {
    setIsLoading(true);
    
    // Excluir cliente usando API real
    try {
      setIsLoading(true);
      
      // Excluir cliente usando API real
      await clientsService.deleteClient(selectedClient.id);
      
      console.log(' Cliente excluído com sucesso, recarregando dados...');
      
      // Recarregar dados completos do revendedor (clientes + estatísticas)
      await loadResellerData();

      success('Cliente excluído!', `${selectedClient.company} foi removido do sistema`);
      setShowDeleteConfirm(false);
    } catch (fallbackError) {
      console.error('❌ Erro no fallback mock:', fallbackError);
    }
  } finally {
    setIsLoading(false);
  }
  };

  const handleAddCredits = (client: any) => {
    setSelectedClient(client);
    setShowAddCreditsModal(true);
  };

  const confirmAddCredits = async () => {
    if (!selectedClient || creditsData.amount <= 0) return;

    // 🔍 VALIDAÇÃO DE SALDO DO REVENDEDOR
    if (creditsData.amount > resellerBalance) {
      showError(
        'Saldo Insuficiente', 
        `Você possui apenas ${formatCurrency(resellerBalance)} de saldo. Não é possível transferir ${formatCurrency(creditsData.amount)}.`
      );
      return;
    }

    try {
      setIsLoading(true);
      
      console.log(`💸 Iniciando transferência: R$ ${creditsData.amount} do revendedor (saldo: R$ ${resellerBalance}) para ${selectedClient.company}`);
      
      // 🔄 TRANSFERÊNCIA DE CRÉDITOS (Revendedor → Cliente)
      // 1. Debitar do revendedor
      const newResellerBalance = resellerBalance - creditsData.amount;
      
      // 2. Creditar no cliente via API
      await clientsService.addCredits(selectedClient.id, creditsData.amount, creditsData.note);
      
      // 3. Atualizar dados localmente (otimista) - IMEDIATO
      setResellerBalance(newResellerBalance);
      
      // 4. Atualizar créditos do cliente na lista local (otimista)
      setRealClients(prevClients => 
        prevClients.map(client => 
          client.id === selectedClient.id 
            ? { ...client, credits: client.credits + creditsData.amount }
            : client
        )
      );
      
      console.log(`✅ Transferência concluída: Novo saldo do revendedor: R$ ${newResellerBalance}`);
      
      // 5. Recarregar dados completos para sincronizar com banco (em background)
      setTimeout(() => {
        loadResellerData();
      }, 1000); // Aguardar 1s para dar tempo do cache ser invalidado

      success(
        'Transferência Realizada!', 
        `${formatCurrency(creditsData.amount)} transferidos para ${selectedClient.company}. Seu novo saldo: ${formatCurrency(newResellerBalance)}`
      );
      
      setCreditData({ amount: 0, note: '' });
      setFormattedAmount(''); // Limpar valor formatado
      setShowAddCreditsModal(false);
      setSelectedClient(null);
      
    } catch (error) {
      console.error('❌ Erro na transferência de créditos:', error);
      
      // Reverter saldo do revendedor em caso de erro
      await loadResellerData();
      
      showError(
        'Erro na Transferência', 
        error instanceof Error ? error.message : 'Falha ao transferir créditos. Tente novamente.'
      );
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
            Meus Clientes
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Gerencie todos os seus clientes e contratos
          </p>
        </div>
        
        <button
          onClick={() => setShowNewClientModal(true)}
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
          <Plus size={16} />
          Novo Cliente
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
            <Users size={20} style={{ color: '#3b82f6', marginRight: '0.5rem' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Total</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
            {statsToUse.total}
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
            <UserCheck size={20} style={{ color: '#10b981', marginRight: '0.5rem' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Ativos</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
            {statsToUse.active}
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
            <DollarSign size={20} style={{ color: '#f59e0b', marginRight: '0.5rem' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Total em Créditos</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
            {formatCurrency(statsToUse.totalCredits)}
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
            <Calendar size={20} style={{ color: '#f59e0b', marginRight: '0.5rem' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Pendentes</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
            {statsToUse.pending}
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
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
            alignItems: 'stretch'
          }}>
            {/* Busca */}
            <div 
              style={{ 
                position: 'relative',
                gridColumn: '1 / -1'
              }}
              className="search-field"
            >
              <Search 
                size={20} 
                style={{ 
                  position: 'absolute', 
                  left: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#64748b',
                  zIndex: 1
                }} 
              />
              <input
                type="text"
                placeholder="Buscar por nome, empresa ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  backgroundColor: 'white',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Filtro de Status */}
            <div style={{ minWidth: '140px' }}>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  padding: '0.75rem 2rem 0.75rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  width: '100%',
                  boxSizing: 'border-box',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="all">Todos os Status</option>
                <option value="active">Ativo</option>
                <option value="pending">Pendente</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>

            {/* Filtro de Plano */}
            <div style={{ minWidth: '130px' }}>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                style={{
                  padding: '0.75rem 2rem 0.75rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  width: '100%',
                  boxSizing: 'border-box',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <option value="all">Todos os Planos</option>
                {resellerPlans.map(plan => (
                  <option key={plan.id} value={plan.name}>{plan.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Cliente
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Contato
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Plano
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Agentes
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Créditos
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Status
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Vencimento
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ 
                      padding: '3rem 2rem', 
                      textAlign: 'center',
                      color: '#64748b'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '1rem' 
                      }}>
                        <Users size={48} style={{ color: '#cbd5e1' }} />
                        <div>
                          <div style={{ 
                            fontSize: '1.125rem', 
                            fontWeight: '600', 
                            color: '#374151',
                            marginBottom: '0.5rem'
                          }}>
                            Nenhum cliente encontrado
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            {searchTerm || selectedStatus !== 'all' 
                              ? 'Tente ajustar os filtros de busca ou criar um novo cliente.'
                              : 'Comece criando seu primeiro cliente clicando no botão "Novo Cliente" acima.'
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : currentClients.map((client: any) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                          {client.name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Building size={14} />
                          {client.company}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                          <Mail size={14} style={{ color: '#64748b' }} />
                          <span style={{ color: '#64748b' }}>{client.email}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Phone size={14} style={{ color: '#64748b' }} />
                          <span style={{ color: '#64748b' }}>{client.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: getPlanColorFromData(client.plan_id),
                          display: 'inline-block'
                        }}></span>
                        <span style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          {client.plan_name || client.plan || 'Sem Plano'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>
                      {(() => {
                        const currentAgents = client.agents || 0;
                        const maxAgents = getPlanAgentLimit(client.plan_id || client.plan);
                        
                        if (maxAgents === 0) {
                          return <span style={{ color: '#64748b' }}>-</span>;
                        }
                        
                        const isOverLimit = currentAgents > maxAgents;
                        const isNearLimit = currentAgents >= maxAgents * 0.8;
                        
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              color: isOverLimit ? '#dc2626' : isNearLimit ? '#f59e0b' : '#64748b',
                              fontWeight: isOverLimit ? '600' : '500'
                            }}>
                              {currentAgents}/{maxAgents}
                            </span>
                            {isOverLimit && (
                              <span style={{ 
                                fontSize: '0.75rem',
                                color: '#dc2626',
                                backgroundColor: '#fef2f2',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem',
                                border: '1px solid #fecaca'
                              }}>
                                Excedido
                              </span>
                            )}
                            {isNearLimit && !isOverLimit && (
                              <span style={{ 
                                fontSize: '0.75rem',
                                color: '#f59e0b',
                                backgroundColor: '#fffbeb',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem',
                                border: '1px solid #fed7aa'
                              }}>
                                Próximo
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: '#1e293b', fontWeight: '500', fontSize: '0.875rem' }}>
                          {formatCurrency(client.credits)}
                        </span>
                        <button
                          onClick={() => handleAddCredits(client)}
                          title="Adicionar créditos"
                          style={{
                            padding: '0.375rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #d1fae5',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#059669',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#dcfce7';
                            e.currentTarget.style.borderColor = '#86efac';
                            e.currentTarget.style.color = '#16a34a';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = '#d1fae5';
                            e.currentTarget.style.color = '#059669';
                          }}
                        >
                          <CreditCard size={14} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <StatusPill status={client.status as any} size="sm" />
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {(() => {
                        const expiration = formatExpirationDate(client.plan_expires_at);
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: expiration.isExpired ? '#ef4444' : expiration.isExpiringSoon ? '#f59e0b' : '#10b981'
                            }}></div>
                            <span style={{
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: expiration.isExpired ? '#dc2626' : expiration.isExpiringSoon ? '#d97706' : '#374151'
                            }}>
                              {expiration.text}
                            </span>
                          </div>
                        );
                      })()
                      }
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleManageClient(client)}
                          title="Gerenciar cliente"
                          style={{
                            padding: '0.5rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #e0e7ff',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#6366f1',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e0e7ff';
                            e.currentTarget.style.borderColor = '#a5b4fc';
                            e.currentTarget.style.color = '#4338ca';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.borderColor = '#e0e7ff';
                            e.currentTarget.style.color = '#6366f1';
                          }}
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          onClick={() => handleEditClient(client)}
                          title="Editar cliente"
                          style={{
                            padding: '0.5rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#64748b',
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
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client)}
                          title="Excluir cliente"
                          style={{
                            padding: '0.5rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            color: '#64748b',
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
                            e.currentTarget.style.color = '#64748b';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>



          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Mostrando {startIndex + 1} a {Math.min(endIndex, localFilteredClients.length)} de {localFilteredClients.length} resultados
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Anterior
                </button>
                <span style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    backgroundColor: currentPage === totalPages ? '#f9fafb' : 'white',
                    color: currentPage === totalPages ? '#9ca3af' : '#374151',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Novo Cliente */}
        {showNewClientModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
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
              overflow: 'auto'
            }}>
              {/* Header */}
              <div style={{
                padding: '1.5rem 1.5rem 1rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: 0
                }}>Novo Cliente</h3>
                <button
                  onClick={() => setShowNewClientModal(false)}
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

              {/* Content */}
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Nome *</label>
                    <input
                      type="text"
                      value={newClientData.name}
                      onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                      placeholder="Nome do responsável"
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Empresa *</label>
                    <input
                      type="text"
                      value={newClientData.company}
                      onChange={(e) => setNewClientData({...newClientData, company: e.target.value})}
                      placeholder="Nome da empresa"
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Email *</label>
                    <input
                      type="email"
                      value={newClientData.email}
                      onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                      placeholder="email@empresa.com"
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Telefone</label>
                    <input
                      type="tel"
                      value={newClientData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                    Plano * 
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                      ({realPlans.length} planos disponíveis)
                    </span>
                  </label>
                  {isLoading ? (
                    <div style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: '#f9fafb',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Carregando planos...
                    </div>
                  ) : realPlans.length > 0 ? (
                    <select
                      value={newClientData.plan}
                      onChange={(e) => setNewClientData({...newClientData, plan: e.target.value})}
                      required
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <option value="">Selecione um plano</option>
                      {realPlans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          ● {plan.name} - {formatCurrency(plan.price)}/{plan.periodDays ? `${plan.periodDays} dias` : 'período'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #fbbf24',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        ⚠️ Nenhum plano disponível encontrado
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={async () => {
                            console.log('🔄 Forçando recarregamento de planos...');
                            await loadResellerData();
                          }}
                          style={{
                            background: 'none',
                            border: '1px solid #92400e',
                            borderRadius: '0.25rem',
                            color: '#92400e',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            padding: '0.25rem 0.5rem'
                          }}
                        >
                          🔄 Recarregar
                        </button>
                        <button
                          onClick={() => {
                            setShowNewClientModal(false);
                            // Redirecionar para página de planos
                            window.location.href = '/reseller/plans';
                          }}
                          style={{
                            background: 'none',
                            border: '1px solid #92400e',
                            borderRadius: '0.25rem',
                            color: '#92400e',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            padding: '0.25rem 0.5rem'
                          }}
                        >
                          ➕ Criar plano
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Observações</label>
                  <textarea
                    value={newClientData.notes}
                    onChange={(e) => setNewClientData({...newClientData, notes: e.target.value})}
                    placeholder="Observações sobre o cliente..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#10b981';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowNewClientModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      color: '#374151',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateClient}
                    disabled={isLoading || !isFormValid()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: (isLoading || !isFormValid()) ? 'not-allowed' : 'pointer',
                      background: (isLoading || !isFormValid()) ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: isLoading ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(16, 185, 129, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <UserCheck size={16} />}
                    {isLoading ? 'Criando...' : 'Criar Cliente'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmar Exclusão */}
        {showDeleteConfirm && selectedClient && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '400px',
              padding: '1.5rem'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <Trash2 size={24} style={{ color: '#dc2626' }} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>Confirmar Exclusão</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  Tem certeza que deseja excluir <strong>{selectedClient.company}</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    color: '#374151',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteClient}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: 'white',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                  {isLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar Cliente */}
        {showEditClientModal && selectedClient && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
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
              overflow: 'auto'
            }}>
              {/* Header */}
              <div style={{
                padding: '1.5rem 1.5rem 1rem',
                borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: 0
                }}>Editar Cliente</h3>
                <button
                  onClick={() => setShowEditClientModal(false)}
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

              {/* Content */}
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Nome *</label>
                    <input
                      type="text"
                      value={editClientData.name}
                      onChange={(e) => setEditClientData({...editClientData, name: e.target.value})}
                      placeholder="Nome do responsável"
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Empresa *</label>
                    <input
                      type="text"
                      value={editClientData.company}
                      onChange={(e) => setEditClientData({...editClientData, company: e.target.value})}
                      placeholder="Nome da empresa"
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Email *</label>
                    <input
                      type="email"
                      value={editClientData.email}
                      onChange={(e) => setEditClientData({...editClientData, email: e.target.value})}
                      placeholder="email@empresa.com"
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Telefone</label>
                    <input
                      type="tel"
                      value={editClientData.phone}
                      onChange={(e) => handleEditPhoneChange(e.target.value)}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      style={{
                        width: '100%',
                        minWidth: '0',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#10b981';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                      Plano *
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal', marginLeft: '0.5rem' }}>({realPlans.length} planos disponíveis)</span>
                    </label>
                    {isLoading ? (
                      <div style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#f9fafb',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        Carregando planos...
                      </div>
                    ) : realPlans.length > 0 ? (
                      <select
                        value={editClientData.plan}
                        onChange={(e) => setEditClientData({...editClientData, plan: e.target.value})}
                        required
                        style={{
                          width: '100%',
                          minWidth: '0',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          outline: 'none',
                          cursor: 'pointer',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          boxSizing: 'border-box',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#10b981';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <option value="">Selecione um plano</option>
                        {realPlans.map(plan => (
                          <option key={plan.id} value={plan.id}>
                            ● {plan.name} - {formatCurrency(plan.price)}/{plan.periodDays ? `${plan.periodDays} dias` : 'período'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #fbbf24',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        textAlign: 'center'
                      }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          ⚠️ Nenhum plano disponível encontrado
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={async () => {
                              console.log('🔄 Forçando recarregamento de planos...');
                              await loadResellerData();
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            🔄 Recarregar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Status</label>
                    <select
                      value={editClientData.status}
                      onChange={(e) => setEditClientData({...editClientData, status: e.target.value as 'active' | 'inactive' | 'pending'})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)'
                      }}
                    >
                      <option value="active">Ativo</option>
                      <option value="pending">Pendente</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Observações</label>
                  <textarea
                    value={editClientData.notes}
                    onChange={(e) => setEditClientData({...editClientData, notes: e.target.value})}
                    placeholder="Observações sobre o cliente..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#10b981';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowEditClientModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      color: '#374151',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateClient}
                    disabled={isLoading || (resellerPlans.length === 0 && !editClientData.plan)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: (isLoading || (resellerPlans.length === 0 && !editClientData.plan)) ? 'not-allowed' : 'pointer',
                      background: (isLoading || (resellerPlans.length === 0 && !editClientData.plan)) ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                      color: 'white',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: isLoading ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(16, 185, 129, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Edit size={16} />}
                    {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Adicionar Créditos */}
        {showAddCreditsModal && selectedClient && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '0.5rem'
          }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderRadius: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: window.innerWidth > 640 ? '500px' : '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: window.innerWidth > 640 ? '1.5rem' : '1rem'
            }}>
              {/* Header */}
              <div style={{
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <CreditCard size={24} style={{ color: '#16a34a' }} />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '0.5rem'
                }}>Adicionar Créditos</h3>
                <p style={{
                  color: '#64748b',
                  fontSize: '0.875rem',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  Cliente: <strong>{selectedClient.company}</strong><br/>
                  Saldo do cliente: <strong>{formatCurrency(selectedClient.credits)}</strong><br/>
                  <span style={{ 
                    color: resellerBalance > 0 ? '#16a34a' : '#dc2626',
                    fontWeight: '500'
                  }}>
                    Seu saldo: <strong>{formatCurrency(resellerBalance)}</strong>
                  </span>
                </p>
              </div>

              {/* Content */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Valor a Adicionar *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>R$</span>
                    <input
                      type="text"
                      value={formattedAmount}
                      onChange={handleAmountChange}
                      placeholder="0,00"
                      style={{
                        width: '100%',
                        padding: window.innerWidth > 640 ? '0.75rem 0.75rem 0.75rem 2.5rem' : '0.875rem 0.875rem 0.875rem 2.75rem',
                        border: `1px solid ${creditsData.amount > resellerBalance ? '#dc2626' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                        fontSize: window.innerWidth > 640 ? '0.875rem' : '1rem',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#16a34a';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>Observação</label>
                  <textarea
                    value={creditsData.note}
                    onChange={(e) => setCreditData({...creditsData, note: e.target.value})}
                    placeholder="Motivo da transferência de créditos..."
                    rows={window.innerWidth > 640 ? 3 : 2}
                    style={{
                      width: '100%',
                      padding: window.innerWidth > 640 ? '0.75rem' : '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: window.innerWidth > 640 ? '0.875rem' : '1rem',
                      outline: 'none',
                      resize: 'vertical',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      boxSizing: 'border-box',
                      minHeight: window.innerWidth > 640 ? 'auto' : '2.5rem'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#16a34a';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Preview da Transferência */}
              {creditsData.amount > 0 && (
                <div style={{
                  backgroundColor: creditsData.amount > resellerBalance ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${creditsData.amount > resellerBalance ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {/* Validação de Saldo Insuficiente */}
                  {creditsData.amount > resellerBalance && (
                    <div style={{
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <Shield size={16} style={{ color: '#dc2626' }} />
                      <span style={{ 
                        color: '#dc2626', 
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        Saldo insuficiente! Você precisa de {formatCurrency(creditsData.amount - resellerBalance)} a mais.
                      </span>
                    </div>
                  )}

                  {/* Resumo da Transferência */}
                  <div style={{ fontSize: '0.875rem' }}>
                    {/* Saldo do Cliente */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ color: '#374151' }}>Saldo atual do cliente:</span>
                      <span style={{ fontWeight: '500' }}>{formatCurrency(selectedClient.credits)}</span>
                    </div>

                    {/* Transferência */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ color: '#16a34a' }}>+ Transferindo:</span>
                      <span style={{ fontWeight: '500', color: '#16a34a' }}>+{formatCurrency(creditsData.amount)}</span>
                    </div>

                    {/* Seu Saldo Atual */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{ color: '#374151' }}>Seu saldo atual:</span>
                      <span style={{ fontWeight: '500' }}>{formatCurrency(resellerBalance)}</span>
                    </div>

                    {/* Seu Novo Saldo */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem'
                    }}>
                      <span style={{ color: '#dc2626' }}>- Debitando do seu saldo:</span>
                      <span style={{ fontWeight: '500', color: '#dc2626' }}>-{formatCurrency(creditsData.amount)}</span>
                    </div>

                    <hr style={{ 
                      margin: '0.75rem 0', 
                      border: 'none', 
                      borderTop: `1px solid ${creditsData.amount > resellerBalance ? '#fecaca' : '#bbf7d0'}` 
                    }} />

                    {/* Resultados Finais */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '1rem',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      <div>
                        <div style={{ color: '#374151', marginBottom: '0.25rem' }}>Novo saldo do cliente:</div>
                        <div style={{ color: '#16a34a', fontSize: '1rem' }}>
                          {formatCurrency(selectedClient.credits + creditsData.amount)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#374151', marginBottom: '0.25rem' }}>Seu novo saldo:</div>
                        <div style={{ 
                          color: (resellerBalance - creditsData.amount) >= 0 ? '#16a34a' : '#dc2626',
                          fontSize: '1rem'
                        }}>
                          {formatCurrency(resellerBalance - creditsData.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    setShowAddCreditsModal(false);
                    setCreditData({ amount: 0, note: '' });
                    setFormattedAmount(''); // Limpar valor formatado
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    color: '#374151',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAddCredits}
                  disabled={isLoading || creditsData.amount <= 0 || creditsData.amount > resellerBalance}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: (isLoading || creditsData.amount <= 0 || creditsData.amount > resellerBalance) ? 'not-allowed' : 'pointer',
                    background: (isLoading || creditsData.amount <= 0 || creditsData.amount > resellerBalance) 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: 'white',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    opacity: (isLoading || creditsData.amount <= 0 || creditsData.amount > resellerBalance) ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading && creditsData.amount > 0) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(22, 163, 74, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading && creditsData.amount > 0) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CreditCard size={16} />}
                  {isLoading ? 'Adicionando...' : 'Adicionar Créditos'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Visualizar Cliente */}
        {showViewClientModal && selectedClient && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
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
              overflowY: 'auto',
              padding: '1.5rem'
            }}>
              {/* Header */}
              <div style={{
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: 0
                  }}>
                    Detalhes do Cliente
                  </h3>
                  <button
                    onClick={() => setShowViewClientModal(false)}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      color: '#6b7280',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.color = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6b7280';
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <p style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  margin: 0
                }}>
                  Informações completas do cliente
                </p>
              </div>

              {/* Informações do Cliente */}
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {/* Informações Básicas */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(249, 250, 251, 0.8)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(229, 231, 235, 0.5)'
                }}>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Users size={18} />
                    Informações Básicas
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Nome</label>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>{selectedClient.name}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Empresa</label>
                      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>{selectedClient.company}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Email</label>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>{selectedClient.email}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Telefone</label>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>{formatPhoneBrazil(selectedClient.phone)}</p>
                    </div>
                  </div>
                </div>

                {/* Plano e Status */}
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(249, 250, 251, 0.8)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(229, 231, 235, 0.5)'
                }}>
                  <h4 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CreditCard size={18} />
                    Plano e Status
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Plano Atual</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: getPlanColorFromData(selectedClient.plan_id),
                          display: 'inline-block'
                        }}></span>
                        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                          {selectedClient.plan_name || selectedClient.plan || 'Sem Plano'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Status</label>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: selectedClient.status === 'active' ? '#dcfce7' : selectedClient.status === 'inactive' ? '#fef2f2' : '#fef3c7',
                        color: selectedClient.status === 'active' ? '#166534' : selectedClient.status === 'inactive' ? '#991b1b' : '#92400e'
                      }}>
                        {selectedClient.status === 'active' ? <UserCheck size={12} /> : selectedClient.status === 'inactive' ? <UserX size={12} /> : <UserPlus size={12} />}
                        {selectedClient.status === 'active' ? 'Ativo' : selectedClient.status === 'inactive' ? 'Inativo' : 'Pendente'}
                      </span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Vencimento do Plano</label>
                      {(() => {
                        const expiration = formatExpirationDate(selectedClient.plan_expires_at);
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: expiration.isExpired ? '#ef4444' : expiration.isExpiringSoon ? '#f59e0b' : '#10b981'
                            }}></div>
                            <span style={{
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: expiration.isExpired ? '#dc2626' : expiration.isExpiringSoon ? '#d97706' : '#374151'
                            }}>
                              {expiration.text}
                            </span>
                            {selectedClient.plan_expires_at && (
                              <span style={{
                                fontSize: '0.75rem',
                                color: '#6b7280',
                                marginLeft: '0.5rem'
                              }}>
                                ({new Date(selectedClient.plan_expires_at).toLocaleDateString('pt-BR')})
                              </span>
                            )}
                          </div>
                        );
                      })()
                      }
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Créditos</label>
                      <p style={{
                        margin: 0,
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: selectedClient.credits > 0 ? '#059669' : '#dc2626'
                      }}>
                        {formatCurrency(selectedClient.credits || 0)}
                      </p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>Data de Criação</label>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                        {selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                {selectedClient.notes && (
                  <div style={{
                    padding: '1.5rem',
                    backgroundColor: 'rgba(249, 250, 251, 0.8)',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(229, 231, 235, 0.5)'
                  }}>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <FileText size={18} />
                      Observações
                    </h4>
                    <p style={{
                      margin: 0,
                      fontSize: '0.875rem',
                      color: '#374151',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {selectedClient.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div style={{
                marginTop: '1.5rem',
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => {
                    setShowViewClientModal(false);
                    handleEditClient(selectedClient);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '1px solid #10b981',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    color: '#10b981',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#10b981';
                  }}
                >
                  <Edit size={16} />
                  Editar Cliente
                </button>
                <button
                  onClick={() => setShowViewClientModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    color: '#374151',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
