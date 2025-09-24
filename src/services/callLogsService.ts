import { BaseService, ApiResponse } from '@/lib/baseService';

export type CallDisposition = 'answered' | 'failed' | 'no_answer';

export interface CallLogInput {
  number: string;
  direction?: 'inbound' | 'outbound' | 'unknown';
  started_at: string; // ISO
  ended_at: string;   // ISO
  disposition_en: CallDisposition;
  failure_cause_code?: string | null;
  failure_status_code?: number | null;
  agent_id?: string | null;
  extension?: string | null;
  campaign_id?: string | null;
  contact_id?: string | number | null;
  metadata?: Record<string, any> | null;
  user_agent?: string | null;
  ip_address?: string | null;
}

class CallLogsService extends BaseService {
  constructor() {
    super('callLogsService');
  }

  async logFinalCall(payload: CallLogInput): Promise<ApiResponse<{ id: string; duration_sec: number }>> {
    return this.post<{ id: string; duration_sec: number }>(`/api/call-logs`, payload);
  }
}

export const callLogsService = new CallLogsService();
