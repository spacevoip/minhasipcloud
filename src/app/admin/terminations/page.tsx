'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Settings, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/components/ui/toast';
import { ResponsiveCard, useIsMobile } from '@/components/ui/responsive-card';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { DataExport } from '@/components/ui/data-export';
import { terminationsService } from '@/lib/terminationsService';

interface Termination {
  id: string;
  name: string;
  provider: string;
  type: 'sip' | 'pstn' | 'voip';
  status: 'active' | 'inactive' | 'maintenance';
  costPerMinute: number;
  maxChannels: number;
  usedChannels: number;
  totalCalls: number;
  totalMinutes: number;
  successRate: number;
  lastUsed: Date;
  country: string;
  priority: number;
}

export default function AdminTerminationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewTerminationModal, setShowNewTerminationModal] = useState(false);
  const [newTermination, setNewTermination] = useState({
    name: '',
    ip: '',
    tech: 'SIP',
    cost: '',
    channels: '',
    type: 'Tronco'
  });

  // Dados reais
  const [terminations, setTerminations] = useState<Termination[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Hooks UX
  const { success, error } = useToast();
  const isMobile = useIsMobile();

  // Busca e filtro
  const filteredTerminations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return terminations.filter(t => {
      const matchesSearch = term === '' ||
        t.name.toLowerCase().includes(term) ||
        t.provider.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [terminations, searchTerm, statusFilter]);

  const { currentPage, totalPages, currentData, goToPage } = usePagination(filteredTerminations, 10);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#64748b';
      case 'maintenance': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'maintenance': return 'Manutenção';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Carregar terminações reais
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const list = await terminationsService.list();
        // Mapear para o shape da UI
        const mapped: Termination[] = list.map((t) => {
          const tarifaNum = t.tarifa != null && !isNaN(Number(t.tarifa)) ? Number(t.tarifa) : 0;
          // Sempre mostrar como Ativo (verde)
          const uiStatus: 'active' | 'inactive' | 'maintenance' = 'active';
          return {
            id: t.id,
            name: t.name,
            provider: t.ip || '—',
            type: 'sip',
            status: uiStatus,
            costPerMinute: tarifaNum,
            maxChannels: 0,
            usedChannels: 0,
            totalCalls: t.stats.total,
            totalMinutes: 0,
            successRate: t.stats.successRate,
            lastUsed: new Date(),
            country: '—',
            priority: 0,
          };
        });
        setTerminations(mapped);
      } catch (e: any) {
        console.error('Erro ao carregar terminações:', e);
        setLoadError(e?.message || 'Falha ao carregar terminações');
        error(e?.message || 'Falha ao carregar terminações');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [error]);

  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh', 
        background: '#f8fafc'
      }}>
        {loading && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            borderRadius: '0.5rem'
          }}>
            Carregando terminações...
          </div>
        )}
        {loadError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '0.5rem'
          }}>
            {loadError}
          </div>
        )}
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
              Gerenciamento de Terminações
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Configure e monitore as rotas de terminação de chamadas
            </p>
          </div>
          
          <button
            onClick={() => setShowNewTerminationModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <Plus style={{ width: '1rem', height: '1rem' }} />
            Nova Terminação
          </button>
        </div>

        {/* Filtros e Busca */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
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
              placeholder="Buscar terminações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              outline: 'none',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '150px'
            }}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="maintenance">Manutenção</option>
          </select>

          <DataExport
            data={filteredTerminations}
            filename="terminacoes"
          />
        </div>

        {/* Lista de Terminações */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {currentData.map((termination) => (
            <ResponsiveCard key={termination.id}>
              <div style={{ padding: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>
                      {termination.name}
                    </h3>
                    <p style={{
                      color: '#64748b',
                      fontSize: '0.875rem'
                    }}>
                      {termination.provider}
                    </p>
                  </div>
                  
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: getStatusColor(termination.status) + '20',
                    color: getStatusColor(termination.status)
                  }}>
                    {getStatusLabel(termination.status)}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginBottom: '0.25rem'
                    }}>
                      Custo por Minuto
                    </p>
                    <p style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#1e293b'
                    }}>
                      {formatCurrency(termination.costPerMinute)}
                    </p>
                  </div>
                  
                  <div>
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginBottom: '0.25rem'
                    }}>
                      Taxa de Sucesso
                    </p>
                    <p style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#10b981'
                    }}>
                      {termination.successRate}%
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    style={{
                      padding: '0.5rem',
                      background: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    <Eye style={{ width: '1rem', height: '1rem' }} />
                  </button>
                  
                  <button
                    style={{
                      padding: '0.5rem',
                      background: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    <Edit style={{ width: '1rem', height: '1rem' }} />
                  </button>
                  
                  <button
                    style={{
                      padding: '0.5rem',
                      background: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      color: '#64748b'
                    }}
                  >
                    <Trash2 style={{ width: '1rem', height: '1rem' }} />
                  </button>
                </div>
              </div>
            </ResponsiveCard>
          ))}
        </div>

        {/* Paginação */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      </div>

      {/* Modal Nova Terminação */}
      {showNewTerminationModal && (
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
            background: 'white',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>Nova Terminação</h2>
              <button
                onClick={() => setShowNewTerminationModal(false)}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={(e) => {
                e.preventDefault();
                success('Terminação criada com sucesso!');
                setShowNewTerminationModal(false);
              }}>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Nome</label>
                    <input
                      type="text"
                      value={newTermination.name}
                      onChange={(e) => setNewTermination({...newTermination, name: e.target.value})}
                      placeholder="Ex: Terminação Brasil Principal"
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>IP</label>
                    <input
                      type="text"
                      value={newTermination.ip}
                      onChange={(e) => setNewTermination({...newTermination, ip: e.target.value})}
                      placeholder="192.168.1.100"
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  marginTop: '2rem'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowNewTerminationModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      color: '#374151',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <Settings style={{ width: '1rem', height: '1rem' }} />
                    Criar Terminação
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
