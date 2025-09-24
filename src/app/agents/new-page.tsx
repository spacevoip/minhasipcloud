'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useUpdateAgentField, useToggleAgentStatus } from '../../hooks/useAgents';
import { AgentList } from '../../components/agents/AgentList';
import { AgentModal } from '../../components/agents/AgentModal';
import { AgentPanel } from '../../components/agents/AgentPanel';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { Agent } from '../../types';
import { toast } from 'react-hot-toast';

export default function AgentsPageNew() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [panelAgent, setPanelAgent] = useState<Agent | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const itemsPerPage = 10;

  // React Query hooks
  const { 
    data: agentsData, 
    isLoading, 
    error 
  } = useAgents({
    page: currentPage,
    limit: itemsPerPage,
    search: debouncedSearchTerm,
    department: selectedDepartment,
    status: selectedStatus
  });

  const createAgentMutation = useCreateAgent();
  const updateAgentMutation = useUpdateAgent();
  const deleteAgentMutation = useDeleteAgent();
  const updateFieldMutation = useUpdateAgentField();
  const toggleStatusMutation = useToggleAgentStatus();

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDeleteAgent = async (agent: Agent) => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir o agente ${agent.name}?`);
    if (!confirmed) return;

    try {
      await deleteAgentMutation.mutateAsync(agent.id);
    } catch (error) {
      // Error handled by the mutation
    }
  };

  const handleManageAgent = (agent: Agent) => {
    setPanelAgent(agent);
    setShowPanel(true);
  };

  const handleToggleStatus = async (agent: Agent) => {
    try {
      await toggleStatusMutation.mutateAsync(agent);
    } catch (error) {
      // Error handled by the mutation
    }
  };

  const handleSaveAgent = async (agentData: Partial<Agent>) => {
    try {
      if (modalMode === 'create') {
        await createAgentMutation.mutateAsync(agentData);
      } else if (selectedAgent) {
        await updateAgentMutation.mutateAsync({
          id: selectedAgent.id,
          data: agentData
        });
      }
      setShowModal(false);
    } catch (error) {
      // Error handled by the mutations
    }
  };

  const handleUpdateField = async (agent: Agent, field: string, value: string) => {
    try {
      await updateFieldMutation.mutateAsync({ agent, field, value });
    } catch (error) {
      throw error; // Re-throw to handle in component
    }
  };

  const departments = ['Vendas', 'Suporte', 'Financeiro', 'Administrativo', 'Diretoria'];
  const statuses = ['online', 'offline', 'busy', 'away'];

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Acesso negado. Faça login para continuar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes</h1>
          <p className="text-gray-600">Gerencie os agentes do seu sistema PABX</p>
        </div>
        <button
          onClick={handleCreateAgent}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          disabled={createAgentMutation.isPending}
        >
          <Plus className="h-4 w-4" />
          Novo Agente
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500">Total de Agentes</h3>
          <p className="text-2xl font-bold text-gray-900">{agentsData?.total || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500">Online</h3>
          <p className="text-2xl font-bold text-green-600">
            {agentsData?.agents?.filter(a => a.status === 'online').length || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500">Ocupados</h3>
          <p className="text-2xl font-bold text-red-600">
            {agentsData?.agents?.filter(a => a.status === 'busy').length || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500">Offline</h3>
          <p className="text-2xl font-bold text-gray-600">
            {agentsData?.agents?.filter(a => a.status === 'offline').length || 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome, ramal ou departamento..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div className="sm:w-48">
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Departamentos</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:w-32">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">
            Erro ao carregar agentes. Usando dados de fallback.
          </p>
        </div>
      )}

      {/* Agents List */}
      <AgentList
        agents={agentsData?.agents || []}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        totalItems={agentsData?.total || 0}
        onPageChange={handlePageChange}
        onEdit={handleEditAgent}
        onDelete={handleDeleteAgent}
        onManage={handleManageAgent}
        onToggleStatus={handleToggleStatus}
        searchTerm={debouncedSearchTerm}
        isLoading={isLoading}
      />

      {/* Agent Modal */}
      <AgentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveAgent}
        agent={selectedAgent}
        mode={modalMode}
        isLoading={createAgentMutation.isPending || updateAgentMutation.isPending}
      />

      {/* Agent Panel */}
      <AgentPanel
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
        agent={panelAgent}
        onUpdate={handleUpdateField}
        onDelete={handleDeleteAgent}
        onToggleStatus={handleToggleStatus}
        isLoading={updateFieldMutation.isPending}
      />
    </div>
  );
}
