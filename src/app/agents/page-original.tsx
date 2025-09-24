'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Save, 
  X, 
  RefreshCw,
  Settings,
  Phone,
  PhoneCall,
  Clock,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// ✅ CSS PARA ANIMAÇÃO DE LOADING
const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Injetar CSS no documento
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

import { agentsService } from '@/services/agentsService';
import { useToast } from '@/components/ui/toast';
import { authService } from '@/lib/auth';
import { ResponsiveCard, useIsMobile } from '@/components/ui/responsive-card';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { DataExport } from '@/components/ui/data-export';
import { useAuthStore } from '@/store/auth';
import { plansService } from '@/services/plansService';
import { MainLayout } from '@/components/layout/main-layout';
import { Agent } from '@/types';
import { userService } from '@/lib/userService';
import { Plan } from '@/types';
import { extensionStatusService } from '@/services/extensionStatusService';

export default function AgentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [editingCallerId, setEditingCallerId] = useState<string | null>(null);
  const [tempCallerIds, setTempCallerIds] = useState<{[key: string]: string}>({});
  const [loadingCallerId, setLoadingCallerId] = useState<{[key: string]: boolean}>({});
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempNames, setTempNames] = useState<{[key: string]: string}>({});
  const [loadingName, setLoadingName] = useState<{[key: string]: boolean}>({});
  const [visiblePasswords, setVisiblePasswords] = useState<{[key: string]: boolean}>({});
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingNewAgent, setLoadingNewAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    extension: '',
    password: '',
    callerId: ''
  });

  // Estados para modal de edição de agente
  const [showEditAgentModal, setShowEditAgentModal] = useState(false);
  const [managementPanelAgent, setManagementPanelAgent] = useState<Agent | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editAgentData, setEditAgentData] = useState({
    name: '',
    callerId: '',
    password: ''
  });
  const { success, error } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();

  // Verificar se usuário pode realizar operações CRUD
  const canPerformCRUD = authService.canPerformCRUD();
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [loadingEditAgent, setLoadingEditAgent] = useState(false);
  const [userPlan, setUserPlan] = useState<Plan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  
  // Hooks UX
  const { user, setUser } = useAuthStore();
  
  // Estado dos agentes - carregados do backend real
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estado de atualização do usuário removido - backend unificado já provê status quando necessário

  const [currentPage, setCurrentPage] = useState(1);

  // Filtrar agentes baseado no termo de busca (memoizado)
  const filteredAgents = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return agents;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(searchLower) ||
      agent.extension.toString().includes(searchLower) ||
      agent.callerId.includes(searchLower)
    );
  }, [agents, debouncedSearchTerm]);

  // Paginação (memoizada)
  const itemsPerPage = 10;
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentData = filteredAgents.slice(startIndex, endIndex);
    
    return { totalPages, currentData };
  }, [filteredAgents, currentPage, itemsPerPage]);
  
  const { totalPages, currentData } = paginationData;

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  useEffect(() => {
    const loadUserAndPlan = async () => {
      try {
        // Usar a mesma estratégia eficiente do MainLayout
        if (user?.id) {
          // 1️⃣ UMA ÚNICA CHAMADA para buscar dados do usuário
          const userData = await userService.getCurrentUserData();
          
          if (userData) {
            // 2️⃣ SE JÁ TEM planId, busca o plano diretamente
            if (userData.planId) {
              try {
                const planData = await plansService.getPlanById(userData.planId);
                setUserPlan(planData);
              } catch (error) {
                setUserPlan(null);
              }
            } else {
              setUserPlan(null);
            }
          }
        }
      } catch (error) {
        setUserPlan(null);
      } finally {
        setLoadingPlan(false);
      }
    };

    loadUserAndPlan();
  }, [user?.id]);

  useEffect(() => {
    const loadAgents = async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoadingAgents(true);
        }
        
        const realAgents = await agentsService.getAgents();
        
        // Converter dados reais para formato da interface atual
        const formattedAgents: Agent[] = realAgents.map(agent => {
          return {
            id: agent.id,
            name: agent.name,
            email: `${agent.name.toLowerCase().replace(' ', '.')}@empresa.com`, // Email mock baseado no nome
            extension: agent.ramal,
            department: 'Vendas', // Departamento mock
            status: agent.status,
            lastActivity: new Date(agent.lastActivity),
            totalCalls: agent.totalCalls,
            averageCallDuration: 180, // Duração média mock
            callerId: agent.callerid || `${agent.ramal}`,
            password: agent.password
          };
        });
        
        setAgents(formattedAgents);
        
      } catch (error) {
        // Em caso de erro, manter array vazio
        setAgents([]);
      } finally {
        if (showRefresh) {
          setRefreshing(false);
        } else {
          setLoadingAgents(false);
        }
      }
    };

    loadAgents();
  }, []);


  // 🔄 Auto-update de status online/offline via extensionStatusService
  useEffect(() => {
    // Inicia o polling (idempotente)
    extensionStatusService.startAutoUpdate();

    // Listener para refletir status em tempo real nos agentes
    const unsubscribe = extensionStatusService.addListener((data) => {
      setAgents((prev) =>
        prev.map((a) => {
          const ext = data.extensions[a.extension];
          if (!ext) return a;
          const nextStatus = ext.isOnline ? 'online' : 'offline';
          // Evita re-render desnecessário
          return a.status === nextStatus ? a : { ...a, status: nextStatus };
        })
      );
    });

    return () => {
      // Remove o listener ao desmontar a página
      unsubscribe();
    };
  }, []);

  // 🎨 FUNÇÃO PARA RENDERIZAR BADGE DE STATUS (baseado no unified agentsService)
  const getStatusBadge = useCallback((status: string) => {
    const realStatus = (status === 'online' || status === 'offline') ? status : 'offline';
    
    const statusConfig = {
      online: { 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.15))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: '#10b981',
        label: 'Online',
        dotColor: '#10b981',
        pulse: true
      },
      offline: { 
        background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(107, 114, 128, 0.15))',
        border: '1px solid rgba(107, 114, 128, 0.3)',
        color: '#6b7280',
        label: 'Offline',
        dotColor: '#6b7280',
        pulse: false
      }
    };

    const config = statusConfig[realStatus as keyof typeof statusConfig];
    
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        background: config.background,
        border: config.border,
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: config.color,
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '50%',
          background: config.dotColor,
          animation: config.pulse ? 'pulse 2s infinite' : 'none'
        }} />
        {config.label}
    </div>
  );
}, []);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  // ✅ FUNÇÃO REMOVIDA: Status agora é automático baseado na tabela ps_contacts
  // O status online/offline é determinado pela presença do ramal na tabela ps_contacts
  // e atualizado automaticamente a cada 5 segundos via extensionStatusService

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiada para a área de transferência!`);
    } catch (err) {
      console.error('Erro ao copiar:', err);
      toast.error('Erro ao copiar para a área de transferência');
    }
  }, []);

  const startEditingCallerId = (agentId: string, currentCallerId: string) => {
    setEditingCallerId(agentId);
    setTempCallerIds(prev => ({ ...prev, [agentId]: currentCallerId }));
  };

  const saveCallerId = async (agentId: string) => {
    const newCallerId = tempCallerIds[agentId];
    if (newCallerId && /^\d+$/.test(newCallerId)) {
      try {
        // ✅ ATIVAR LOADING DURANTE SALVAMENTO
        setLoadingCallerId(prev => ({ ...prev, [agentId]: true }));
        
        // Atualizar no banco via agentsService
        await agentsService.updateAgent(agentId, {
          callerid: newCallerId
        });

        // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Atualizar estado local imediatamente
        setAgents(prev => prev.map(agent => 
          agent.id === agentId ? { ...agent, callerId: newCallerId } : agent
        ));

        toast.success(`CallerID (Bina) atualizado para ${newCallerId}`);
        setEditingCallerId(null);
        setTempCallerIds(prev => {
          const { [agentId]: removed, ...rest } = prev;
          return rest;
        });
        
        
      } catch (err) {
        
        toast.error('Erro ao salvar CallerID. Tente novamente.');
      } finally {
        // ✅ DESATIVAR LOADING APÓS OPERAÇÃO
        setLoadingCallerId(prev => ({ ...prev, [agentId]: false }));
      }
    } else {
      toast.error('CallerID deve conter apenas números');
    }
  };

  const cancelEditingCallerId = () => {
    setEditingCallerId(null);
    setTempCallerIds({});
  };

  // Funções para edição de nome
  const startEditingName = (agentId: string, currentName: string) => {
    setEditingName(agentId);
    setTempNames({ ...tempNames, [agentId]: currentName });
  };

  const saveName = async (agentId: string) => {
    const newName = tempNames[agentId];
    if (newName && newName.trim().length >= 2) {
      try {
        // ✅ ATIVAR LOADING DURANTE SALVAMENTO
        setLoadingName(prev => ({ ...prev, [agentId]: true }));
        
        // Atualizar no banco via agentsService
        await agentsService.updateAgent(agentId, {
          agente_name: newName.trim()
        });

        // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Atualizar estado local imediatamente
        setAgents(prev => prev.map(agent => 
          agent.id === agentId ? { ...agent, name: newName.trim() } : agent
        ));

        toast.success(`Nome do agente atualizado para "${newName}"`);
        setEditingName(null);
        setTempNames(prev => {
          const { [agentId]: removed, ...rest } = prev;
          return rest;
        });
        
        
      } catch (err) {
        
        toast.error('Erro ao salvar nome. Tente novamente.');
      } finally {
        // ✅ DESATIVAR LOADING APÓS OPERAÇÃO
        setLoadingName(prev => ({ ...prev, [agentId]: false }));
      }
    } else {
      toast.error('Nome deve ter pelo menos 2 caracteres');
    }
  };

  const cancelEditingName = () => {
    setEditingName(null);
    setTempNames({});
  };

  const handleNameChange = (agentId: string, value: string) => {
    setTempNames({ ...tempNames, [agentId]: value });
  };

  // Função para alternar visibilidade da senha
  const togglePasswordVisibility = useCallback((agentId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  }, []);

  const handleCallerIdChange = (agentId: string, value: string) => {
    // Remove espaços e mantém apenas números
    const numbersOnly = value.replace(/\D/g, '');
    setTempCallerIds(prev => ({ ...prev, [agentId]: numbersOnly }));
  };

  // Função para excluir agente
  const deleteAgent = async (agentId: string, agentName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o agente "${agentName}"?\n\nEsta ação não pode ser desfeita.`)) {
      try {
        
        // Excluir do banco via agentsService
        await agentsService.deleteAgent(agentId);

        // Remover do estado local
        setAgents(prev => prev.filter(agent => agent.id !== agentId));

        success(`Agente "${agentName}" excluído com sucesso`);
      } catch (err) {
        error('Erro ao excluir agente. Tente novamente.');
      }
    }
  };

  // Estado para loading do ramal
  const [loadingExtension, setLoadingExtension] = useState(false);

  // ✅ FUNÇÃO INTELIGENTE PARA GERAR RAMAL SEM DUPLICATAS NO BANCO REAL
  const generateExtension = async () => {
    try {
      setLoadingExtension(true);
      setNewAgent(prev => ({ ...prev, extension: '...' }));
      // Usa backend para obter o próximo ramal disponível de forma atômica
      const next = await agentsService.getNextRamal();
      setNewAgent(prev => ({ ...prev, extension: next }));
    } catch (error:any) {
      console.error('Falha ao gerar ramal via backend:', error?.message || error);
      // Mantém valor anterior ou limpa em caso de erro
      setNewAgent(prev => ({ ...prev, extension: '' }));
    } finally {
      setLoadingExtension(false);
    }
  };

  const isPasswordWeak = (password: string) => {
    // Verifica senhas fracas
    const weakPatterns = [
      /^0+$/, // Apenas zeros
      /^1+$/, // Apenas uns
      /^2+$/, // Apenas dois
      /^3+$/, // Apenas três
      /^4+$/, // Apenas quatros
      /^5+$/, // Apenas cincos
      /^6+$/, // Apenas seis
      /^7+$/, // Apenas setes
      /^8+$/, // Apenas oitos
      /^9+$/, // Apenas noves
      /^(.)\1+$/, // Caracteres repetidos
      /^123+/, // Sequência 123...
      /^abc+/i, // Sequência abc...
    ];
    
    return weakPatterns.some(pattern => pattern.test(password));
  };

  const openNewAgentModal = async () => {
    // 🚫 VALIDAÇÃO DE SEGURANÇA: Verificar status suspenso
    if (!canPerformCRUD) {
      error('Conta suspensa! Entre em contato com o suporte para reativar sua conta.');
      return;
    }
    
    // 🔒 VALIDAÇÃO DE SEGURANÇA: Verificar limite antes de abrir modal
    if (isAtAgentLimit) {
      error(`Limite de ramais atingido! Seu plano "${userPlan?.name || 'Atual'}" permite no máximo ${userPlan?.maxAgents || 0} ramais.`);
      return;
    }
    
    
    
    setNewAgent({
      name: '',
      extension: '',
      password: '',
      callerId: ''
    });
    setShowNewAgentModal(true);
    setShowPassword(false);
    
    // Gerar ramal único após abrir o modal
    await generateExtension();
  };

  const closeNewAgentModal = () => {
    setShowNewAgentModal(false);
    setNewAgent({
      name: '',
      extension: '',
      password: '',
      callerId: ''
    });
    setShowPassword(false);
  };

  const handleNewAgentSubmit = async () => {
    // Validações
    if (!newAgent.name.trim()) {
      error('Nome é obrigatório');
      return;
    }
    
    if (newAgent.name.trim().length < 2) {
      error('Nome deve ter pelo menos 2 caracteres');
      return;
    }
    
    if (!newAgent.extension.trim()) {
      error('Ramal é obrigatório');
      return;
    }
    
    if (!/^\d{4}$/.test(newAgent.extension)) {
      error('Ramal deve ter exatamente 4 dígitos');
      return;
    }
    
    if (!newAgent.password.trim()) {
      error('Senha é obrigatória');
      return;
    }
    
    if (newAgent.password.length < 4) {
      error('Senha deve ter pelo menos 4 caracteres');
      return;
    }
    
    if (newAgent.callerId && !/^\d+$/.test(newAgent.callerId)) {
      error('CallerID deve conter apenas números');
      return;
    }

    try {
      // ✅ ATIVAR LOADING DURANTE CRIAÇÃO
      setLoadingNewAgent(true);
      
      // ✅ CRIAR AGENTE NO BANCO REAL VIA agentsService
      const createdAgentData = {
        agente_name: newAgent.name.trim(),
        ramal: newAgent.extension,
        senha: newAgent.password,
        callerid: newAgent.callerId || newAgent.extension,
        user_id: user?.id // Vincular ao usuário logado
      };
      
      const createdAgent = await agentsService.createAgent(createdAgentData);
      
      // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Adicionar à lista local imediatamente
      const newAgentForInterface: Agent = {
        id: createdAgent.id,
        name: createdAgent.name,
        extension: createdAgent.ramal,
        email: `${createdAgent.name.toLowerCase().replace(/\s+/g, '.')}@empresa.com`,
        status: createdAgent.status || 'offline',
        department: 'Geral',
        lastActivity: new Date(createdAgent.lastActivity || Date.now()),
        totalCalls: createdAgent.totalCalls || 0,
        averageCallDuration: 180,
        callerId: createdAgent.callerid || createdAgent.ramal,
        password: createdAgent.password
      };
      
      setAgents(prev => [...prev, newAgentForInterface]);
      
      closeNewAgentModal();
      
      // 🔒 FEEDBACK DE SEGURANÇA: Informar sobre limite após criação
      const newTotal = agents.length + 1;
      const newRemaining = userPlan ? Math.max(0, userPlan.maxAgents - newTotal) : 0;
      
      if (newRemaining === 0) {
        success(`Agente "${newAgent.name}" criado! ⚠️ Limite de ${userPlan?.maxAgents} ramais atingido.`);
      } else {
        success(`Agente "${newAgent.name}" criado! (${newRemaining} ramais restantes)`);
      }
      
      
    } catch (err) {
      
      error('Erro ao criar agente. Tente novamente.');
    } finally {
      // ✅ DESATIVAR LOADING APÓS OPERAÇÃO
      setLoadingNewAgent(false);
    }
  };

  const formatCallerIdDisplay = (callerId: string) => {
    if (!callerId) return '';
    
    // Formatação para números brasileiros
    if (callerId.length === 13) {
      // +55 11 99999-9999
      return `+${callerId.slice(0, 2)} ${callerId.slice(2, 4)} ${callerId.slice(4, 9)}-${callerId.slice(9)}`;
    } else if (callerId.length === 12) {
      // +55 11 9999-9999
      return `+${callerId.slice(0, 2)} ${callerId.slice(2, 4)} ${callerId.slice(4, 8)}-${callerId.slice(8)}`;
    } else if (callerId.length === 11) {
      // 11 99999-9999
      return `${callerId.slice(0, 2)} ${callerId.slice(2, 7)}-${callerId.slice(7)}`;
    } else if (callerId.length === 10) {
      // 11 9999-9999
      return `${callerId.slice(0, 2)} ${callerId.slice(2, 6)}-${callerId.slice(6)}`;
    }
    
    return callerId;
  };

  // Função para abrir modal de edição de agente
  const openEditAgentModal = (agent: Agent) => {
    setEditingAgent(agent);
    setEditAgentData({
      name: agent.name,
      callerId: agent.callerId || agent.extension,
      password: agent.password
    });
    setShowEditAgentModal(true);
    setShowEditPassword(false);
  };

  // Função para fechar modal de edição de agente
  const closeEditAgentModal = () => {
    setShowEditAgentModal(false);
    setEditingAgent(null);
    setEditAgentData({
      name: '',
      callerId: '',
      password: ''
    });
    setShowEditPassword(false);
  };

  // Função para salvar edições do agente
  const saveEditAgent = async () => {
    if (!editingAgent) return;

    // Validações
    if (!editAgentData.name.trim()) {
      error('Nome é obrigatório');
      return;
    }

    if (editAgentData.name.trim().length < 2) {
      error('Nome deve ter pelo menos 2 caracteres');
      return;
    }

    if (!editAgentData.callerId.trim()) {
      error('CallerID é obrigatório');
      return;
    }

    if (!/^\d+$/.test(editAgentData.callerId)) {
      error('CallerID deve conter apenas números');
      return;
    }

    if (!editAgentData.password.trim()) {
      error('Senha é obrigatória');
      return;
    }

    if (editAgentData.password.length < 4) {
      error('Senha deve ter pelo menos 4 caracteres');
      return;
    }

    try {
      // ✅ ATIVAR LOADING DURANTE SALVAMENTO DO MODAL
      setLoadingEditAgent(true);
      
      // Atualizar no banco via agentsService
      await agentsService.updateAgent(editingAgent.id, {
        agente_name: editAgentData.name.trim(),
        callerid: editAgentData.callerId.trim(),
        senha: editAgentData.password.trim()
      });

      // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Atualizar estado local imediatamente
      const updatedAgent = {
        ...editingAgent,
        name: editAgentData.name.trim(),
        callerId: editAgentData.callerId.trim(),
        password: editAgentData.password.trim()
      };
      
      setAgents(prev => prev.map(agent => 
        agent.id === editingAgent.id ? updatedAgent : agent
      ));
      
      

      success(`Agente "${editAgentData.name}" atualizado com sucesso`);
      closeEditAgentModal();
      
      // ✅ Log removido
    } catch (err) {
      
      error('Erro ao salvar alterações. Tente novamente.');
    } finally {
      // ✅ DESATIVAR LOADING APÓS OPERAÇÃO DO MODAL
      setLoadingEditAgent(false);
    }
  };

  // Funções do painel inline removidas - agora usando página dedicada

  // ✅ VALIDAÇÃO DE LIMITE DE RAMAIS BASEADA NO PLANO
  const isAtAgentLimit = userPlan ? agents.length >= userPlan.maxAgents : false;
  const remainingAgents = userPlan ? Math.max(0, userPlan.maxAgents - agents.length) : 0;
  
  // 🚫 VALIDAÇÃO DE STATUS SUSPENSO - Desabilitar todas as ações CRUD
  const isActionDisabled = isAtAgentLimit || !canPerformCRUD;
  
  

  // Calcular estatísticas
  const stats = {
    total: agents.length,
    online: agents.filter(a => a.status === 'online').length,
    busy: agents.filter(a => a.status === 'busy').length,
    offline: agents.filter(a => a.status === 'offline').length,
    away: agents.filter(a => a.status === 'away').length
  };

  // Informações do plano de ramais (DADOS REAIS)
  const extensionsPlan = {
    maxExtensions: userPlan?.maxAgents || 0, // Limite real do plano
    usedExtensions: agents.length, // Ramais em uso (dados reais do Supabase)
    availableExtensions: Math.max(0, (userPlan?.maxAgents || 0) - agents.length), // Ramais disponíveis
    planName: userPlan?.name || 'Carregando...', // Nome real do plano
    planDescription: userPlan?.description || '', // Descrição do plano
    isLoading: loadingPlan || loadingAgents // Estado de carregamento
  };

  



  // ⏳ Loading page while fetching plan or agents
  if (loadingAgents || loadingPlan) {
    return (
      <MainLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '70vh',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '3px solid rgba(99,102,241,0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite'
          }} />
          <div style={{ color: '#475569', fontWeight: 500 }}>Carregando agentes...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'transparent'
      }}>
        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '1rem',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px -2px rgba(99, 102, 241, 0.3)'
              }}>
                <Users style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#1e293b'
                }}>
                  {stats.total}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  fontWeight: '500'
                }}>
                  Total de Agentes
                </div>
              </div>
            </div>
          </div>

          <div style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '1rem',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px -2px rgba(16, 185, 129, 0.3)'
              }}>
                <UserCheck style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#1e293b'
                }}>
                  {stats.online}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  fontWeight: '500'
                }}>
                  Agentes Online
                </div>
              </div>
            </div>
          </div>

          <div style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '1rem',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px -2px rgba(245, 158, 11, 0.3)'
              }}>
                <Settings style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: '#1e293b',
                  marginBottom: '0.25rem'
                }}>
                  {extensionsPlan.isLoading ? 'Carregando...' : extensionsPlan.planName}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginBottom: '0.5rem'
                }}>
                  Limite de Agentes
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    {extensionsPlan.usedExtensions} / {extensionsPlan.maxExtensions} em uso
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    color: extensionsPlan.availableExtensions > 10 ? '#10b981' : extensionsPlan.availableExtensions > 5 ? '#f59e0b' : '#ef4444',
                    fontWeight: '600'
                  }}>
                    {extensionsPlan.availableExtensions} disponíveis
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '0.5rem',
                  background: 'rgba(226, 232, 240, 0.5)',
                  borderRadius: '0.25rem',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(extensionsPlan.usedExtensions / extensionsPlan.maxExtensions) * 100}%`,
                    height: '100%',
                    background: extensionsPlan.usedExtensions / extensionsPlan.maxExtensions > 0.9 
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
                      : extensionsPlan.usedExtensions / extensionsPlan.maxExtensions > 0.7 
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)' 
                      : 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '0.25rem',
                    transition: 'all 0.3s ease'
                  }}>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '1rem',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px -2px rgba(107, 114, 128, 0.3)'
              }}>
                <UserX style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: '#1e293b'
                }}>
                  {stats.offline}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  fontWeight: '500'
                }}>
                  Agentes Offline
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{
              position: 'relative',
              minWidth: '300px',
              flex: 1,
              maxWidth: '400px'
            }}>
              <Search style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '1rem',
                height: '1rem',
                color: '#64748b'
              }} />
              <input
                type="text"
                placeholder="Buscar agentes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <DataExport
                data={filteredAgents}
                filename="agentes"
              />
              
              <button
              onClick={openNewAgentModal}
              disabled={isActionDisabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: isActionDisabled 
                  ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isActionDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isActionDisabled ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!isActionDisabled) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(99, 102, 241, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActionDisabled) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              title={
                !canPerformCRUD 
                  ? 'Conta suspensa! Entre em contato com o suporte para reativar sua conta.'
                  : isAtAgentLimit 
                    ? `Limite de ${userPlan?.maxAgents || 0} ramais atingido (Plano: ${userPlan?.name || 'Sem plano'})` 
                    : `Criar novo agente (${remainingAgents} ramais restantes)`
              }
            >
              <Plus style={{ width: '1rem', height: '1rem' }} />
              {!canPerformCRUD ? 'Conta Suspensa' : isAtAgentLimit ? 'Limite Atingido' : 'Novo Agente'}
            </button>
            </div>
          </div>
        </div>

        {/* Agents Table */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '1rem',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
            background: 'rgba(248, 250, 252, 0.5)'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0
            }}>
              Lista de Agentes
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              margin: '0.25rem 0 0 0'
            }}>
              Gerencie todos os agentes do sistema
            </p>
          </div>

          {/* Desktop Table */}
          {!isMobile && (
            <div style={{
              overflowX: 'auto'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
              <thead>
                <tr style={{
                  background: 'rgba(248, 250, 252, 0.5)',
                  borderBottom: '1px solid rgba(226, 232, 240, 0.8)'
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Agente
                  </th>
                  <th style={{
                    padding: '1rem 1.5rem 1rem 1rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Ramal
                  </th>
                  <th style={{
                    padding: '1rem 2rem 1rem 1rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    CallerID (Bina)
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Status
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Senha
                  </th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentData.map((agent, index) => (
                  <tr key={agent.id} style={{
                    borderBottom: index < filteredAgents.length - 1 ? '1px solid rgba(226, 232, 240, 0.5)' : 'none',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(248, 250, 252, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '0.75rem',
                          background: agent.status === 'online'
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: agent.status === 'online' ? '#ffffff' : '#64748b'
                        }}>
                          {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          {editingName === agent.id ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <input
                                type="text"
                                value={tempNames[agent.id] || ''}
                                onChange={(e) => handleNameChange(agent.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveName(agent.id);
                                  } else if (e.key === 'Escape') {
                                    cancelEditingName();
                                  }
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  border: '1px solid rgba(99, 102, 241, 0.5)',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  outline: 'none',
                                  background: 'white',
                                  minWidth: '120px'
                                }}
                                placeholder="Nome do agente"
                                autoFocus
                              />
                              <button
                                onClick={() => saveName(agent.id)}
                                disabled={loadingName[agent.id]}
                                style={{
                                  padding: '0.25rem',
                                  background: loadingName[agent.id] ? 'rgba(156, 163, 175, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                  border: `1px solid ${loadingName[agent.id] ? 'rgba(156, 163, 175, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                  borderRadius: '0.25rem',
                                  cursor: loadingName[agent.id] ? 'not-allowed' : 'pointer',
                                  color: loadingName[agent.id] ? '#9ca3af' : '#22c55e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                title={loadingName[agent.id] ? 'Salvando...' : 'Salvar'}
                              >
                                {loadingName[agent.id] ? (
                                  <div style={{
                                    width: '0.75rem',
                                    height: '0.75rem',
                                    border: '2px solid #e5e7eb',
                                    borderTop: '2px solid #6366f1',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                  }} />
                                ) : '✓'}
                              </button>
                              <button
                                onClick={cancelEditingName}
                                style={{
                                  padding: '0.25rem',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Cancelar"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#1e293b'
                              }}>
                                {agent.name}
                              </div>
                              <button
                                onClick={() => startEditingName(agent.id, agent.name)}
                                style={{
                                  padding: '0.25rem',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#64748b',
                                  transition: 'all 0.2s ease',
                                  borderRadius: '0.25rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
                                  e.currentTarget.style.color = '#f59e0b';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#64748b';
                                }}
                                title="Editar nome"
                              >
                                <Edit style={{ width: '0.75rem', height: '0.75rem' }} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem 1rem 1rem', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#1e293b',
                        justifyContent: 'center'
                      }}>
                        <Phone style={{ width: '0.75rem', height: '0.75rem', color: '#64748b' }} />
                        <span>{agent.extension}</span>
                        <button
                          onClick={() => copyToClipboard(agent.extension, 'Ramal')}
                          style={{
                            padding: '0.25rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s ease',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                            e.currentTarget.style.color = '#6366f1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#64748b';
                          }}
                          title="Copiar ramal"
                        >
                          <Copy style={{ width: '0.75rem', height: '0.75rem' }} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 2rem 1rem 1rem', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.875rem',
                        color: '#1e293b',
                        justifyContent: 'center'
                      }}>
                        {editingCallerId === agent.id ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <input
                              type="text"
                              value={tempCallerIds[agent.id] || ''}
                              onChange={(e) => handleCallerIdChange(agent.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveCallerId(agent.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditingCallerId();
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                border: '1px solid rgba(99, 102, 241, 0.5)',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontFamily: 'monospace',
                                outline: 'none',
                                background: 'white',
                                minWidth: '120px'
                              }}
                              placeholder="Apenas números"
                              autoFocus
                            />
                            <button
                              onClick={() => saveCallerId(agent.id)}
                              disabled={loadingCallerId[agent.id]}
                              style={{
                                padding: '0.25rem',
                                background: loadingCallerId[agent.id] ? 'rgba(156, 163, 175, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                border: `1px solid ${loadingCallerId[agent.id] ? 'rgba(156, 163, 175, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                borderRadius: '0.25rem',
                                cursor: loadingCallerId[agent.id] ? 'not-allowed' : 'pointer',
                                color: loadingCallerId[agent.id] ? '#9ca3af' : '#22c55e',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              title={loadingCallerId[agent.id] ? 'Salvando...' : 'Salvar'}
                            >
                              {loadingCallerId[agent.id] ? (
                                <div style={{
                                  width: '0.75rem',
                                  height: '0.75rem',
                                  border: '2px solid #e5e7eb',
                                  borderTop: '2px solid #6366f1',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }} />
                              ) : '✓'}
                            </button>
                            <button
                              onClick={cancelEditingCallerId}
                              style={{
                                padding: '0.25rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <PhoneCall style={{ 
                              width: '1rem', 
                              height: '1rem', 
                              color: '#6366f1',
                              flexShrink: 0
                            }} />
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: '1px solid rgba(99, 102, 241, 0.1)',
                              minWidth: '140px',
                              
                            }}>
                              <span style={{
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#1e293b',
                                letterSpacing: '0.025em'
                              }}>
                                {formatCallerIdDisplay(agent.callerId)}
                              </span>
                            </div>
                            <button
                              onClick={() => startEditingCallerId(agent.id, agent.callerId)}
                              style={{
                                padding: '0.25rem',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#64748b',
                                transition: 'all 0.2s ease',
                                borderRadius: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
                                e.currentTarget.style.color = '#f59e0b';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#64748b';
                              }}
                              title="Editar CallerID"
                            >
                              <Edit style={{ width: '0.75rem', height: '0.75rem' }} />
                            </button>
                            <button
                              onClick={() => copyToClipboard(agent.extension.replace(/^\d/, '11'), 'CallerID')}
                              style={{
                                padding: '0.25rem',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#64748b',
                                transition: 'all 0.2s ease',
                                borderRadius: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                                e.currentTarget.style.color = '#6366f1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#64748b';
                              }}
                              title="Copiar CallerID"
                            >
                              <Copy style={{ width: '0.75rem', height: '0.75rem' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div>
                        {getStatusBadge(agent.status)}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(99, 102, 241, 0.1)',
                          minWidth: '100px',
                          textAlign: 'center'
                        }}>
                          <span style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#1e293b',
                            letterSpacing: '0.025em',
                            fontFamily: 'monospace'
                          }}>
                            {visiblePasswords[agent.id] ? agent.password : '••••••••'}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(agent.password, 'Senha')}
                          style={{
                            padding: '0.25rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s ease',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                            e.currentTarget.style.color = '#6366f1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#64748b';
                          }}
                          title="Copiar senha"
                        >
                          <Copy style={{ width: '0.75rem', height: '0.75rem' }} />
                        </button>
                        <button
                          onClick={() => togglePasswordVisibility(agent.id)}
                          style={{
                            padding: '0.25rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s ease',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                            e.currentTarget.style.color = '#a855f7';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#64748b';
                          }}
                          title={visiblePasswords[agent.id] ? 'Ocultar senha' : 'Exibir senha'}
                        >
                          {visiblePasswords[agent.id] ? 
                            <EyeOff style={{ width: '0.75rem', height: '0.75rem' }} /> : 
                            <Eye style={{ width: '0.75rem', height: '0.75rem' }} />
                          }
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}>
                        <button 
                          onClick={() => {
                            if (!canPerformCRUD) {
                              error('Conta suspensa! Entre em contato com o suporte para reativar sua conta.');
                              return;
                            }
                            router.push(`/agents/manage/${agent.id}`);
                          }}
                          disabled={!canPerformCRUD}
                          style={{
                            padding: '0.5rem',
                            background: !canPerformCRUD 
                              ? 'rgba(156, 163, 175, 0.1)'
                              : 'rgba(99, 102, 241, 0.1)',
                            border: !canPerformCRUD 
                              ? '1px solid rgba(156, 163, 175, 0.3)'
                              : '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '0.5rem',
                            cursor: !canPerformCRUD ? 'not-allowed' : 'pointer',
                            color: !canPerformCRUD ? '#9ca3af' : '#6366f1',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: !canPerformCRUD ? 0.6 : 1
                          }}
                          onMouseEnter={(e) => {
                            if (!!canPerformCRUD) {
                              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                              e.currentTarget.style.color = '#4f46e5';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!!canPerformCRUD) {
                              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                              e.currentTarget.style.color = '#6366f1';
                            }
                          }}
                          title={!canPerformCRUD ? 'Conta suspensa - Entre em contato com o suporte' : 'Gerenciar ramal'}
                        >
                          <Settings style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        <button 
                        onClick={() => {
                          if (!canPerformCRUD) {
                            error('Conta suspensa! Entre em contato com o suporte para reativar sua conta.');
                            return;
                          }
                          openEditAgentModal(agent);
                        }}
                        disabled={!canPerformCRUD}
                        style={{
                          padding: '0.5rem',
                          background: !canPerformCRUD 
                            ? 'rgba(156, 163, 175, 0.1)'
                            : 'rgba(248, 250, 252, 0.8)',
                          border: !canPerformCRUD 
                            ? '1px solid rgba(156, 163, 175, 0.3)'
                            : '1px solid rgba(226, 232, 240, 0.8)',
                          borderRadius: '0.5rem',
                          cursor: !canPerformCRUD ? 'not-allowed' : 'pointer',
                          color: !canPerformCRUD ? '#9ca3af' : '#64748b',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: !canPerformCRUD ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!!canPerformCRUD) {
                            e.currentTarget.style.background = 'rgba(241, 245, 249, 0.9)';
                            e.currentTarget.style.color = '#374151';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!!canPerformCRUD) {
                            e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                            e.currentTarget.style.color = '#64748b';
                          }
                        }}
                        title={!canPerformCRUD ? 'Conta suspensa - Entre em contato com o suporte' : 'Editar agente'}
                        >
                          <Edit style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        <button 
                        onClick={() => {
                          if (!canPerformCRUD) {
                            error('Conta suspensa! Entre em contato com o suporte para reativar sua conta.');
                            return;
                          }
                          deleteAgent(agent.id, agent.name);
                        }}
                        disabled={!canPerformCRUD}
                        style={{
                          padding: '0.5rem',
                          background: !canPerformCRUD 
                            ? 'rgba(156, 163, 175, 0.1)'
                            : 'rgba(248, 250, 252, 0.8)',
                          border: !canPerformCRUD 
                            ? '1px solid rgba(156, 163, 175, 0.3)'
                            : '1px solid rgba(226, 232, 240, 0.8)',
                          borderRadius: '0.5rem',
                          cursor: !canPerformCRUD ? 'not-allowed' : 'pointer',
                          color: !canPerformCRUD ? '#9ca3af' : '#ef4444',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: !canPerformCRUD ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!!canPerformCRUD) {
                            e.currentTarget.style.background = 'rgba(254, 242, 242, 0.9)';
                            e.currentTarget.style.color = '#dc2626';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!!canPerformCRUD) {
                            e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                            e.currentTarget.style.color = '#ef4444';
                          }
                        }}
                        title={!canPerformCRUD ? 'Conta suspensa - Entre em contato com o suporte' : 'Excluir agente'}
                        >
                          <Trash2 style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}

          {/* Mobile Cards */}
          {isMobile && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '1rem'
            }}>
              {currentData.map((agent) => (
                <div key={agent.id} style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  padding: '1rem',
                  boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '0.75rem'
                  }}>
                    <div>
                      {editingName === agent.id ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.25rem'
                        }}>
                          <input
                            type="text"
                            value={tempNames[agent.id] || ''}
                            onChange={(e) => handleNameChange(agent.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveName(agent.id);
                              } else if (e.key === 'Escape') {
                                cancelEditingName();
                              }
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              border: '1px solid rgba(99, 102, 241, 0.5)',
                              borderRadius: '0.375rem',
                              fontSize: '1rem',
                              fontWeight: '600',
                              outline: 'none',
                              background: 'white',
                              minWidth: '150px'
                            }}
                            placeholder="Nome do agente"
                            autoFocus
                          />
                          <button
                            onClick={() => saveName(agent.id)}
                            style={{
                              padding: '0.25rem',
                              background: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              color: '#22c55e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Salvar"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEditingName}
                            style={{
                              padding: '0.25rem',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Cancelar"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.25rem'
                        }}>
                          <h3 style={{
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: '#1e293b',
                            margin: 0
                          }}>
                            {agent.name}
                          </h3>
                          <button
                            onClick={() => startEditingName(agent.id, agent.name)}
                            style={{
                              padding: '0.25rem',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#64748b',
                              transition: 'all 0.2s ease',
                              borderRadius: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)';
                              e.currentTarget.style.color = '#f59e0b';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                            title="Editar nome"
                          >
                            <Edit style={{ width: '0.75rem', height: '0.75rem' }} />
                          </button>
                        </div>
                      )}
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        margin: 0
                      }}>
                        {agent.department}
                      </p>
                    </div>
                    {getStatusBadge(agent.status)}
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: '500'
                      }}>Ramal</span>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0.25rem 0 0 0'
                      }}>
                        {agent.extension}
                      </p>
                    </div>
                    <div>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: '500'
                      }}>CallerID</span>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0.25rem 0 0 0'
                      }}>
                        {agent.callerId}
                      </p>
                    </div>
                    <div>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: '500'
                      }}>Senha</span>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.25rem'
                      }}>
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(99, 102, 241, 0.1)'
                        }}>
                          <span style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#1e293b',
                            letterSpacing: '0.025em',
                            fontFamily: 'monospace'
                          }}>
                            {visiblePasswords[agent.id] ? agent.password : '••••••••'}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(agent.password, 'Senha')}
                          style={{
                            padding: '0.25rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s ease',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                            e.currentTarget.style.color = '#6366f1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#64748b';
                          }}
                          title="Copiar senha"
                        >
                          <Copy style={{ width: '0.75rem', height: '0.75rem' }} />
                        </button>
                        <button
                          onClick={() => togglePasswordVisibility(agent.id)}
                          style={{
                            padding: '0.25rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            transition: 'all 0.2s ease',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                            e.currentTarget.style.color = '#a855f7';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#64748b';
                          }}
                          title={visiblePasswords[agent.id] ? 'Ocultar senha' : 'Exibir senha'}
                        >
                          {visiblePasswords[agent.id] ? 
                            <EyeOff style={{ width: '0.75rem', height: '0.75rem' }} /> : 
                            <Eye style={{ width: '0.75rem', height: '0.75rem' }} />
                          }
                        </button>
                      </div>
                    </div>
                    <div>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        fontWeight: '500'
                      }}>Última Atividade</span>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        margin: '0.25rem 0 0 0'
                      }}>
                        {agent.lastActivity.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => openEditAgentModal(agent)}
                      style={{
                        padding: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '0.5rem',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="Editar agente"
                    >
                      <Edit style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                    <button
                      onClick={() => deleteAgent(agent.id, agent.name)}
                      style={{
                        padding: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '0.5rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                      title="Excluir agente"
                    >
                      <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                    </button>
                  </div>
                </div>
              ))}
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

          {filteredAgents.length === 0 && (
            <div style={{
              padding: '3rem',
              textAlign: 'center'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <Users style={{ width: '3rem', height: '3rem', color: '#d1d5db' }} />
                <div>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#374151',
                    margin: '0 0 0.5rem 0'
                  }}>
                    Nenhum agente encontrado
                  </h3>
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    margin: 0
                  }}>
                    Tente ajustar os filtros de busca ou adicione novos agentes
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel removido - agora usando página dedicada */}

      {/* Modal Novo Agente */}
      {showNewAgentModal && (
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
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}>
            {/* Header do Modal */}
            <div style={{
              padding: '1rem 1rem 1rem 1rem',
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
              }}>
                Novo Agente
              </h2>
              <button
                onClick={closeNewAgentModal}
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
            <div style={{ padding: '0 1rem 1rem 1rem' }}>
              {/* Campo Nome */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Digite o nome do agente"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    background: 'rgba(255, 255, 255, 0.8)',
                    boxSizing: 'border-box',
                    minWidth: 0
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

              {/* Campo Ramal */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Ramal
                </label>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center'
                }}>
                  <input
                    type="text"
                    value={newAgent.extension}
                    readOnly
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: loadingExtension ? 'rgba(99, 102, 241, 0.05)' : 'rgba(243, 244, 246, 0.8)',
                      color: loadingExtension ? '#6366f1' : '#6b7280',
                      fontFamily: 'monospace',
                      fontWeight: '600',
                      textAlign: 'center',
                      animation: loadingExtension ? 'pulse 1.5s ease-in-out infinite' : 'none',
                      boxSizing: 'border-box',
                      minWidth: 0
                    }}
                  />
                  <button
                    onClick={generateExtension}
                    disabled={loadingExtension}
                    style={{
                      padding: '0.75rem',
                      background: loadingExtension 
                        ? 'rgba(156, 163, 175, 0.8)' 
                        : 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: 'white',
                      cursor: loadingExtension ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: loadingExtension ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!loadingExtension) {
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loadingExtension) {
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                    title={loadingExtension ? "Gerando ramal..." : "Gerar novo ramal"}
                  >
                    <RefreshCw style={{ 
                      width: '1rem', 
                      height: '1rem',
                      animation: loadingExtension ? 'spin 1s linear infinite' : 'none'
                    }} />
                  </button>
                </div>
              </div>

              {/* Campo Senha */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Senha *
                </label>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newAgent.password}
                    onChange={(e) => setNewAgent(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    style={{
                      width: '100%',
                      padding: '0.75rem 3rem 0.75rem 1rem',
                      border: `1px solid ${newAgent.password.length > 0 && newAgent.password.length < 8 ? '#ef4444' : newAgent.password.length > 0 && isPasswordWeak(newAgent.password) ? '#f59e0b' : 'rgba(209, 213, 219, 0.8)'}`,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'rgba(255, 255, 255, 0.8)',
                      boxSizing: 'border-box',
                      minWidth: 0
                    }}
                    onFocus={(e) => {
                      if (newAgent.password.length === 0 || (newAgent.password.length >= 8 && !isPasswordWeak(newAgent.password))) {
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
                      padding: '0.25rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showPassword ? 
                      <EyeOff style={{ width: '1rem', height: '1rem' }} /> : 
                      <Eye style={{ width: '1rem', height: '1rem' }} />
                    }
                  </button>
                </div>
                {newAgent.password.length > 0 && newAgent.password.length < 8 && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    marginTop: '0.25rem',
                    margin: '0.25rem 0 0 0'
                  }}>
                    Senha deve ter no mínimo 8 caracteres
                  </p>
                )}
                {newAgent.password.length >= 8 && isPasswordWeak(newAgent.password) && (
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

              {/* Campo CallerID */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  CallerID (Bina)
                </label>
                <input
                  type="text"
                  value={newAgent.callerId}
                  onChange={(e) => {
                    const numbersOnly = e.target.value.replace(/\D/g, '');
                    setNewAgent(prev => ({ ...prev, callerId: numbersOnly }));
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
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    minWidth: 0
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
                {newAgent.callerId && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.25rem',
                    margin: '0.25rem 0 0 0'
                  }}>
                    Formatado: {formatCallerIdDisplay(newAgent.callerId)}
                  </p>
                )}
              </div>

              {/* Botões */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={closeNewAgentModal}
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
                  onClick={handleNewAgentSubmit}
                  disabled={loadingNewAgent || !newAgent.name.trim() || !newAgent.password.trim() || newAgent.password.length < 8}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1.5rem',
                    background: (loadingNewAgent || !newAgent.name.trim() || !newAgent.password.trim() || newAgent.password.length < 8) 
                      ? 'rgba(156, 163, 175, 0.5)' 
                      : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: (loadingNewAgent || !newAgent.name.trim() || !newAgent.password.trim() || newAgent.password.length < 8) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: loadingNewAgent ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingNewAgent && newAgent.name.trim() && newAgent.password.trim() && newAgent.password.length >= 8) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(99, 102, 241, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loadingNewAgent && newAgent.name.trim() && newAgent.password.trim() && newAgent.password.length >= 8) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {loadingNewAgent ? (
                    <div style={{
                      width: '1rem',
                      height: '1rem',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                  ) : (
                    <Save style={{ width: '1rem', height: '1rem' }} />
                  )}
                  {loadingNewAgent ? 'Criando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Agente */}
      {showEditAgentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95))',
            backdropFilter: 'blur(20px)',
            borderRadius: '1rem',
            padding: '1rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}>
            {/* Cabeçalho */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
              padding: '0 1rem'
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1f2937',
                margin: 0,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Editar Agente
              </h3>
              <button
                onClick={closeEditAgentModal}
                style={{
                  padding: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.5rem',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* Formulário */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem',
              padding: '0 1rem'
            }}>
              {/* Nome do Agente */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Nome do Agente *
                </label>
                <input
                  type="text"
                  value={editAgentData.name}
                  onChange={(e) => setEditAgentData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Digite o nome do agente"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.8)',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* CallerID */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  CallerID *
                </label>
                <input
                  type="text"
                  value={editAgentData.callerId}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setEditAgentData(prev => ({ ...prev, callerId: value }));
                  }}
                  placeholder="Digite apenas números"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.8)',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Senha */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Senha *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editAgentData.password}
                    onChange={(e) => setEditAgentData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Digite a senha"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      paddingRight: '3rem',
                      border: '1px solid rgba(209, 213, 219, 0.8)',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.8)',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box',
                      minWidth: 0
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(209, 213, 219, 0.8)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6b7280',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showEditPassword ? 
                      <EyeOff style={{ width: '1rem', height: '1rem' }} /> : 
                      <Eye style={{ width: '1rem', height: '1rem' }} />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div style={{
              marginTop: '2rem',
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              padding: '0 1rem',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={closeEditAgentModal}
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
                onClick={saveEditAgent}
                disabled={loadingEditAgent}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loadingEditAgent ? 'linear-gradient(135deg, #9ca3af, #6b7280)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: loadingEditAgent ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: loadingEditAgent ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loadingEditAgent) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(59, 130, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loadingEditAgent) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {loadingEditAgent ? (
                  <div style={{
                    width: '1rem',
                    height: '1rem',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <Save style={{ width: '1rem', height: '1rem' }} />
                )}
                {loadingEditAgent ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
 
}
