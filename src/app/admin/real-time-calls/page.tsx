'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, Clock, Search, Filter, PhoneOff, PhoneCall, RefreshCw, User, Pause, Play, PhoneForwarded, Volume2, Mic, MicOff } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import agentsService, { Agent } from '@/services/agentsService';
import { usersApiService } from '@/services/usersApiService';
import { useActiveCallsOptimized } from '@/hooks/useActiveCallsOptimized';

interface RealTimeCall {
  id: string;
  status: 'ringing' | 'talking' | 'hold' | 'transferring';
  startTime: Date;
  duration: number;
  userId?: string;
  userName?: string;
  userCompany?: string;
  agentExtension?: string;
  agentName?: string;
  callerNumber?: string;
  calledNumber?: string;
}

export default function AdminRealTimeCallsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [calls, setCalls] = useState<RealTimeCall[]>([]);
  const [agentsMap, setAgentsMap] = useState<Record<string, { name: string; callerid?: string }>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Use optimized active calls hook (polls only on this page)
  const { activeCalls, isLoading, lastUpdate: lastUpdateStr, refetch } = useActiveCallsOptimized('/admin/real-time-calls', 6000);

  // Atualizar relógio de "Última atualização" a cada 10s e carregar agentes uma vez
  useEffect(() => {
    const tick = setInterval(() => setLastUpdate(new Date()), 10000);
    (async () => {
      try {
        setAgentsLoading(true);
        const list: Agent[] = await agentsService.getAgents();
        const map: Record<string, { name: string; callerid?: string }> = {};
        list.forEach(a => { map[a.ramal] = { name: a.name || a.ramal, callerid: a.callerid }; });
        setAgentsMap(map);
      } catch (e) {
        console.warn('[AdminRTC] Falha ao carregar agentes:', e);
      } finally {
        setAgentsLoading(false);
      }
    })();
    return () => clearInterval(tick);
  }, []);

  // Enriquecer chamadas vindas do hook com nomes de usuários e agentes
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Mapear chamadas básicas do hook para o formato da página
        const basic: RealTimeCall[] = activeCalls.map(ch => ({
          id: ch.id,
          status: ch.status,
          startTime: ch.startTime,
          duration: ch.duration,
          userId: ch.userId,
          agentExtension: ch.extension,
          agentName: ch.agentName,
          callerNumber: ch.callerNumber,
          calledNumber: ch.destination,
        }));

        // Buscar nomes dos usuários se necessário
        const idsRaw = Array.from(new Set(basic.map(b => b.userId).filter(Boolean))) as string[];
        if (idsRaw.length > 0) {
          try {
            const users = await usersApiService.getUsersByIds(idsRaw);
            const userMap = new Map<string, { name: string; company?: string }>();
            users.forEach(user => {
              userMap.set(user.id.toLowerCase(), { name: user.name, company: user.company });
            });
            basic.forEach(b => {
              const key = b.userId ? String(b.userId).toLowerCase() : '';
              if (key && userMap.has(key)) {
                const user = userMap.get(key)!;
                b.userName = user.name || b.userId;
                b.userCompany = user.company || '';
                // Agente: fallback para nome do usuário se não houver nome de agente
                b.agentName = b.agentName || user.name;
              }
              if (!b.userName && b.userId) b.userName = b.userId;
            });
          } catch (error) {
            console.warn('[AdminRTC] Falha ao carregar dados dos usuários:', error);
            basic.forEach(b => { if (!b.userName && b.userId) b.userName = b.userId; });
          }
        }

        // Aplicar nomes de agentes via mapa por ramal
        basic.forEach(b => {
          if (b.agentExtension && agentsMap[b.agentExtension]) {
            b.agentName = agentsMap[b.agentExtension].name || b.agentName;
          }
        });

        setCalls(basic);
        // Atualizar lastUpdate proveniente do serviço
        if (lastUpdateStr) setLastUpdate(new Date(lastUpdateStr));
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCalls, agentsMap, lastUpdateStr]);

  const filteredCalls = calls.filter(call => {
    const matchesSearch = (call.agentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (call.agentExtension || '').includes(searchTerm) ||
                         (call.callerNumber || '').includes(searchTerm) ||
                         (call.calledNumber || '').includes(searchTerm) ||
                         (call.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (call.userCompany || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'talking': return '#10b981';
      case 'ringing': return '#3b82f6';
      case 'hold': return '#f59e0b';
      case 'transferring': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'talking': return 'Conversando';
      case 'ringing': return 'Chamando';
      case 'hold': return 'Em Espera';
      case 'transferring': return 'Transferindo';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'talking': return PhoneCall;
      case 'ringing': return Phone;
      case 'hold': return Clock;
      case 'transferring': return RefreshCw;
      default: return Phone;
    }
  };

  // Removido: direção/fila

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Estatísticas
  const totalCalls = calls.length;
  const talkingCalls = calls.filter(c => c.status === 'talking').length;
  const ringingCalls = calls.filter(c => c.status === 'ringing').length;
  const holdCalls = calls.filter(c => c.status === 'hold').length;

  // Removido mapAndEnrichCalls: enriquecimento acontece no useEffect acima

  // Ação: desligar chamada e atualizar lista
  const handleHangup = async (callId: string) => {
    try {
      setConfirmLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`http://localhost:3001/api/active-calls/hangup`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id: callId })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        console.error('[AdminRTC] Hangup failed:', { status: res.status, json });
        return;
      }
      // Refetch via service; próximo tick atualiza automaticamente
      try { await refetch(); } catch {}
    } catch (e) {
      console.error('[AdminRTC] handleHangup error:', e);
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      setConfirmingId(null);
    }
  };

  const openConfirm = (id: string) => {
    setConfirmingId(id);
    setConfirmOpen(true);
  };

  // ...

  return (
    <MainLayout>
      <div aria-busy={loading || agentsLoading} style={{ 
        padding: '2rem', 
        minHeight: '100vh', 
        background: '#f8fafc'
      }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
            Chamadas em Tempo Real
          </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Monitore todas as chamadas ativas de todos os usuários
            </p>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Última atualização: {formatTime(lastUpdate)}
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              padding: '0.5rem',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                backgroundColor: 'white',
                borderRadius: '50%'
              }} />
            </div>
            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
              Ao Vivo
            </span>
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
                <Phone size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {totalCalls}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Total de Chamadas</p>
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
                <PhoneCall size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {talkingCalls}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Conversando</p>
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
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Phone size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {ringingCalls}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Chamando</p>
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
                <Clock size={20} style={{ color: 'white' }} />
              </div>
            </div>
            <h3 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>
              {holdCalls}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Em Espera</p>
          </div>
        </div>

        {/* Filters (sem direção) */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '220px' }}>
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
                placeholder="Buscar por agente, usuário, empresa ou número..."
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
                <option value="talking">Conversando</option>
                <option value="ringing">Chamando</option>
                <option value="hold">Em Espera</option>
                <option value="transferring">Transferindo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Calls Table */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Usuário/Empresa</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Agente</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Ramal</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Origem</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Destino</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Duração</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e2e8f0' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map((call) => {
                  const Icon = getStatusIcon(call.status);
                  const color = getStatusColor(call.status);
                  const label = getStatusLabel(call.status);
                  return (
                    <tr key={call.id}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '1.75rem', height: '1.75rem', borderRadius: '9999px',
                            backgroundColor: color, color: 'white'
                          }}>
                            <Icon size={14} />
                          </span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{call.userName || '-'}</div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{call.userCompany || ''}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#1e293b' }}>{agentsMap[call.agentExtension || '']?.name || call.agentName || '-'}</div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Ramal: {call.agentExtension || '-'}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>
                        {call.agentExtension || '-'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>
                        {call.callerNumber || '-'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: '500', color: '#1e293b' }}>
                        {call.calledNumber || '-'}
                      </td>
                      <td style={{ 
                        padding: '1rem', 
                        fontWeight: '600', 
                        color: '#1e293b',
                        fontFamily: 'monospace'
                      }}>
                        {formatDuration(call.duration)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={() => openConfirm(call.id)}
                          title="Desligar"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white',
                            border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', fontWeight: 600
                          }}
                        >
                          <PhoneOff size={16} /> Desligar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Loading overlay removed to avoid flicker; background updates continue silently */}

          {filteredCalls.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <PhoneOff size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>Nenhuma chamada ativa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Hangup Modal */}
      {confirmOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            background: 'white', borderRadius: '0.75rem', width: '100%', maxWidth: '460px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ padding: '1.25rem 1.25rem 0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                Confirmar encerramento da chamada
              </h3>
              <p style={{ marginTop: '0.5rem', color: '#4b5563', fontSize: '0.95rem' }}>
                Tem certeza que deseja encerrar esta chamada? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => { if (!confirmLoading) { setConfirmOpen(false); setConfirmingId(null); } }}
                style={{
                  padding: '0.5rem 0.9rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
                  background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer'
                }}
                disabled={confirmLoading}
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmingId && handleHangup(confirmingId)}
                style={{
                  padding: '0.5rem 0.9rem', borderRadius: '0.5rem', border: 'none',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white',
                  fontWeight: 700, cursor: 'pointer', opacity: confirmLoading ? 0.7 : 1
                }}
                disabled={confirmLoading}
              >
                {confirmLoading ? 'Encerrando...' : 'Encerrar' }
              </button>
            </div>
          </div>
        </div>
      )}

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
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </MainLayout>
  );
}
