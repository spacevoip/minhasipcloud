'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { adminAgentsService, AdminAgent } from '@/services/adminAgentsService';
// import { useToast } from '@/components/ui/toast';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  X, 
  Eye, 
  EyeOff, 
  Copy,
  Check, 
  Phone,
  Mail,
  Building,
  Settings,
  Clock,
  RefreshCw
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  email: string;
  extension: string;
  department: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastActivity: Date;
  totalCalls: number;
  todayCalls: number;
  averageCallDuration: number;
  callerId: string;
  password: string;
  webrtc: boolean;
  blocked: boolean;
  createdAt: Date;
  userId: string;
  userName?: string;
  userCompany?: string;
  isActive: boolean;
}

export default function AdminManageAgentPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de edição
  const [editingName, setEditingName] = useState(false);
  const [editingCallerId, setEditingCallerId] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempCallerId, setTempCallerId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Toast simples
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    console.log(`${type.toUpperCase()}: ${message}`);
    // TODO: Implementar toast notification visual
  };

  // Carregar dados do agente
  useEffect(() => {
    loadAgent();
  }, [agentId]);

  const loadAgent = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const agentData = await adminAgentsService.getAgentById(agentId);
      
      // Converter AdminAgent para Agent
      const convertedAgent: Agent = {
        id: agentData.id,
        name: agentData.name,
        email: '', // AdminAgent não tem userEmail
        extension: agentData.extension,
        department: 'Geral',
        status: agentData.isActive ? 'online' : 'offline',
        lastActivity: new Date(),
        totalCalls: 0,
        todayCalls: 0,
        averageCallDuration: 0,
        callerId: agentData.callerId || agentData.extension,
        password: '', // AdminAgent não tem password
        webrtc: true,
        blocked: !agentData.isActive,
        createdAt: new Date(agentData.createdAt),
        userId: agentData.userId,
        userName: agentData.userName,
        userCompany: agentData.userCompany,
        isActive: agentData.isActive
      };
      
      setAgent(convertedAgent);
      setTempName(convertedAgent.name);
      setTempCallerId(convertedAgent.callerId);
      
    } catch (error: any) {
      console.error('❌ Erro ao carregar agente:', error);
      setError(error.message || 'Erro ao carregar dados do agente');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) return;
    
    try {
      setSaving(true);
      await adminAgentsService.updateAgent(agentId, { name: tempName });
      
      if (agent) {
        setAgent({ ...agent, name: tempName });
      }
      
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
    if (!tempCallerId.trim()) return;
    
    try {
      setSaving(true);
      await adminAgentsService.updateAgent(agentId, { callerId: tempCallerId });
      
      if (agent) {
        setAgent({ ...agent, callerId: tempCallerId });
      }
      
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
    try {
      setSaving(true);
      const updatedAgent = await adminAgentsService.toggleAgentStatus(agentId, !!agent?.isActive);
      
      if (agent) {
        setAgent({ 
          ...agent, 
          isActive: updatedAgent.isActive,
          status: updatedAgent.isActive ? 'online' : 'offline',
          blocked: !updatedAgent.isActive
        });
      }

      const statusText = updatedAgent.isActive ? 'ativado' : 'desativado';
      showToast(`Agente ${statusText} com sucesso!`, 'success');
      
    } catch (error: any) {
      console.error('❌ Erro ao alterar status:', error);
      showToast(error.message || 'Erro ao alterar status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setSaving(true);
      await adminAgentsService.deleteAgent(agentId);
      showToast('Agente excluído com sucesso!', 'success');
      
      setTimeout(() => {
        router.push('/admin/agents-all');
      }, 1000);
      
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
      setTempName(agent?.name || '');
      setTempCallerId(agent?.callerId || '');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f4f6',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#6b7280', margin: 0 }}>Carregando dados do agente...</p>
        </div>
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: '#fee2e2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <span style={{ fontSize: '24px', color: '#dc2626' }}>⚠️</span>
          </div>
          <h3 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>Erro ao Carregar</h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => router.push('/admin/agents-all')}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Voltar à Lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div style={{ padding: '2rem' }}>

        {/* Main Content Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '2rem'
        }}>
          {/* Informações Básicas */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              margin: '0 0 1.5rem 0',
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#6366f1' }} />
              Informações Básicas
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Nome do Agente */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Nome do Agente
                </label>
                {editingName ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, handleSaveName)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '2px solid #6366f1',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                      placeholder="Digite o nome do agente"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving}
                      style={{
                        padding: '0.75rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {saving ? <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: '1rem', height: '1rem' }} />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setTempName(agent?.name || '');
                      }}
                      style={{
                        padding: '0.75rem',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      <X style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingName(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                      {agent?.name || 'Nome do agente'}
                    </span>
                    <Edit style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
                  </div>
                )}
              </div>

              {/* Caller ID */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Caller ID
                </label>
                {editingCallerId ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={tempCallerId}
                      onChange={(e) => setTempCallerId(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, handleSaveCallerId)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '2px solid #6366f1',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                      placeholder="Digite o Caller ID"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveCallerId}
                      disabled={saving}
                      style={{
                        padding: '0.75rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {saving ? <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} /> : <Save style={{ width: '1rem', height: '1rem' }} />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingCallerId(false);
                        setTempCallerId(agent?.callerId || '');
                      }}
                      style={{
                        padding: '0.75rem',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      <X style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingCallerId(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>
                      {agent?.callerId || 'Clique para definir'}
                    </span>
                    <Edit style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              margin: '0 0 1.5rem 0',
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />
              Ações Rápidas
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={handleToggleStatus}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  background: saving ? '#9ca3af' : (agent?.isActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                {saving ? <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} /> : (agent?.isActive ? '🚫' : '✅')}
                {saving ? 'Processando...' : (agent?.isActive ? 'Desativar Agente' : 'Ativar Agente')}
              </button>

              <button
                onClick={handleDelete}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1rem',
                  background: saving ? '#9ca3af' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                {saving ? <RefreshCw style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} /> : '🗑️'}
                {saving ? 'Processando...' : 'Excluir Agente'}
              </button>

              {agent?.extension && (
                <button
                  onClick={() => copyToClipboard(agent.extension, 'Ramal')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <Copy style={{ width: '1rem', height: '1rem' }} />
                  Copiar Ramal ({agent.extension})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Informações do Sistema */}
        {(agent?.userName || agent?.userCompany) && (
          <div style={{
            marginTop: '2rem',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h2 style={{
              margin: '0 0 1.5rem 0',
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Building style={{ width: '1.25rem', height: '1.25rem', color: '#6366f1' }} />
              Informações do Sistema
            </h2>
            
            <div style={{ 
              display: 'grid', 
              gap: '1rem', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' 
            }}>
              {agent.userName && (
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                    Usuário
                  </label>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: '600', color: '#1f2937' }}>
                    {agent.userName}
                  </p>
                </div>
              )}
              {agent.userCompany && (
                <div>
                  <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                    Empresa
                  </label>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: '600', color: '#1f2937' }}>
                    {agent.userCompany}
                  </p>
                </div>
              )}
              <div>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                  Criado em
                </label>
                <p style={{ margin: '0.25rem 0 0 0', fontWeight: '600', color: '#1f2937' }}>
                  {agent?.createdAt ? new Date(agent.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </MainLayout>
  );
}
