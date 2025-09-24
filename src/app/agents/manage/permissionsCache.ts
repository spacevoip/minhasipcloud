// Simple localStorage-backed cache for user permissions
// Keyed by userId. Stored indefinitely (no TTL) as requested.

export type UserPermissions = { webrtc: boolean; auto_discagem: boolean; sms_send: boolean; up_audio: boolean };

const KEY_PREFIX = 'agents_manage_permissions:';

const safeIsBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export const permissionsCache = {
  get(userId: string): UserPermissions | null {
    try {
      if (!safeIsBrowser()) return null;
      const raw = window.localStorage.getItem(KEY_PREFIX + userId);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data) return null;
      if (
        typeof data.webrtc !== 'boolean' ||
        typeof data.auto_discagem !== 'boolean' ||
        typeof data.sms_send !== 'boolean' ||
        typeof data.up_audio !== 'boolean'
      ) return null;
      return data as UserPermissions;
    } catch {
      return null;
    }
  },
  set(userId: string, perms: UserPermissions) {
    try {
      if (!safeIsBrowser()) return;
      const payload = JSON.stringify({ ...perms, updatedAt: Date.now() });
      window.localStorage.setItem(KEY_PREFIX + userId, payload);
    } catch {
      // ignore
    }
  },
  invalidate(userId: string) {
    try {
      if (!safeIsBrowser()) return;
      window.localStorage.removeItem(KEY_PREFIX + userId);
    } catch {
      // ignore
    }
  }
};
