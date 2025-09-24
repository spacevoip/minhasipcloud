'use client';

import { useState, useEffect } from 'react';
import { Filter, X, Calendar, ChevronDown } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'text' | 'number';
  options?: FilterOption[];
  placeholder?: string;
  min?: number;
  max?: number;
}

interface ActiveFilter {
  key: string;
  label: string;
  value: any;
  displayValue: string;
}

interface AdvancedFiltersProps {
  fields: FilterField[];
  onFiltersChange: (filters: Record<string, any>) => void;
  initialFilters?: Record<string, any>;
  className?: string;
}

export function AdvancedFilters({
  fields,
  onFiltersChange,
  initialFilters = {},
  className = ''
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  useEffect(() => {
    updateActiveFilters();
    onFiltersChange(filters);
  }, [filters]);

  const updateActiveFilters = () => {
    const active: ActiveFilter[] = [];
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && 
          (Array.isArray(value) ? value.length > 0 : true)) {
        
        const field = fields.find(f => f.key === key);
        if (!field) return;

        let displayValue = '';
        
        switch (field.type) {
          case 'select':
            const option = field.options?.find(o => o.value === value);
            displayValue = option?.label || value;
            break;
          case 'multiselect':
            const selectedOptions = field.options?.filter(o => value.includes(o.value));
            displayValue = selectedOptions?.map(o => o.label).join(', ') || value.join(', ');
            break;
          case 'daterange':
            if (value.start && value.end) {
              displayValue = `${formatDate(value.start)} - ${formatDate(value.end)}`;
            } else if (value.start) {
              displayValue = `A partir de ${formatDate(value.start)}`;
            } else if (value.end) {
              displayValue = `Até ${formatDate(value.end)}`;
            }
            break;
          case 'date':
            displayValue = formatDate(value);
            break;
          default:
            displayValue = String(value);
        }

        if (displayValue) {
          active.push({
            key,
            label: field.label,
            value,
            displayValue
          });
        }
      }
    });

    setActiveFilters(active);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const removeFilter = (key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const renderFilterField = (field: FilterField) => {
    const value = filters[field.key];

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleFilterChange(field.key, e.target.value || undefined)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              backgroundColor: 'white'
            }}
          >
            <option value="">{field.placeholder || 'Selecione...'}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} {option.count ? `(${option.count})` : ''}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '0.375rem',
            padding: '0.5rem',
            backgroundColor: 'white',
            maxHeight: '120px',
            overflowY: 'auto'
          }}>
            {field.options?.map(option => (
              <label key={option.value} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={(value || []).includes(option.value)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v: string) => v !== option.value);
                    handleFilterChange(field.key, newValues.length > 0 ? newValues : undefined);
                  }}
                />
                {option.label} {option.count ? `(${option.count})` : ''}
              </label>
            ))}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => handleFilterChange(field.key, e.target.value || undefined)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
        );

      case 'daterange':
        return (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="date"
              value={value?.start || ''}
              onChange={(e) => handleFilterChange(field.key, {
                ...value,
                start: e.target.value || undefined
              })}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>até</span>
            <input
              type="date"
              value={value?.end || ''}
              onChange={(e) => handleFilterChange(field.key, {
                ...value,
                end: e.target.value || undefined
              })}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>
        );

      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleFilterChange(field.key, e.target.value || undefined)}
            placeholder={field.placeholder}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleFilterChange(field.key, e.target.value ? Number(e.target.value) : undefined)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={`advanced-filters ${className}`}>
      {/* Filter Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0',
            backgroundColor: activeFilters.length > 0 ? '#f0f9ff' : 'white',
            color: activeFilters.length > 0 ? '#0369a1' : '#374151',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Filter size={16} />
          Filtros
          {activeFilters.length > 0 && (
            <span style={{
              backgroundColor: '#0369a1',
              color: 'white',
              borderRadius: '9999px',
              padding: '0.125rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {activeFilters.length}
            </span>
          )}
          <ChevronDown 
            size={16} 
            style={{ 
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }} 
          />
        </button>

        {activeFilters.length > 0 && (
          <button
            onClick={clearAllFilters}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Limpar Todos
          </button>
        )}
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          {activeFilters.map((filter) => (
            <div
              key={filter.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0.75rem',
                backgroundColor: '#f1f5f9',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                color: '#475569'
              }}
            >
              <span style={{ fontWeight: '500' }}>{filter.label}:</span>
              <span>{filter.displayValue}</span>
              <button
                onClick={() => removeFilter(filter.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: '#cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#cbd5e1';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter Panel */}
      {isOpen && (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
          marginBottom: '1rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            {fields.map((field) => (
              <div key={field.key}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  {field.label}
                </label>
                {renderFilterField(field)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
