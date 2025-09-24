'use client';

import { ReactNode } from 'react';
import { AlertTriangle, Trash2, X, Check } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  icon?: ReactNode;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  isLoading = false,
  icon
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const getTypeConfig = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: '#fee2e2',
          iconColor: '#dc2626',
          confirmBg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          confirmHover: '0 6px 20px rgba(220, 38, 38, 0.4)',
          defaultIcon: <Trash2 size={24} />
        };
      case 'warning':
        return {
          iconBg: '#fef3c7',
          iconColor: '#d97706',
          confirmBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          confirmHover: '0 6px 20px rgba(217, 119, 6, 0.4)',
          defaultIcon: <AlertTriangle size={24} />
        };
      case 'info':
        return {
          iconBg: '#dbeafe',
          iconColor: '#2563eb',
          confirmBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          confirmHover: '0 6px 20px rgba(37, 99, 235, 0.4)',
          defaultIcon: <Check size={24} />
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '1rem',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '400px',
          padding: '1.5rem',
          animation: 'slideInScale 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: config.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              animation: 'pulse 2s infinite'
            }}
          >
            <div style={{ color: config.iconColor }}>
              {icon || config.defaultIcon}
            </div>
          </div>
          
          <h3
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1.25rem',
              fontWeight: '600',
              color: '#1e293b'
            }}
          >
            {title}
          </h3>
          
          <div
            style={{
              color: '#64748b',
              fontSize: '0.875rem',
              lineHeight: '1.5'
            }}
          >
            {message}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#64748b',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#d1d5db';
              }
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              background: config.confirmBg,
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: isLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = config.confirmHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {isLoading && (
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
            )}
            {isLoading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInScale {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// Hook para usar confirmação
export function useConfirmation() {
  const confirm = (options: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>) => {
    return new Promise<boolean>((resolve) => {
      const dialog = document.createElement('div');
      document.body.appendChild(dialog);

      const cleanup = () => {
        document.body.removeChild(dialog);
      };

      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      // Render dialog (this would need React.render in a real implementation)
      // For now, this is a placeholder for the concept
    });
  };

  return { confirm };
}
