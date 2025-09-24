'use client';

import { useState, useEffect } from 'react';
import { PhoneCall, Phone, Clock, User, Volume2, PhoneOff, Pause, Play, MoreVertical, PhoneForwarded, Settings, Search, Filter, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import agentsService, { Agent } from '@/services/agentsService';
import { useActiveCallsOptimized, ActiveCall } from '@/hooks/useActiveCallsOptimized';
import { TransferCallModal } from '@/components/modals/TransferCallModal';

export default function ActiveCallsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [agentsMap, setAgentsMap] = useState<Record<string, { name: string; callerid?: string }>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ActiveCall | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Estados para modal de transferência
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<ActiveCall | null>(null);
  
  // Estados para busca e filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Usar o hook otimizado para chamadas ativas com contexto
  const { activeCalls, isLoading } = useActiveCallsOptimized('/active-calls', 5000);

  // Estado local para permitir atualizações otimistas (ex.: após hangup)
  const [localCalls, setLocalCalls] = useState<ActiveCall[]>([]);
  useEffect(() => {
    setLocalCalls(activeCalls);
  }, [activeCalls]);

  // Load agents to map extension -> agent name/callerid
  useEffect(() => {
    (async () => {
      try {
        const list: Agent[] = await agentsService.getAgents();
        const map: Record<string, { name: string; callerid?: string }> = {};
        list.forEach(a => { map[a.ramal] = { name: a.name || a.ramal, callerid: a.callerid }; });
        setAgentsMap(map);
      } catch (e) {
        console.warn('[ActiveCalls] Falha ao carregar agentes:', e);
      }
    })();
  }, []);

  // Auto-fechar modal se chamada não existir mais
  useEffect(() => {
    if (transferModalOpen && transferTarget) {
      const callExists = localCalls.find(c => c.id === transferTarget.id);
      if (!callExists) {
        setTransferModalOpen(false);
        setTransferTarget(null);
      }
    }
  }, [localCalls, transferModalOpen, transferTarget]);

  // Filtrar chamadas baseado na busca e filtros
  const filteredCalls = localCalls.filter(call => {
    // Filtro de busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const agentName = agentsMap[call.extension]?.name?.toLowerCase() || '';
      const extension = call.extension?.toLowerCase() || '';
      const callerNumber = call.callerNumber?.toLowerCase() || '';
      const destination = call.destination?.toLowerCase() || '';
      
      if (!agentName.includes(query) && 
          !extension.includes(query) && 
          !callerNumber.includes(query) && 
          !destination.includes(query)) {
        return false;
      }
    }
    
    // Filtro de status
    if (statusFilter !== 'all' && call.status !== statusFilter) {
      return false;
    }
    
    return true;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'talking': return '#10b981';
      case 'ringing': return '#f59e0b';
      case 'hold': return '#ef4444';
      case 'transferring': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'talking': return 'Em conversa';
      case 'ringing': return 'Chamando';
      case 'hold': return 'Em espera';
      case 'transferring': return 'Transferindo';
      default: return status;
    }
  };

  const handleCallAction = async (callId: string, action: string) => {
    try {
      if (action === 'transferir') {
        // Encontrar a chamada para transferir
        const call = localCalls.find(c => c.id === callId) || activeCalls.find(c => c.id === callId);
        if (call) {
          setTransferTarget(call);
          setTransferModalOpen(true);
        }
        return;
      }
      
      if (action === 'hangup' || action === 'desligar') {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const url = `${API_BASE}/api/active-calls/hangup`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ id: callId })
        });

        let result: any = { success: false, message: `HTTP ${response.status}` };
        try {
          result = await response.json();
        } catch (parseErr) {
          // Fallback when server returns HTML/error page
          result = { success: false, message: `Falha ao interpretar resposta (${response.status})` };
        }

        if (response.ok && result.success) {
          console.log('✅ Chamada encerrada:', result.message);
          // Atualização otimista: remover a chamada da lista local
          setLocalCalls(prev => prev.filter(c => c.id !== callId));
          if (selectedCall === callId) setSelectedCall(null);
          if (confirmOpen) setConfirmOpen(false);
          if (confirmTarget?.id === callId) setConfirmTarget(null);
          setConfirmLoading(false);
        } else {
          console.error('❌ Erro ao encerrar chamada:', result.message);
          alert(`Erro: ${result.message}`);
        }
      } else {
        console.log(`[DEBUG] Ação "${action}" para chamada ${callId} - ainda não implementada`);
        alert(`Ação "${action}" ainda não implementada`);
      }
    } catch (error) {
      console.error('❌ Erro na ação da chamada:', error);
      alert('Erro interno na ação da chamada');
    }
  };

  const openConfirmHangup = (call: ActiveCall) => {
    setConfirmTarget(call);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmTarget(null);
    setConfirmLoading(false);
  };

  const confirmHangup = async () => {
    if (!confirmTarget) return;
    try {
      setConfirmLoading(true);
      await handleCallAction(confirmTarget.id, 'hangup');
    } finally {
      closeConfirm();
    }
  };

  const InfoChip = ({ label, value, color = '#111827' }: { label: string; value?: string; color?: string }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      backgroundColor: 'rgba(15, 23, 42, 0.06)', color,
      padding: '0.35rem 0.65rem', borderRadius: '999px',
      fontSize: '0.85rem', fontWeight: 600, lineHeight: 1
    }}>
      <span style={{ opacity: 0.7 }}>{label}:</span>
      <span style={{ fontWeight: 700, color: '#0f172a' }}>{value || '—'}</span>
    </span>
  );



  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh',
        background: '#f8fafc'
      }}>
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          
          .ac-scroll { overflow-x: auto; }
          .ac-grid { display: grid; grid-template-columns: 160px 1.2fr 120px 1fr 1fr 100px 180px; gap: 1rem; }
          .ac-header { 
            background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%); 
            border-radius: 12px; 
            border: 1px solid rgba(99,102,241,0.2); 
            padding: 0.75rem 1rem; 
            color: #475569; 
            font-size: 0.85rem; 
            font-weight: 600;
            backdrop-filter: blur(10px);
          }
          .ac-row { 
            align-items: center; 
            padding: 0.9rem 1rem; 
            border: 1px solid rgba(226,232,240,0.8); 
            border-radius: 12px; 
            background: rgba(255,255,255,0.9); 
            margin-bottom: 8px;
            backdrop-filter: blur(10px);
            transition: all 0.2s ease;
            animation: slideUp 0.3s ease-out;
          }
          .ac-row:hover { 
            border-color: rgba(99,102,241,0.3);
            box-shadow: 0 4px 12px rgba(99,102,241,0.1);
            transform: translateY(-1px);
          }
          .ac-actions { display: flex; align-items: center; gap: 8px; }
          .ac-btn { 
            width: 36px; 
            height: 36px; 
            display: grid; 
            place-items: center; 
            border-radius: 10px; 
            border: 1px solid transparent; 
            cursor: pointer; 
            background: transparent;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
          }
          .ac-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
          .ac-btn:active { transform: translateY(0); }
          .ac-btn.transfer { 
            background: linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%); 
            border-color: rgba(99,102,241,0.25); 
            color: #4f46e5; 
          }
          .ac-btn.transfer:hover { 
            background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%); 
            border-color: rgba(99,102,241,0.4); 
          }
          .ac-btn.listen { 
            background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.1) 100%); 
            border-color: rgba(16,185,129,0.25); 
            color: #059669; 
          }
          .ac-btn.listen:hover { 
            background: linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.15) 100%); 
            border-color: rgba(16,185,129,0.4); 
          }
          .ac-btn.hang { 
            background: linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(220,38,38,0.1) 100%); 
            border-color: rgba(239,68,68,0.25); 
            color: #dc2626; 
          }
          .ac-btn.hang:hover { 
            background: linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%); 
            border-color: rgba(239,68,68,0.4); 
          }
          .ac-btn.manage { 
            background: linear-gradient(135deg, rgba(100,116,139,0.1) 0%, rgba(71,85,105,0.1) 100%); 
            border-color: rgba(100,116,139,0.25); 
            color: #475569; 
          }
          .ac-btn.manage:hover { 
            background: linear-gradient(135deg, rgba(100,116,139,0.15) 0%, rgba(71,85,105,0.15) 100%); 
            border-color: rgba(100,116,139,0.4); 
          }
          @media (max-width: 1200px) { .ac-grid { grid-template-columns: 150px 1fr 110px 1fr 1fr 90px 160px; } }
          @media (max-width: 992px)  { .ac-grid { grid-template-columns: 140px 1fr 100px 1fr 1fr 80px 140px; } }
          @media (max-width: 768px)  {
            .ac-header { display: none; }
            .ac-grid { grid-template-columns: 1fr 1fr; row-gap: 8px; }
            .ac-col-status { grid-column: 1 / span 2; }
            .ac-col-agent { grid-column: 1 / span 1; }
            .ac-col-ext { grid-column: 2 / span 1; justify-self: end; }
            .ac-col-src { grid-column: 1 / span 1; }
            .ac-col-dst { grid-column: 2 / span 1; }
            .ac-col-dur { grid-column: 1 / span 1; }
            .ac-col-actions { grid-column: 2 / span 1; justify-self: end; }
          }
        `}</style>
        {/* Header */}
        <div style={{ 
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2.25rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              marginBottom: '0.5rem'
            }}>Chamadas Ativas</h1>
            <p style={{
              color: '#64748b',
              fontSize: '1rem',
              margin: 0,
              fontWeight: '500'
            }}>Monitore e gerencie chamadas</p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isLoading ? '#f59e0b' : '#10b981',
              animation: isLoading ? 'pulse 2s infinite' : 'none'
            }} />
            <span style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}>
              {isLoading ? 'Atualizando...' : 'Conectado'}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.1) 100%)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            transition: 'all 0.2s ease',
            animation: 'scaleIn 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(16,185,129,0.3)'
              }}>
                <PhoneCall style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '500' }}>
                  Total Ativas
                </p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', lineHeight: 1 }}>
                  {localCalls.length}
                </p>
              </div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.1) 100%)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(59,130,246,0.2)',
            transition: 'all 0.2s ease',
            animation: 'scaleIn 0.4s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(59,130,246,0.3)'
              }}>
                <Phone style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '500' }}>
                  Em Conversa
                </p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', lineHeight: 1 }}>
                  {localCalls.filter(call => call.status === 'talking').length}
                </p>
              </div>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.1) 100%)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            transition: 'all 0.2s ease',
            animation: 'scaleIn 0.5s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px rgba(245,158,11,0.3)'
              }}>
                <Phone style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '500' }}>
                  Chamando
                </p>
                <p style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b', lineHeight: 1 }}>
                  {localCalls.filter(call => call.status === 'ringing').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Calls List */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          overflow: 'hidden',
          animation: 'fadeIn 0.6s ease-out'
        }}>
          <div style={{
            padding: '2rem',
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(139,92,246,0.05) 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0
              }}>Chamadas em Andamento</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '12px',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  <Clock size={16} />
                  Atualizações
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: showFilters ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(255, 255, 255, 0.8)',
                    color: showFilters ? 'white' : '#64748b',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Filter size={16} />
                  Filtros
                </button>
              </div>
            </div>
            
            {/* Search and Filters */}
            {showFilters && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                background: 'rgba(248, 250, 252, 0.8)',
                borderRadius: '12px',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                animation: 'slideUp 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', minWidth: '300px', flex: 1 }}>
                    <Search size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b'
                    }} />
                    <input
                      type="text"
                      placeholder="Buscar por agente, ramal, origem ou destino..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        background: 'white',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#6366f1';
                        e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '2px'
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  
                  {/* Status Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                      Status:
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        background: 'white',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="all">Todos</option>
                      <option value="talking">Em Conversa</option>
                      <option value="ringing">Chamando</option>
                      <option value="hold">Em Espera</option>
                      <option value="transferring">Transferindo</option>
                    </select>
                  </div>
                  
                  {/* Results Count */}
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#6366f1'
                  }}>
                    {filteredCalls.length} de {activeCalls.length} chamadas
                  </div>
                </div>
              </div>
            )}
          </div>

          {filteredCalls.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <PhoneCall size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '1.125rem', fontWeight: '500' }}>
                {localCalls.length === 0 ? 'Nenhuma chamada ativa no momento' : 'Nenhuma chamada encontrada'}
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {localCalls.length === 0 ? 'As chamadas em andamento aparecerão aqui' : 'Tente ajustar os filtros de busca'}
              </p>
            </div>
          ) : (
            <div className="ac-scroll" style={{ padding: '0.75rem' }}>
              {/* Header row */}
              <div className="ac-grid ac-header">
                <div>Status</div>
                <div>Agente</div>
                <div>Ramal</div>
                <div>Origem</div>
                <div>Destino</div>
                <div>Duração</div>
                <div>Ações</div>
              </div>

              {/* Rows */}
              <div style={{ marginTop: '0.5rem', minWidth: 720 }}>
                {filteredCalls.map((call) => (
                  <div key={call.id} className="ac-grid ac-row">
                    {/* Status */}
                    <div className="ac-col-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(call.status) }} />
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: getStatusColor(call.status),
                        color: 'white',
                        padding: '0.3rem 0.6rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {getStatusText(call.status)}
                      </span>
                    </div>

                    {/* Agente */}
                    <div className="ac-col-agent">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 700 }}>
                        <User size={16} style={{ color: '#64748b' }} />
                        <span>{agentsMap[call.extension]?.name || '—'}</span>
                      </div>
                    </div>

                    {/* Ramal */}
                    <div className="ac-col-ext" style={{ color: '#334155', fontWeight: 700 }}>{call.extension || '—'}</div>

                    {/* Origem */}
                    <div className="ac-col-src" style={{ color: '#334155', fontWeight: 700 }}>{call.callerNumber || '—'}</div>

                    {/* Destino */}
                    <div className="ac-col-dst" style={{ color: '#334155', fontWeight: 700 }}>{call.destination || '—'}</div>

                    {/* Duração */}
                    <div className="ac-col-dur" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 700, justifyContent: 'flex-start' }}>
                      <Clock size={14} style={{ color: '#64748b' }} />
                      <span>{formatDuration(call.duration)}</span>
                    </div>

                    {/* Ações */}
                    <div className="ac-col-actions ac-actions" key={`actions-${call.id}`}>
                      <button 
                        aria-label="Transferir" 
                        className="ac-btn transfer" 
                        onClick={() => handleCallAction(call.id, 'transferir')} 
                        title="Transferir"
                        disabled={!['talking','ringing','hold'].includes(call.status)}
                        style={{ opacity: !['talking','ringing','hold'].includes(call.status) ? 0.5 : 1 }}
                      >
                        <PhoneForwarded size={18} />
                      </button>
                      <button 
                        aria-label="Ouvir" 
                        className="ac-btn listen" 
                        onClick={() => handleCallAction(call.id, 'ouvir')} 
                        title="Ouvir"
                        disabled={call.status !== 'talking'}
                        style={{ opacity: call.status !== 'talking' ? 0.5 : 1 }}
                      >
                        <Volume2 size={18} />
                      </button>
                      <button 
                        aria-label="Desligar" 
                        className="ac-btn hang" 
                        onClick={() => openConfirmHangup(call)} 
                        title="Desligar"
                      >
                        <PhoneOff size={18} />
                      </button>
                      <button 
                        aria-label="Gerenciar" 
                        className="ac-btn manage" 
                        onClick={() => handleCallAction(call.id, 'gerenciar')} 
                        title="Gerenciar"
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Confirm Hangup Modal */}
      {confirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
          background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', zIndex: 50
        }}>
          <div style={{
            width: 'min(520px, 92vw)', borderRadius: '1rem',
            background: 'rgba(255,255,255,0.98)',
            border: '1px solid rgba(226,232,240,0.8)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #eef2f7' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Confirmar desligamento</h3>
              <button onClick={closeConfirm} aria-label="Fechar" style={{
                border: '1px solid rgba(15,23,42,0.08)', background: 'transparent',
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer', color: '#64748b'
              }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem', color: '#334155' }}>
              <p style={{ marginTop: 0, marginBottom: '0.75rem' }}>Tem certeza que deseja encerrar esta chamada?</p>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
                background: 'rgba(248,250,252,0.6)', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.75rem'
              }}>
                <div><strong>Ramal</strong><div>{confirmTarget?.extension || '—'}</div></div>
                <div><strong>Duração</strong><div>{confirmTarget ? formatDuration(confirmTarget.duration) : '—'}</div></div>
                <div><strong>Origem</strong><div>{confirmTarget?.callerNumber || '—'}</div></div>
                <div><strong>Destino</strong><div>{confirmTarget?.destination || '—'}</div></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem', borderTop: '1px solid #eef2f7' }}>
              <button onClick={closeConfirm} disabled={confirmLoading} style={{
                padding: '0.6rem 1rem', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#334155', fontWeight: 600
              }}>Cancelar</button>
              <button onClick={confirmHangup} disabled={confirmLoading} style={{
                padding: '0.6rem 1rem', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', cursor: 'pointer', fontWeight: 700,
                opacity: confirmLoading ? 0.8 : 1
              }}>{confirmLoading ? 'Desligando...' : 'Desligar agora'}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Transfer Call Modal */}
      {transferModalOpen && transferTarget && (
        <TransferCallModal
          isOpen={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false);
            setTransferTarget(null);
          }}
          call={transferTarget}
          onTransferComplete={() => {
            setTransferModalOpen(false);
            setTransferTarget(null);
            // Refresh calls list
            window.location.reload();
          }}
        />
      )}
    </MainLayout>
  );
}
