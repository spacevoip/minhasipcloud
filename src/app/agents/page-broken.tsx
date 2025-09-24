'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Download,
  Phone,
  PhoneCall,
  Clock,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';

// ✅ HOOKS OTIMIZADOS
import { useDebounce } from '@/hooks/useDebounce';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '@/hooks/useAgentsQuery';
import { useBatchExtensionStatus } from '@/hooks/useBatchExtensionStatus';
import { useAgentsSmartPolling } from '@/hooks/useSmartPolling';
import { 
  useAgents as useAgentsStore, 
  useFilteredAgents, 
  useSelectedAgents, 
  useEditingAgent, 
  useAgentsLoading, 
  useAgentsActions 
} from '@/store/agentsStore';

// ✅ COMPONENTS
import { useToast } from '@/components/ui/toast';
import { ResponsiveCard, useIsMobile } from '@/components/ui/responsive-card';
import { MainLayout } from '@/components/layout/main-layout';
import { PageErrorBoundary } from '@/components/ui/enhanced-error-boundary';

// Agent interface local
interface Agent {
  id: string;
  ramal: string;
  name: string;
  password: string;
  callerid?: string;
  webrtc: boolean;
  blocked: boolean;
  autoDiscagem?: boolean;
  status: 'online' | 'offline' | 'busy' | 'away';
  totalCalls: number;
  todayCalls: number;
  lastActivity: string;
  createdAt: string;
  userId: string;
}

export default function AgentsPageFinal() {
  // ✅ LOCAL STATE (MINIMIZADO)
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    extension: '',
    password: '',
    callerId: ''
  });

  // ✅ HOOKS OTIMIZADOS
  const { success, error } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();
  const canPerformCRUD = authService.canPerformCRUD();
  const { user } = useAuthStore();

  // ✅ ZUSTAND STORE (SELETORES OTIMIZADOS)
  const { agents, filteredAgents } = useAgentsData();
  const { managementPanelAgent } = useAgentsUI();
  const { setSearchTerm: setStoreSearchTerm, setManagementPanelAgent } = useAgentsActions();

  // ✅ REACT QUERY HOOKS
  const { 
    data: queryAgents = [], 
    isLoading: loadingAgents, 
    error: agentsError,
    refetch: refetchAgents 
  } = useAgents();

  const { 
    data: agentsStats, 
    isLoading: loadingStats 
  } = useAgentsStats();

  // ✅ OPTIMISTIC UPDATES
  const {
    createAgent: createAgentOptimistic,
    updateAgent: updateAgentOptimistic,
    deleteAgent: deleteAgentOptimistic,
    isCreating,
    isUpdating,
    isDeleting,
  } = useOptimisticAgents();

  // ✅ BATCH STATUS PROCESSING
  const extensionNumbers = useMemo(() => 
    queryAgents.map(agent => agent.extension).filter(Boolean), 
    [queryAgents]
  );

  const { 
    data: extensionsStatus = {},
    isLoading: loadingStatus,
    getStatusCounts,
    getOnlineExtensions,
    getOfflineExtensions
  } = useBatchExtensionStatus(extensionNumbers, {
    batchSize: 25,
    maxConcurrent: 4,
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 8,
  });

  // ✅ SMART POLLING
  const smartPolling = useAgentsSmartPolling(extensionNumbers);
  const { pausePolling, resumePolling } = useSmartBatchPolling(extensionNumbers);

  // ✅ COMPUTED VALUES (MEMOIZED)
  const searchResults = useMemo(() => {
    if (!debouncedSearchTerm) return queryAgents;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return queryAgents.filter(agent => 
      agent.name.toLowerCase().includes(searchLower) ||
      agent.extension.includes(searchLower) ||
      (agent.callerId && agent.callerId.toLowerCase().includes(searchLower)) ||
      (agent.department && agent.department.toLowerCase().includes(searchLower))
    );
  }, [queryAgents, debouncedSearchTerm]);

  const statusCounts = useMemo(() => {
    return getStatusCounts();
  }, [getStatusCounts]);

  // ✅ PAGINATION
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedAgents,
    goToPage,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev
  } = usePagination(searchResults, 10);

  // ✅ HANDLERS OTIMIZADOS
  const handleCreateAgent = useCallback(async () => {
    if (!newAgent.name || !newAgent.extension || !newAgent.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const createData: CreateAgentData = {
      name: newAgent.name,
      extension: newAgent.extension,
      password: newAgent.password,
      callerId: newAgent.callerId || undefined,
      userId: user?.id
    };

    try {
      await createAgentOptimistic(createData);
      setNewAgent({ name: '', extension: '', password: '', callerId: '' });
      setShowNewAgentModal(false);
    } catch (error) {
      console.error('Erro ao criar agente:', error);
    }
  }, [newAgent, createAgentOptimistic, user?.id]);

  const handleUpdateAgent = useCallback(async (id: string, data: Partial<Agent>) => {
    try {
      await updateAgentOptimistic({ id, data });
    } catch (error) {
      console.error('Erro ao atualizar agente:', error);
    }
  }, [updateAgentOptimistic]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    
    try {
      await deleteAgentOptimistic(id);
    } catch (error) {
      console.error('Erro ao excluir agente:', error);
    }
  }, [deleteAgentOptimistic]);

  // ✅ UTILITY FUNCTIONS
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }, []);

  const getStatusBadge = useCallback((extension: string) => {
    const status = extensionsStatus[extension] || 'offline';
    const isOnline = status === 'online' || status === 'registered';
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isOnline 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        <div className={`w-2 h-2 rounded-full mr-1 ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    );
  }, [extensionsStatus]);

  // ✅ LOADING STATES
  if (loadingAgents) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Carregando agentes...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ✅ ERROR STATE
  if (agentsError) {
    return (
      <MainLayout>
        <PageErrorBoundary>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center space-y-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <p className="text-red-600">Erro ao carregar agentes</p>
              <button 
                onClick={() => refetchAgents()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </PageErrorBoundary>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageErrorBoundary>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                Agentes
                <span className="text-sm font-normal text-gray-500">
                  ({queryAgents.length} total)
                </span>
              </h1>
              <p className="text-gray-600 mt-1">
                Sistema otimizado com React Query + Zustand + Batch Processing
              </p>
            </div>
            
            {canPerformCRUD && (
              <button
                onClick={() => setShowNewAgentModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={isCreating}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isCreating ? 'Criando...' : 'Novo Agente'}
              </button>
            )}
          </div>

          {/* Stats Cards Otimizados */}
          <ComponentErrorBoundary>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {queryAgents.length}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Online</p>
                    <p className="text-2xl font-bold text-green-600">
                      {loadingStatus ? '...' : statusCounts.online}
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Offline</p>
                    <p className="text-2xl font-bold text-red-600">
                      {loadingStatus ? '...' : statusCounts.offline}
                    </p>
                  </div>
                  <UserX className="h-8 w-8 text-red-600" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Performance</p>
                    <p className="text-sm font-bold text-blue-600">
                      ⚡ Otimizado
                    </p>
                    <p className="text-xs text-gray-500">
                      Batch + Cache + Optimistic
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </div>
          </ComponentErrorBoundary>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar agentes... (otimizado com debounce)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => refetchAgents()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loadingAgents}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingAgents ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              
              <button
                onClick={() => smartPolling.isActive ? smartPolling.pause() : smartPolling.start()}
                className={`inline-flex items-center px-3 py-2 rounded-lg transition-colors ${
                  smartPolling.isActive 
                    ? 'bg-green-100 text-green-700 border border-green-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                {smartPolling.isActive ? 'Pausar Polling' : 'Iniciar Polling'}
              </button>
              
              <DataExport
                data={searchResults}
                filename="agentes-otimizados"
                columns={[
                  { key: 'name', label: 'Nome' },
                  { key: 'extension', label: 'Ramal' },
                  { key: 'callerId', label: 'Caller ID' },
                  { key: 'department', label: 'Departamento' }
                ]}
              />
            </div>
          </div>

          {/* Performance Indicators */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-blue-700">
                  <strong>Cache:</strong> {smartPolling.isActive ? '🟢 Ativo' : '🔴 Inativo'}
                </span>
                <span className="text-blue-700">
                  <strong>Polling:</strong> {smartPolling.currentInterval}ms
                </span>
                <span className="text-blue-700">
                  <strong>Batch Size:</strong> 25 extensões
                </span>
                <span className="text-blue-700">
                  <strong>Última Atualização:</strong> {new Date().toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* Agents List */}
          <ComponentErrorBoundary>
            {isMobile ? (
              // Mobile Cards
              <div className="space-y-4">
                {paginatedAgents.map((agent) => (
                  <ResponsiveCard key={agent.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          {getStatusBadge(agent.extension)}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Ramal: {agent.extension}</p>
                          {agent.callerId && <p>Caller ID: {agent.callerId}</p>}
                          <p>Departamento: {agent.department || 'Geral'}</p>
                        </div>
                      </div>
                      
                      {canPerformCRUD && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setManagementPanelAgent(agent)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            disabled={isDeleting(agent.id)}
                          >
                            {isDeleting(agent.id) ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </ResponsiveCard>
                ))}
              </div>
            ) : (
              // Desktop Table
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Agente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ramal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status (Real-time)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Caller ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Departamento
                        </th>
                        {canPerformCRUD && (
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ações
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-blue-600" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {agent.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900">{agent.extension}</span>
                              <button
                                onClick={() => copyToClipboard(agent.extension, 'Ramal')}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(agent.extension)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {agent.callerId || 'Não definido'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {agent.department || 'Geral'}
                          </td>
                          {canPerformCRUD && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setManagementPanelAgent(agent)}
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <Settings className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="text-red-600 hover:text-red-800 transition-colors"
                                  disabled={isDeleting(agent.id)}
                                >
                                  {isDeleting(agent.id) ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ComponentErrorBoundary>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              onNext={nextPage}
              onPrev={prevPage}
              canGoNext={canGoNext}
              canGoPrev={canGoPrev}
            />
          )}
        </div>
      </PageErrorBoundary>
    </MainLayout>
  );
}
