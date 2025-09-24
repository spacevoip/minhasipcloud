import { useState, useCallback } from 'react';
import { unifiedAuthService } from '@/lib/unifiedAuth';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  baseUrl?: string;
}

export function useApi<T = any>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null
  });

  const request = useCallback(async (endpoint: string, options: ApiOptions = {}) => {
    const {
      method = 'GET',
      body,
      headers = {},
      baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    } = options;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const token = unifiedAuthService.getToken();
      const url = `${baseUrl}${endpoint}`;

      const config: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...headers
        }
      };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setState({ data, loading: false, error: null });
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      throw error;
    }
  }, []);

  const get = useCallback((endpoint: string, options?: Omit<ApiOptions, 'method'>) => 
    request(endpoint, { ...options, method: 'GET' }), [request]);

  const post = useCallback((endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) => 
    request(endpoint, { ...options, method: 'POST', body }), [request]);

  const put = useCallback((endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) => 
    request(endpoint, { ...options, method: 'PUT', body }), [request]);

  const del = useCallback((endpoint: string, options?: Omit<ApiOptions, 'method'>) => 
    request(endpoint, { ...options, method: 'DELETE' }), [request]);

  const patch = useCallback((endpoint: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) => 
    request(endpoint, { ...options, method: 'PATCH', body }), [request]);

  return {
    ...state,
    request,
    get,
    post,
    put,
    delete: del,
    patch
  };
}
