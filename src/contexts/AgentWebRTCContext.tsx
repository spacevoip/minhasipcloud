'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { agentAuthService } from '@/services/agentAuthService';

interface WebRTCConfig {
  domain: string;
  username: string;
  password: string;
  displayName?: string;
}

interface AgentWebRTCContextType {
  // Connection states
  webrtcConnected: boolean;
  webrtcRegistered: boolean;
  webrtcConnecting: boolean;
  
  // Call states
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected';
  callTarget: string;
  callTargetNumber: string;
  callDuration: number;
  isMuted: boolean;
  
  // Recent calls
  recentCalls: Array<{
    number: string;
    status: string;
    duration: number;
    timestamp: Date;
  }>;
  
  // Actions
  connectWebRTC: () => Promise<void>;
  disconnectWebRTC: () => void;
  makeCall: (number: string) => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  formatCallDuration: (seconds: number) => string;
  
  // Config
  webrtcConfig: WebRTCConfig | null;
}

const AgentWebRTCContext = createContext<AgentWebRTCContextType | null>(null);

interface AgentWebRTCProviderProps {
  children: React.ReactNode;
}

export function AgentWebRTCProvider({ children }: AgentWebRTCProviderProps) {
  const [webrtcConfig, setWebrtcConfig] = useState<WebRTCConfig | null>(null);
  const [agentPassword, setAgentPassword] = useState<string>('');
  
  // Initialize WebRTC hook
  const webrtcHook = useWebRTC(webrtcConfig);

  // Initialize WebRTC config when agent data is available
  useEffect(() => {
    const initWebRTCConfig = async () => {
      try {
        if (!agentAuthService.isAuthenticated()) {
          return;
        }

        const agentData = agentAuthService.getStoredAgentData();
        if (!agentData?.ramal) {
          console.warn('🔐 Dados do agente não encontrados');
          return;
        }

        // Fetch agent password from API if not already fetched
        if (!agentPassword) {
          console.log('🔐 Buscando senha do ramal do banco de dados...');
          
          // Get authentication token
          const token = localStorage.getItem('agent_token');
          if (!token) {
            console.error('❌ Token de autenticação não encontrado');
            return;
          }

          const response = await fetch(`/api/agents/ramal/${agentData.ramal}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error('Falha ao buscar dados do ramal');
          }
          
          const data = await response.json();
          const senha = data.senha || data.password || '';
          
          if (senha) {
            console.log('🔐 Senha do ramal obtida do banco de dados');
            setAgentPassword(senha);
            
            // Set WebRTC config
            const config: WebRTCConfig = {
              domain: 'minhasip.cloud',
              username: agentData.ramal,
              password: senha,
              displayName: agentData.nome || `Ramal ${agentData.ramal}`
            };
            
            setWebrtcConfig(config);
            
            console.log('🔐 Configurações WebRTC:', {
              ramal: agentData.ramal,
              uri: `sip:${agentData.ramal}@minhasip.cloud`,
              websocket: 'wss://minhasip.cloud:8089/ws',
              hasPassword: !!senha
            });
          }
        }
      } catch (error) {
        console.error('❌ Erro ao inicializar WebRTC:', error);
      }
    };

    initWebRTCConfig();
  }, [agentPassword]);

  // Auto-connect when config is ready
  useEffect(() => {
    if (webrtcConfig && !webrtcHook.webrtcConnected && !webrtcHook.webrtcConnecting) {
      console.log('🔄 Conectando WebRTC automaticamente...');
      webrtcHook.connectWebRTC();
    }
  }, [webrtcConfig, webrtcHook.webrtcConnected, webrtcHook.webrtcConnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webrtcHook.webrtcConnected) {
        console.log('🔌 Desconectando WebRTC no cleanup...');
        webrtcHook.disconnectWebRTC();
      }
    };
  }, []);

  const contextValue: AgentWebRTCContextType = {
    // Connection states
    webrtcConnected: webrtcHook.webrtcConnected,
    webrtcRegistered: webrtcHook.webrtcRegistered,
    webrtcConnecting: webrtcHook.webrtcConnecting,
    
    // Call states
    callStatus: webrtcHook.callStatus,
    callTarget: webrtcHook.callTarget,
    callTargetNumber: webrtcHook.callTargetNumber,
    callDuration: webrtcHook.callDuration,
    isMuted: webrtcHook.isMuted,
    
    // Recent calls
    recentCalls: webrtcHook.recentCalls,
    
    // Actions
    connectWebRTC: webrtcHook.connectWebRTC,
    disconnectWebRTC: webrtcHook.disconnectWebRTC,
    makeCall: webrtcHook.makeCall,
    hangup: webrtcHook.hangup,
    toggleMute: webrtcHook.toggleMute,
    formatCallDuration: webrtcHook.formatCallDuration,
    
    // Config
    webrtcConfig
  };

  return (
    <AgentWebRTCContext.Provider value={contextValue}>
      {children}
    </AgentWebRTCContext.Provider>
  );
}

export function useAgentWebRTC() {
  const context = useContext(AgentWebRTCContext);
  if (!context) {
    throw new Error('useAgentWebRTC deve ser usado dentro de AgentWebRTCProvider');
  }
  return context;
}

export default AgentWebRTCProvider;
