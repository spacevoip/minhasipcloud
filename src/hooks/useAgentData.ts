'use client';

import { useState, useEffect, useCallback } from 'react';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useAgentData() {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // CallerID editing states
  const [editingCallerId, setEditingCallerId] = useState(false);
  const [tempCallerId, setTempCallerId] = useState('');
  const [savingCallerId, setSavingCallerId] = useState(false);

  // Load agent data
  const loadAgentData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await agentAuthService.getCurrentAgent();
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Erro ao carregar dados do agente');
      }
      const data = result.data;
      setAgentData(data);
    } catch (err) {
      console.error('Error loading agent data:', err);
      setError('Erro ao carregar dados do agente');
    } finally {
      setLoading(false);
    }
  }, []);

  // Save CallerID
  const saveCallerId = useCallback(async (newCallerId: string): Promise<boolean> => {
    if (!agentData || !newCallerId.trim()) return false;

    setSavingCallerId(true);
    
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await fetch(`${API_BASE}/api/agents/update-callerid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          agentId: agentData.id,
          callerid: newCallerId.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar CallerID');
      }

      // Update local data
      setAgentData(prev => prev ? { ...prev, callerid: newCallerId.trim() } : null);
      setEditingCallerId(false);
      setTempCallerId('');
      
      return true;
    } catch (error) {
      console.error('Error saving CallerID:', error);
      return false;
    } finally {
      setSavingCallerId(false);
    }
  }, [agentData]);

  // Start editing CallerID
  const startEditingCallerId = useCallback(() => {
    setEditingCallerId(true);
    setTempCallerId(agentData?.callerid || '');
  }, [agentData?.callerid]);

  // Cancel editing CallerID
  const cancelEditingCallerId = useCallback(() => {
    setEditingCallerId(false);
    setTempCallerId('');
  }, []);

  // Load data on mount
  useEffect(() => {
    loadAgentData();
  }, [loadAgentData]);

  // Generate stats data
  const stats = agentData ? [
    {
      title: 'Ramal',
      value: agentData.ramal || 'N/A',
      icon: require('lucide-react').Phone,
      color: '#10b981',
      bgColor: '#10b98115'
    },
    {
      title: 'Status',
      value: 'Online',
      icon: require('lucide-react').Activity,
      color: '#10b981',
      bgColor: '#10b98115'
    },
    {
      title: 'Chamadas Hoje',
      value: '0',
      icon: require('lucide-react').PhoneIncoming,
      color: '#3b82f6',
      bgColor: '#3b82f615'
    },
    {
      title: 'CallerID (BINA)',
      value: agentData.callerid || 'Não definido',
      icon: require('lucide-react').Phone,
      color: '#f59e0b',
      bgColor: '#f59e0b15'
    }
  ] : [];

  return {
    // Data
    agentData,
    loading,
    error,
    stats,
    
    // CallerID editing
    editingCallerId,
    tempCallerId,
    savingCallerId,
    
    // Actions
    loadAgentData,
    saveCallerId,
    startEditingCallerId,
    cancelEditingCallerId,
    setTempCallerId
  };
}
