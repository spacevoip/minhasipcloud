import React from 'react';
import { getStatusColor, getStatusLabel, type UserStatus } from '@/lib/statusHelpers';

export type StatusPillProps = {
  status: UserStatus;
  size?: 'sm' | 'md';
};

/**
 * Small pill for user status. Colors/label come from statusHelpers to keep consistency.
 */
const StatusPill: React.FC<StatusPillProps> = ({ status, size = 'sm' }) => {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

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
        backgroundColor: `${color}20`, // subtle tinted background
        color,
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
};

export default StatusPill;
