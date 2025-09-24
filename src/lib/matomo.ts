// Lightweight Matomo helper for safe client-side tracking

export function matomoPush(args: any[]) {
  try {
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (Array.isArray(w._paq)) {
        w._paq.push(args);
      }
    }
  } catch {}
}

export function setUserId(userId: string) {
  if (!userId) return;
  matomoPush(['setUserId', userId]);
}

export function resetUserId() {
  matomoPush(['resetUserId']);
}

export function trackEvent(category: string, action: string, name?: string, value?: number) {
  const args: any[] = ['trackEvent', category, action];
  if (name !== undefined) args.push(name);
  if (value !== undefined) args.push(value);
  matomoPush(args);
}

export function setCustomDimension(index: number, value: string) {
  // Ensure index is positive integer per Matomo requirements
  if (!Number.isInteger(index) || index <= 0) return;
  if (typeof value !== 'string') return;
  matomoPush(['setCustomDimension', index, value]);
}
