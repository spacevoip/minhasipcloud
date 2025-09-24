/**
 * Sistema de Cache Profissional com TTL
 * Otimizado para dados de planos e usuários que mudam raramente
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
}

class ProfessionalCache {
  private cache = new Map<string, CacheItem<any>>();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutos padrão
      maxSize: 100,
      cleanupInterval: 60 * 1000, // Limpeza a cada 1 minuto
      ...config
    };

    this.startCleanup();
  }

  /**
   * Armazena dados no cache com TTL personalizado
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL
    };

    // Remove item mais antigo se exceder tamanho máximo
    if (this.cache.size >= this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, item);
  }

  /**
   * Recupera dados do cache se ainda válidos
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > item.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Verifica se uma chave existe e está válida
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove item específico do cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove itens expirados
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Inicia limpeza automática
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Para limpeza automática
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  /**
   * Estatísticas do cache
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      defaultTTL: this.config.defaultTTL
    };
  }
}

// Instância global do cache
export const layoutCache = new ProfessionalCache({
  defaultTTL: 10 * 60 * 1000, // 10 minutos para dados de layout
  maxSize: 50,
  cleanupInterval: 2 * 60 * 1000 // Limpeza a cada 2 minutos
});

// TTLs específicos para diferentes tipos de dados
export const CACHE_KEYS = {
  USER_DATA: 'user_data',
  PLAN_DATA: 'plan_data',
  NOTIFICATIONS: 'notifications',
  EXTENSION_STATUS: 'extension_status'
} as const;

export const CACHE_TTL = {
  USER_DATA: 15 * 60 * 1000, // 15 minutos - dados do usuário mudam raramente
  PLAN_DATA: 30 * 60 * 1000, // 30 minutos - planos mudam muito raramente
  NOTIFICATIONS: 2 * 60 * 1000, // 2 minutos - notificações precisam ser atuais
  EXTENSION_STATUS: 30 * 1000 // 30 segundos - status de ramais muda frequentemente
} as const;

/**
 * Hook para cache com invalidação automática
 */
export const useCachedData = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
) => {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchData = React.useCallback(async (forceRefresh = false) => {
    // Verifica cache primeiro
    if (!forceRefresh) {
      const cached = layoutCache.get<T>(key);
      if (cached) {
        setData(cached);
        return cached;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      layoutCache.set(key, result, ttl);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    invalidate: () => layoutCache.delete(key)
  };
};

export default layoutCache;
