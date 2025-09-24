import React from 'react';

export type PlanPillProps = {
  daysRemaining: number;
  expiresAt?: string | null;
  size?: 'sm' | 'md';
};

/**
 * Small, subtle pill to display remaining days until plan expiration.
 * Colors are aligned with existing palette used in /admin/users.
 */
export const PlanPill: React.FC<PlanPillProps> = ({ daysRemaining, expiresAt, size = 'sm' }) => {
  const isExpired = daysRemaining <= 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 7;

  const styles = (() => {
    if (isExpired) {
      return {
        bg: '#fef2f2',
        border: '#fecaca',
        color: '#ef4444'
      };
    }
    if (isExpiringSoon) {
      return {
        bg: '#fef3c7',
        border: '#fde68a',
        color: '#d97706'
      };
    }
    return {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      color: '#16a34a'
    };
  })();

  const fontSize = size === 'sm' ? '0.75rem' : '0.875rem';
  const padY = size === 'sm' ? '0.25rem' : '0.375rem';
  const padX = size === 'sm' ? '0.75rem' : '0.875rem';

  const title = expiresAt ? `Expira em: ${new Date(expiresAt).toLocaleDateString('pt-BR')}` : undefined;

  return (
    <span
      title={title}
      style={{
        padding: `${padY} ${padX}`,
        borderRadius: '9999px',
        fontSize,
        fontWeight: 500,
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        display: 'inline-flex',
        alignItems: 'center',
        lineHeight: 1
      }}
    >
      {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
    </span>
  );
};

export default PlanPill;
