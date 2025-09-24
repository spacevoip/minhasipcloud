import React from 'react';

export type AgentPresenceStatus = 'online' | 'offline' | 'busy' | 'away' | 'inactive' | 'unregistered';

type AgentStatusPillProps = {
  status?: string; // allow flexible inputs (e.g., "online" | "offline" | ...)
  isOnline?: boolean;
  isActive?: boolean;
  callStatus?: 'idle' | 'ringing' | 'in_call';
  size?: 'sm' | 'md';
  showDot?: boolean;
};

const LABELS: Record<AgentPresenceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Em chamada',
  away: 'Ausente',
  inactive: 'Inativo',
  unregistered: 'Não registrado'
};

const COLORS: Record<AgentPresenceStatus, string> = {
  online: '#10b981',        // green
  offline: '#64748b',       // slate/gray
  busy: '#f59e0b',          // amber/orange (busy in call)
  away: '#d97706',          // darker amber
  inactive: '#6b7280',      // gray (inactive agent)
  unregistered: '#64748b'   // gray
};

function normalizeStatus(
  input?: string,
  flags?: { isOnline?: boolean; isActive?: boolean; callStatus?: 'idle' | 'ringing' | 'in_call' }
): AgentPresenceStatus {
  const raw = (input || '').toLowerCase();
  if (raw === 'online' || raw === 'offline' || raw === 'busy' || raw === 'away' || raw === 'inactive' || raw === 'unregistered') {
    return raw as AgentPresenceStatus;
  }

  const { isOnline, isActive, callStatus } = flags || {};
  if (isActive === false) return 'inactive';
  if (callStatus === 'in_call') return 'busy';
  if (isOnline === true) return 'online';
  if (isOnline === false) return 'offline';
  return 'offline';
}

const AgentStatusPill: React.FC<AgentStatusPillProps> = ({
  status,
  isOnline,
  isActive,
  callStatus,
  size = 'sm',
  showDot = false
}) => {
  const resolved = normalizeStatus(status, { isOnline, isActive, callStatus });
  const color = COLORS[resolved];
  const label = LABELS[resolved];

  const fontSize = size === 'sm' ? '0.75rem' : '0.875rem';
  const padY = size === 'sm' ? '0.25rem' : '0.375rem';
  const padX = size === 'sm' ? '0.75rem' : '0.875rem';

  return (
    <span
      style={{
        padding: `${padY} ${padX}`,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 500,
        backgroundColor: `${color}20`,
        color,
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
        gap: showDot ? '0.375rem' : 0
      }}
    >
      {showDot && (
        <span
          aria-hidden
          style={{
            width: size === 'sm' ? 6 : 8,
            height: size === 'sm' ? 6 : 8,
            borderRadius: '50%',
            backgroundColor: color
          }}
        />
      )}
      {label}
    </span>
  );
};

export default AgentStatusPill;
