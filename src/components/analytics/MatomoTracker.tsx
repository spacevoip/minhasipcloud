"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Matomo SPA route change tracking.
 * This component tracks page views for single-page application navigation.
 */
function MatomoTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Skip first run to avoid double pageview (base snippet tracks initial load)
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    // Track on client route changes (App Router)
    try {
      const w = window as any;
      if (typeof w !== "undefined" && Array.isArray(w._paq)) {
        const url = window.location.href;
        const title = document?.title || "";
        w._paq.push(["setCustomUrl", url]);
        w._paq.push(["setDocumentTitle", title]);
        w._paq.push(["trackPageView"]);
      }
    } catch {
      // no-op
    }
  }, [pathname, searchParams]);

  return null;
}

export default function MatomoTracker() {
  return (
    <Suspense fallback={null}>
      <MatomoTrackerInner />
    </Suspense>
  );
}
