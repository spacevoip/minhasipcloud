'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Filter, Phone, PhoneCall, PhoneOff, Clock, User, Building, Copy, Edit, Eye, EyeOff, Trash2, Power, PowerOff, Plus, Settings, X, RefreshCw, Save } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { extensionStatusService, ExtensionStatusData } from '@/services/extensionStatusService';
import { adminAgentsService, AdminAgent } from '@/services/adminAgentsService';
import AgentStatusPill from '@/components/ui/AgentStatusPill';

interface Agent {
  id: string;
  name: string;
  extension: string;
  callerId: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  userId: string;
  userName: string;
  userCompany: string;
  callsToday: number;
  totalCallTime: number;
  lastActivity: Date;
  plan: string;
  isOnline?: boolean; // Status real do sistema
  lastSeen?: string;
  uri?: string;
  userAgent?: string;
}

export default function AdminAgentsAllPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatusData | null>(null);
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AdminAgent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estados para painel inline de gerenciamento
  const [showManagementPanel, setShowManagementPanel] = useState(false);
  const [managingAgent, setManagingAgent] = useState<AdminAgent | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingCallerId, setEditingCallerId] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempCallerId, setTempCallerId] = useState('');
  const [saving, setSaving] = useState(false);
  // visibilidade de senha por agente
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  


  // ✅ CARREGAR DADOS REAIS DE AGENTES DO BACKEND
  const loadAgents = async () => {
    try {
      // loading apenas na primeira carga
      setLoading(prev => prev);
      setError(null);
      
      const response = await adminAgentsService.getAllAgents({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? (statusFilter as any) : undefined
      });
      
      setAgents(response.agents);
    } catch (error) {
      console.error('❌ Erro ao carregar agentes:', error);
      const message = error instanceof Error ? error.message : 'Erro ao carregar agentes';
      setError(message);
      if (message.includes('Token expirado') || (error as any)?.code === 401) {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('session_token');
        } catch {}
        router.push('/login');
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  // Carregar agentes na inicialização e quando filtros mudarem
  useEffect(() => {
    loadAgents();
  }, [searchTerm, statusFilter]);

  // ✅ Polling a cada 6s com snapshot diffing
  const lastSnapshotRef = useRef<string>('');
  useEffect(() => {
    let isMounted = true;
    let timer: any;

    const fetchAndDiff = async () => {
      try {
        const resp = await adminAgentsService.getAllAgents({
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? (statusFilter as any) : undefined,
        });
        if (!isMounted) return;

        const sorted = [...resp.agents].sort((a, b) => a.id.localeCompare(b.id));
        // gerar snapshot leve apenas com campos principais
        const snapshot = JSON.stringify(sorted.map(a => ({
          id: a.id,
          name: a.name,
          extension: a.extension,
          callerId: a.callerId,
          userId: a.userId,
          userName: a.userName,
          userCompany: a.userCompany,
          isActive: a.isActive,
          updatedAt: a.updatedAt,
        })));

        if (snapshot !== lastSnapshotRef.current) {
          lastSnapshotRef.current = snapshot;
          setAgents(resp.agents);
        }
      } catch (e) {
        // Silenciar erros de polling para evitar flicker
        console.warn('Polling admin agents falhou:', e);
        const message = e instanceof Error ? e.message : '';
        if (message.includes('Token expirado') || (e as any)?.code === 401) {
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('session_token');
          } catch {}
          router.push('/login');
          return;
        }
      }
    };

    // primeira chamada rápida sem setar loading
    fetchAndDiff();
    timer = setInterval(fetchAndDiff, 7000);

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [searchTerm, statusFilter]);



  // ✅ INICIALIZAR SISTEMA DE STATUS DE RAMAIS REAL - TODOS OS RAMAIS DO SISTEMA
  useEffect(() => {
    const unsubscribe = extensionStatusService.addListener((data) => {
      setExtensionStatus(data);
    });

    // Iniciar monitoramento automático com contexto
    extensionStatusService.startAutoUpdate('/admin/agents-all');

    return () => {
      unsubscribe();
      extensionStatusService.stopAutoUpdate();
    };
  }, []);

  const agentsWithRealStatus = useMemo(() => {
    if (!extensionStatus || !extensionStatus.extensions) {
      // Fallback para status_sip da tabela agentes_pabx quando extensionStatus não disponível
      return agents.map(agent => ({
        ...agent,
        isOnline: false, // Fallback quando extensionStatus não disponível
        lastSeen: agent.lastSeen,
        uri: undefined,
        userAgent: undefined
      }));
    }
    
    return agents.map(agent => {
      const realStatus = extensionStatus.extensions[agent.extension];
      return {
        ...agent,
        // Usar status real do ps_contacts se disponível, senão fallback para status_sip
        isOnline: realStatus ? realStatus.isOnline : false,
        lastSeen: realStatus?.details?.lastSeen || agent.lastSeen,
        uri: realStatus?.details?.uri,
        userAgent: realStatus?.details?.userAgent
      };
    });
  }, [agents, extensionStatus]);

  const filteredAgents = agentsWithRealStatus.filter((agent: AdminAgent) => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.extension.includes(searchTerm) ||
                         (agent.callerId || '').includes(searchTerm) ||
                         (agent.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (agent.userCompany || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'online' && agent.isOnline) ||
                         (statusFilter === 'offline' && !agent.isOnline);
    
    return matchesSearch && matchesStatus;
  });

  // ✅ FUNÇÕES DE GERENCIAMENTO DE AGENTES - PÁGINA DEDICADA
  const handleManageAgent = (agent: AdminAgent) => {
    router.push(`/admin/agents-all/manage/${agent.id}`);
  };


  const handleEditAgent = (agent: AdminAgent) => {
    setSelectedAgent(agent);
    setShowEditModal(true);
  };

  const handleDeleteAgentOld = (agent: AdminAgent) => {
    setSelectedAgent(agent);
    setShowDeleteModal(true);
  };

  const handleToggleStatusOld = async (agent: AdminAgent) => {
    try {
      await adminAgentsService.toggleAgentStatus(agent.id, !!agent.isActive);
      showToast('Status do agente alterado com sucesso!', 'success');
      await loadAgents(); // Recarregar lista
    } catch (error) {
      console.error('❌ Erro ao alterar status:', error);
      showToast('Erro ao alterar status do agente', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!selectedAgent) return;
    
    try {
      await adminAgentsService.deleteAgent(selectedAgent.id);
      showToast('Agente excluído com sucesso!', 'success');
      setShowDeleteModal(false);
      setSelectedAgent(null);
      await loadAgents(); // Recarregar lista
    } catch (error) {
      console.error('❌ Erro ao excluir agente:', error);
      showToast('Erro ao excluir agente', 'error');
    }
  };

  // ✅ TOAST NOTIFICATIONS
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    console.log(`${type.toUpperCase()}: ${message}`);
    // TODO: Implementar toast notification visual
  };

  // Funções do painel inline de gerenciamento
  const openManagementPanel = (agent: AdminAgent) => {
    setManagingAgent(agent);
    setTempName(agent.name);
    setTempCallerId(agent.callerId || '');
    setShowManagementPanel(true);
  };

  const openManagementPanelForCallerId = (agent: AdminAgent) => {
    openManagementPanel(agent);
    setEditingName(false);
    setEditingCallerId(true);
  };

  const closeManagementPanel = () => {
    setShowManagementPanel(false);
    setManagingAgent(null);
    setEditingName(false);
    setEditingCallerId(false);
    setTempName('');
    setTempCallerId('');
    setSaving(false);
  };

  const handleSaveName = async () => {
    if (!managingAgent || !tempName.trim()) return;
    
    try {
      setSaving(true);
      await adminAgentsService.updateAgent(managingAgent.id, { name: tempName });
      
      // Atualizar lista local
      setAgents(prev => prev.map(agent => 
        agent.id === managingAgent.id 
          ? { ...agent, name: tempName }
          : agent
      ));
      
      setManagingAgent(prev => prev ? { ...prev, name: tempName } : null);
      setEditingName(false);
      showToast('Nome atualizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('❌ Erro ao salvar nome:', error);
      showToast(error.message || 'Erro ao salvar nome', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCallerId = async () => {
    if (!managingAgent || !tempCallerId.trim()) return;
    
    try {
      setSaving(true);
      await adminAgentsService.updateAgent(managingAgent.id, { callerId: tempCallerId });
      
      // Atualizar lista local
      setAgents(prev => prev.map(agent => 
        agent.id === managingAgent.id 
          ? { ...agent, callerId: tempCallerId }
          : agent
      ));
      
      setManagingAgent(prev => prev ? { ...prev, callerId: tempCallerId } : null);
      setEditingCallerId(false);
      showToast('Caller ID atualizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('❌ Erro ao salvar Caller ID:', error);
      showToast(error.message || 'Erro ao salvar Caller ID', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!managingAgent) return;
    
    try {
      setSaving(true);
      const updatedAgent = await adminAgentsService.toggleAgentStatus(managingAgent.id, !!managingAgent.isActive);
      
      // Atualizar lista local
      setAgents(prev => prev.map(agent => 
        agent.id === managingAgent.id 
          ? { ...agent, isActive: updatedAgent.isActive }
          : agent
      ));
      
      setManagingAgent(prev => prev ? { ...prev, isActive: updatedAgent.isActive } : null);
      
      const statusText = updatedAgent.isActive ? 'ativado' : 'desativado';
      showToast(`Agente ${statusText} com sucesso!`, 'success');
    } catch (error: any) {
      console.error('❌ Erro ao alterar status:', error);
      showToast(error.message || 'Erro ao alterar status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!managingAgent) return;
    
    if (!confirm('Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setSaving(true);
      await adminAgentsService.deleteAgent(managingAgent.id);
      
      // Remover da lista local
      setAgents(prev => prev.filter(agent => agent.id !== managingAgent.id));
      
      showToast('Agente excluído com sucesso!', 'success');
      closeManagementPanel();
    } catch (error: any) {
      console.error('❌ Erro ao excluir agente:', error);
      showToast(error.message || 'Erro ao excluir agente', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copiado!`, 'success');
    } catch (error) {
      showToast(`Erro ao copiar ${label}`, 'error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      setEditingName(false);
      setEditingCallerId(false);
      setTempName(managingAgent?.name || '');
      setTempCallerId(managingAgent?.callerId || '');
    }
  };

  const getStatusColor = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return '#6b7280'; // Inativo
    return isOnline ? '#10b981' : '#ef4444'; // Online verde, Offline vermelho
  };

  const getStatusIcon = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return <PhoneOff style={{ width: '1rem', height: '1rem' }} />;
    return isOnline ? <Phone style={{ width: '1rem', height: '1rem' }} /> : <PhoneOff style={{ width: '1rem', height: '1rem' }} />;
  };

  const getStatusText = (isOnline: boolean, isActive: boolean) => {
    if (!isActive) return 'Inativo';
    return isOnline ? 'Online' : 'Offline';
  };

  const formatLastActivity = (lastSeen?: string) => {
    if (!lastSeen) return 'Nunca';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  const formatCallerId = (callerId: string) => {
    if (callerId.length === 10) {
      return `(${callerId.slice(0, 2)}) ${callerId.slice(2, 6)}-${callerId.slice(6)}`;
    }
    if (callerId.length === 11) {
      return `(${callerId.slice(0, 2)}) ${callerId.slice(2, 7)}-${callerId.slice(7)}`;
    }
    return callerId;
  };



  // ✅ ESTATÍSTICAS USANDO DADOS REAIS
  // Estatísticas calculadas a partir dos dados reais dos agentes carregados
  
  // Estatísticas em tempo real do sistema
  const realOnlineCount = extensionStatus?.onlineCount || 0;
  const realTotalExtensions = extensionStatus?.totalExtensions || 0;

  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh', 
        background: '#f8fafc'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
            Todos os Agentes
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Visualize e gerencie todos os agentes de todos os usuários do sistema
          </p>
        </div>

        {/* Animations */}
        <style jsx>{`
          @keyframes shimmer {
            0% { background-position: -200px 0; }
            100% { background-position: 200px 0; }
          }
        `}</style>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
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
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Users size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {realTotalExtensions || agents.length}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Total de Ramais (Sistema)
            </p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <PhoneCall size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {realOnlineCount}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Ramais Online (Tempo Real)
            </p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #64748b, #475569)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <PhoneOff size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {realTotalExtensions - realOnlineCount}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Ramais Offline (Tempo Real)
            </p>
          </div>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Clock size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {extensionStatus?.lastUpdate ? 
                new Date(extensionStatus.lastUpdate).toLocaleTimeString('pt-BR', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }) : 
                '--:--:--'
              }
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Última Atualização (Tempo Real)
            </p>
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
            <div style={{ position: 'relative', flex: '1', minWidth: '300px' }}>
              <Search style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                width: '1rem', 
                height: '1rem', 
                color: '#64748b' 
              }} />
              <input
                type="text"
                placeholder="Buscar por agente, ramal, CallerId, usuário ou empresa..."
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
                <option value="online">Online</option>
                <option value="busy">Ocupado</option>
                <option value="away">Ausente</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <button
              onClick={() => loadAgents()}
              disabled={loading}
              style={{
                padding: '0.75rem 1rem',
                background: loading ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Agents Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Agente</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Usuário/Empresa</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Ramal</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>CallerID</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Senha</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td colSpan={7} style={{ padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 2fr 2fr 1fr 1fr', gap: '1rem' }}>
                          {[...Array(7)].map((__, j) => (
                            <div
                              key={`sk-${i}-${j}`}
                              style={{
                                height: '20px',
                                borderRadius: '8px',
                                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)',
                                backgroundSize: '400% 100%',
                                animation: 'shimmer 1.4s ease-in-out infinite'
                              }}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                      {error}
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      Nenhum agente encontrado
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const isOnline = agent.isOnline || false;
                    const isActive = agent.isActive;
                    return (
                      <tr key={agent.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
                                {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>{agent.name}</div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
                            <div>
                              <div style={{ fontWeight: '500', color: '#1e293b' }}>{agent.userName || 'N/A'}</div>
                              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{agent.userCompany || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '0.375rem',
                              border: '1px solid #e2e8f0',
                              fontFamily: 'monospace',
                              fontWeight: '500',
                              color: '#1e293b'
                            }}>
                              {agent.extension}
                            </div>
                            <button
                              onClick={() => copyToClipboard(agent.extension, 'Ramal')}
                              style={{
                                padding: '0.25rem',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                color: '#64748b'
                              }}
                              title="Copiar ramal"
                            >
                              <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {agent.callerId ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                padding: '0.5rem 0.75rem',
                                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}>
                                <Phone style={{ width: '0.875rem', height: '0.875rem' }} />
                                {formatCallerId(agent.callerId)}
                              </div>
                              <button
                                onClick={() => copyToClipboard(agent.callerId!, 'CallerID')}
                                style={{
                                  padding: '0.25rem',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                                title="Copiar CallerID"
                              >
                                <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
                              </button>
                              <button
                                onClick={() => openManagementPanelForCallerId(agent)}
                                style={{
                                  padding: '0.25rem',
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  color: '#64748b'
                                }}
                                title="Editar CallerID"
                              >
                                <Edit style={{ width: '0.875rem', height: '0.875rem' }} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>N/A</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => copyToClipboard(agent.sipPassword || 'N/A', 'Senha SIP')}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                fontFamily: 'monospace',
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title="Clique para copiar senha SIP"
                            >
                              {showPassword[agent.id] ? (agent.sipPassword || 'N/A') : '••••••••'}
                            </button>
                            <button
                              onClick={() => setShowPassword((prev: Record<string, boolean>) => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                              style={{
                                padding: '0.25rem',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#6b7280'
                              }}
                              title={showPassword[agent.id] ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                              {showPassword[agent.id] ? <EyeOff style={{ width: '1rem', height: '1rem' }} /> : <Eye style={{ width: '1rem', height: '1rem' }} />}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {typeof agent.isOnline === 'undefined' && !extensionStatus ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                width: '80px', height: '22px', borderRadius: '9999px',
                                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                                backgroundSize: '200px 100%', animation: 'shimmer 1.6s infinite'
                              }} />
                            </div>
                          ) : (
                            <AgentStatusPill isOnline={isOnline} isActive={isActive} size="sm" showDot />
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => openManagementPanel(agent)}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#f0f9ff',
                                border: '1px solid #0ea5e9',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                color: '#0ea5e9'
                              }}
                              title="Gerenciar agente"
                            >
                              <Settings style={{ width: '1rem', height: '1rem' }} />
                            </button>
                            <button
                              onClick={() => handleToggleStatusOld(agent)}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: isActive ? '#fef3c7' : '#dcfce7',
                                border: `1px solid ${isActive ? '#f59e0b' : '#10b981'}`,
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                color: isActive ? '#f59e0b' : '#10b981'
                              }}
                              title={isActive ? 'Desativar agente' : 'Ativar agente'}
                            >
                              {isActive ? <PowerOff style={{ width: '1rem', height: '1rem' }} /> : <Power style={{ width: '1rem', height: '1rem' }} />}
                            </button>
                            <button
                              onClick={() => handleDeleteAgentOld(agent)}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #ef4444',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                color: '#ef4444'
                              }}
                              title="Excluir agente"
                            >
                              <Trash2 style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredAgents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Nenhum agente encontrado</p>
            </div>
          )}
        </div>

        {/* ✅ MODAL DE EDIÇÃO DE AGENTE */}
        {showEditModal && selectedAgent && (
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
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e293b' }}>
                Editar Agente
              </h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Nome do Agente
                </label>
                <input
                  type="text"
                  defaultValue={selectedAgent.name}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  CallerID
                </label>
                <input
                  type="text"
                  defaultValue={selectedAgent.callerId || ''}
                  placeholder="Ex: 11999999999"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedAgent(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    // Implementar lógica de atualização
                    showToast('Funcionalidade em desenvolvimento', 'success');
                    setShowEditModal(false);
                    setSelectedAgent(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}



        {/* ✅ MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
        {showDeleteModal && selectedAgent && (
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
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '4rem',
                  height: '4rem',
                  backgroundColor: '#fef2f2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}>
                  <Trash2 style={{ width: '2rem', height: '2rem', color: '#ef4444' }} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
                  Confirmar Exclusão
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  Tem certeza que deseja excluir o agente <strong>{selectedAgent.name}</strong> (Ramal {selectedAgent.extension})?
                  Esta ação não pode ser desfeita.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAgent(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
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
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ PAINEL INLINE DE GERENCIAMENTO DE AGENTE - MELHORADO E RESPONSIVO */}
        {showManagementPanel && managingAgent && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '0.5rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '95vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(226, 232, 240, 0.8)'
            }}>
              {/* Header Compacto e Responsivo */}
              <div style={{
                padding: '1.5rem',
                borderBottom: '1px solid #e5e7eb',
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                borderRadius: '16px 16px 0 0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '250px' }}>
                    <div style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {managingAgent.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        margin: '0 0 0.5rem 0',
                        wordBreak: 'break-word'
                      }}>
                        Ramal {managingAgent.extension}
                      </h2>
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.75rem', 
                        alignItems: 'center',
                        flexWrap: 'wrap'
                      }}>
                        <span style={{
                          background: managingAgent.isActive ? '#dcfce7' : '#fee2e2',
                          color: managingAgent.isActive ? '#166534' : '#dc2626',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {managingAgent.isActive ? 'ATIVO' : 'INATIVO'}
                        </span>
                        <span style={{ 
                          color: '#6b7280', 
                          fontSize: '12px',
                          wordBreak: 'break-word'
                        }}>
                          {managingAgent.userName}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={closeManagementPanel}
                    style={{
                      padding: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: '#ef4444',
                      flexShrink: 0,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                  >
                    <X style={{ width: '1.25rem', height: '1.25rem' }} />
                  </button>
                </div>
              </div>

              {/* Content Reorganizado */}
              <div style={{ padding: '1.5rem' }}>
                {/* Layout Responsivo - Stack em mobile, Grid em desktop */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {/* Informações Básicas - Melhorado */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9))',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: '#1f2937',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <User style={{ width: '1.125rem', height: '1.125rem', color: '#3b82f6' }} />
                      Informações Básicas
                    </h3>

                    {/* Nome - Compacto */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Nome do Agente
                      </label>
                      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
                        {editingName ? (
                          <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyPress={(e) => handleKeyPress(e, handleSaveName)}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              border: '2px solid #3b82f6',
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white',
                              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                            }}
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingName(true)}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              background: 'white',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#d1d5db';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            {managingAgent.name}
                          </div>
                        )}
                        {editingName ? (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              onClick={handleSaveName}
                              disabled={saving}
                              style={{
                                padding: '0.75rem',
                                background: saving ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #059669)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                minWidth: '2.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {saving ? (
                                <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Save style={{ width: '1rem', height: '1rem' }} />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingName(false);
                                setTempName(managingAgent.name);
                              }}
                              style={{
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                minWidth: '2.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <X style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingName(true)}
                            style={{
                              padding: '0.75rem',
                              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '8px',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              minWidth: '2.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1))';
                            }}
                          >
                            <Edit style={{ width: '1rem', height: '1rem' }} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Caller ID */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>
                        Caller ID
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {editingCallerId ? (
                          <input
                            type="text"
                            value={tempCallerId}
                            onChange={(e) => setTempCallerId(e.target.value)}
                            onKeyPress={(e) => handleKeyPress(e, handleSaveCallerId)}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              border: '2px solid #3b82f6',
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                              outline: 'none'
                            }}
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCallerId(true)}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              background: 'white'
                            }}
                          >
                            {managingAgent.callerId || managingAgent.extension}
                          </div>
                        )}
                        {editingCallerId ? (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              onClick={handleSaveCallerId}
                              disabled={saving}
                              style={{
                                padding: '0.5rem',
                                background: saving ? '#9ca3af' : '#10b981',
                                border: 'none',
                                borderRadius: '0.375rem',
                                color: 'white',
                                cursor: saving ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {saving ? (
                                <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Save style={{ width: '1rem', height: '1rem' }} />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingCallerId(false);
                                setTempCallerId(managingAgent.callerId || managingAgent.extension);
                              }}
                              style={{
                                padding: '0.5rem',
                                background: '#ef4444',
                                border: 'none',
                                borderRadius: '0.375rem',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              <X style={{ width: '1rem', height: '1rem' }} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCallerId(true)}
                            style={{
                              padding: '0.5rem',
                              background: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '0.375rem',
                              color: '#3b82f6',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit style={{ width: '1rem', height: '1rem' }} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ramal */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>
                        Ramal
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          background: '#f9fafb',
                          color: '#6b7280'
                        }}>
                          {managingAgent.extension}
                        </div>
                        <button
                          onClick={() => copyToClipboard(managingAgent.extension, 'Ramal')}
                          style={{
                            padding: '0.5rem',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '0.375rem',
                            color: '#10b981',
                            cursor: 'pointer'
                          }}
                        >
                          <Copy style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas - Melhorado */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9))',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: '700',
                      color: '#1f2937',
                      marginBottom: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <Settings style={{ width: '1.125rem', height: '1.125rem', color: '#8b5cf6' }} />
                      Ações Rápidas
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        onClick={handleToggleStatus}
                        disabled={saving}
                        style={{
                          padding: '0.875rem 1rem',
                          background: managingAgent.isActive 
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          opacity: saving ? 0.7 : 1,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!saving) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!saving) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                          }
                        }}
                      >
                        {saving ? (
                          <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                        ) : managingAgent.isActive ? (
                          <PowerOff style={{ width: '1rem', height: '1rem' }} />
                        ) : (
                          <Power style={{ width: '1rem', height: '1rem' }} />
                        )}
                        {managingAgent.isActive ? 'Desativar' : 'Ativar'}
                      </button>

                      <button
                        onClick={() => copyToClipboard(managingAgent.extension, 'Ramal')}
                        style={{
                          padding: '0.875rem 1rem',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        <Copy style={{ width: '1rem', height: '1rem' }} />
                        Copiar Ramal
                      </button>

                      <button
                        onClick={handleDeleteAgent}
                        disabled={saving}
                        style={{
                          padding: '0.875rem 1rem',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          opacity: saving ? 0.7 : 1,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!saving) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!saving) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                          }
                        }}
                      >
                        {saving ? (
                          <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Trash2 style={{ width: '1rem', height: '1rem' }} />
                        )}
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>

                {/* Informações do Sistema */}
                <div style={{
                  marginTop: '2rem',
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  borderRadius: '12px',
                  padding: '1.5rem'
                }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Building style={{ width: '1.25rem', height: '1.25rem', color: '#10b981' }} />
                    Informações do Sistema
                  </h3>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                  }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '0.25rem'
                      }}>
                        ID do Agente
                      </label>
                      <div style={{
                        padding: '0.5rem',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        {managingAgent.id}
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '0.25rem'
                      }}>
                        Usuário
                      </label>
                      <div style={{
                        padding: '0.5rem',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        {managingAgent.userName}
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '0.25rem'
                      }}>
                        Empresa
                      </label>
                      <div style={{
                        padding: '0.5rem',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        {managingAgent.userCompany}
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '0.25rem'
                      }}>
                        Criado em
                      </label>
                      <div style={{
                        padding: '0.5rem',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        {new Date(managingAgent.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
