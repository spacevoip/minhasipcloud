// =====================================================
// BASE SERVICE - Classe base para serviços API
// =====================================================

import { unifiedAuthService } from './unifiedAuth';
import { errorHandler } from './errorHandler';
import { logger } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
}

export abstract class BaseService {
  protected baseUrl: string;
  protected serviceName: string;

  constructor(serviceName: string, baseUrl?: string) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Build request headers with authentication
   */
  protected buildHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const token = unifiedAuthService.getToken();
    
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...customHeaders
    };
  }

  /**
   * Build URL with query parameters
   */
  protected buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Generic request method
   */
  protected async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Preflight: client-side session expiry enforcement (1h absolute)
      if (typeof window !== 'undefined') {
        const expiredHandled = await unifiedAuthService.checkAndHandleExpiry();
        if (expiredHandled) {
          return { success: false, message: 'Sessão expirada' } as ApiResponse<T>;
        }
      }

      const url = this.buildUrl(endpoint, options.params);
      const headers = this.buildHeaders(options.headers);

      const config: RequestInit = {
        method,
        headers,
        ...(options.timeout && { signal: AbortSignal.timeout(options.timeout) })
      };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      logger.info(`[${this.serviceName}] ${method} ${endpoint}`, { body, params: options.params });

      const response = await fetch(url, config);
      // Try to parse JSON; if it fails, fallback to text
      let data: any = null;
      try {
        data = await response.json();
      } catch (_) {
        try {
          const text = await response.text();
          data = { message: text };
        } catch {}
      }

      if (!response.ok) {
        logger.error(`[${this.serviceName}] API Error:`, {
          status: response.status,
          statusText: response.statusText,
          data
        });

        // Handle server-enforced logout or auth errors
        if (response.status === 401) {
          const force = Boolean(data?.forceLogout);
          const msg = data?.message || data?.error || 'Não autorizado';
          try {
            await unifiedAuthService.logout();
          } finally {
            if (typeof window !== 'undefined') {
              try { window.dispatchEvent(new Event('app:force-logout')); } catch {}
              // Only redirect on explicit force or known auth errors
              if (force || /token expirado|token inválido|não autorizado|unauthorized|expired/i.test(msg)) {
                window.location.assign('/login');
              }
            }
          }
        }

        return {
          success: false,
          message: data?.message || data?.error || `HTTP ${response.status}`,
          error: data?.error,
          errors: data?.errors
        };
      }

      logger.info(`[${this.serviceName}] Success:`, data);

      return {
        success: true,
        data: data?.data || data,
        message: data?.message
      };

    } catch (error) {
      const appError = errorHandler.handle(error, {
        component: this.serviceName,
        action: `${method} ${endpoint}`
      });

      return {
        success: false,
        message: appError.userMessage,
        error: appError.message
      };
    }
  }

  /**
   * GET request
   */
  protected async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST request
   */
  protected async post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, body, options);
  }

  /**
   * PUT request
   */
  protected async put<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  /**
   * DELETE request
   */
  protected async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * PATCH request
   */
  protected async patch<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body, options);
  }

  /**
   * Generic CRUD operations
   */
  protected async getAll<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T[]>> {
    return this.get<T[]>(endpoint, { params });
  }

  protected async getById<T>(endpoint: string, id: string | number): Promise<ApiResponse<T>> {
    return this.get<T>(`${endpoint}/${id}`);
  }

  protected async create<T>(endpoint: string, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.post<T>(endpoint, data);
  }

  protected async update<T>(endpoint: string, id: string | number, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.put<T>(`${endpoint}/${id}`, data);
  }

  protected async remove<T>(endpoint: string, id: string | number): Promise<ApiResponse<T>> {
    return this.delete<T>(`${endpoint}/${id}`);
  }

  /**
   * Paginated request
   */
  protected async getPaginated<T>(
    endpoint: string,
    page: number = 1,
    limit: number = 10,
    params?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const response = await this.get<any>(endpoint, {
      params: { page, limit, ...params }
    });

    return {
      ...response,
      pagination: response.data?.pagination
    };
  }

  /**
   * Upload file
   */
  protected async uploadFile(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      const token = unifiedAuthService.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || data.error || `HTTP ${response.status}`,
          error: data.error
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message
      };

    } catch (error) {
      const appError = errorHandler.handle(error, {
        component: this.serviceName,
        action: `uploadFile ${endpoint}`
      });

      return {
        success: false,
        message: appError.userMessage,
        error: appError.message
      };
    }
  }

  /**
   * Batch operations
   */
  protected async batchCreate<T>(endpoint: string, items: Partial<T>[]): Promise<ApiResponse<T[]>> {
    return this.post<T[]>(`${endpoint}/batch`, { items });
  }

  protected async batchUpdate<T>(endpoint: string, updates: Array<{ id: string | number; data: Partial<T> }>): Promise<ApiResponse<T[]>> {
    return this.put<T[]>(`${endpoint}/batch`, { updates });
  }

  protected async batchDelete(endpoint: string, ids: (string | number)[]): Promise<ApiResponse<any>> {
    return this.delete(`${endpoint}/batch`, { params: { ids: ids.join(',') } });
  }
}
