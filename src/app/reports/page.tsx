'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Download, User, PhoneCall, TrendingUp, BarChart3 } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { getCdr } from '@/services/cdrService';

interface AgentReport {
  agentId: string;
  agentName: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  efficiency: number;
  averageDuration: number; // seconds
  extension?: string;
}

// Toast notification inline
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; 
    background: ${type === 'success' ? '#10b981' : '#ef4444'}; 
    color: white; padding: 12px 24px; border-radius: 8px; 
    z-index: 1000; font-weight: 500; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;
  toast.textContent = `${type === 'success' ? '✅' : '❌'} ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => document.body.removeChild(toast), 3000);
};

export default function ReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load recent CDR and aggregate per agent
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        // Default: últimos 7 dias
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Paginate to collect up to a reasonable cap
        const pageLimit = 200; // backend max
        let page = 1;
        const cap = 2000; // safety cap
        const aggregated: Record<string, { name: string; total: number; answered: number; durationSum: number; extCount: Record<string, number> }>= {};
        let fetched = 0;
        let total = 0;
        do {
          const { records, total: t, totalPages } = await getCdr({
            page,
            limit: pageLimit,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            order: 'desc',
          });
          total = t || total;
          fetched += records.length;
          for (const r of records) {
            const key = (r.agentName?.trim() || r.extension || r.from || 'Desconhecido').toString();
            const name = r.agentName?.trim() || r.extension || r.from || 'Desconhecido';
            if (!aggregated[key]) aggregated[key] = { name, total: 0, answered: 0, durationSum: 0, extCount: {} };
            aggregated[key].total += 1;
            if (r.status === 'answered') aggregated[key].answered += 1;
            aggregated[key].durationSum += Number(r.duration || 0);
            const ext = (r.extension || '').toString();
            if (ext) {
              aggregated[key].extCount[ext] = (aggregated[key].extCount[ext] || 0) + 1;
            }
          }
          page += 1;
          if (fetched >= cap) break;
          if (records.length === 0) break;
          if (page > totalPages) break;
        } while (true);

        if (cancelled) return;
        const result: AgentReport[] = Object.entries(aggregated).map(([id, v]) => {
          const missed = Math.max(0, v.total - v.answered);
          const eff = v.total > 0 ? Math.round((v.answered / v.total) * 100) : 0;
          const avg = v.total > 0 ? Math.round(v.durationSum / v.total) : 0;
          // pick most frequent extension if any
          let ext: string | undefined = undefined;
          const entries = Object.entries(v.extCount);
          if (entries.length) {
            entries.sort((a, b) => b[1] - a[1]);
            ext = entries[0][0];
          }
          return {
            agentId: id,
            agentName: v.name,
            totalCalls: v.total,
            answeredCalls: v.answered,
            missedCalls: missed,
            efficiency: eff,
            averageDuration: avg,
            extension: ext,
          };
        });
        setReports(result);
      } catch (e: any) {
        console.error('[Reports] Failed to load CDR:', e);
        setError(e?.message || 'Falha ao carregar relatórios');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredReports = useMemo(() =>
    reports.filter(r => r.agentName.toLowerCase().includes(searchTerm.toLowerCase())),
  [reports, searchTerm]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return '#10b981';
    if (efficiency >= 80) return '#f59e0b';
    return '#ef4444';
  };

  const exportData = () => {
    try {
      const csvContent = [
        ['Agente', 'Ramal', 'Total Chamadas', 'Atendidas', 'Perdidas', 'Eficiência (%)', 'Duração Média'].join(','),
        ...filteredReports.map(report => [
          report.agentName,
          report.extension || '',
          report.totalCalls,
          report.answeredCalls,
          report.missedCalls,
          report.efficiency,
          formatDuration(report.averageDuration)
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-agentes.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Relatório exportado com sucesso!');
    } catch (error) {
      showToast('Erro ao exportar relatório', 'error');
    }
  };

  return (
    <MainLayout>
      <div style={{ padding: '2rem', minHeight: '100vh', background: '#f8fafc' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Relatórios</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Análise de performance dos agentes</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', width: '1rem', height: '1rem' }} />
              <input
                type="text"
                placeholder="Buscar agente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem',
                  border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem',
                  width: '250px', outline: 'none', transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            
            <button
              onClick={exportData}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white',
                border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500',
                cursor: 'pointer', transition: 'all 0.2s ease'
              }}
            >
              <Download style={{ width: '1rem', height: '1rem' }} />
              Exportar
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <User style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', margin: 0 }}>Total de Agentes</h3>
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{reports.length}</p>
          </div>
          
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <PhoneCall style={{ width: '1.25rem', height: '1.25rem', color: '#10b981' }} />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', margin: 0 }}>Chamadas Totais</h3>
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{reports.reduce((acc, report) => acc + report.totalCalls, 0)}</p>
          </div>
          
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <TrendingUp style={{ width: '1.25rem', height: '1.25rem', color: '#f59e0b' }} />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', margin: 0 }}>Eficiência Média</h3>
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', margin: 0 }}>{Math.round(reports.reduce((acc, report) => acc + report.efficiency, 0) / reports.length)}%</p>
          </div>
          
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <BarChart3 style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', margin: 0 }}>Chamadas Atendidas</h3>
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>{reports.reduce((acc, report) => acc + report.answeredCalls, 0)}</p>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Relatório Detalhado</h3>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Agente</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Ramal</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Chamadas</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Atendidas</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Perdidas</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Eficiência</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Duração</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#e5e7eb' }} />
                        <div className="shimmer" style={{ width: '140px', height: '12px', borderRadius: '6px', background: '#e5e7eb' }} />
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div className="shimmer" style={{ width: '64px', height: '12px', borderRadius: '6px', background: '#e5e7eb' }} />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div className="shimmer" style={{ width: '48px', height: '12px', borderRadius: '6px', background: '#e5e7eb' }} />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div className="shimmer" style={{ width: '48px', height: '12px', borderRadius: '6px', background: '#e5e7eb' }} />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div className="shimmer" style={{ width: '72px', height: '12px', borderRadius: '6px', background: '#e5e7eb' }} />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div className="shimmer" style={{ width: '64px', height: '12px', borderRadius: '6px', background: '#e5e7eb' }} />
                    </td>
                  </tr>
                ))
              )}
              {!loading && filteredReports.sort((a, b) => b.efficiency - a.efficiency).map((report, index) => (
                <tr key={`${report.agentName}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {report.agentName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span style={{ fontWeight: '500', color: '#1e293b' }}>{report.agentName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#374151' }}>{report.extension || '-'}</td>
                  <td style={{ padding: '0.75rem', color: '#374151' }}>{report.totalCalls}</td>
                  <td style={{ padding: '0.75rem', color: '#10b981', fontWeight: '500' }}>{report.answeredCalls}</td>
                  <td style={{ padding: '0.75rem', color: '#ef4444', fontWeight: '500' }}>{report.missedCalls}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '500', backgroundColor: `${getEfficiencyColor(report.efficiency)}20`, color: getEfficiencyColor(report.efficiency) }}>
                      {report.efficiency}%
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#374151' }}>{formatDuration(report.averageDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Shimmer animation style */}
          <style>{`
            .shimmer {
              position: relative;
              overflow: hidden;
            }
            .shimmer::after {
              content: '';
              position: absolute;
              top: 0; left: -150%;
              height: 100%; width: 150%;
              background: linear-gradient(90deg, rgba(229,231,235,0) 0%, rgba(255,255,255,0.6) 50%, rgba(229,231,235,0) 100%);
              animation: shimmer 1.2s infinite;
            }
            @keyframes shimmer {
              0% { left: -150%; }
              100% { left: 100%; }
            }
          `}</style>
          {loading && (
            <div style={{ padding: '1rem', color: '#64748b' }}>Carregando dados reais...</div>
          )}
          {error && (
            <div style={{ padding: '1rem', color: '#ef4444' }}>Erro: {error}</div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
