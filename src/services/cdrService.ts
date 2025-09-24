import { CDR } from '@/types';
// Import kept for typing context of auth in app, not used directly here
// We won't call refreshToken from here to avoid TS/private access issues

import { logger } from '@/lib/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface CdrQuery {
  page?: number;
  limit?: number;
  search?: string;
  disposition?: string;
  startDate?: string; // ISO string
  endDate?: string;   // ISO string
  order?: 'asc' | 'desc';
  // When true, asks backend to bypass accountcode filter for diagnostics
  probe?: boolean;
}

export async function deleteCdr(ids: string[]): Promise<number> {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const url = `${API_BASE_URL}/api/cdr`;
  const res = await authorizedFetch(url, {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
  const json = await res.json();
  const deleted = json?.data?.deleted ?? 0;
  return Number(deleted) || 0;
}

export interface CdrResponse {
  success: boolean;
  data: {
    records: unknown[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

interface BackendCdr {
  calldate?: string;
  billsec?: number | string;
  duration?: number | string;
  uniqueid?: string;
  accountcode?: string;
  src?: string;
  dst?: string;
  ui_status?: CDR['status'] | string;
  disposition_raw?: string;
  disposition?: string;
  extension?: string;
  agent_name?: string;
  channel?: string;
  lastdata?: string;
}

function toUiCdr(rowUnknown: unknown): CDR {
  const row = (rowUnknown ?? {}) as BackendCdr;
  // Map backend CDR row to UI CDR type
  const start = row.calldate ? new Date(row.calldate) : new Date();
  const duration = Number(row.billsec ?? row.duration ?? 0);
  const id = String(row.uniqueid || `${row.accountcode || 'acc'}-${row.calldate || Date.now()}-${row.src || ''}-${row.dst || ''}`);
  
  // Detectar se é transferência baseado na coluna lastdata
  const lastdata = String(row.lastdata || '');
  const isTransfer = lastdata.includes('PJSIP/') && 
                    lastdata.includes('sip:') && 
                    lastdata.includes('@') && 
                    !lastdata.includes('@master');
  
  // Mapear origem/destino baseado no tipo de chamada
  let from: string;
  let to: string;
  let callerId: string | undefined;
  
  if (isTransfer) {
    // Para transferências: dst = ramal, src = destino
    from = String(row.dst || '');  // ramal
    to = String(row.src || '');    // destino
    callerId = 'ChamadadeTRANSFERENCIA';
  } else {
    // Chamadas normais
    from = String(row.src || '');
    to = String(row.dst || '');
    callerId = row.src ? String(row.src) : undefined;
  }
  
  // Prefer backend ui_status, else normalize locally
  let status: CDR['status'] = (row.ui_status as CDR['status']) || 'completed';
  const disp = String(row.disposition_raw ?? row.disposition ?? '').toUpperCase().replace(/\s+/g, '_');
  switch (true) {
    case disp === 'ANSWERED':
      status = 'answered';
      break;
    case disp === 'NO_ANSWER' || disp === 'NOANSWER' || disp === 'CANCEL':
      status = 'no_answer';
      break;
    case disp === 'BUSY':
      status = 'busy';
      break;
    case disp === 'FAILED' || disp.includes('FAIL') || disp === 'CONGESTION' || disp === 'CHANUNAVAIL':
      status = 'failed';
      break;
    default:
      status = status || 'completed';
  }

  // Normalize possible localized ui_status to internal enums
  const s = String(status).toLowerCase();
  if (s === 'atendida') status = 'answered' as CDR['status'];

  // Extension: backend provides parsed `extension`; fallback parse from channel/lastdata
  let extension: string | undefined = undefined;
  
  // Primeiro tenta o campo extension direto do backend
  if (row.extension) {
    extension = String(row.extension);
  } else {
    // Fallback: extrair do channel
    if (row.channel) {
      const channelMatch = row.channel.match(/PJSIP\/(\d{3,6})/);
      if (channelMatch) extension = channelMatch[1];
    }
    
    // Fallback adicional: extrair do lastdata para transferências
    if (!extension && lastdata) {
      const lastdataMatch = lastdata.match(/PJSIP\/(\d{3,6})/);
      if (lastdataMatch) extension = lastdataMatch[1];
    }
  }

  const result: CDR = {
    id,
    callId: id,
    from,
    to,
    startTime: start,
    endTime: new Date(start.getTime() + duration * 1000),
    duration,
    status,
    agentId: undefined,
    agentName: row.agent_name ? String(row.agent_name) : undefined,
    extension,
    callerId,
    direction: 'outbound',
    cost: undefined,
  };
  logger.info('[CDR] Mapped row:', { 
    id: result.id, 
    status: result.status, 
    ext: result.extension, 
    agent: result.agentName,
    isTransfer,
    lastdata: lastdata.substring(0, 50) + (lastdata.length > 50 ? '...' : ''),
    from: result.from,
    to: result.to,
    callerId: result.callerId
  });
  return result;
}

async function authorizedFetch(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Force no-cache for real-time CDR
  headers['Cache-Control'] = 'no-store';
  headers['Pragma'] = 'no-cache';

  const res = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (res.status === 401) {
    // Let global auth flow handle token refresh/logout
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    try {
      const data = await res.clone().json();
      const msg = data?.message || data?.error || '';
      throw new Error(`HTTP ${res.status}${msg ? ` - ${msg}` : ''}`);
    } catch {
      throw new Error(`HTTP ${res.status}`);
    }
  }
  return res;
}

export async function getCdr(query: CdrQuery): Promise<{ records: CDR[]; total: number; page: number; totalPages: number; limit: number }>{
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.search) params.set('search', query.search);
  if (query.disposition) params.set('disposition', query.disposition);
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.order) params.set('order', query.order);
  if (query.probe) params.set('probe', '1');
  // Bust caches
  params.set('_ts', String(Date.now()));

  const url = `${API_BASE_URL}/api/cdr?${params.toString()}`;
  logger.info('[CDR] Fetching:', url);
  const res = await authorizedFetch(url);
  const json: CdrResponse = await res.json();
  const rows = (json?.data?.records || []) as unknown[];
  const pagination = json?.data?.pagination || { page: 1, limit: query.limit || 10, total: rows.length, totalPages: 1 };
  logger.info('[CDR] Rows received:', rows.length);
  if (rows.length) {
    const sample = rows.slice(0, 3).map((r) => {
      const row = r as BackendCdr;
      return {
        ui_status: row.ui_status,
        disposition: row.disposition,
        disposition_raw: row.disposition_raw,
        extension: row.extension,
        agent_name: row.agent_name,
        channel: row.channel,
        lastdata: row.lastdata ? row.lastdata.substring(0, 50) + (row.lastdata.length > 50 ? '...' : '') : undefined,
        src: row.src,
        dst: row.dst,
      };
    });
    logger.info('[CDR] Sample rows (up to 3):', sample);
  }

  return {
    records: rows.map(toUiCdr),
    total: pagination.total,
    page: pagination.page,
    totalPages: pagination.totalPages,
    limit: pagination.limit,
  };
}
