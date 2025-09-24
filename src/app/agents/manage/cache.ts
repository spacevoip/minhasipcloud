export type AgentCacheEntry<T> = {
  data: T;
  updatedAt: number; // epoch ms
};

const PREFIX = 'agents_manage_cache:';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function makeKey(agentId: string) {
  return `${PREFIX}${agentId}`;
}

export const agentCache = {
  get<T = any>(agentId: string): T | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(makeKey(agentId));
      if (!raw) return null;
      const entry = JSON.parse(raw) as AgentCacheEntry<T>;
      if (!entry || typeof entry !== 'object' || !('data' in entry)) return null;
      return entry.data;
    } catch {
      return null;
    }
  },
  set<T = any>(agentId: string, data: T) {
    if (!isBrowser()) return;
    try {
      const entry: AgentCacheEntry<T> = { data, updatedAt: Date.now() };
      window.localStorage.setItem(makeKey(agentId), JSON.stringify(entry));
    } catch {
      // ignore quota/JSON errors
    }
  },
  invalidate(agentId: string) {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(makeKey(agentId));
    } catch {
      // noop
    }
  }
};
