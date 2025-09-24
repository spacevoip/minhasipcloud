'use client';

import { useState, useEffect } from 'react';
import { AgentLayout } from '@/components/layout/agent-layout';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';
import { 
  Calendar, 
  Clock, 
  Download, 
  Filter, 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Search, 
  User, 
  Activity
} from 'lucide-react';

interface CDRRecord {
  uniqueid: string;
  calldate: string;
  src: string;
  dst: string;
  duration: number;
  billsec: number;
  disposition: string;
  ui_status: string;
  call_direction: 'inbound' | 'outbound' | 'unknown';
  clid?: string;
  extension?: string;
  agent_name?: string;
}

export default function AgentCDR() {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [cdrRecords, setCdrRecords] = useState<CDRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [stats, setStats] = useState({ 
    total_calls: 0, 
    today_calls: 0, 
    answered_calls: 0, 
    total_duration: 0, 
    total_billsec: 0 
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const loadCDRData = async (ramal: string, page = 1) => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        console.warn('⚠️ [CDR] Token não encontrado');
        return;
      }

      console.log('📞 [CDR] Carregando dados CDR para ramal:', ramal, 'página:', page);
      
      // Build query params
      let startDate = '';
      let endDate = '';
      
      if (dateFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (dateFilter) {
          case 'today':
            startDate = today.toISOString();
            endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = weekAgo.toISOString();
            break;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            startDate = monthAgo.toISOString();
            break;
        }
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: searchTerm,
        disposition: '',
        startDate,
        endDate,
        order: 'desc'
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/cdr/agent/${ramal}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [CDR] Dados CDR carregados:', data);
        console.log('📊 [CDR] Estrutura dos dados:', {
          success: data.success,
          hasData: !!data.data,
          callsCount: data.data?.calls?.length || 0,
          statsKeys: data.data?.stats ? Object.keys(data.data.stats) : [],
          paginationKeys: data.data?.pagination ? Object.keys(data.data.pagination) : []
        });
        
        if (data.success && data.data) {
          const calls = data.data.calls || [];
          console.log('📞 [CDR] Chamadas encontradas:', calls.length);
          if (calls.length > 0) {
            console.log('📞 [CDR] Primeira chamada:', calls[0]);
          }
          
          setCdrRecords(calls);
          console.log('📊 [CDR] Estado atualizado - cdrRecords:', calls.length);
          setStats(data.data.stats || { 
            total_calls: 0, 
            today_calls: 0, 
            answered_calls: 0, 
            total_duration: 0, 
            total_billsec: 0 
          });
          setPagination(data.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } else {
          console.log('❌ [CDR] Dados inválidos:', { success: data.success, hasData: !!data.data });
        }
      } else {
        console.error('❌ [CDR] Erro na API:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ [CDR] Detalhes do erro:', errorText);
      }
    } catch (error) {
      console.error('Error loading CDR data:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔄 [CDR] Carregando dados do agente...');
        
        const result = await agentAuthService.getCurrentAgent();
        if (result.success && result.data) {
          console.log('✅ [CDR] Dados do agente carregados:', result.data);
          setAgentData(result.data);
          
          if (result.data.ramal) {
            await loadCDRData(result.data.ramal);
          }
        } else {
          const storedData = agentAuthService.getStoredAgentData();
          if (storedData && storedData.ramal) {
            console.log('💾 [CDR] Usando dados armazenados:', storedData);
            setAgentData(storedData);
            await loadCDRData(storedData.ramal);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Reload data when filters change
  useEffect(() => {
    if (agentData?.ramal) {
      loadCDRData(agentData.ramal, 1);
    }
  }, [dateFilter]); // Remove searchTerm from dependencies to avoid auto-reload

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  };

  const formatCallerID = (clid: string) => {
    if (!clid) return '-';
    // Remove quotes and extract numbers from formats like "" <1135981517>
    const match = clid.match(/<(\d+)>/) || clid.match(/"([^"]*)"/); 
    if (match && match[1]) {
      return match[1];
    }
    // If no special format, extract only numbers
    const numbers = clid.replace(/\D/g, '');
    return numbers || clid;
  };

  const getDispositionColor = (disposition: string) => {
    switch (disposition) {
      case 'ANSWERED': return '#10b981';
      case 'NO ANSWER': return '#f59e0b';
      case 'BUSY': return '#ef4444';
      case 'FAILED': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getDispositionLabel = (disposition: string, uiStatus?: string) => {
    // Use ui_status if available, otherwise fallback to disposition mapping
    if (uiStatus) {
      return uiStatus;
    }
    
    switch (disposition) {
      case 'ANSWERED': return 'Atendida';
      case 'NO ANSWER': return 'Não Atendida';
      case 'BUSY': return 'Ocupado';
      case 'FAILED': return 'Falhou';
      default: return disposition;
    }
  };

  // No need for client-side filtering since API handles it
  const filteredRecords = cdrRecords;
  
  const handlePageChange = (newPage: number) => {
    if (agentData?.ramal) {
      loadCDRData(agentData.ramal, newPage);
    }
  };

  if (loading) {
    return (
      <AgentLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%'
        }}>
          <Activity size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#1e293b',
            margin: 0,
            marginBottom: '8px'
          }}>
            Histórico de Chamadas (CDR)
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Phone size={20} color="#64748b" />
            <p style={{ 
              color: '#64748b', 
              margin: 0,
              fontSize: '16px'
            }}>
              Ramal {agentData?.ramal} - {agentData?.agente_name}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '20px',
          marginBottom: '32px'
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' }}>Total de Chamadas</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{stats.total_calls}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' }}>Chamadas Hoje</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{stats.today_calls}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' }}>Chamadas Atendidas</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{stats.answered_calls}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            border: '1px solid #f1f5f9'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '500' }}>Tempo Total de Conversação</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>{formatDuration(stats.total_duration)}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', minWidth: '180px', flex: '1' }}>
              <Search 
                size={16} 
                style={{ 
                  position: 'absolute', 
                  left: '10px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#64748b' 
                }} 
              />
              <input
                type="text"
                placeholder="Buscar por número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 35px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                minWidth: '140px',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todos</option>
              <option value="today">Hoje</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
            </select>

            <button
              onClick={() => loadCDRData(agentData?.ramal || '', 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Search size={14} />
              Buscar
            </button>
            
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={14} />
              Exportar
            </button>
          </div>
        </div>

        {/* CDR Table */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          overflowX: 'auto'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              minWidth: '800px',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}>
                    Caller ID
                  </th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}>
                    Data/Hora
                  </th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}>
                    Origem
                  </th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}>
                    Destino
                  </th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}>
                    Duração
                  </th>
                  <th style={{ 
                    padding: '12px 16px', 
                    textAlign: 'left', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap'
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  console.log('🎨 [CDR] Renderizando tabela:', { 
                    cdrRecords: cdrRecords.length, 
                    filteredRecords: filteredRecords.length,
                    loading 
                  });
                  return null;
                })()}
                {filteredRecords.map((record) => (
                  <tr key={record.uniqueid} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={14} color="#64748b" />
                        <span style={{ 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          color: '#1e293b',
                          wordBreak: 'break-word'
                        }}>
                          {formatCallerID(record.clid || '') || record.src || '-'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '14px', color: '#1e293b' }}>
                          {formatDate(record.calldate)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#1e293b',
                        wordBreak: 'break-word'
                      }}>
                        {agentData?.ramal || record.src}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500', 
                        color: '#1e293b',
                        wordBreak: 'break-word'
                      }}>
                        {record.dst}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} color="#64748b" />
                        <span style={{ fontSize: '14px', color: '#1e293b' }}>
                          {formatDuration(record.billsec || 0)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: '500',
                        color: getDispositionColor(record.disposition),
                        backgroundColor: `${getDispositionColor(record.disposition)}20`,
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}>
                        {getDispositionLabel(record.disposition, record.ui_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && !loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: '#64748b'
            }}>
              <Phone size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '500' }}>
                Nenhuma chamada encontrada
              </h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {searchTerm || dateFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca' 
                  : 'Suas chamadas aparecerão aqui quando forem realizadas'}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '24px'
          }}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: pagination.page <= 1 ? '#f1f5f9' : 'white',
                color: pagination.page <= 1 ? '#94a3b8' : '#475569',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Anterior
            </button>
            
            <span style={{ 
              padding: '8px 16px',
              fontSize: '14px',
              color: '#64748b'
            }}>
              Página {pagination.page} de {pagination.totalPages}
            </span>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                padding: '8px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: pagination.page >= pagination.totalPages ? '#f1f5f9' : 'white',
                color: pagination.page >= pagination.totalPages ? '#94a3b8' : '#475569',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </AgentLayout>
  );
}
