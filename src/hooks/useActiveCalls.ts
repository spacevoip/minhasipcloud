import { useState, useEffect, useRef } from 'react';
import { authService } from '@/lib/auth';

interface ActiveCall {
  id: string;
  extension: string;
  agentName: string;
  callerNumber: string;
  callerName?: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'talking' | 'hold' | 'transferring';
  duration: number;
  startTime: Date;
  queue?: string;
  destination?: string;
}

export const useActiveCalls = (pollingInterval: number = 5000) => {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: map ARI channel -> ActiveCall
  const mapAriToActiveCall = (ch: any): ActiveCall => {
    const name: string = ch?.name || '';
    const isMasterLeg = name.toLowerCase().includes('master');
    const extMatch = name.match(/^PJSIP\/(.+?)-/i);
    const extension = extMatch ? extMatch[1] : '';

    const callerNumber: string = ch?.caller?.number || '';
    const connectedNumber: string = ch?.connected?.number || '';
    const destination: string = connectedNumber || ch?.dialplan?.exten || '';

    // Direction heuristic
    const direction: 'inbound' | 'outbound' = isMasterLeg ? 'outbound' : 'inbound';

    // Status mapping
    const state: string = (ch?.state || '').toLowerCase();
    let status: ActiveCall['status'] = 'transferring';
    if (state === 'up') status = 'talking';
    else if (state === 'ring' || state === 'ringing') status = 'ringing';
    else if (state === 'hold') status = 'hold';

    const start = ch?.creationtime ? new Date(ch.creationtime) : new Date();
    const duration = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));

    return {
      id: String(ch?.id || name || Math.random()),
      extension,
      agentName: '',
      callerNumber: direction === 'inbound' ? (callerNumber || connectedNumber) : (connectedNumber || callerNumber),
      callerName: '',
      direction,
      status,
      duration,
      startTime: start,
      queue: undefined,
      destination,
    };
  };

  // Fetch from backend with JWT; force filter by logged-in user's id (accountcode)
  const fetchActiveCalls = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const currentUser = typeof window !== 'undefined' ? authService.getCurrentUser() : null;
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('accountcode', String(currentUser.id));
      const url = `http://localhost:3001/api/active-calls?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (!res.ok) {
        console.error('[ActiveCalls] API error:', { status: res.status });
        // Don't clear calls on network errors, keep previous state
        setIsLoading(false);
        return;
      }
      
      const json = await res.json();
      if (json?.success === false) {
        console.error('[ActiveCalls] API returned error:', json);
        setActiveCalls([]);
        setIsLoading(false);
        return;
      }
      
      const userId = currentUser?.id ? String(currentUser.id).trim().toLowerCase() : '';
      const rows = (Array.isArray(json?.data?.records) ? json.data.records : [])
        .filter((ch: any) => {
          if (!userId) return true;
          const acc = String(ch?.accountcode || '').trim().toLowerCase();
          return acc === userId;
        });
      
      // Enhanced filtering with better validation
      const filtered = rows.filter((ch: any) => {
        const name = String(ch?.name || '').toLowerCase();
        // Skip master legs
        if (name.includes('master')) return false;
        // Must be PJSIP channel
        const m = name.match(/^pjsip\/(.+?)-/);
        if (!m) return false;
        // Must be numeric extension (2+ digits)
        const ext = m[1];
        if (!/^\d{2,}$/.test(ext)) return false;
        // Must have valid state
        const state = String(ch?.state || '').toLowerCase();
        if (!state || state === 'down' || state === 'destroyed') return false;
        return true;
      });
      
      const mapped = filtered.map(mapAriToActiveCall);
      
      // Only update if data actually changed to prevent unnecessary re-renders
      setActiveCalls(prevCalls => {
        const prevIds = prevCalls.map((c: ActiveCall) => c.id).sort();
        const newIds = mapped.map((c: ActiveCall) => c.id).sort();
        if (JSON.stringify(prevIds) !== JSON.stringify(newIds)) {
          return mapped;
        }
        // Update durations for existing calls
        return prevCalls.map(prevCall => {
          const updated = mapped.find((newCall: ActiveCall) => newCall.id === prevCall.id);
          return updated || prevCall;
        });
      });
      
      setIsLoading(false);
    } catch (e) {
      console.error('[ActiveCalls] Fetch failed:', e);
      // Don't clear calls on fetch errors, keep previous state
      setIsLoading(false);
    }
  };

  // Polling para buscar chamadas ativas
  useEffect(() => {
    fetchActiveCalls();
    pollingRef.current = setInterval(() => {
      fetchActiveCalls();
    }, pollingInterval);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollingInterval]);

  return {
    activeCalls,
    isLoading,
    refetch: fetchActiveCalls,
    count: activeCalls.length
  };
};

export type { ActiveCall };
