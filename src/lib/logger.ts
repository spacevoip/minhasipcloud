// Lightweight frontend logger gated by env flags
// Usage: import { logger } from '@/lib/logger'
// Set NEXT_PUBLIC_DEBUG=true to enable info/log/warn. Set NEXT_PUBLIC_DEBUG_ERRORS=true to enable error output.

const toBool = (v: string | undefined | null): boolean =>
  typeof v === 'string' && v.trim().toLowerCase() === 'true';

const DEBUG = toBool(process.env.NEXT_PUBLIC_DEBUG);
const DEBUG_ERRORS = toBool(process.env.NEXT_PUBLIC_DEBUG_ERRORS) || DEBUG;

function safeConsole(method: 'log' | 'info' | 'warn' | 'error', ...args: any[]) {
  // Guard against missing console in some environments
  if (typeof console !== 'undefined' && typeof (console as any)[method] === 'function') {
    (console as any)[method](...args);
  }
}

export const logger = {
  log: (...args: any[]) => { if (DEBUG) safeConsole('log', ...args); },
  info: (...args: any[]) => { if (DEBUG) safeConsole('info', ...args); },
  warn: (...args: any[]) => { if (DEBUG) safeConsole('warn', ...args); },
  error: (...args: any[]) => { if (DEBUG_ERRORS) safeConsole('error', ...args); },
};
