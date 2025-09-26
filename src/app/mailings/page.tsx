'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Mail, Send, Clock, TrendingUp, Search, Filter, Plus, MoreHorizontal, Eye, Trash2, Settings, Users } from 'lucide-react';
import DistributionModal from '@/components/DistributionModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';

interface Agent {
  id: string;
  agente_name: string;
  ramal: string;
}

interface Mailing {
  id: string;
  name: string;
  total: number;
  status: 'active' | 'disabled' | 'working';
  created_at: string;
  updated_at: string;
  agent_id: string | null;
  vinculo_all: string | null;
  agentes_pabx: {
    id: string;
    agente_name: string;
    ramal: string;
  } | null;
  multiple_agents?: {
    id: string;
    agente_name: string;
    ramal: string;
  }[];
}

interface MailingsResponse {
  success: boolean;
  data: Mailing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Cache configuration
const CACHE_KEYS = {
  MAILINGS: 'pabx_mailings_cache',
  AGENTS: 'pabx_agents_cache',
  MAILINGS_TIMESTAMP: 'pabx_mailings_timestamp',
  AGENTS_TIMESTAMP: 'pabx_agents_timestamp'
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Cache utility functions
const cacheUtils = {
  set: (key: string, data: any) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
      localStorage.setItem(`${key}_timestamp`, Date.now().toString());
    } catch (error) {
      console.warn('Cache write failed:', error);
    }
  },
  
  get: (key: string) => {
    try {
      const cached = localStorage.getItem(key);
      const timestamp = localStorage.getItem(`${key}_timestamp`);
      
      if (!cached || !timestamp) return null;
      
      const cacheAge = Date.now() - parseInt(timestamp);
      if (cacheAge > CACHE_DURATION) {
        // Cache expirado, limpar
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}_timestamp`);
        return null;
      }
      
      const cacheData = JSON.parse(cached);
      return cacheData.data || cacheData; // Compatibilidade com formato antigo
    } catch (error) {
      console.warn('Cache read failed:', error);
      return null;
    }
  },
  
  invalidate: (key: string) => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_timestamp`);
  },
  
  clear: () => {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_timestamp`);
    });
  }
};

function MailingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mailings, setMailings] = useState<Mailing[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMailing, setSelectedMailing] = useState<Mailing | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mailingToDelete, setMailingToDelete] = useState<Mailing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [mailingToChangeStatus, setMailingToChangeStatus] = useState<Mailing | null>(null);
  const [newStatus, setNewStatus] = useState<'active' | 'disabled' | 'working'>('active');
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [showChangeAgentModal, setShowChangeAgentModal] = useState(false);
  const [mailingToChangeAgent, setMailingToChangeAgent] = useState<Mailing | null>(null);
  const [newAgentId, setNewAgentId] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgentDetails, setLoadingAgentDetails] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isChangingAgent, setIsChangingAgent] = useState(false);
  
  // Estados para modal de distribuição
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributionMode, setDistributionMode] = useState<'single' | 'multiple'>('multiple');
  const [agentDistribution, setAgentDistribution] = useState<'automatic' | 'manual'>('automatic');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedAgents, setSelectedAgents] = useState<{[key: string]: {selected: boolean; quantity?: number}}>({});

  // Memoized filtered mailings para performance
  const filteredMailings = useMemo(() => {
    return mailings.filter(mailing => {
      const matchesSearch = mailing.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || mailing.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [mailings, searchTerm, statusFilter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchMailings = useCallback(async (forceRefresh = false) => {
    try {
      // Verificar cache primeiro (se não for refresh forçado)
      if (!forceRefresh) {
        const cachedMailings = cacheUtils.get(CACHE_KEYS.MAILINGS);
        if (cachedMailings && Array.isArray(cachedMailings)) {
          setMailings(cachedMailings);
          setIsLoading(false);
          console.log('📦 Mailings carregados do cache:', cachedMailings.length);
          return;
        }
      }
      
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('http://localhost:3001/api/mailings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const result: MailingsResponse = await response.json();
      
      if (result.success) {
        setMailings(result.data);
        // Salvar no cache
        cacheUtils.set(CACHE_KEYS.MAILINGS, result.data);
        console.log('✅ Mailings carregados da API e salvos no cache:', result.data.length);
      } else {
        throw new Error('Falha ao carregar campanhas');
      }
    } catch (err) {
      console.error('❌ Erro ao carregar mailings:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setMailings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleViewDetails = async (mailing: Mailing) => {
    setSelectedMailing(mailing);
    
    // Se a campanha tem múltiplos agentes, buscar os dados completos
    if (mailing.vinculo_all && !mailing.multiple_agents) {
      const agentIds = mailing.vinculo_all.split(',').filter(id => id.trim());
      if (agentIds.length > 0) {
        const agentsData = await fetchMultipleAgentsData(agentIds);
        setSelectedMailing({
          ...mailing,
          multiple_agents: agentsData
        });
      }
    }
    
    setShowViewModal(true);
  };

  const handleDeleteMailing = (mailing: Mailing) => {
    setMailingToDelete(mailing);
    setShowDeleteModal(true);
  };

  const handleChangeStatus = (mailing: Mailing) => {
    setMailingToChangeStatus(mailing);
    setNewStatus(mailing.status);
    setShowStatusModal(true);
  };

  const handleChangeAgent = async (mailing: Mailing) => {
    setMailingToChangeAgent(mailing);
    setNewAgentId(mailing.agent_id || '');
    
    // Carregar agentes se ainda não foram carregados
    if (agents.length === 0) {
      await fetchAgents();
    }
    
    // Se for múltiplos agentes, usar modal de distribuição
    if (mailing.vinculo_all) {
      // Pré-selecionar agentes atuais da campanha
      const currentAgentIds = mailing.vinculo_all.split(',').filter(id => id.trim());
      const preSelectedAgents: {[key: string]: {selected: boolean; quantity?: number}} = {};
      
      // Marcar agentes atuais como selecionados
      currentAgentIds.forEach(agentId => {
        preSelectedAgents[agentId] = { selected: true };
      });
      
      setSelectedAgents(preSelectedAgents);
      setDistributionMode('multiple');
      setAgentDistribution('automatic');
      setShowDistributionModal(true);
    } else {
      // Usar modal simples para agente único
      setShowChangeAgentModal(true);
    }
  };

  // Função para buscar dados dos agentes múltiplos
  const fetchMultipleAgentsData = useCallback(async (agentIds: string[]) => {
    try {
      setLoadingAgentDetails(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:3001/api/agents?ids=${agentIds.join(',')}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dados dos agentes');
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Erro ao buscar agentes múltiplos:', error);
      return [];
    } finally {
      setLoadingAgentDetails(false);
    }
  }, []);

  const fetchAgents = useCallback(async (forceRefresh = false) => {
    try {
      // Verificar cache primeiro
      if (!forceRefresh) {
        const cachedAgents = cacheUtils.get(CACHE_KEYS.AGENTS);
        if (cachedAgents && Array.isArray(cachedAgents)) {
          setAgents(cachedAgents);
          setIsLoadingAgents(false);
          console.log('📦 Agentes carregados do cache:', cachedAgents.length);
          return;
        }
      }
      
      setIsLoadingAgents(true);
      const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('http://localhost:3001/api/agents', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAgents(result.data);
        // Salvar no cache
        cacheUtils.set(CACHE_KEYS.AGENTS, result.data);
        console.log('✅ Agentes carregados da API e salvos no cache:', result.data.length);
      } else {
        throw new Error('Falha ao carregar agentes');
      }
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      setAgents([]);
    } finally {
      setIsLoadingAgents(false);
    }
  }, []);

  const confirmDelete = async () => {
    if (!mailingToDelete) return;
    
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
      
      const response = await fetch(`http://localhost:3001/api/mailings/${mailingToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // Atualizar lista local
      setMailings(prev => prev.filter(m => m.id !== mailingToDelete.id));
      setShowDeleteModal(false);
      setMailingToDelete(null);
      
    } catch (err) {
      console.error('❌ Erro ao deletar campanha:', err);
      alert('Erro ao deletar campanha: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!mailingToChangeStatus) return;
    
    try {
      setIsChangingStatus(true);
      const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
      
      const response = await fetch(`http://localhost:3001/api/mailings/${mailingToChangeStatus.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // Atualizar lista local
      setMailings(prev => prev.map(m => 
        m.id === mailingToChangeStatus.id 
          ? { ...m, status: newStatus }
          : m
      ));
      
      setShowStatusModal(false);
      setMailingToChangeStatus(null);
      
    } catch (err) {
      console.error('❌ Erro ao alterar status:', err);
      alert('Erro ao alterar status: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setIsChangingStatus(false);
    }
  };

  const confirmAgentChange = async () => {
    if (!mailingToChangeAgent || !newAgentId) return;
    
    try {
      setIsChangingAgent(true);
      const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
      
      const response = await fetch(`http://localhost:3001/api/mailings/${mailingToChangeAgent.id}/agent`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_id: newAgentId })
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // Buscar dados do novo agente
      const selectedAgent = agents.find(a => a.id === newAgentId);
            // Invalidar cache e recarregar a lista após exclusão
        cacheUtils.invalidate(CACHE_KEYS.MAILINGS);
        await fetchMailings(true);
      // Atualizar lista local
      setMailings(prev => prev.map(m => 
        m.id === mailingToChangeAgent.id 
          ? { 
              ...m, 
              agent_id: newAgentId,
              agentes_pabx: {
                id: selectedAgent?.id || '',
                agente_name: selectedAgent?.agente_name || '',
                ramal: selectedAgent?.ramal || ''
              }
            }
          : m
      ));
      
      setShowChangeAgentModal(false);
      setMailingToChangeAgent(null);
      
    } catch (err) {
      console.error('❌ Erro ao alterar agente:', err);
      alert('Erro ao alterar agente: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setIsChangingAgent(false);
    }
  };

  // Invalidar cache quando necessário
  const invalidateCache = useCallback(() => {
    cacheUtils.invalidate(CACHE_KEYS.MAILINGS);
    cacheUtils.invalidate(CACHE_KEYS.AGENTS);
    console.log('🗑️ Cache invalidado');
  }, []);

  // Função para refresh manual
  const handleRefresh = useCallback(() => {
    fetchMailings(true); // Force refresh
  }, [fetchMailings]);

  useEffect(() => {
    const shouldRefresh = searchParams?.get('refresh') === '1';
    if (shouldRefresh) {
      cacheUtils.invalidate(CACHE_KEYS.MAILINGS);
      fetchMailings(true);
    } else {
      fetchMailings();
    }
  }, [fetchMailings, searchParams]);

  return (
    <MainLayout>
      <div style={{
        padding: '2rem',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0,
              marginBottom: '0.5rem'
            }}>
              Mailings
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '1rem',
              margin: 0
            }}>
              Gerencie suas campanhas de email marketing
            </p>
          </div>
          
          <button
          onClick={() => {
            if (mailings.length >= 3) {
              alert('Limite máximo de 3 campanhas atingido. Exclua uma campanha existente para criar uma nova.');
              return;
            }
            router.push('/mailings/new');
          }}
          disabled={mailings.length >= 3}
          style={{
            background: mailings.length >= 3 
              ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: mailings.length >= 3 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: mailings.length >= 3 
              ? 'none' 
              : '0 4px 12px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.2s',
            opacity: mailings.length >= 3 ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (mailings.length < 3) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (mailings.length < 3) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
            }
          }}
        >
            <Plus size={16} />
            {mailings.length >= 3 ? 'Limite Atingido (3/3)' : 'Nova Campanha'}
          </button>
        </div>

        {/* Aviso de Limite Atingido */}
        {mailings.length >= 3 && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            border: '1px solid #f59e0b',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>!</span>
            </div>
            <div>
              <p style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '600',
                color: '#92400e'
              }}>
                Limite de campanhas atingido ({mailings.length}/3)
              </p>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: '#a16207'
              }}>
                Exclua uma campanha existente para criar uma nova.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* Campanhas Ativas */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Send size={20} color="white" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0
                }}>
                  {mailings.filter(m => m.status === 'active').length}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: 0
                }}>
                  Campanhas Ativas
                </p>
              </div>
            </div>
          </div>

          {/* Total */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={20} color="white" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0
                }}>
                  {mailings.reduce((acc, m) => acc + m.total, 0).toLocaleString('pt-BR')}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: 0
                }}>
                  Total
                </p>
              </div>
            </div>
          </div>

          {/* Total de Campanhas */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Mail size={20} color="white" />
              </div>
              <div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: 0
                }}>
                  {mailings.length}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: 0
                }}>
                  Total de Campanhas
                </p>
              </div>
            </div>
          </div>
        </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', gridColumn: 'span 2' }}>
            <Search size={18} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b'
            }} />
            <input
              type="text"
              placeholder="Buscar campanhas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '12px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '14px',
              outline: 'none',
              background: 'white',
              cursor: 'pointer',
              width: '100%',
              maxWidth: '200px',
              boxSizing: 'border-box'
            }}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativas</option>
            <option value="working">Em Execução</option>
            <option value="disabled">Desabilitadas</option>
          </select>
        </div>
        
        <style jsx>{`
          @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="gridColumn"] {
            grid-column: span 1 !important;
          }
        }  }
        `}</style>
      </div>

      {/* Mailings List */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#1e293b',
            margin: 0
          }}>
            Campanhas de Mailing
          </h2>
        </div>

        {error && (
          <div style={{
            padding: '1rem 1.5rem',
            background: '#fef2f2',
            borderBottom: '1px solid #e2e8f0',
            color: '#dc2626',
            fontSize: '14px'
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{
                  padding: '1rem 1.5rem',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Campanha
                </th>
                <th style={{
                  padding: '1rem 1.5rem',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Agente
                </th>
                <th style={{
                  padding: '1rem 1.5rem',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Total de Contatos
                </th>
                <th style={{
                  padding: '1rem 1.5rem',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Status
                </th>
                <th style={{
                  padding: '1rem 1.5rem',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Data
                </th>
                <th style={{
                  padding: '1rem 1.5rem',
                  textAlign: 'center',
                  fontSize: '12px',
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
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#64748b'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid #e2e8f0',
                        borderTop: '2px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Carregando campanhas...
                    </div>
                  </td>
                </tr>
              ) : filteredMailings.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#64748b'
                  }}>
                    {error ? 'Erro ao carregar campanhas' : 'Nenhuma campanha encontrada'}
                  </td>
                </tr>
              ) : (
                filteredMailings.map((mailing) => (
                  <tr key={mailing.id} style={{
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.2s'
                  }}>
                    <td style={{ padding: '1.5rem' }}>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '4px'
                        }}>
                          {mailing.name}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#64748b'
                      }}>
                        {mailing.agentes_pabx 
                          ? `${mailing.agentes_pabx.agente_name} (${mailing.agentes_pabx.ramal})`
                          : mailing.vinculo_all 
                            ? `Múltiplos Agentes (${mailing.vinculo_all.split(',').length} ramais)`
                            : 'N/A'
                        }
                      </div>
                    </td>
                    <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {mailing.total ? mailing.total.toLocaleString('pt-BR') : '0'}
                      </div>
                    </td>
                    <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        backgroundColor: 
                          (mailing.status as string) === 'ativo' ? '#dcfce7' :
                          (mailing.status as string) === 'working' ? '#fef3c7' :
                          (mailing.status as string) === 'disabled' ? '#f1f5f9' : '#fee2e2',
                        color: 
                          (mailing.status as string) === 'ativo' ? '#166534' :
                          (mailing.status as string) === 'working' ? '#92400e' :
                          (mailing.status as string) === 'disabled' ? '#475569' : '#dc2626'
                      }}>
                        {(mailing.status as string) === 'ativo' ? 'Ativa' :
                         (mailing.status as string) === 'working' ? 'Em Execução' :
                         (mailing.status as string) === 'disabled' ? 'Desabilitada' : 
                         (mailing.status as string) || 'Erro'}
                      </span>
                    </td>
                    <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <div style={{
                        fontSize: '14px',
                        color: '#64748b'
                      }}>
                        {formatDate(mailing.created_at)}
                      </div>
                    </td>
                    <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleViewDetails(mailing)}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f1f5f9',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#e2e8f0';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title="Visualizar detalhes da campanha"
                        >
                          <Eye size={16} />
                        </button>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const dropdown = document.getElementById(`dropdown-${mailing.id}`);
                              if (dropdown) {
                                if (dropdown.style.display === 'block') {
                                  dropdown.style.display = 'none';
                                } else {
                                  dropdown.style.display = 'block';
                                  dropdown.style.left = `${rect.left - 80}px`;
                                  dropdown.style.top = `${rect.bottom + 4}px`;
                                }
                              }
                            }}
                            style={{
                              padding: '8px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#f0f9ff',
                              color: '#0369a1',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#e0f2fe';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#f0f9ff';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                            title="Mais opções para esta campanha"
                          >
                            <Settings size={16} />
                          </button>
                          
                          <div
                            id={`dropdown-${mailing.id}`}
                            style={{
                              display: 'none',
                              position: 'fixed',
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              zIndex: 9999,
                              minWidth: '160px'
                            }}
                          >
                            <button
                              onClick={() => {
                                handleChangeStatus(mailing);
                                document.getElementById(`dropdown-${mailing.id}`)!.style.display = 'none';
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#374151',
                                borderBottom: '1px solid #f3f4f6'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              Alterar Status
                            </button>
                            <button
                              onClick={() => {
                                handleChangeAgent(mailing);
                                document.getElementById(`dropdown-${mailing.id}`)!.style.display = 'none';
                              }}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#374151'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              Alterar Agente
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteMailing(mailing)}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#fecaca';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#fef2f2';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          title="Excluir esta campanha permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Overlay para fechar dropdowns */}
      <div 
        onClick={() => {
          // Fechar todos os dropdowns abertos
          const dropdowns = document.querySelectorAll('[id^="dropdown-"]');
          dropdowns.forEach(dropdown => {
            (dropdown as HTMLElement).style.display = 'none';
          });
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          display: document.querySelector('[id^="dropdown-"][style*="block"]') ? 'block' : 'none'
        }}
      />

      {/* Modal de Visualização */}
      {showViewModal && selectedMailing && (
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
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                Detalhes da Campanha
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Nome da Campanha
                </label>
                <p style={{
                  fontSize: '16px',
                  color: '#1e293b',
                  margin: 0,
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  {selectedMailing.name}
                </p>
              </div>
              
              <div>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Agente Responsável
                </label>
                {selectedMailing.agentes_pabx ? (
                  <p style={{
                    fontSize: '16px',
                    color: '#1e293b',
                    margin: 0,
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    {selectedMailing.agentes_pabx.agente_name} ({selectedMailing.agentes_pabx.ramal})
                  </p>
                ) : selectedMailing.multiple_agents ? (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Users size={16} />
                      Múltiplos Agentes ({selectedMailing.multiple_agents.length} ramais)
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {selectedMailing.multiple_agents.map((agent) => (
                        <div key={agent.id} style={{
                          background: 'white',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '13px',
                          color: '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#10b981',
                            flexShrink: 0
                          }}></div>
                          <div style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            <div style={{ fontWeight: '500' }}>{agent.agente_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Ramal {agent.ramal}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedMailing.vinculo_all ? (
                  <p style={{
                    fontSize: '16px',
                    color: '#1e293b',
                    margin: 0,
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    {loadingAgentDetails 
                      ? 'Carregando dados dos agentes...'
                      : `Múltiplos Agentes (${selectedMailing.vinculo_all.split(',').length} ramais)`
                    }
                  </p>
                ) : (
                  <p style={{
                    fontSize: '16px',
                    color: '#1e293b',
                    margin: 0,
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    N/A
                  </p>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Total de Contatos
                  </label>
                  <p style={{
                    fontSize: '16px',
                    color: '#1e293b',
                    margin: 0,
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    {selectedMailing.total.toLocaleString('pt-BR')}
                  </p>
                </div>
                
                <div>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Status
                  </label>
                  <div style={{
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: selectedMailing.status === 'active' ? '#10b981' :
                                  selectedMailing.status === 'working' ? '#f59e0b' :
                                  selectedMailing.status === 'disabled' ? '#ef4444' : '#6b7280'
                    }}></div>
                    <span style={{
                      fontSize: '16px',
                      color: '#1e293b',
                      fontWeight: '500'
                    }}>
                      {selectedMailing.status === 'active' ? 'Ativa' :
                       selectedMailing.status === 'working' ? 'Em Execução' :
                       selectedMailing.status === 'disabled' ? 'Desabilitada' : 
                       selectedMailing.status || 'Status Indefinido'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <label style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Data de Criação
                </label>
                <p style={{
                  fontSize: '16px',
                  color: '#1e293b',
                  margin: 0,
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  {formatDate(selectedMailing.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && mailingToDelete && (
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
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Trash2 size={32} color="#dc2626" />
              </div>
              
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: '0 0 0.5rem'
              }}>
                Excluir Campanha
              </h3>
              
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Tem certeza que deseja excluir a campanha <strong>"{mailingToDelete.name}"</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1
                }}
              >
                {isDeleting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '8px'
                    }}></div>
                    Excluindo...
                  </>
                ) : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alteração de Status */}
      {showStatusModal && mailingToChangeStatus && (
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
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f0f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Settings size={32} color="#0369a1" />
              </div>
              
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: '0 0 0.5rem'
              }}>
                Alterar Status da Campanha
              </h3>
              
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Altere o status da campanha <strong>"{mailingToChangeStatus.name}"</strong>
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                display: 'block',
                marginBottom: '0.5rem'
              }}>
                Novo Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'active' | 'disabled' | 'working')}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="active">Ativa</option>
                <option value="working">Em Execução</option>
                <option value="disabled">Desabilitada</option>
              </select>
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowStatusModal(false)}
                disabled={isChangingStatus}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isChangingStatus ? 'not-allowed' : 'pointer',
                  opacity: isChangingStatus ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              
              <button
                onClick={confirmStatusChange}
                disabled={isChangingStatus}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0369a1',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isChangingStatus ? 'not-allowed' : 'pointer',
                  opacity: isChangingStatus ? 0.5 : 1
                }}
              >
                {isChangingStatus ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '8px'
                    }}></div>
                    Alterando...
                  </>
                ) : 'Alterar Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alteração de Agente */}
      {showChangeAgentModal && mailingToChangeAgent && (
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
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f0fdf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Users size={32} color="#16a34a" />
              </div>
              
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: '0 0 0.5rem'
              }}>
                Alterar Agente Responsável
              </h3>
              
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Altere o agente responsável pela campanha <strong>"{mailingToChangeAgent.name}"</strong>
              </p>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                display: 'block',
                marginBottom: '0.5rem'
              }}>
                Novo Agente
              </label>
              {isLoadingAgents ? (
                <div style={{
                  padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#64748b'
                }}>
                  Carregando agentes...
                </div>
              ) : (
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Selecione um agente</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.agente_name || 'Nome não disponível'} ({agent.ramal || 'N/A'})
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowChangeAgentModal(false)}
                disabled={isChangingAgent}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isChangingAgent ? 'not-allowed' : 'pointer',
                  opacity: isChangingAgent ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              
              <button
                onClick={confirmAgentChange}
                disabled={isChangingAgent || !newAgentId}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: newAgentId ? '#16a34a' : '#9ca3af',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (isChangingAgent || !newAgentId) ? 'not-allowed' : 'pointer',
                  opacity: (isChangingAgent || !newAgentId) ? 0.5 : 1
                }}
              >
                {isChangingAgent ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginRight: '8px'
                    }}></div>
                    Alterando...
                  </>
                ) : 'Alterar Agente'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Distribuição para Múltiplos Agentes */}
      {showDistributionModal && mailingToChangeAgent && (
        <DistributionModal
          isOpen={showDistributionModal}
          onClose={() => {
            setShowDistributionModal(false);
            setMailingToChangeAgent(null);
          }}
          onConfirm={async () => {
            try {
              setIsChangingAgent(true);
              const token = localStorage.getItem('token') || localStorage.getItem('agent_token');
              
              // Obter agentes selecionados
              const selectedAgentIds = Object.entries(selectedAgents)
                .filter(([_, data]) => data.selected)
                .map(([agentId]) => agentId);
              
              if (selectedAgentIds.length === 0) {
                alert('Selecione pelo menos um agente');
                return;
              }
              
              // Preparar dados para envio com lógica de redistribuição
              const updateData = {
                agent_ids: selectedAgentIds,
                redistribution_strategy: 'from_end', // Pegar contatos do final para evitar conflitos
                total_contacts: mailingToChangeAgent.total
              };
              
              const response = await fetch(`http://localhost:3001/api/mailings/${mailingToChangeAgent.id}/agents`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
              });
              
              if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
              }
              
              // Invalidar cache e recarregar lista
              cacheUtils.invalidate(CACHE_KEYS.MAILINGS);
              await fetchMailings(true);
              
              setShowDistributionModal(false);
              setMailingToChangeAgent(null);
              
            } catch (err) {
              console.error('❌ Erro ao alterar agentes:', err);
              alert('Erro ao alterar agentes: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
            } finally {
              setIsChangingAgent(false);
            }
          }}
          agents={agents}
          totalContacts={mailingToChangeAgent.total}
          distributionMode={distributionMode}
          setDistributionMode={setDistributionMode}
          agentDistribution={agentDistribution}
          setAgentDistribution={setAgentDistribution}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          selectedAgents={selectedAgents}
          setSelectedAgents={setSelectedAgents}
          isEditMode={true}
          currentAgentIds={mailingToChangeAgent.vinculo_all?.split(',').filter(id => id.trim()) || []}
        />
      )}
    </MainLayout>
  );
}

export default function MailingsPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <MailingsPageInner />
    </Suspense>
  );
}
