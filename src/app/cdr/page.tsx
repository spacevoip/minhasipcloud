'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Download, Filter, Calendar, Phone, ChevronLeft, ChevronRight, Clock, PhoneCall, TrendingUp, Trash2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { CDR, FilterOptions } from '@/types';
import { getCdr, deleteCdr, CdrQuery } from '@/services/cdrService';
import { useToast } from '@/components/ui/toast';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile('matches' in e ? e.matches : (e as MediaQueryList).matches);
    onChange(mql);
    // Modern browsers
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange as (ev: Event) => void);
      return () => mql.removeEventListener('change', onChange as (ev: Event) => void);
    }
    // Fallback
    // @ts-ignore
    mql.addListener(onChange);
    return () => {
      // @ts-ignore
      mql.removeListener(onChange);
    };
  }, []);
  return isMobile;
};

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function CDRPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<CDR[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Hooks UX
  const { success, error } = useToast();
  const isMobile = useIsMobile();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const itemsPerPage = 10;

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAllCurrent = useCallback(() => {
    const all = new Set<string>();
    records.forEach(r => all.add(r.id));
    setSelected(all);
  }, [records]);
  const deselectAll = useCallback(() => clearSelection(), [clearSelection]);
  const allCurrentSelected = useMemo(() => records.length > 0 && records.every(r => selected.has(r.id)), [records, selected]);
  const someCurrentSelected = useMemo(() => records.some(r => selected.has(r.id)), [records, selected]);

  const handleBulkDelete = async () => {
    try {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      const confirmText = ids.length === 1 ? 'Excluir este registro CDR?' : `Excluir ${ids.length} registros CDR selecionados?`;
      if (!window.confirm(confirmText)) return;
      // Optimistic UI
      setRecords(prev => prev.filter(r => !selected.has(r.id)));
      setTotal(prev => Math.max(0, prev - ids.length));
      clearSelection();
      const deleted = await deleteCdr(ids);
      if (deleted < ids.length) {
        console.warn('Nem todos os registros foram excluídos. Excluídos:', deleted, 'solicitados:', ids.length);
      }
      success(`${deleted} registro(s) excluído(s).`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao excluir CDR(s)';
      error(message);
    }
  };

  // Carregar dados reais do backend
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params: CdrQuery = {
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearchTerm || undefined,
          order: 'desc',
        };
        // Date filters (optional quick ranges)
        if (dateRange === 'today') {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          params.startDate = start.toISOString();
          params.endDate = new Date().toISOString();
        } else if (dateRange === '7d') {
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          params.startDate = start.toISOString();
          params.endDate = end.toISOString();
        } else if (dateRange === '30d') {
          const end = new Date();
          const start = new Date();
          start.setDate(end.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          params.startDate = start.toISOString();
          params.endDate = end.toISOString();
        } // else 'all' -> no date params
        // Advanced filters -> map to backend-compatible params
        if (filters?.status) {
          const map: Record<string, string> = {
            answered: 'ANSWERED',
            no_answer: 'NO_ANSWER',
            busy: 'BUSY',
            failed: 'FAILED',
            missed: 'NO_ANSWER',
            completed: 'ANSWERED',
          };
          params.disposition = map[String(filters.status)] || undefined;
        }
        if (filters?.dateFrom) params.startDate = new Date(filters.dateFrom).toISOString();
        if (filters?.dateTo) params.endDate = new Date(filters.dateTo).toISOString();
        const res = await getCdr(params);
        setRecords(res.records);
        setTotal(res.total);
        setTotalPages(res.totalPages || 1);
        // Remove selections that aren't in the new page
        setSelected(prev => {
          const next = new Set<string>();
          res.records.forEach((r: CDR) => { if (prev.has(r.id)) next.add(r.id); });
          return next;
        });
      } catch (e) {
        console.error('Erro ao carregar CDR:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentPage, debouncedSearchTerm, dateRange, filters]);

  // Dados atuais vindo da API
  const currentData = records;
  const totalCalls = useMemo(() => total || currentData.length, [total, currentData.length]);
  const answeredCount = useMemo(() => currentData.filter(r => r.status === 'answered').length, [currentData]);
  const noAnswerCount = useMemo(() => currentData.filter(r => r.status === 'no_answer').length, [currentData]);
  const avgDurationSec = useMemo(() => currentData.length ? Math.round(currentData.reduce((sum, r) => sum + (r.duration || 0), 0) / currentData.length) : 0, [currentData]);
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  }, [totalPages]);

  const getStatusBadge = (status: CDR['status']) => {
    const statusConfig = {
      answered: { color: '#10b981', bg: '#d1fae5', label: 'Atendida' },
      missed: { color: '#ef4444', bg: '#fee2e2', label: 'Perdida' },
      busy: { color: '#f59e0b', bg: '#fef3c7', label: 'Ocupado' },
      completed: { color: '#10b981', bg: '#d1fae5', label: 'Concluída' },
      failed: { color: '#ef4444', bg: '#fee2e2', label: 'Falhou' },
      no_answer: { color: '#6b7280', bg: '#f3f4f6', label: 'Não Atendida' }
    };

    const config = statusConfig[status] || { color: '#6b7280', bg: '#f3f4f6', label: status || 'Desconhecido' };
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.color}20`
      }}>
        {config.label}
      </span>
    );
  };

  const getDirectionBadge = (direction: CDR['direction']) => {
    const isInbound = direction === 'inbound';
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: isInbound ? '#6b7280' : '#374151',
        backgroundColor: isInbound ? '#f3f4f6' : '#e5e7eb',
        border: `1px solid ${isInbound ? '#d1d5db' : '#9ca3af'}`
      }}>
        {isInbound ? 'Entrada' : 'Saída'}
      </span>
    );
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Gerar CSV com dados atuais
      const csvContent = [
        'Data/Hora,Origem,Destino,Status,Duração,Agente,CallerID',
        ...records.map(cdr => 
          `${new Date(cdr.startTime).toLocaleString()},${cdr.from},${cdr.to},${cdr.status},${formatDuration(cdr.duration)},${cdr.agentName || ''},${cdr.callerId || ''}`
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdr-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      success('Relatório CDR exportado com sucesso!');
    } catch (err) {
      console.error('Erro na exportação:', err);
      error('Erro ao exportar relatório. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar todos os registros compatíveis com o filtro atual (pagina por página)
  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const header = 'Data/Hora,Origem,Destino,Status,Duração,Agente,CallerID';
      const lines: string[] = [header];
      // Primeiro fetch para obter total/totalPages atualizados
      const baseParams: CdrQuery = {
        page: 1,
        limit: itemsPerPage,
        search: debouncedSearchTerm || undefined,
        order: 'desc',
      };
      // Advanced filters -> map to backend-compatible params
      if (filters?.status) {
        const map: Record<string, string> = {
          answered: 'ANSWERED',
          no_answer: 'NO_ANSWER',
          busy: 'BUSY',
          failed: 'FAILED',
          missed: 'NO_ANSWER',
          completed: 'ANSWERED',
        };
        baseParams.disposition = map[String(filters.status)] || undefined;
      }
      if (filters?.dateFrom) baseParams.startDate = new Date(filters.dateFrom).toISOString();
      if (filters?.dateTo) baseParams.endDate = new Date(filters.dateTo).toISOString();
      const first = await getCdr(baseParams);
      const pages = Math.max(1, first.totalPages || 1);
      const process = (arr: CDR[]) => arr.forEach(cdr => {
        lines.push(`${new Date(cdr.startTime).toLocaleString()},${cdr.from},${cdr.to},${cdr.status},${formatDuration(cdr.duration)},${cdr.agentName || ''},${cdr.callerId || ''}`);
      });
      process(first.records);
      for (let p = 2; p <= pages; p++) {
        const pageRes = await getCdr({ ...baseParams, page: p });
        process(pageRes.records);
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdr-all-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      success('Exportação de todos os registros concluída!');
    } catch (err) {
      console.error('Erro na exportação completa:', err);
      error('Erro ao exportar todos os registros.');
    } finally {
      setIsExporting(false);
    }
  };

  if (false) {
    return (
      <MainLayout>
        <div style={{ 
          padding: '2rem', 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ 
              height: '2rem', 
              background: 'linear-gradient(90deg, #e5e7eb, #f3f4f6, #e5e7eb)', 
              backgroundSize: '200% 100%',
              borderRadius: '0.5rem', 
              width: '12rem', 
              animation: 'shimmer 1.5s ease-in-out infinite'
            }}></div>
            <div style={{ 
              height: '2.5rem', 
              background: 'linear-gradient(90deg, #e5e7eb, #f3f4f6, #e5e7eb)', 
              backgroundSize: '200% 100%',
              borderRadius: '0.5rem', 
              width: '8rem', 
              animation: 'shimmer 1.5s ease-in-out infinite'
            }}></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ 
                height: '8rem', 
                background: 'linear-gradient(90deg, #e5e7eb, #f3f4f6, #e5e7eb)', 
                backgroundSize: '200% 100%',
                borderRadius: '0.75rem', 
                animation: `shimmer 1.5s ease-in-out infinite ${i * 0.2}s`
              }}></div>
            ))}
          </div>
          <div style={{ 
            height: '24rem', 
            background: 'linear-gradient(90deg, #e5e7eb, #f3f4f6, #e5e7eb)', 
            backgroundSize: '200% 100%',
            borderRadius: '1rem', 
            animation: 'shimmer 1.5s ease-in-out infinite'
          }}></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}>
          {/* Header removed as requested */}

          {/* Stats Cards */}
          {!loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Total Calls Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideInUp 0.6s ease-out 0.1s both',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)';
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#dbeafe',
                  borderRadius: '0.75rem',
                  marginRight: '1rem'
                }}>
                  <Phone size={24} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>Total de Chamadas</p>
                  <p style={{
                    fontSize: '1.875rem',
                    fontWeight: 'bold',
                    color: '#111827'
                  }}>{new Intl.NumberFormat('pt-BR').format(totalCalls)}</p>
                </div>
              </div>
            </div>

            {/* Answered Calls Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideInUp 0.6s ease-out 0.2s both',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)';
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#d1fae5',
                  borderRadius: '0.75rem',
                  marginRight: '1rem'
                }}>
                  <PhoneCall size={24} style={{ color: '#059669' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>Chamadas Atendidas</p>
                  <p style={{
                    fontSize: '1.875rem',
                    fontWeight: 'bold',
                    color: '#111827'
                  }}>{new Intl.NumberFormat('pt-BR').format(answeredCount)}</p>
                </div>
              </div>
            </div>

            {/* Missed Calls Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideInUp 0.6s ease-out 0.3s both',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)';
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fee2e2',
                  borderRadius: '0.75rem',
                  marginRight: '1rem'
                }}>
                  <Clock size={24} style={{ color: '#dc2626' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>Chamadas Perdidas</p>
                  <p style={{
                    fontSize: '1.875rem',
                    fontWeight: 'bold',
                    color: '#111827'
                  }}>{new Intl.NumberFormat('pt-BR').format(noAnswerCount)}</p>
                </div>
              </div>
            </div>

            {/* Average Duration Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: 'slideInUp 0.6s ease-out 0.4s both',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)';
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#f3e8ff',
                  borderRadius: '0.75rem',
                  marginRight: '1rem'
                }}>
                  <TrendingUp size={24} style={{ color: '#7c3aed' }} />
                </div>
                <div>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>Duração Média</p>
                  <p style={{
                    fontSize: '1.875rem',
                    fontWeight: 'bold',
                    color: '#111827'
                  }}>{avgDurationSec > 0 ? formatDuration(avgDurationSec) : '0:00'}</p>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  height: '96px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '1rem',
                  border: '1px solid #e5e7eb',
                  animation: 'shimmer 2s ease-in-out infinite'
                }} />
              ))}
            </div>
          )}

          {/* Main Content */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            animation: 'slideInUp 1s ease-out 0.5s both'
          }}>
            {/* Removed section title/description as requested */}

            {loading ? (
              <div style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
              }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{
                    height: '4rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '0.5rem',
                    animation: 'shimmer 2s ease-in-out infinite'
                  }} />
                ))}
              </div>
            ) : (
              <>
                {/* Toolbar: Search + Filters + Export + Delete */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', width: '100%' }}>
                  <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '260px', maxWidth: '400px' }}>
                    <Search style={{
                      position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                      color: '#9ca3af', width: '1rem', height: '1rem', zIndex: 1
                    }} />
                    <input
                      type="text"
                      placeholder="Buscar por número, agente ou destino..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '1px solid #d1d5db',
                        borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white', transition: 'all 0.2s ease', 
                        outline: 'none', boxSizing: 'border-box'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  {/* Period selector */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} style={{ color: '#6b7280' }} />
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      style={{
                        padding: '0.6rem 0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        backgroundColor: 'white',
                        fontSize: '0.875rem',
                        color: '#111827',
                        cursor: 'pointer'
                      }}
                      title="Período"
                    >
                      <option value="all">Todos</option>
                      <option value="today">Hoje</option>
                      <option value="7d">Últimos 7 dias</option>
                      <option value="30d">Últimos 30 dias</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem',
                      backgroundColor: 'white', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                      fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb'; }}
                    onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = 'white'; }}
                  >
                    <Filter size={16} />
                    Filtros
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem',
                        backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '600',
                        cursor: 'pointer', transition: 'all 0.2s ease', outline: 'none', flexShrink: 0
                      }}
                      title={`Excluir ${selected.size} selecionado(s)`}
                    >
                      <Trash2 size={16} />
                      {`Excluir (${selected.size})`}
                    </button>
                  )}
                  <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                      onClick={handleExport}
                      disabled={isExporting}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem',
                        backgroundColor: isExporting ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem',
                        fontSize: '0.875rem', fontWeight: '500', cursor: isExporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', outline: 'none'
                      }}
                      onMouseEnter={(e) => { if (!isExporting) { (e.target as HTMLButtonElement).style.backgroundColor = '#2563eb'; (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; } }}
                      onMouseLeave={(e) => { if (!isExporting) { (e.target as HTMLButtonElement).style.backgroundColor = '#3b82f6'; (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; } }}
                    >
                      <Download size={16} />
                      {isExporting ? 'Exportando...' : 'Exportar CSV'}
                    </button>
                  </div>
                </div>

                {/* Painel de Filtros Avançados */}
                {showFilters && (
                  <div style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.75rem'
                  }}>
                    {/* Status */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Status</label>
                      <select
                        value={String(filters.status || '')}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterOptions['status'] }))}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}
                      >
                        <option value="">Todos</option>
                        <option value="answered">Atendida</option>
                        <option value="no_answer">Não Atendida</option>
                        <option value="busy">Ocupado</option>
                        <option value="failed">Falhou</option>
                      </select>
                    </div>
                    {/* Direção */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Direção</label>
                      <select
                        value={String(filters.direction || '')}
                        onChange={(e) => setFilters(prev => ({ ...prev, direction: (e.target.value || undefined) as FilterOptions['direction'] }))}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}
                      >
                        <option value="">Ambas</option>
                        <option value="inbound">Entrada</option>
                        <option value="outbound">Saída</option>
                      </select>
                    </div>
                    {/* Datas personalizadas */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Início</label>
                      <input type="datetime-local"
                        value={filters.dateFrom ? new Date(filters.dateFrom).toISOString().slice(0,16) : ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value ? new Date(e.target.value) : undefined }))}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Fim</label>
                      <input type="datetime-local"
                        value={filters.dateTo ? new Date(filters.dateTo).toISOString().slice(0,16) : ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value ? new Date(e.target.value) : undefined }))}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}
                      />
                    </div>
                  </div>
                )}

                {/* CDR Table - Desktop */}
                {!isMobile && (
                  <div style={{
                    background: 'white',
                    borderRadius: '0.75rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                          {/* Select All */}
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <input
                            type="checkbox"
                            checked={allCurrentSelected}
                            onChange={(e) => {
                              if (e.currentTarget.checked) selectAllCurrent(); else deselectAll();
                            }}
                            style={{ width: 16, height: 16 }}
                          />
                        </th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>Data/Hora</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>Ramal</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>Destino</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>CallerID</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>Duração</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>Status</th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '1px solid #e5e7eb'
                        }}>Agente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.map((cdr, index) => (
                        <tr key={cdr.id} style={{
                          borderBottom: index < records.length - 1 ? '1px solid #f3f4f6' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}>
                          {/* Row selector */}
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected(cdr.id)}
                              onChange={() => toggleSelect(cdr.id)}
                              style={{ width: 16, height: 16 }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                            <div>
                              <div style={{ fontWeight: '500', color: '#111827' }}>
                                {cdr.startTime.toLocaleDateString('pt-BR')}
                              </div>
                              <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                {cdr.startTime.toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.5rem 1rem',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '0.5rem',
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#334155'
                            }}>
                              {cdr.extension || 'N/A'}
                            </div>
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            color: '#374151',
                            textAlign: 'center'
                          }}>{cdr.to}</td>
                          <td style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.375rem 0.75rem',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.5rem',
                              fontFamily: 'monospace',
                              fontSize: '0.8125rem',
                              fontWeight: '500',
                              color: '#475569'
                            }}>
                              <span>{cdr.callerId || cdr.from}</span>
                            </div>
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: '#111827',
                            textAlign: 'center'
                          }}>{formatDuration(cdr.duration)}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>{getStatusBadge(cdr.status)}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
                            {cdr.agentName ? (
                              <div style={{ color: '#111827', fontWeight: '500' }}>
                                {cdr.agentName}
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>N/A</span>
                            )}
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
                    gap: '1rem'
                  }}>
                    {currentData.map((cdr) => (
                      <div key={cdr.id} style={{
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
                            <h3 style={{
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: '0 0 0.25rem 0'
                            }}>
                              {cdr.from} → {cdr.to}
                            </h3>
                            <p style={{
                              fontSize: '0.875rem',
                              color: '#64748b',
                              margin: 0
                            }}>
                              {cdr.startTime.toLocaleString()}
                            </p>
                          </div>
                          {getStatusBadge(cdr.status)}
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.75rem',
                          marginBottom: '0.75rem'
                        }}>
                          <div>
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              fontWeight: '500'
                            }}>Duração</span>
                            <p style={{
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: '0.25rem 0 0 0'
                            }}>
                              {formatDuration(cdr.duration)}
                            </p>
                          </div>
                          <div>
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#64748b',
                              fontWeight: '500'
                            }}>Agente</span>
                            <p style={{
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              color: '#1e293b',
                              margin: '0.25rem 0 0 0'
                            }}>
                              {cdr.agentName || 'N/A'}
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
                              {cdr.callerId || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paginação Moderna */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '2rem',
                    padding: '1rem'
                  }}>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: currentPage === 1 ? '#f3f4f6' : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${currentPage === 1 ? '#d1d5db' : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '0.5rem',
                        color: currentPage === 1 ? '#9ca3af' : '#3b82f6',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
                      Anterior
                    </button>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        const isActive = pageNum === currentPage;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            style={{
                              width: '2.5rem',
                              height: '2.5rem',
                              borderRadius: '0.5rem',
                              border: `1px solid ${isActive ? '#3b82f6' : '#d1d5db'}`,
                              background: isActive ? '#3b82f6' : 'white',
                              color: isActive ? 'white' : '#374151',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: currentPage === totalPages ? '#f3f4f6' : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${currentPage === totalPages ? '#d1d5db' : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '0.5rem',
                        color: currentPage === totalPages ? '#9ca3af' : '#3b82f6',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Próxima
                      <ChevronRight style={{ width: '1rem', height: '1rem' }} />
                    </button>
                    
                    <div style={{
                      marginLeft: '1rem',
                      fontSize: '0.875rem',
                      color: '#64748b'
                    }}>
                      {(() => {
                        const startIdx = (currentPage - 1) * itemsPerPage;
                        return `Mostrando ${total === 0 ? 0 : startIdx + 1} a ${Math.min(startIdx + itemsPerPage, total)} de ${total} resultados`;
                      })()}
                    </div>
                  </div>
                )}

                {records.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#6b7280'
                  }}>
                    <Phone size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <p>Nenhum registro encontrado</p>
                  </div>
                )}
              </>
            )}


            {/* Pagination removida (duplicada) */}
          </div>

          {/* Global CSS Animations */}
          <style jsx global>{`
            @keyframes slideInUp {
              0% {
                opacity: 0;
                transform: translateY(30px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes float {
              0%, 100% {
                transform: translateY(0px) rotate(0deg);
              }
              50% {
                transform: translateY(-20px) rotate(180deg);
              }
            }

            @keyframes shimmer {
              0% {
                background-position: -200% 0;
              }
              100% {
                background-position: 200% 0;
              }
            }

            /* Smooth scrolling */
            html {
              scroll-behavior: smooth;
            }

            /* Custom scrollbar */
            ::-webkit-scrollbar {
              width: 8px;
            }

            ::-webkit-scrollbar-track {
              background: rgba(241, 245, 249, 0.5);
              border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.5);
              border-radius: 4px;
              transition: background 0.2s ease;
            }

            ::-webkit-scrollbar-thumb:hover {
              background: rgba(100, 116, 139, 0.7);
            }

            /* Responsive animations */
            @media (prefers-reduced-motion: reduce) {
              * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
              }
            }
          `}</style>
      </div>
    </MainLayout>
  );
}
