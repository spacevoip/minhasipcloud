// Utilities for plan date calculations, aligned with backend logic
// Backend (auth-v2.js) computes daysRemaining as the whole-day difference between
// UTC dates using Math.floor and ignoring time-of-day. We replicate that here.

/**
 * Compute days remaining until expiration using UTC midnight boundaries.
 * Matches backend logic used in /api/auth-v2/me and /api/auth-v2/login.
 */
export function computeDaysRemainingUTC(expiresAt?: string | Date | null): number {
  try {
    if (!expiresAt) return 0;
    const end = new Date(expiresAt);
    if (isNaN(end.getTime())) return 0;

    const now = new Date();
    const startUTC = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    const endUTC = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate()
    );
    const diff = Math.floor((endUTC - startUTC) / 86400000);
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}

/**
 * Compute how many full days the plan is past due (expired), using UTC
 * midnight boundaries, mirroring the remaining-days logic.
 */
export function computeDaysExpiredUTC(expiresAt?: string | Date | null): number {
  try {
    if (!expiresAt) return 0;
    const end = new Date(expiresAt);
    if (isNaN(end.getTime())) return 0;

    const now = new Date();
    const startUTC = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );
    const endUTC = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate()
    );
    if (startUTC <= endUTC) return 0;
    const diff = Math.floor((startUTC - endUTC) / 86400000);
    return Math.max(0, diff);
  } catch {
    return 0;
  }
}
