'use client';

import { useAgentWebRTC } from '@/contexts/AgentWebRTCContext';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';

interface WebRTCStatusProps {
  showCallActions?: boolean;
}

export function WebRTCStatus({ showCallActions = false }: WebRTCStatusProps) {
  const webrtc = useAgentWebRTC();

  if (!showCallActions) {
    // Simple status indicator
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: webrtc.webrtcRegistered ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${webrtc.webrtcRegistered ? '#bbf7d0' : '#fecaca'}`,
        borderRadius: '8px',
        fontSize: '12px'
      }}>
        {webrtc.webrtcConnecting ? (
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
        ) : webrtc.webrtcRegistered ? (
          <Phone size={16} style={{ color: '#10b981' }} />
        ) : (
          <PhoneOff size={16} style={{ color: '#ef4444' }} />
        )}
        <span style={{
          color: webrtc.webrtcRegistered ? '#065f46' : '#991b1b',
          fontWeight: '500'
        }}>
          WebRTC: {webrtc.webrtcRegistered ? 'Conectado' : webrtc.webrtcConnecting ? 'Conectando...' : 'Desconectado'}
        </span>
      </div>
    );
  }

  // Full call actions interface
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#111827',
          margin: 0
        }}>
          Softphone WebRTC
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {webrtc.webrtcConnecting ? (
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
          ) : webrtc.webrtcRegistered ? (
            <div style={{
              width: '8px',
              height: '8px',
              background: '#10b981',
              borderRadius: '50%'
            }} />
          ) : (
            <div style={{
              width: '8px',
              height: '8px',
              background: '#ef4444',
              borderRadius: '50%'
            }} />
          )}
          <span style={{
            fontSize: '12px',
            color: webrtc.webrtcRegistered ? '#10b981' : '#ef4444',
            fontWeight: '500'
          }}>
            {webrtc.webrtcRegistered ? 'Online' : webrtc.webrtcConnecting ? 'Conectando...' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Call Status */}
      {webrtc.callStatus !== 'idle' && (
        <div style={{
          background: '#f3f4f6',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                {webrtc.callStatus === 'calling' && 'Discando...'}
                {webrtc.callStatus === 'ringing' && 'Tocando...'}
                {webrtc.callStatus === 'connected' && 'Em chamada'}
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#111827'
              }}>
                {webrtc.callTargetNumber || webrtc.callTarget}
              </div>
            </div>
            {webrtc.callStatus === 'connected' && (
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#059669'
              }}>
                {webrtc.formatCallDuration(webrtc.callDuration)}
              </div>
            )}
          </div>

          {/* Call Actions */}
          {webrtc.callStatus === 'connected' && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '12px'
            }}>
              <button
                onClick={webrtc.toggleMute}
                style={{
                  background: webrtc.isMuted ? '#ef4444' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                {webrtc.isMuted ? 'Desmutar' : 'Mutar'}
              </button>
              <button
                onClick={webrtc.hangup}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Desligar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Connection Actions */}
      <div style={{
        display: 'flex',
        gap: '8px'
      }}>
        {!webrtc.webrtcConnected && !webrtc.webrtcConnecting && (
          <button
            onClick={webrtc.connectWebRTC}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Conectar WebRTC
          </button>
        )}
        {webrtc.webrtcConnected && (
          <button
            onClick={webrtc.disconnectWebRTC}
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Desconectar
          </button>
        )}
      </div>
    </div>
  );
}

export default WebRTCStatus;
