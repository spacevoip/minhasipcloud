/**
 * Componente PlanStatusCard otimizado e memoizado
 * Extraído do main-layout para melhor performance
 */

import React, { memo } from 'react';
import { TrendingUp } from 'lucide-react';

interface PlanStatusCardProps {
  daysRemaining: number;
  planName: string;
  isLoading: boolean;
}

const PlanStatusCard = memo<PlanStatusCardProps>(({ 
  daysRemaining, 
  planName, 
  isLoading 
}) => {
  // Definir cores baseado nos dias restantes
  const getCardColors = (days: number) => {
    if (days >= 10) {
      // Azul céu claro esfumaçado
      return {
        background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.08), rgba(173, 216, 230, 0.12))',
        border: 'rgba(135, 206, 235, 0.15)',
        shadow: 'rgba(135, 206, 235, 0.1)',
        hoverShadow: 'rgba(135, 206, 235, 0.2)',
        iconBg: 'linear-gradient(135deg, #87ceeb, #add8e6)',
        numberColor: '#4682b4',
        textColor: '#5f9ea0'
      };
    } else if (days >= 5) {
      // Laranja claro esfumaçado
      return {
        background: 'linear-gradient(135deg, rgba(255, 165, 0, 0.08), rgba(255, 140, 0, 0.12))',
        border: 'rgba(255, 165, 0, 0.15)',
        shadow: 'rgba(255, 165, 0, 0.1)',
        hoverShadow: 'rgba(255, 165, 0, 0.2)',
        iconBg: 'linear-gradient(135deg, #ffa500, #ff8c00)',
        numberColor: '#ff8c00',
        textColor: '#ff7f50'
      };
    } else {
      // Vermelho para urgente
      return {
        background: 'linear-gradient(135deg, rgba(245, 101, 101, 0.08), rgba(245, 101, 101, 0.12))',
        border: 'rgba(245, 101, 101, 0.15)',
        shadow: 'rgba(245, 101, 101, 0.1)',
        hoverShadow: 'rgba(245, 101, 101, 0.2)',
        iconBg: 'linear-gradient(135deg, #f56565, #e53e3e)',
        numberColor: '#f56565',
        textColor: '#e53e3e'
      };
    }
  };

  const colors = getCardColors(daysRemaining);

  return (
    <div 
      className="plan-status-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.625rem 1rem',
        background: colors.background,
        borderRadius: '0.75rem',
        border: `1px solid ${colors.border}`,
        boxShadow: `0 2px 4px -1px ${colors.shadow}`,
        fontSize: '0.875rem',
        transition: 'all 0.2s ease',
        cursor: 'default'
      }}
      title={`Dias restantes do ${planName}`}
    >
      <div style={{
        width: '1.75rem',
        height: '1.75rem',
        borderRadius: '0.5rem',
        background: colors.iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <TrendingUp style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ 
          color: colors.numberColor, 
          fontWeight: '600', 
          fontSize: '1rem' 
        }}>
          {isLoading ? '...' : daysRemaining}
        </div>
        <div style={{ 
          color: colors.textColor, 
          fontWeight: '500', 
          fontSize: '0.75rem' 
        }}>
          {daysRemaining < 5 ? 'Renovar Urgente!' : 'Dias restantes'}
        </div>
      </div>

      <style jsx>{`
        .plan-status-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px -2px ${colors.hoverShadow};
        }
      `}</style>
    </div>
  );
});

PlanStatusCard.displayName = 'PlanStatusCard';

export default PlanStatusCard;
