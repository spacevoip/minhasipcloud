import React, { useState } from 'react';
import AgentStatusPill from '@/components/ui/AgentStatusPill';
import { X, Copy, Eye, EyeOff, Save, Loader2, User, Phone, Settings, Trash2, Power, PowerOff } from 'lucide-react';
import { Agent } from '../../types';
import { toast } from 'react-hot-toast';

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent | null;
  onUpdate: (agent: Agent, field: string, value: string) => Promise<void>;
  onDelete?: (agent: Agent) => Promise<void>;
  onToggleStatus?: (agent: Agent) => Promise<void>;
  isLoading?: boolean;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  isOpen,
  onClose,
  agent,
  onUpdate,
  onDelete,
  onToggleStatus,
  isLoading = false
}) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen || !agent) return null;

  const handleEditStart = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleEditSave = async () => {
    if (!editingField || !agent) return;

    if (editValue.trim() === '') {
      toast.error('Valor não pode estar vazio');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(agent, editingField, editValue.trim());
      setEditingField(null);
      setEditValue('');
      toast.success(`${editingField === 'name' ? 'Nome' : 'Caller ID'} atualizado com sucesso!`);
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
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

  const handleDelete = async () => {
    if (!agent || !onDelete) return;

    const confirmed = window.confirm(`Tem certeza que deseja excluir o agente ${agent.name}?`);
    if (!confirmed) return;

    try {
      await onDelete(agent);
      onClose();
      toast.success('Agente excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir agente');
    }
  };

  const handleToggleStatus = async () => {
    if (!agent || !onToggleStatus) return;

    try {
      await onToggleStatus(agent);
      toast.success(`Status do agente ${agent.status === 'online' ? 'desativado' : 'ativado'}!`);
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            disabled={isUpdating}
          >
            <X className="h-6 w-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
              <p className="text-blue-100">Ramal {agent.extension}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Status Atual</h3>
              <AgentStatusPill status={agent.status as any} size="md" showDot />
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Última Atividade</h3>
              <p className="text-sm text-gray-600">
                {agent.lastActivity ? new Date(agent.lastActivity).toLocaleString('pt-BR') : 'Nunca'}
              </p>
            </div>
          </div>

          {/* Agent Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informações do Agente</h3>
            
            {/* Nome */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
              {editingField === 'name' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    disabled={isUpdating}
                  />
                  <button
                    onClick={handleEditSave}
                    className="text-green-600 hover:text-green-800 disabled:opacity-50"
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="text-red-600 hover:text-red-800"
                    disabled={isUpdating}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span 
                    onClick={() => handleEditStart('name', agent.name)}
                    className="text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {agent.name}
                  </span>
                  <button
                    onClick={() => handleEditStart('name', agent.name)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Caller ID */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Caller ID</label>
              {editingField === 'callerId' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o Caller ID"
                    autoFocus
                    disabled={isUpdating}
                  />
                  <button
                    onClick={handleEditSave}
                    className="text-green-600 hover:text-green-800 disabled:opacity-50"
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="text-red-600 hover:text-red-800"
                    disabled={isUpdating}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span 
                    onClick={() => handleEditStart('callerId', agent.callerId || '')}
                    className="text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {agent.callerId || 'Clique para editar'}
                  </span>
                  <button
                    onClick={() => handleEditStart('callerId', agent.callerId || '')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Ramal */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Ramal</label>
              <div className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">{agent.extension}</span>
                <button
                  onClick={() => copyToClipboard(agent.extension, 'Ramal')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Senha */}
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
              <div className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">
                  {showPassword ? agent.password : '••••••••'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(agent.password || '', 'Senha')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Departamento */}
            {agent.department && (
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                <span className="text-gray-900">{agent.department}</span>
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-700 mb-1">Total de Chamadas</h4>
              <p className="text-2xl font-bold text-blue-900">{agent.totalCalls || 0}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-700 mb-1">Duração Média</h4>
              <p className="text-2xl font-bold text-green-900">{agent.avgDuration || '0m'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {onToggleStatus && (
                <button
                  onClick={handleToggleStatus}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    agent.status === 'online'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {agent.status === 'online' ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  {agent.status === 'online' ? 'Desativar' : 'Ativar'}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
