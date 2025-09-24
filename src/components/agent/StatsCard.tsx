'use client';

import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  isEditable?: boolean;
  isEditing?: boolean;
  tempValue?: string;
  isSaving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  onTempValueChange?: (value: string) => void;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
  isEditable = false,
  isEditing = false,
  tempValue = '',
  isSaving = false,
  onEdit,
  onSave,
  onCancel,
  onTempValueChange
}: StatsCardProps) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={24} color={color} />
        </div>
        <div>
          <p style={{ 
            fontSize: '14px', 
            color: '#64748b',
            margin: 0,
            marginBottom: '4px'
          }}>
            {title}
          </p>
          {isEditable && isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={tempValue}
                onChange={(e) => onTempValueChange?.(e.target.value)}
                placeholder="Digite o valor"
                style={{
                  flex: 1,
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '14px',
                  color: '#374151',
                  outline: 'none'
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = color)}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#d1d5db')}
              />
              <button
                onClick={onSave}
                disabled={isSaving || !tempValue.trim()}
                style={{
                  background: isSaving || !tempValue.trim() ? '#9ca3af' : color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: isSaving || !tempValue.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={onCancel}
                style={{
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: '#1e293b'
              }}>
                {value}
              </span>
              {isEditable && (
                <button
                  onClick={onEdit}
                  style={{
                    background: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ✏️
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
