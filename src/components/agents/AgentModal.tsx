import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import { Agent } from '../../types';
import { toast } from 'react-hot-toast';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agent: Partial<Agent>) => Promise<void>;
  agent?: Agent | null;
  mode: 'create' | 'edit';
  isLoading?: boolean;
}

export const AgentModal: React.FC<AgentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  agent,
  mode,
  isLoading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    extension: '',
    password: '',
    callerId: '',
    department: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && agent) {
        setFormData({
          name: agent.name || '',
          extension: agent.extension || '',
          password: agent.password || '',
          callerId: agent.callerId || '',
          department: agent.department || ''
        });
      } else {
        setFormData({
          name: '',
          extension: '',
          password: '',
          callerId: '',
          department: ''
        });
      }
    }
  }, [isOpen, mode, agent]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
    toast.success('Senha gerada automaticamente!');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return false;
    }
    if (!formData.extension.trim()) {
      toast.error('Ramal é obrigatório');
      return false;
    }
    if (!/^\d+$/.test(formData.extension)) {
      toast.error('Ramal deve conter apenas números');
      return false;
    }
    if (!formData.password.trim()) {
      toast.error('Senha é obrigatória');
      return false;
    }
    if (formData.password.length < 4) {
      toast.error('Senha deve ter pelo menos 4 caracteres');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const agentData: Partial<Agent> = {
        ...formData,
        ...(mode === 'edit' && agent ? { id: agent.id } : {})
      };

      await onSave(agentData);
      onClose();
      toast.success(`Agente ${mode === 'create' ? 'criado' : 'atualizado'} com sucesso!`);
    } catch (error) {
      toast.error(`Erro ao ${mode === 'create' ? 'criar' : 'atualizar'} agente`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Novo Agente' : 'Editar Agente'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSaving}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Digite o nome do agente"
              disabled={isSaving}
              required
            />
          </div>

          {/* Ramal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ramal *
            </label>
            <input
              type="text"
              value={formData.extension}
              onChange={(e) => handleInputChange('extension', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: 1001"
              disabled={isSaving || mode === 'edit'}
              required
            />
            {mode === 'edit' && (
              <p className="text-xs text-gray-500 mt-1">
                O ramal não pode ser alterado após a criação
              </p>
            )}
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Digite a senha"
                disabled={isSaving}
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-2 text-gray-400 hover:text-gray-600"
                  disabled={isSaving}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
              disabled={isSaving}
            >
              Gerar senha automática
            </button>
          </div>

          {/* Caller ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caller ID
            </label>
            <input
              type="text"
              value={formData.callerId}
              onChange={(e) => handleInputChange('callerId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: (11) 99999-9999"
              disabled={isSaving}
            />
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departamento
            </label>
            <select
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSaving}
            >
              <option value="">Selecione um departamento</option>
              <option value="Vendas">Vendas</option>
              <option value="Suporte">Suporte</option>
              <option value="Financeiro">Financeiro</option>
              <option value="Administrativo">Administrativo</option>
              <option value="Diretoria">Diretoria</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {mode === 'create' ? 'Criar Agente' : 'Salvar Alterações'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
