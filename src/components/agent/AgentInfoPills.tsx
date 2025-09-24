'use client';

import { Phone, Users } from 'lucide-react';

interface AgentInfoPillsProps {
  ramal?: string;
  agentName?: string;
  userName?: string;
}

export function AgentInfoPills({ ramal, agentName, userName }: AgentInfoPillsProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: '12px',
      flexWrap: 'wrap',
      maxWidth: '100%'
    }}>
      {/* Ramal */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          background: '#667eea15',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Phone size={16} color="#667eea" />
        </div>
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '1px'
          }}>
            Ramal
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            {ramal || 'N/A'}
          </div>
        </div>
      </div>

      {/* Nome do Agente */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          background: '#764ba215',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Users size={16} color="#764ba2" />
        </div>
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '1px'
          }}>
            Nome do Agente
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: '700',
            color: '#1e293b',
            whiteSpace: 'nowrap',
            maxWidth: '280px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {agentName || 'N/A'}
          </div>
        </div>
      </div>

      {/* Usuário Master */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          background: '#f59e0b15',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Users size={16} color="#f59e0b" />
        </div>
        <div>
          <div style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '1px'
          }}>
            Usuário Master
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: '700',
            color: '#1e293b',
            whiteSpace: 'nowrap',
            maxWidth: '280px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {userName || 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}
