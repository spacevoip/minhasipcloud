import React, { useMemo, useState } from 'react';
import AgentStatusPill from '@/components/ui/AgentStatusPill';
import { Edit2, Trash2, Settings, Copy, Phone, PhoneOff } from 'lucide-react';
import { Agent } from '../../types';
import { ResponsiveCard } from '../ui/responsive-card';
import { Pagination } from '../ui/pagination';
import { toast } from 'react-hot-toast';

interface AgentListProps {
  agents: Agent[];
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onManage: (agent: Agent) => void;
  onToggleStatus?: (agent: Agent) => void;
  searchTerm?: string;
  isLoading?: boolean;
}

export const AgentList: React.FC<AgentListProps> = ({
  agents,
  currentPage,
  itemsPerPage,
  totalItems,
  onPageChange,
  onEdit,
  onDelete,
  onManage,
  onToggleStatus,
  searchTerm = '',
  isLoading = false
}) => {
  const [editingField, setEditingField] = useState<{ agentId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'bg-green-100 text-green-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      case 'busy':
        return 'bg-red-100 text-red-800';
      case 'away':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch (error) {
      toast.error('Erro ao copiar');
    }
  };

  const handleInlineEdit = (agent: Agent, field: string, currentValue: string) => {
    setEditingField({ agentId: agent.id, field });
    setEditValue(currentValue);
  };

  const handleSaveEdit = async (agent: Agent, field: string) => {
    if (editValue.trim() === '') {
      toast.error('Valor não pode estar vazio');
      return;
    }

    try {
      // Aqui seria a chamada para salvar via React Query
      const updatedAgent = { ...agent, [field]: editValue };
      onEdit(updatedAgent);
      
      setEditingField(null);
      setEditValue('');
      toast.success(`${field === 'name' ? 'Nome' : 'Caller ID'} atualizado!`);
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent, agent: Agent, field: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(agent, field);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const desktopColumns = [
    { key: 'extension', label: 'RAMAL', width: '10%' },
    { key: 'name', label: 'NOME', width: '20%' },
    { key: 'callerId', label: 'CALLER ID', width: '15%' },
    { key: 'department', label: 'DEPARTAMENTO', width: '15%' },
    { key: 'status', label: 'STATUS', width: '10%' },
    { key: 'lastActivity', label: 'ÚLTIMA ATIVIDADE', width: '15%' },
    { key: 'actions', label: 'AÇÕES', width: '15%' }
  ];

  const mobileFields = [
    { 
      key: 'extension', 
      label: 'Ramal', 
      render: (agent: Agent) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-blue-600">{agent.extension}</span>
          <button
            onClick={() => copyToClipboard(agent.extension, 'Ramal')}
            className="text-gray-400 hover:text-gray-600"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )
    },
    { 
      key: 'name', 
      label: 'Nome',
      render: (agent: Agent) => {
        const isEditing = editingField?.agentId === agent.id && editingField?.field === 'name';
        
        if (isEditing) {
          return (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, agent, 'name')}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                autoFocus
              />
              <button
                onClick={() => handleSaveEdit(agent, 'name')}
                className="text-green-600 hover:text-green-800"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          );
        }

        return (
          <span 
            onClick={() => handleInlineEdit(agent, 'name', agent.name)}
            className="cursor-pointer hover:text-blue-600"
          >
            {agent.name}
          </span>
        );
      }
    },
    { 
      key: 'callerId', 
      label: 'Caller ID',
      render: (agent: Agent) => {
        const isEditing = editingField?.agentId === agent.id && editingField?.field === 'callerId';
        
        if (isEditing) {
          return (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyPress(e, agent, 'callerId')}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                autoFocus
              />
              <button
                onClick={() => handleSaveEdit(agent, 'callerId')}
                className="text-green-600 hover:text-green-800"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          );
        }

        return (
          <span 
            onClick={() => handleInlineEdit(agent, 'callerId', agent.callerId || '')}
            className="cursor-pointer hover:text-blue-600"
          >
            {agent.callerId || 'Clique para editar'}
          </span>
        );
      }
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (agent: Agent) => (
        <AgentStatusPill status={agent.status as any} size="sm" showDot />
      )
    }
  ];

  const actions = [
    {
      label: 'Gerenciar',
      icon: Settings,
      onClick: onManage,
      className: 'text-blue-600 hover:text-blue-900'
    },
    {
      label: 'Editar',
      icon: Edit2,
      onClick: onEdit,
      className: 'text-violet-600 hover:text-violet-900'
    },
    {
      label: 'Excluir',
      icon: Trash2,
      onClick: onDelete,
      className: 'text-red-600 hover:text-red-900'
    }
  ];

  if (onToggleStatus) {
    actions.unshift({
      label: 'Toggle Status',
      icon: (agent: Agent) => agent.status === 'online' ? PhoneOff : Phone,
      onClick: onToggleStatus,
      className: (agent: Agent) => agent.status === 'online' 
        ? 'text-red-600 hover:text-red-900' 
        : 'text-green-600 hover:text-green-900'
    });
  }

  const renderDesktopRow = (agent: Agent) => (
    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-blue-600">{agent.extension}</span>
          <button
            onClick={() => copyToClipboard(agent.extension, 'Ramal')}
            className="text-gray-400 hover:text-gray-600"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {editingField?.agentId === agent.id && editingField?.field === 'name' ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, agent, 'name')}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              autoFocus
            />
            <button
              onClick={() => handleSaveEdit(agent, 'name')}
              className="text-green-600 hover:text-green-800"
            >
              ✓
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        ) : (
          <span 
            onClick={() => handleInlineEdit(agent, 'name', agent.name)}
            className="text-sm text-gray-900 cursor-pointer hover:text-blue-600"
          >
            {agent.name}
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {editingField?.agentId === agent.id && editingField?.field === 'callerId' ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, agent, 'callerId')}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="Digite o Caller ID"
              autoFocus
            />
            <button
              onClick={() => handleSaveEdit(agent, 'callerId')}
              className="text-green-600 hover:text-green-800"
            >
              ✓
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        ) : (
          <span 
            onClick={() => handleInlineEdit(agent, 'callerId', agent.callerId || '')}
            className="text-sm text-gray-500 cursor-pointer hover:text-blue-600"
          >
            {agent.callerId || 'Clique para editar'}
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-500">{agent.department || '-'}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <AgentStatusPill status={agent.status as any} size="sm" showDot />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-500">
          {agent.lastActivity ? new Date(agent.lastActivity).toLocaleString('pt-BR') : '-'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          {actions.map((action, index) => {
            const IconComponent = typeof action.icon === 'function' ? action.icon(agent) : action.icon;
            const className = typeof action.className === 'function' ? action.className(agent) : action.className;
            
            return (
              <button
                key={index}
                onClick={() => action.onClick(agent)}
                className={`transition-colors ${className}`}
                title={action.label}
              >
                <IconComponent className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );

  if (isLoading) {
    return (
      <div className="bg-white shadow-md rounded-lg p-8">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveCard
        data={agents}
        columns={desktopColumns}
        mobileFields={mobileFields}
        actions={actions}
        renderDesktopRow={renderDesktopRow}
        searchTerm={searchTerm}
        emptyMessage="Nenhum agente encontrado"
      />

      {totalItems > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / itemsPerPage)}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};
