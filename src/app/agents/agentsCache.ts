// Cache com TTL (5 minutos) para a lista de agentes em /agents
// Exclui status do cache; status é atualizado via polling (extensionStatusService)

import type { Agent } from '@/types';

// Versão cacheada do Agent sem o campo de status
export type CachedAgent = {
  id: string;
  name: string;
  extension: string;
  password?: string;
  callerId?: string;
  department?: string;
  isActive: boolean;
  createdAt: string; // ISO
  lastActivity?: string | null; // ISO ou null
  totalCalls?: number;
  avgDuration?: string;
};

type CacheEnvelope = {
  updatedAt: number; // ms epoch
  data: CachedAgent[];
};

const KEY = 'agents:list:v2';
const TTL_MS = 5 * 60 * 1000; // 5 minutos

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export const agentsCache = {
  get(): CachedAgent[] | null {
    try {
      if (!isBrowser()) return null;
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const env = JSON.parse(raw) as CacheEnvelope;
      if (!env || !Array.isArray(env.data)) return null;
      if (!env.updatedAt || Date.now() - env.updatedAt > TTL_MS) return null; // expirado
      return env.data as CachedAgent[];
    } catch {
      return null;
    }
  },
  set(data: CachedAgent[]) {
    try {
      if (!isBrowser()) return;
      const env: CacheEnvelope = { updatedAt: Date.now(), data };
      window.localStorage.setItem(KEY, JSON.stringify(env));
    } catch {
      // ignore
    }
  },
  invalidate() {
    try {
      if (!isBrowser()) return;
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
};
