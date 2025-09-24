'use client';

import { ReactNode, useState, useEffect } from 'react';

interface CardField {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  fullWidth?: boolean;
}

interface ResponsiveCardProps {
  fields?: CardField[];
  actions?: ReactNode;
  avatar?: ReactNode;
  title?: string | ReactNode;
  subtitle?: string;
  status?: {
    label: string;
    color: string;
    bgColor: string;
  };
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export function ResponsiveCard({
  fields,
  actions,
  avatar,
  title,
  subtitle,
  status,
  onClick,
  className = '',
  children
}: ResponsiveCardProps) {
  return (
    <div
      className={`responsive-card ${className}`}
      style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        marginBottom: '1rem'
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Header */}
      {(avatar || title || subtitle || status) && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            {avatar && (
              <div style={{ flexShrink: 0 }}>
                {avatar}
              </div>
            )}
            
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && (
                <h3 style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {title}
                </h3>
              )}
              
              {subtitle && (
                <p style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.875rem',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          {status && (
            <span style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '500',
              backgroundColor: status.bgColor,
              color: status.color,
              flexShrink: 0
            }}>
              {status.label}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {children ? (
        children
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: actions ? '1rem' : 0
        }}>
          {fields?.map((field, index) => (
            <div
              key={index}
              style={{
                gridColumn: field.fullWidth ? '1 / -1' : 'auto'
              }}
            >
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '500',
                color: '#64748b',
                marginBottom: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {field.label}
              </div>
              
              <div style={{
                fontSize: field.highlight ? '1rem' : '0.875rem',
                fontWeight: field.highlight ? '600' : '500',
                color: field.highlight ? '#1e293b' : '#374151',
                lineHeight: '1.4'
              }}>
                {field.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #f1f5f9'
        }}>
          {actions}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .responsive-card {
            margin-left: -1rem;
            margin-right: -1rem;
            border-radius: 0;
            border-left: none;
            border-right: none;
          }
        }
      `}</style>
    </div>
  );
}

// Hook para detectar se está em mobile
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}

// Componente para container responsivo
interface ResponsiveContainerProps {
  children: ReactNode;
  showTable: boolean;
  emptyState?: ReactNode;
}

export function ResponsiveContainer({ children, showTable, emptyState }: ResponsiveContainerProps) {
  const isMobile = useIsMobile();
  
  return (
    <div>
      {/* Desktop Table */}
      {!isMobile && showTable && (
        <div>
          {children}
        </div>
      )}
      
      {/* Mobile Cards */}
      {isMobile && !showTable && (
        <div>
          {children}
        </div>
      )}
      
      {emptyState && !children && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#64748b'
        }}>
          {emptyState}
        </div>
      )}
    </div>
  );
}
