/**
 * Componente NotificationDropdown otimizado e memoizado
 * Extraído do main-layout para melhor performance
 */

import React, { memo } from 'react';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  recipient_status: 'read' | 'delivered' | 'pending';
  read_at?: string;
  delivered_at?: string;
  created_at: string;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  notificationCount: number;
  isOpen: boolean;
  isPinned: boolean;
  onTogglePinned: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const NotificationDropdown = memo<NotificationDropdownProps>(({
  notifications,
  notificationCount,
  isOpen,
  isPinned,
  onTogglePinned,
  onMouseEnter,
  onMouseLeave
}) => {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const minutes = Math.floor(diffMs / 60000);
    
    if (minutes < 60) return `${minutes} min`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    
    const days = Math.floor(hours / 24);
    return `${days} d`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'read': return '#94a3b8';
      case 'delivered': return '#10b981';
      default: return '#f59e0b';
    }
  };

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        className="notification-button"
        style={{
          position: 'relative',
          padding: '0.875rem',
          background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.8))',
          border: '1px solid rgba(226, 232, 240, 0.6)',
          borderRadius: '1rem',
          cursor: 'pointer',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.08)',
          width: '3rem',
          height: '3rem',
          transition: 'all 0.2s ease'
        }}
        onClick={onTogglePinned}
        aria-expanded={isPinned || isOpen}
        title={`${notificationCount} notificações pendentes`}
      >
        <Bell style={{ width: '1.25rem', height: '1.25rem' }} />
        {notificationCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '0.125rem',
            right: '0.125rem',
            background: '#ef4444',
            color: 'white',
            borderRadius: '999px',
            padding: '0.125rem 0.375rem',
            fontSize: '0.625rem',
            fontWeight: 700,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            minWidth: '1.25rem',
            textAlign: 'center'
          }}>
            {notificationCount > 99 ? '99+' : notificationCount}
          </div>
        )}
      </button>

      {/* Notification Preview */}
      <div
        className="notification-dropdown"
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          width: '320px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '1rem',
          padding: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          backdropFilter: 'blur(20px)',
          zIndex: 1000,
          opacity: (isPinned || isOpen) ? 1 : 0,
          visibility: (isPinned || isOpen) ? 'visible' : 'hidden',
          transform: (isPinned || isOpen) ? 'translateY(0)' : 'translateY(-10px)',
          pointerEvents: (isPinned || isOpen) ? 'auto' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#1e293b',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>Notificações Recentes</span>
          <span style={{
            fontSize: '0.75rem',
            color: '#64748b',
            background: 'rgba(239, 68, 68, 0.1)',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {notificationCount} novas
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {notifications.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#64748b',
              fontSize: '0.875rem'
            }}>
              Nenhuma notificação recente
            </div>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <div key={notification.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'rgba(248, 250, 252, 0.8)',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                transition: 'background 0.2s ease'
              }}>
                <div style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  background: getStatusColor(notification.recipient_status),
                  flexShrink: 0
                }} />
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#1e293b',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {notification.title}: {notification.message}
                  </div>
                </div>
                
                <div style={{
                  fontSize: '0.625rem',
                  color: '#64748b',
                  flexShrink: 0
                }}>
                  {formatTimeAgo(
                    notification.read_at || 
                    notification.delivered_at || 
                    notification.created_at
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .notification-button:hover {
          background: linear-gradient(135deg, rgba(241, 245, 249, 0.95), rgba(226, 232, 240, 0.9)) !important;
          color: #374151 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.12) !important;
        }
      `}</style>
    </div>
  );
});

NotificationDropdown.displayName = 'NotificationDropdown';

export default NotificationDropdown;
