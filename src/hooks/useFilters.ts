import { useState, useMemo } from 'react';

export interface FilterConfig<T> {
  key: keyof T;
  type: 'text' | 'select' | 'date' | 'number' | 'boolean';
  label: string;
  options?: Array<{ value: any; label: string }>;
  placeholder?: string;
}

export function useFilters<T extends Record<string, any>>(
  data: T[],
  filterConfigs: FilterConfig<T>[]
) {
  const [filters, setFilters] = useState<Record<string, any>>({});

  const filteredData = useMemo(() => {
    if (Object.keys(filters).length === 0) return data;

    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === '' || value === null || value === undefined) return true;

        const itemValue = item[key];
        const config = filterConfigs.find(c => String(c.key) === key);

        if (!config) return true;

        switch (config.type) {
          case 'text':
            return String(itemValue || '').toLowerCase().includes(String(value).toLowerCase());
          
          case 'select':
            return itemValue === value;
          
          case 'date':
            // Assuming value is a date range or single date
            if (typeof value === 'object' && value.start && value.end) {
              const itemDate = new Date(itemValue);
              return itemDate >= new Date(value.start) && itemDate <= new Date(value.end);
            }
            return new Date(itemValue).toDateString() === new Date(value).toDateString();
          
          case 'number':
            if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
              return Number(itemValue) >= value.min && Number(itemValue) <= value.max;
            }
            return Number(itemValue) === Number(value);
          
          case 'boolean':
            return Boolean(itemValue) === Boolean(value);
          
          default:
            return true;
        }
      });
    });
  }, [data, filters, filterConfigs]);

  const updateFilter = (key: string, value: any) => {
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

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return {
    filteredData,
    filters,
    updateFilter,
    removeFilter,
    clearFilters,
    hasActiveFilters,
    filterConfigs
  };
}
