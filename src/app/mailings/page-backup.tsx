'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, Clock, TrendingUp, Search, Filter, Plus, MoreHorizontal, Eye, Trash2, Settings, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';

interface Mailing {
  id: string;
  name: string;
  total: number;
  status: 'active' | 'disabled' | 'working';
  created_at: string;
  updated_at: string;
  agent_id: string;
  agentes_pabx: {
    id: string;
    agente_name: string;
    ramal: string;
  };
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

export default function MailingsPage() {
  const router = useRouter();
  const toast = useToast();
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
  const [newAgentId, setNewAgentId] = useState<string>('');
  const [isChangingAgent, setIsChangingAgent] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const filteredMailings = mailings.filter(mailing => {
    const matchesSearch = mailing.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || mailing.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchMailings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
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
        console.log('✅ Mailings carregados:', result.data.length);
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
  };

  const handleViewMailing = (mailing: Mailing) => {
    setSelectedMailing(mailing);
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
    setNewAgentId(mailing.agent_id);
    
    // Carregar agentes se ainda não foram carregados
    if (agents.length === 0) {
      await loadAgents();
    }
    
    setShowChangeAgentModal(true);
  };

  const loadAgents = async () => {
    try {
      setIsLoadingAgents(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:3001/api/agents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAgents(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const confirmDelete = async () => {
    if (!mailingToDelete) return;
    
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token');
      
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
      toast.success('Campanha excluída', 'A campanha foi removida com sucesso');
      
    } catch (err) {
      console.error('❌ Erro ao deletar campanha:', err);
      toast.error('Erro ao deletar campanha', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!mailingToChangeStatus) return;
    
    try {
      setIsChangingStatus(true);
      const token = localStorage.getItem('token');
      
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
      toast.success('Status alterado', 'O status da campanha foi atualizado com sucesso');
      
    } catch (err) {
      console.error('❌ Erro ao alterar status:', err);
      toast.error('Erro ao alterar status', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsChangingStatus(false);
    }
  };

  const confirmAgentChange = async () => {
    if (!mailingToChangeAgent || !newAgentId) return;
    
    try {
      setIsChangingAgent(true);
      const token = localStorage.getItem('token');
      
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
      
      // Atualizar lista local
      setMailings(prev => prev.map(m => 
        m.id === mailingToChangeAgent.id 
          ? { 
              ...m, 
              agent_id: newAgentId,
              agentes_pabx: {
                id: selectedAgent?.id || '',
                agente_name: selectedAgent?.agente_name || selectedAgent?.name || '',
                ramal: selectedAgent?.ramal || ''
              }
            }
          : m
      ));
      
      setShowChangeAgentModal(false);
      setMailingToChangeAgent(null);
      toast.success('Agente alterado', 'O agente responsável foi atualizado com sucesso');
      
    } catch (err) {
      console.error('❌ Erro ao alterar agente:', err);
      toast.error('Erro ao alterar agente', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsChangingAgent(false);
    }
  };

  useEffect(() => {
    fetchMailings();
  }, []);

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
            onClick={() => router.push('/mailings/new')}
            style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={16} />
            Nova Campanha
          </button>
        </div>

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
                  {mailings.reduce((acc, m) => acc + m.total, 0).toLocaleString()}
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
          @media (max-width: 768px) {
            div[style*="gridTemplateColumns"] {
              grid-template-columns: 1fr !important;
            }
            div[style*="gridColumn"] {
              grid-column: span 1 !important;
            }
          }
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
                    Carregando campanhas...
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
                        {mailing.agentes_pabx.agente_name} ({mailing.agentes_pabx.ramal})
                      </div>
                    </td>
                    <td style={{ padding: '1.5rem', textAlign: 'center' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {mailing.total.toLocaleString()}
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
                          mailing.status === 'active' ? '#dcfce7' :
                          mailing.status === 'working' ? '#fef3c7' :
                          mailing.status === 'disabled' ? '#f1f5f9' : '#fee2e2',
                        color: 
                          mailing.status === 'active' ? '#166534' :
                          mailing.status === 'working' ? '#92400e' :
                          mailing.status === 'disabled' ? '#475569' : '#dc2626'
                      }}>
                        {mailing.status === 'active' ? 'Ativa' :
                         mailing.status === 'working' ? 'Em Execução' :
                         mailing.status === 'disabled' ? 'Desabilitada' : 'Erro'}
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
                          onClick={() => handleViewMailing(mailing)}
                          style={{
                            padding: '8px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f1f5f9',
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#e2e8f0';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                          }}
                          title="Visualizar campanha"
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
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#f0f9ff';
                            }}
                            title="Opções"
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
                            <button
                              onClick={() => {
                                handleDeleteMailing(mailing);
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
                                color: '#dc2626'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                              title="Excluir campanha"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={16} />
                                Excluir
                              </div>
                            </button>
                          </div>
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
                    {selectedMailing.total.toLocaleString()}
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
                  <p style={{
                    fontSize: '16px',
                    color: '#1e293b',
                    margin: 0,
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    {selectedMailing.status === 'active' ? 'Ativa' :
                     selectedMailing.status === 'working' ? 'Em Execução' :
                     selectedMailing.status === 'disabled' ? 'Desabilitada' : 'Erro'}
                  </p>
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
                {isDeleting ? 'Excluindo...' : 'Excluir'}
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
                {isChangingStatus ? 'Alterando...' : 'Alterar Status'}
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
                      {agent.agente_name || agent.name} ({agent.ramal})
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
                {isChangingAgent ? 'Alterando...' : 'Alterar Agente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
