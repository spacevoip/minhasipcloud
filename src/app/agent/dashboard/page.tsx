'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Auto Dialer Buffer Controls
const AUTO_BUFFER_TARGET = 20; // manter sempre ~20 contatos no buffer
const AUTO_MAX_TOPUP_PER_ROUND = 20; // máximo buscado por rodada de reabastecimento
// Novo modelo: fila ativa de 50 + buffer em memória de 50 com low watermark de 20
const ACTIVE_QUEUE_TARGET = 50;
const MEMORY_BUFFER_TARGET = 50;
const MEMORY_LOW_WATERMARK = 20;
import { 
  Phone, 
  PhoneCall, 
  PhoneOff,
  Lock,
  Pause,
  Mic,
  MicOff,
  Clock, 
  TrendingUp,
  Activity,
  Users,
  BarChart3,
  PhoneIncoming,
  PhoneOutgoing,
  ArrowLeft,
  Volume2,
  Play,
  ArrowRightLeft,
  PhoneForwarded,
  Settings,
  StopCircle,
  Edit,
  Save,
  X,
  Eye,
  ChevronLeft,
  Music,
  Square,
  ChevronRight,
  Loader2,
  Trash2,
  Download,
  Hash,
  Star
} from 'lucide-react';
import { AgentLayout } from '@/components/layout/agent-layout';
import { TransferCallModal } from '@/components/modals/TransferCallModal';
import { StatsCard } from '@/components/agent/StatsCard';
import { AgentInfoPills } from '@/components/agent/AgentInfoPills';
import { CallStatusOverlay } from '@/components/agent/CallStatusOverlay';
import { DialerKeypad } from '@/components/agent/DialerKeypad';
import { RecentCallsList } from '@/components/agent/RecentCallsList';
import { FloatingSMSButton } from '@/components/sms/FloatingSMSButton';
// Custom hooks temporarily disabled due to variable conflicts
// import { useAgentData } from '@/hooks/useAgentData';
// import { useToast } from '@/hooks/useToast';
import { useActiveCallsOptimized, ActiveCall as OptimizedActiveCall } from '@/hooks/useActiveCallsOptimized';
import { workSessionsService, type WorkSession, type WorkBreak } from '@/services/workSessionsService';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';
import { authService } from '@/lib/auth';
import { unifiedAuthService } from '@/lib/unifiedAuth';
import { userRealtimeService } from '@/services/userRealtimeService';
import supabase from '@/lib/supabase';
import { agentsRealtimeService } from '@/services/agentsRealtimeService';
import { classificationService } from '@/services/classificationService';
import { callLogsService } from '@/services/callLogsService';

// Realtime via cliente centralizado (config via env em src/lib/supabase)

export default function AgentDashboard() {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [agentCampaigns, setAgentCampaigns] = useState<Array<{id: string, name: string, total: number, total_discados?: number, discados?: number}>>([]);
  const [dashboardConfig, setDashboardConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  
  // Usar hook otimizado para chamadas ativas (substitui o polling manual)
  const { activeCalls: optimizedActiveCalls, isLoading: loadingCalls, refetch: refetchActiveCalls } = useActiveCallsOptimized('/agent/dashboard', 5000);
  
  // Estado local para chamadas ativas (lógica limpa como /active-calls)
  const [localCalls, setLocalCalls] = useState<ActiveCall[]>([]);
  
  // Estados para filtros (como /active-calls)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Sincronização direta com optimizedActiveCalls (sem anti-flicker complexo)
  useEffect(() => {
    const mappedCalls = optimizedActiveCalls.map((call: OptimizedActiveCall) => ({
      id: call.id,
      callerid: call.callerNumber || 'Desconhecido',
      destination: call.destination || 'Desconhecido',
      duration: call.duration,
      status: call.status,
      startTime: call.startTime,
      extension: call.extension
    }));
    
    setLocalCalls(mappedCalls);
  }, [optimizedActiveCalls]);

  // Filtrar chamadas baseado na busca e filtros (como /active-calls) - OTIMIZADO com useMemo
  const filteredCalls = useMemo(() => {
    console.log(`[SECURITY] Filtrando ${localCalls.length} chamadas para ramal ${agentData?.ramal}`);
    
    return localCalls.filter(call => {
      // Filtro de busca
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const extension = call.extension?.toLowerCase() || '';
        const callerNumber = call.callerid?.toLowerCase() || '';
        const destination = call.destination?.toLowerCase() || '';
        
        if (!extension.includes(query) && 
            !callerNumber.includes(query) && 
            !destination.includes(query)) {
          return false;
        }
      }
      
      // Filtro de status
      if (statusFilter !== 'all' && call.status !== statusFilter) {
        return false;
      }
      
      // 🛡️ FILTRO SEGURO: Apenas chamadas do ramal específico do agente
      if (agentData?.ramal) {
        const agentExtension = String(agentData.ramal).trim();
        const callExtension = String(call.extension || '').trim();
        
        // Filtro rigoroso: deve ser exatamente o ramal do agente
        if (callExtension !== agentExtension) {
          console.log(`[SECURITY] Chamada filtrada: ${callExtension} !== ${agentExtension}`);
          return false;
        }
        
        // Filtro adicional: verificar se a chamada realmente pertence ao contexto do agente
        // O backend já filtra por accountcode (user_id), este é um filtro de segurança extra
      }
      
      return true;
    }).filter((call, index, array) => {
      // Log final do resultado da filtragem
      if (index === array.length - 1) {
        console.log(`[SECURITY] ✅ Resultado: ${array.length} chamadas aprovadas para ramal ${agentData?.ramal}`);
        array.forEach((c, i) => {
          console.log(`[SECURITY] Chamada ${i + 1}: extension=${c.extension}, caller=${c.callerid}, destination=${c.destination}`);
        });
      }
      return true;
    });
  }, [localCalls, searchQuery, statusFilter, agentData?.ramal]);
  
  const [extensionStatus, setExtensionStatus] = useState<'online' | 'offline'>('offline');
  const [callStats, setCallStats] = useState({ today: 0, total: 0 });
  const [dialNumber, setDialNumber] = useState('');
  
  // WebRTC states
  const [webrtcConnected, setWebrtcConnected] = useState(false);
  const [webrtcRegistered, setWebrtcRegistered] = useState(false);
  const [webrtcUA, setWebrtcUA] = useState<any>(null);
  const [webrtcSession, setWebrtcSession] = useState<any>(null);
  const [webrtcConnecting, setWebrtcConnecting] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [callTarget, setCallTarget] = useState('');
  const [callTargetNumber, setCallTargetNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [recentCalls, setRecentCalls] = useState<Array<{number: string, status: string, duration: number, timestamp: Date}>>([]);
  const [showRecentCalls, setShowRecentCalls] = useState(false);
  interface ActiveCall {
    id: string;
    callerid: string;
    destination: string;
    duration: number; // Changed to number for real-time calculation
    status: string;
    startTime: Date;
    extension?: string;
    muted?: boolean;
  }
  
  const [managingCall, setManagingCall] = useState<string | null>(null);
  const [dtmfCapturing, setDtmfCapturing] = useState(false);
  const [capturedDigits, setCapturedDigits] = useState('');
  const [dtmfSubscription, setDtmfSubscription] = useState<any>(null);
  const [audioInjecting, setAudioInjecting] = useState(false);
  // Snapshot para manter dados da chamada em gerenciamento durante falhas momentâneas
  const [managingCallSnapshot, setManagingCallSnapshot] = useState<ActiveCall | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [availableAudios, setAvailableAudios] = useState<any[]>([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] = useState<MediaStreamAudioSourceNode | null>(null);
  // Removido microphoneMixMode - agora usa modo padrão (sempre mute durante áudio)
  const [currentAudioElement, setCurrentAudioElement] = useState<HTMLAudioElement | null>(null);
  const [originalAudioTrack, setOriginalAudioTrack] = useState<MediaStreamTrack | null>(null);
  // Avaliação pós-chamada: controle de espera e último número discado
  const [awaitingClassification, setAwaitingClassification] = useState(false);
  const awaitingClassificationRef = useRef(false);
  const setAwaiting = (v: boolean) => { setAwaitingClassification(v); awaitingClassificationRef.current = v; };
  const lastDialedNumberRef = useRef<string>('');
  
  // Contexto da chamada para persistência de status (salvar apenas no encerramento)
  const callLogSavedRef = useRef<boolean>(false);
  const callInitiatedAtRef = useRef<number | null>(null);
  const callRangRef = useRef<boolean>(false);
  const callConfirmedRef = useRef<boolean>(false);
  const callNumberRef = useRef<string>('');
  const callCampaignIdRef = useRef<string | null>(null);
  const callContactIdRef = useRef<string | number | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Work Sessions (Jornada) state
  const [workSession, setWorkSession] = useState<WorkSession | null>(null);
  const [workBreak, setWorkBreak] = useState<WorkBreak | null>(null);
  const [workClosedBreakSeconds, setWorkClosedBreakSeconds] = useState<number>(0);
  const [workServerOffsetMs, setWorkServerOffsetMs] = useState<number>(0);
  const [workTick, setWorkTick] = useState<number>(0); // re-render ticker
  const [workLoading, setWorkLoading] = useState<boolean>(true);
  const [workActionLoading, setWorkActionLoading] = useState<boolean>(false);
  const [pauseModalOpen, setPauseModalOpen] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('');
  const [pauseReasonText, setPauseReasonText] = useState<string>('');
  
  // CallerID editing states
  const [editingCallerId, setEditingCallerId] = useState(false);
  const [tempCallerId, setTempCallerId] = useState('');
  const [savingCallerId, setSavingCallerId] = useState(false);
  
  // Call Quality Monitoring States
  const [callQuality, setCallQuality] = useState<{
    packetLoss: number;
    jitter: number;
    rtt: number;
    audioLevel: number;
    bitrate: number;
    codec: string;
    networkType: string;
  } | null>(null);
  const [qualityMonitorInterval, setQualityMonitorInterval] = useState<NodeJS.Timeout | null>(null);
  const [qualityCardExpanded, setQualityCardExpanded] = useState(false);
  const [showQualityStats, setShowQualityStats] = useState(false);
  const [confirmHangupOpen, setConfirmHangupOpen] = useState(false);
  const [confirmHangupTarget, setConfirmHangupTarget] = useState<ActiveCall | null>(null);

  // Ticker para atualizar o timer a cada 1s
  useEffect(() => {
    const id = setInterval(() => setWorkTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Sincronizar sessão/pausa ativa ao montar a página
  useEffect(() => {
    const syncActive = async () => {
      try {
        setWorkLoading(true);
        const resp = await workSessionsService.getActive();
        if (resp.success && resp.data) {
          const serverTime = new Date(resp.data.server_time).getTime();
          setWorkServerOffsetMs(serverTime - Date.now());
          setWorkSession(resp.data.session || null);
          setWorkBreak(resp.data.break || null);
          const closed = (resp.data as any).closed_break_seconds || 0;
          setWorkClosedBreakSeconds(Number.isFinite(closed) ? closed : 0);

          // Persistir no localStorage para resiliência entre abas
          if (resp.data.session?.id) {
            localStorage.setItem('work_session_id', resp.data.session.id);
          } else {
            localStorage.removeItem('work_session_id');
          }
          if (resp.data.break?.id) {
            localStorage.setItem('work_break_id', resp.data.break.id);
          } else {
            localStorage.removeItem('work_break_id');
          }
        }
      } catch (err) {
        console.warn('[WorkTimer] Falha ao sincronizar sessão ativa:', err);
      } finally {
        setWorkLoading(false);
      }
    };
    syncActive();
  }, []);

  // ============================
  // Auto Dialer: Fonte de Contatos (Dialer API)
  // ============================
  // Verifica rapidamente se a campanha possui contatos atribuídos a este agente
  const checkContactsForAgent = async (campaignId: string): Promise<boolean> => {
    try {
      if (!agentData?.id) return false;
      const token = localStorage.getItem('agent_token');
      if (!token) return false;
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${base}/api/mailings/${campaignId}/contacts?limit=1&offset=0&agentId=${agentData.id}`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      const arr = data?.data;
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  };
  // Busca o próximo contato do discador (com escopo por campanha)
  const fetchDialerNext = async (campaignId: string): Promise<NormalizedContact | null> => {
    try {
      if (!agentData?.id) return null;
      const token = localStorage.getItem('agent_token');
      if (!token) return null;
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${base}/api/dialer/agents/${agentData.id}/next?campaignId=${encodeURIComponent(campaignId)}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.status === 204) return null;
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        console.warn('⚠️ [AutoDialer] /next falhou:', resp.status, txt);
        return null;
      }
      const data = await resp.json();
      if (!data?.success || !data?.data) return null;
      const r = data.data as { id: string; name?: string; phone: string; dados_extras?: any };
      const normalized: NormalizedContact = {
        id: String(r.id),
        name: r.name || r.phone,
        number: r.phone,
        raw: r as any
      } as NormalizedContact;
      return normalized;
    } catch (e) {
      console.warn('⚠️ [AutoDialer] Erro ao obter próximo contato:', e);
      return null;
    }
  };

  // Solicita um lote ao discador e preenche uma fila inicial (claim + next)
  const fetchDialerBatch = async (campaignId: string, batch: number): Promise<NormalizedContact[]> => {
    const results: NormalizedContact[] = [];
    try {
      if (!agentData?.id) return results;
      const token = localStorage.getItem('agent_token');
      if (!token) return results;
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // 1) Tentar reservar em lote (idempotente)
      try {
        await fetch(`${base}/api/dialer/agents/${agentData.id}/claim`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ batch, campaignId })
        });
      } catch {}

      // 2) Buscar N próximos em paralelo (acelera o seed/top-up)
      const promises = Array.from({ length: batch }, () => fetchDialerNext(campaignId));
      const got = await Promise.all(promises);
      const nonNull = (got.filter(Boolean) as NormalizedContact[]);
      // evitar duplicados (por segurança)
      const seen = new Set<string>();
      for (const c of nonNull) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          results.push(c);
        }
      }

      // 3) Se ainda faltou para completar o batch, usar listagem rápida como top-up (sem lock)
      if (results.length < batch) {
        const need = batch - results.length;
        try {
          const url = `${base}/api/mailings/${campaignId}/contacts?limit=${Math.max(need * 2, need)}&offset=0&agentId=${agentData.id}`;
          const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
          if (resp.ok) {
            const data = await resp.json();
            const list = Array.isArray(data?.data) ? data.data : [];
            for (const r of list) {
              const id = String(r.id);
              if (results.length >= batch) break;
              if (seen.has(id)) continue;
              results.push({ id, name: r.name || r.phone, number: r.phone, raw: r } as any);
              seen.add(id);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('⚠️ [AutoDialer] Erro ao obter lote do discador:', e);
    }
    return results;
  };

  // Busca rápida SEM usar o dialer (sem lock), para seed inicial responsivo
  const fetchFastContactsWithoutDialer = async (campaignId: string, batch: number): Promise<NormalizedContact[]> => {
    const results: NormalizedContact[] = [];
    try {
      if (!agentData?.id) return results;
      const token = localStorage.getItem('agent_token');
      if (!token) return results;
      const url = `${API_BASE}/api/mailings/${campaignId}/contacts?limit=${batch}&offset=0&agentId=${agentData.id}`;
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (!resp.ok) return results;
      const data = await resp.json();
      const list = Array.isArray(data?.data) ? data.data : [];
      for (const r of list) {
        const id = String(r.id);
        results.push({ id, name: r.name || r.phone, number: r.phone, raw: r } as any);
      }
    } catch {}
    return results;
  };

  // Ações Work Timer
  const handleWorkStart = async () => {
    try {
      setWorkActionLoading(true);
      const resp = await workSessionsService.start();
      if (resp.success && resp.data?.session) {
        // Re-sincronizar estado completo via /active
        const active = await workSessionsService.getActive();
        if (active.success && active.data) {
          const serverTime = new Date(active.data.server_time).getTime();
          setWorkServerOffsetMs(serverTime - Date.now());
          setWorkSession(active.data.session || null);
          setWorkBreak(active.data.break || null);
          const closed = (active.data as any).closed_break_seconds || 0;
          setWorkClosedBreakSeconds(Number.isFinite(closed) ? closed : 0);
        }
        showToast('Jornada iniciada', 'success');
      }
    } catch (err) {
      console.error('[WorkTimer] start error:', err);
      showToast('Falha ao iniciar jornada', 'error');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleOpenPause = () => {
    setPauseReason('');
    setPauseReasonText('');
    setPauseModalOpen(true);
  };

  const handleConfirmPause = async () => {
    try {
      setWorkActionLoading(true);
      const resp = await workSessionsService.pause(pauseReason || undefined, pauseReasonText || undefined);
      if (resp.success && resp.data?.break) {
        setWorkBreak(resp.data.break);
        showToast('Pausa iniciada', 'success');
      }
    } catch (err) {
      console.error('[WorkTimer] pause error:', err);
      showToast('Falha ao iniciar pausa', 'error');
    } finally {
      setWorkActionLoading(false);
      setPauseModalOpen(false);
    }
  };

  const handleWorkResume = async () => {
    try {
      setWorkActionLoading(true);
      const resp = await workSessionsService.resume();
      if (resp.success) {
        // Otimista: remover pausa imediatamente no cliente
        setWorkBreak(null);
        try { localStorage.removeItem('work_break_id'); } catch {}
        // Após fechar pausa, re-sincronizar para atualizar closed_break_seconds
        const active = await workSessionsService.getActive();
        if (active.success && active.data) {
          const serverTime = new Date(active.data.server_time).getTime();
          setWorkServerOffsetMs(serverTime - Date.now());
          setWorkSession(active.data.session || null);
          setWorkBreak(active.data.break || null);
          const closed = (active.data as any).closed_break_seconds || 0;
          setWorkClosedBreakSeconds(Number.isFinite(closed) ? closed : 0);
        }
        showToast('Pausa encerrada', 'success');
      }
    } catch (err) {
      console.error('[WorkTimer] resume error:', err);
      showToast('Falha ao encerrar pausa', 'error');
    } finally {
      setWorkActionLoading(false);
    }
  };

  const handleWorkStop = async () => {
    try {
      setWorkActionLoading(true);
      const resp = await workSessionsService.stop();
      if (resp.success) {
        setWorkSession(null);
        setWorkBreak(null);
        setWorkClosedBreakSeconds(0);
        localStorage.removeItem('work_session_id');
        localStorage.removeItem('work_break_id');
        showToast('Jornada finalizada', 'success');
      }
    } catch (err) {
      console.error('[WorkTimer] stop error:', err);
      showToast('Falha ao finalizar jornada', 'error');
    } finally {
      setWorkActionLoading(false);
    }
  };

  // Cálculo do tempo líquido da sessão atual (sem pausas)
  const computeNetSessionSeconds = () => {
    if (!workSession) return 0;
    const nowMs = Date.now() + workServerOffsetMs;
    const startedMs = Date.parse(workSession.started_at);
    const total = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
    let breaks = workClosedBreakSeconds || 0;
    if (workBreak?.started_at && !workBreak.ended_at) {
      const brkStart = Date.parse(workBreak.started_at);
      breaks += Math.max(0, Math.floor((nowMs - brkStart) / 1000));
    }
    return Math.max(0, total - breaks);
  };

  // Estilos constantes para melhor manutenibilidade
  const BUTTON_STYLES = {
    primary: {
      background: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '9999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
    },
    danger: {
      background: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '9999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
    },
    secondary: {
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '9999px',
      padding: '6px 10px',
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px'
    },
    outline: {
      background: 'white',
      color: '#334155',
      border: '1px solid #e2e8f0',
      borderRadius: '9999px',
      padding: '6px 10px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px'
    },
    dangerOutline: {
      background: 'white',
      color: '#ef4444',
      border: '1px solid #fecaca',
      borderRadius: '9999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    },
    blueOutline: {
      background: 'white',
      color: '#2563eb',
      border: '1px solid #bfdbfe',
      borderRadius: '9999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    }
  };

  const CARD_STYLES = {
    section: {
      flex: '1 1 340px',
      minWidth: '280px',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '12px'
    },
    callItem: {
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  };
  const [confirmHangupLoading, setConfirmHangupLoading] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<OptimizedActiveCall | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Pós-chamada: Classificação obrigatória
  const [showClassification, setShowClassification] = useState(false);
  const [classificationRating, setClassificationRating] = useState<number>(0);
  const [classificationReason, setClassificationReason] = useState<string>('');
  const [classificationNumber, setClassificationNumber] = useState<string>('');
  const [classificationDuration, setClassificationDuration] = useState<number>(0);
  const [savingClassification, setSavingClassification] = useState(false);
  const [reviewingCampaign, setReviewingCampaign] = useState<any>(null);
  const [campaignContacts, setCampaignContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsTotal, setContactsTotal] = useState(0);
  const contactsPerPage = 10;
  // Ref para rolar até a visão de revisão manual quando ativada
  const campaignReviewRef = useRef<HTMLDivElement | null>(null);
  // Contato manual atualmente em chamada (para destacar e manter na lista)
  const [manualActiveContactId, setManualActiveContactId] = useState<string | null>(null);
  // Modal de Ficha do Contato
  const [contactSheetOpen, setContactSheetOpen] = useState(false);
  const [contactSheetData, setContactSheetData] = useState<any | null>(null);
  // Último contato discado manualmente (para abrir ficha no discador)
  const [lastDialedContact, setLastDialedContact] = useState<NormalizedContact | null>(null);

  // Manter snapshot sincronizado enquanto a chamada gerenciada existir ao vivo (apenas do ramal)
  useEffect(() => {
    if (!managingCall) return;
    const live = filteredCalls.find((c: ActiveCall) => c.id === managingCall);
    if (live) {
      setManagingCallSnapshot(live);
    }
  }, [managingCall, filteredCalls]);

  // Realtime: garantia de logout imediato em suspensão (fallback local)
  useEffect(() => {
    try {
      const user = unifiedAuthService.getCurrentUser();
      const type = unifiedAuthService.getCurrentUserType();
      const targetUserId = user ? (type === 'agent' ? (user as any).user_id : (user as any).id) : null;

      if (targetUserId) {
        userRealtimeService.start(String(targetUserId), async () => {
          try {
            await unifiedAuthService.logout();
          } finally {
            try { window.dispatchEvent(new Event('app:force-logout')); } catch {}
            window.location.assign('/login');
          }
        });

      }
    } catch {}

    const onForce = () => { window.location.assign('/login'); };
    window.addEventListener('app:force-logout', onForce);
    return () => {
      window.removeEventListener('app:force-logout', onForce);
      // Não paramos o userRealtimeService aqui para não interferir no listener global
    };
  }, []);

  // Session expiry watcher (absolute 1h limit via unifiedAuthService)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const check = async () => {
      try {
        await unifiedAuthService.checkAndHandleExpiry();
      } catch {}
    };

    // Check on mount
    check();

    // Check periodically (every 60s)
    interval = setInterval(check, 60 * 1000);

    // Check when tab becomes visible again
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Função para iniciar captura DTMF
  const startDTMFCapture = async (callId: string) => {
    if (!callId) {
      console.warn('[DTMF] ID da chamada não fornecido');
      return;
    }

    console.log(`[DTMF] Iniciando captura para chamada: ${callId}`);
    
    // Limpar subscription anterior se existir
    if (dtmfSubscription) {
      dtmfSubscription.unsubscribe();
    }

    // ✅ LIMPAR DÍGITOS EXISTENTES ANTES DE INICIAR
    try {
      await clearCapturedDigits(callId);
      console.log(`[DTMF] Dígitos anteriores limpos para chamada: ${callId}`);
    } catch (error) {
      console.error('[DTMF] Erro ao limpar dígitos anteriores:', error);
    }

    // Buscar dígitos existentes (deve estar vazio após limpeza)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/dtmf/${callId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.digito) {
          setCapturedDigits(data.data.digito);
        } else {
          setCapturedDigits('');
        }
      }
    } catch (error) {
      console.error('[DTMF] Erro ao buscar dígitos existentes:', error);
      setCapturedDigits('');
    }

    // Configurar realtime subscription
    const channel = supabase
      .channel(`dtmf-${callId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dtmf_pabx',
          filter: `id_call=eq.${callId}`
        },
        (payload) => {
          console.log('[DTMF] Realtime update:', payload);
          if (payload.new && typeof payload.new === 'object') {
            const row: any = payload.new as any;
            const digito: string = typeof row?.digito === 'string' ? row.digito : '';
            setCapturedDigits(digito || '');
            
            // Toast notification
            setToast({
              message: `Dígito capturado: ${digito?.split(',').pop() || ''}`,
              type: 'success'
            });
            setTimeout(() => setToast(null), 2000);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[DTMF] Inscrito para chamada: ${callId}`);
        }
      });

    setDtmfSubscription(channel);
    setDtmfCapturing(true);
  };

  // Função para parar captura DTMF
  const stopDTMFCapture = () => {
    console.log('[DTMF] Parando captura');
    
    if (dtmfSubscription) {
      dtmfSubscription.unsubscribe();
      setDtmfSubscription(null);
    }
    
    setDtmfCapturing(false);
  };

  // Função para limpar dígitos capturados
  const clearCapturedDigits = async (callId: string) => {
    if (!callId) return;
    
    try {
      const token = localStorage.getItem('agent_token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/dtmf/${callId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        setCapturedDigits('');
        setToast({
          message: 'Dígitos limpos com sucesso',
          type: 'success'
        });
        setTimeout(() => setToast(null), 2000);
      }
    } catch (error) {
      console.error('[DTMF] Erro ao limpar dígitos:', error);
      setToast({
        message: 'Erro ao limpar dígitos',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Função para baixar dígitos em TXT
  const downloadDigits = (callId: string, digits: string) => {
    if (!digits) {
      setToast({
        message: 'Nenhum dígito para baixar',
        type: 'error'
      });
      setTimeout(() => setToast(null), 2000);
      return;
    }

    const content = `Dígitos DTMF - Chamada: ${callId}\nData: ${new Date().toLocaleString('pt-BR')}\nDígitos: ${digits.replace(/,/g, ' ')}\nTotal: ${digits.split(',').length} dígitos`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dtmf_${callId}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({
      message: 'Dígitos baixados com sucesso',
      type: 'success'
    });
    setTimeout(() => setToast(null), 2000);
  };

  // Auto Dialer States
  const [autoDialerRunning, setAutoDialerRunning] = useState(false);
  const [autoDialerPaused, setAutoDialerPaused] = useState(false);
  const [autoDialerCampaign, setAutoDialerCampaign] = useState<any>(null);
  const [autoDialerQueue, setAutoDialerQueue] = useState<any[]>([]);
  const [autoDialerCurrentContact, setAutoDialerCurrentContact] = useState<any>(null);
  const [autoDialerStats, setAutoDialerStats] = useState({
    total: 0,
    completed: 0,
    successful: 0,
    failed: 0,
    remaining: 0
  });
  const [autoDialerTimeout, setAutoDialerTimeout] = useState<NodeJS.Timeout | null>(null);
  const autoReplenishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoStarting, setAutoStarting] = useState(false);
  const [currentCall, setCurrentCall] = useState({
    active: false,
    callerid: '',
    number: '',
    duration: '00:00',
    status: '',
    muted: false,
    onHold: false
  });

  // Parar autodiscagem e limpar timers/estado
  const stopAutoDialer = () => {
    setAutoDialerRunning(false);
    setAutoDialerPaused(false);
    // Sync refs
    autoDialerRunningRef.current = false;
    autoDialerPausedRef.current = false;
    // Reset campanha e fila
    setAutoDialerCampaign(null);
    setAutoDialerQueue([]);
    setAutoDialerCurrentContact(null);
    setAutoDialerStats({ total: 0, completed: 0, successful: 0, failed: 0, remaining: 0 });
    autoMemoryBufferRef.current = [];
    // Timers
    if (autoDialerTimeout) {
      clearTimeout(autoDialerTimeout);
      setAutoDialerTimeout(null);
    }
    if (autoReplenishTimerRef.current) {
      clearInterval(autoReplenishTimerRef.current);
      autoReplenishTimerRef.current = null;
    }
    console.log('🛑 [AutoDialer] Parado');
  };

  // (stopCallTimer defined later near timers section to avoid duplication)

  // Refs to avoid stale closures in AutoDialer handlers
  const autoDialerRunningRef = useRef(autoDialerRunning);
  const autoDialerPausedRef = useRef(autoDialerPaused);
  const autoDialerQueueRef = useRef<any[]>(autoDialerQueue);
  const autoDialerContactsRef = useRef<any[]>([]);
  const autoDialerIndexRef = useRef<number>(0);
  const autoMemoryBufferRef = useRef<any[]>([]);

  useEffect(() => {
    autoDialerRunningRef.current = autoDialerRunning;
  }, [autoDialerRunning]);

  useEffect(() => {
    autoDialerPausedRef.current = autoDialerPaused;
  }, [autoDialerPaused]);

  useEffect(() => {
    autoDialerQueueRef.current = autoDialerQueue;
  }, [autoDialerQueue]);

  // Safe setter to keep queue state and ref synchronized
  const setAutoDialerQueueSafe = (q: any[]) => {
    setAutoDialerQueue(q);
    autoDialerQueueRef.current = q;
  };

  // Reabastecer fila automaticamente quando baixa (2 níveis: ativa e memória)
  const ensureAutoQueueReplenish = async () => {
    try {
      if (!autoDialerCampaign?.id) return;
      if (awaitingClassificationRef.current) return; // não busca enquanto espera avaliação
      const idx = autoDialerIndexRef.current;
      const totalActive = autoDialerContactsRef.current.length;
      const activeRemaining = Math.max(0, totalActive - (idx + 1));

      // 1) Subir da memória para a fila ativa até atingir ACTIVE_QUEUE_TARGET
      if (activeRemaining < ACTIVE_QUEUE_TARGET && autoMemoryBufferRef.current.length > 0) {
        const needActive = Math.min(ACTIVE_QUEUE_TARGET - activeRemaining, AUTO_MAX_TOPUP_PER_ROUND);
        const moveCount = Math.min(needActive, autoMemoryBufferRef.current.length);
        if (moveCount > 0) {
          const toMove = autoMemoryBufferRef.current.slice(0, moveCount);
          autoMemoryBufferRef.current = autoMemoryBufferRef.current.slice(moveCount);
          autoDialerContactsRef.current = [...autoDialerContactsRef.current, ...toMove];
          const newRemaining = autoDialerContactsRef.current.slice(idx + 1);
          setAutoDialerQueueSafe(newRemaining);
          console.log(`🧃 [AutoDialer] +${toMove.length} movidos da memória para ativa. Ativa agora=${newRemaining.length}, Memória=${autoMemoryBufferRef.current.length}`);
        }
      }

      // 2) Reabastecer memória quando abaixo do watermark
      if (autoMemoryBufferRef.current.length < MEMORY_LOW_WATERMARK) {
        const memNeed = MEMORY_BUFFER_TARGET - autoMemoryBufferRef.current.length;
        if (memNeed > 0) {
          // Buscar rápido primeiro
          let addMem = await fetchFastContactsWithoutDialer(autoDialerCampaign.id, memNeed);
          if (addMem.length < memNeed) {
            const extra = await fetchDialerBatch(autoDialerCampaign.id, memNeed - addMem.length);
            if (extra.length > 0) addMem = addMem.concat(extra);
          }
          if (addMem.length > 0) {
            const seen = new Set([
              ...autoDialerContactsRef.current.map((c: any) => c.id),
              ...autoMemoryBufferRef.current.map((c: any) => c.id)
            ]);
            const freshMem = addMem.filter(c => !seen.has(c.id));
            if (freshMem.length > 0) {
              autoMemoryBufferRef.current = [...autoMemoryBufferRef.current, ...freshMem];
              console.log(`🧠 [AutoDialer] Memória reabastecida: +${freshMem.length}, totalMem=${autoMemoryBufferRef.current.length}`);
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [AutoDialer] Falha ao reabastecer fila:', e);
    }
  };

  // Seed inicial de 2 níveis: ativa (50) + memória (50)
  const seedTwoTier = async (campaignId: string) => {
    const totalNeeded = ACTIVE_QUEUE_TARGET + MEMORY_BUFFER_TARGET;
    // 1) Buscar rápido sem lock
    let seed = await fetchFastContactsWithoutDialer(campaignId, totalNeeded);
    // 2) Completar via dialer se faltar
    if (seed.length < totalNeeded) {
      const extra = await fetchDialerBatch(campaignId, totalNeeded - seed.length);
      if (extra.length > 0) {
        const seen = new Set(seed.map(c => c.id));
        seed = seed.concat(extra.filter(c => !seen.has(c.id)));
      }
    }
    // Deduplicar por segurança
    const seenAll = new Set<string>();
    const unique: any[] = [];
    for (const c of seed) {
      const id = String((c as any).id);
      if (!seenAll.has(id)) { seenAll.add(id); unique.push(c); }
    }
    const active = unique.slice(0, Math.min(ACTIVE_QUEUE_TARGET, unique.length));
    const mem = unique.slice(active.length, Math.min(active.length + MEMORY_BUFFER_TARGET, unique.length));
    autoDialerContactsRef.current = active;
    autoDialerIndexRef.current = 0;
    setAutoDialerQueueSafe(active.slice(1));
    setAutoDialerCurrentContact(active[0] || null);
    autoMemoryBufferRef.current = mem;
    setAutoDialerStats(prev => ({ ...prev, total: active.length, remaining: Math.max(0, active.length - 1) }));
    console.log(`🚀 [AutoDialer] Seed 2-níveis: ativa=${active.length}, memória=${mem.length}`);
    return { activeCount: active.length, memoryCount: mem.length };
  };

  // Inicia próxima chamada usando estado atual conhecido
  const startNextAutoCallWithState = async (queue: any[], isRunning: boolean, isPaused: boolean) => {
    if (!isRunning || isPaused) return;
    if (!webrtcUA || !webrtcRegistered) return;
    if (!queue || queue.length === 0) {
      // Sem fila local, tenta pegar um próximo do dialer
      if (autoDialerCampaign?.id) {
        const next = await fetchDialerNext(autoDialerCampaign.id);
        if (next) {
          startNextAutoCall([next]);
        } else {
          stopAutoDialer();
        }
      } else {
        stopAutoDialer();
      }
      return;
    }

    const nextContact = queue[0];
    // Atualizar fila da UI com base na fila recebida (sem pular registros)
    const remaining = queue.slice(1);
    setAutoDialerQueueSafe(remaining);
    setAutoDialerCurrentContact(nextContact);

    try {
      // Discar via WebRTC diretamente
      const session = webrtcUA.call(`sip:${nextContact.number}@minhasip.cloud`, {
        sessionTimersExpires: 120,
        mediaConstraints: { 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }, 
          video: false 
        },
        rtcConfiguration: { 
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
      setWebrtcSession(session);
      setCallStatus('calling');
      setCallTarget(nextContact.name);
      setCallTargetNumber(nextContact.number);
      lastDialedNumberRef.current = nextContact.number;
      // Contexto de chamada do autodiscador
      resetCallContext();
      callInitiatedAtRef.current = Date.now();
      callNumberRef.current = String(nextContact.number || '');
      callCampaignIdRef.current = (autoDialerCampaign?.id || reviewingCampaign?.id) ?? null;
      callContactIdRef.current = (nextContact?.id ?? null);

      // Contabilizar discagem quando começar a tocar
      session.on('progress', () => {
        callRangRef.current = true;
        if (autoDialerCampaign?.id) void incrementCampaignDial(autoDialerCampaign.id);
      });
      // Ao finalizar/falhar, seguir para próximo
      const continueNext = () => {
        // Avançar índice global estável (aponta para o PRÓXIMO atual)
        autoDialerIndexRef.current = Math.min(
          autoDialerIndexRef.current + 1,
          Math.max(0, autoDialerContactsRef.current.length - 1)
        );
        // Atualizar fila da UI (itens após o atual)
        const newRemaining = autoDialerContactsRef.current.slice(autoDialerIndexRef.current + 1);
        setAutoDialerQueueSafe(newRemaining);
        setAutoDialerStats(prev => ({ ...prev, completed: prev.completed + 1, remaining: newRemaining.length }));
        // Reabastecer imediatamente (mover da memória e/ou buscar)
        void ensureAutoQueueReplenish();
        // Disparar próxima chamada com a fatia a partir do índice atual (inclui o próximo atual)
        const fromCurrent = autoDialerContactsRef.current.slice(autoDialerIndexRef.current);
        setTimeout(() => {
          if (autoDialerRunningRef.current && !autoDialerPausedRef.current && !awaitingClassificationRef.current) {
            startNextAutoCall(fromCurrent);
          }
        }, 300);
      };
      session.on('ended', (ev: any) => {
        void finalizeAndLogCall('ended', ev);
        continueNext();
      });
      session.on('failed', (ev: any) => {
        // Ignorar falha com causa 'Terminated' (fluxo normal de encerramento)
        if (ev && ev.cause === 'Terminated') {
          continueNext();
          return;
        }
        // Contabilizar falha com causa
        const info = getWebRTCFailureInfo(ev);
        console.warn('📵 [AutoDialer] Falha na chamada:', info, ev);
        setAutoDialerStats(prev => ({ ...prev, failed: prev.failed + 1 }));
        // Persistir e continuar para o próximo contato
        void finalizeAndLogCall('failed', ev);
        continueNext();
      });
    } catch (e) {
      console.error('❌ [AutoDialer] Erro ao iniciar chamada automática:', e);
      // Contabilizar falha imediata
      setAutoDialerStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      // Persistir falha sem tocar
      callRangRef.current = false;
      void finalizeAndLogCall('failed');
      // Em caso de falha imediata, tentar próximo
      setTimeout(() => {
        if (autoDialerRunningRef.current && !autoDialerPausedRef.current && !awaitingClassificationRef.current) {
          startNextAutoCall(autoDialerQueueRef.current);
        }
      }, 500);
    }
  };

  // Decide e inicia a próxima chamada com base na fila atual/ref
  const startNextAutoCall = async (queue: any[]) => {
    const running = autoDialerRunningRef.current;
    const paused = autoDialerPausedRef.current;
    if (!running || paused || awaitingClassificationRef.current) return;

    if (!queue || queue.length === 0) {
      if (!autoDialerCampaign?.id) { stopAutoDialer(); return; }
      const next = await fetchDialerNext(autoDialerCampaign.id);
      if (!next) { stopAutoDialer(); return; }
      await startNextAutoCallWithState([next], running, paused);
      return;
    }
    await startNextAutoCallWithState(queue, running, paused);
  };

  // Normalização inteligente de contatos vindos do backend (inclui raw para exibir ficha completa)
  type NormalizedContact = { id: string; name: string; number: string; raw?: any };
  const normalizeContact = (raw: any): NormalizedContact => {
    // id
    const idCandidates = ['id', 'contact_id', 'uuid', '_id', 'rowid'];
    const id = String(
      idCandidates.map((k) => raw?.[k]).find((v) => v !== undefined && v !== null) ??
      // fallback: concat de algum campo único
      (raw?.number ?? raw?.phone ?? raw?.telefone ?? raw?.msisdn ?? Math.random().toString(36).slice(2))
    );

    // name
    const nameCandidates = ['name', 'nome', 'full_name', 'contact_name', 'contato'];
    let name = nameCandidates.map((k) => raw?.[k]).find((v) => typeof v === 'string' && v.trim().length > 0);
    if (!name) {
      // tente montar a partir de campos alternativos
      const first = raw?.first_name || raw?.firstname || raw?.given_name;
      const last = raw?.last_name || raw?.lastname || raw?.family_name;
      if (first || last) name = [first, last].filter(Boolean).join(' ').trim();
    }
    if (!name) name = 'Contato';

    // number (prioridade para phone-like)
    const numCandidates = [
      'number', 'phone', 'telefone', 'msisdn', 'mobile', 'celular', 'phone_number', 'destination', 'to', 'dial'
    ];
    let number = numCandidates.map((k) => raw?.[k]).find((v) => typeof v === 'string' && v.trim().length > 0);
    // composições comuns: ddd + telefone
    if (!number && raw?.ddd && raw?.telefone) number = `${raw.ddd}${raw.telefone}`;
    if (!number && raw?.ddi && raw?.telefone) number = `${raw.ddi}${raw.telefone}`;
    if (!number) number = String(raw?.number ?? raw?.phone ?? '');

    return { id, name, number, raw };
  };

  // Helper functions - OTIMIZADO com ref para evitar memory leaks
  const showToast = (message: string, type: 'success' | 'error') => {
    // Limpar timeout anterior se existir
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    setToast({ message, type });
    
    // Criar novo timeout com ref
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  const resetCallContext = () => {
    callLogSavedRef.current = false;
    callInitiatedAtRef.current = null;
    callRangRef.current = false;
    callConfirmedRef.current = false;
    callNumberRef.current = '';
    callCampaignIdRef.current = null;
    callContactIdRef.current = null;
  };

  const finalizeAndLogCall = async (kind: 'ended' | 'failed', ev?: any) => {
    try {
      if (callLogSavedRef.current) return; // idempotente
      const nowIso = new Date().toISOString();
      const startedIso = new Date(callInitiatedAtRef.current || Date.now()).toISOString();
      const number = String(callNumberRef.current || lastDialedNumberRef.current || callTargetNumber || '');
      if (!number) {
        callLogSavedRef.current = true; // evita loop
        return;
      }

      // Mapear disposição final
      let disposition: 'answered' | 'no_answer' | 'failed' = 'failed';
      let failureCause: string | null = null;
      let failureStatus: number | null = null;

      if (kind === 'ended') {
        if (callConfirmedRef.current) disposition = 'answered';
        else if (callRangRef.current) disposition = 'no_answer';
        else disposition = 'failed';
      } else {
        const info = getWebRTCFailureInfo(ev);
        failureCause = info.code || null;
        failureStatus = (typeof info.status === 'number') ? info.status : null;
        // NO_ANSWER / REQUEST_TIMEOUT / CANCELED => no_answer; demais => failed
        const code = String(info.code || '').toUpperCase();
        if (code.includes('NO_ANSWER') || code.includes('REQUEST_TIMEOUT') || code.includes('CANCELED')) {
          disposition = 'no_answer';
        } else {
          disposition = 'failed';
        }
      }

      const payload = {
        number,
        direction: 'outbound' as const,
        started_at: startedIso,
        ended_at: nowIso,
        disposition_en: disposition,
        failure_cause_code: failureCause,
        failure_status_code: failureStatus,
        agent_id: agentData?.id || null,
        extension: agentData?.ramal || null,
        campaign_id: callCampaignIdRef.current,
        contact_id: callContactIdRef.current,
        metadata: {
          source: autoDialerCampaign ? 'autodialer' : 'manual'
        }
      };

      callLogSavedRef.current = true; // marcar antes para evitar duplicatas em eventos em cascata
      const resp = await callLogsService.logFinalCall(payload);
      if (!resp.success) {
        console.warn('⚠️ Falha ao salvar call log:', resp.message || resp.error);
      } else {
        console.log('📝 Call log salvo:', resp.data);
      }
    } catch (e) {
      console.error('❌ Erro ao salvar call log:', e);
    }
  };

  // Normaliza e categoriza causas de falha WebRTC/JsSIP
  const getWebRTCFailureInfo = (e: any) => {
    const rawCause = (e?.cause ?? '').toString();
    const cause = rawCause.toUpperCase();
    const status = e?.response?.status_code as number | undefined;
    const phrase = e?.response?.reason_phrase as string | undefined;

    // Mapeamento por status-code prioritário
    if (status === 404) return { code: 'NOT_FOUND', status, phrase, category: 'Número inexistente' };
    if (status === 486) return { code: 'BUSY', status, phrase, category: 'Ocupado' };
    if (status === 480 || status === 503) return { code: 'UNAVAILABLE', status, phrase, category: 'Indisponível' };
    if (status === 484) return { code: 'ADDRESS_INCOMPLETE', status, phrase, category: 'Endereço incompleto' };
    if (status === 488) return { code: 'INCOMPATIBLE_SDP', status, phrase, category: 'SDP incompatível' };
    if (status === 401 || status === 407) return { code: 'AUTHENTICATION_ERROR', status, phrase, category: 'Erro de autenticação' };
    if (status === 408) return { code: 'REQUEST_TIMEOUT', status, phrase, category: 'Sem resposta/Timeout' };

    // Mapeamento por causa textual (JsSIP.C.causes)
    if (cause.includes('NOT_FOUND')) return { code: 'NOT_FOUND', status, phrase, category: 'Número inexistente' };
    if (cause.includes('BUSY')) return { code: 'BUSY', status, phrase, category: 'Ocupado' };
    if (cause.includes('UNAVAILABLE')) return { code: 'UNAVAILABLE', status, phrase, category: 'Indisponível' };
    if (cause.includes('REJECTED')) return { code: 'REJECTED', status, phrase, category: 'Rejeitado' };
    if (cause.includes('ADDRESS_INCOMPLETE')) return { code: 'ADDRESS_INCOMPLETE', status, phrase, category: 'Endereço incompleto' };
    if (cause.includes('INCOMPATIBLE_SDP')) return { code: 'INCOMPATIBLE_SDP', status, phrase, category: 'SDP incompatível' };
    if (cause.includes('MISSING_SDP')) return { code: 'MISSING_SDP', status, phrase, category: 'SDP ausente' };
    if (cause.includes('AUTHENTICATION')) return { code: 'AUTHENTICATION_ERROR', status, phrase, category: 'Erro de autenticação' };
    if (cause.includes('REQUEST_TIMEOUT') || cause.includes('NO_ANSWER')) return { code: 'REQUEST_TIMEOUT', status, phrase, category: 'Sem resposta/Timeout' };
    if (cause.includes('CONNECTION_ERROR')) return { code: 'CONNECTION_ERROR', status, phrase, category: 'Erro de conexão' };
    if (cause.includes('USER_DENIED_MEDIA_ACCESS')) return { code: 'USER_DENIED_MEDIA_ACCESS', status, phrase, category: 'Permissão de microfone negada' };
    if (cause.includes('RTP_TIMEOUT')) return { code: 'RTP_TIMEOUT', status, phrase, category: 'RTP timeout' };
    if (cause.includes('DIALOG_ERROR')) return { code: 'DIALOG_ERROR', status, phrase, category: 'Erro de diálogo' };
    if (cause.includes('NO_ACK')) return { code: 'NO_ACK', status, phrase, category: 'Sem ACK' };
    if (cause.includes('EXPIRES')) return { code: 'EXPIRES', status, phrase, category: 'Expirou' };
    if (cause.includes('CANCELED')) return { code: 'CANCELED', status, phrase, category: 'Cancelada' };

    // Default genérico
    return { code: cause || 'UNKNOWN', status, phrase, category: 'Falha desconhecida' };
  };

  // Format seconds to HH:MM:SS
  const formatHMS = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ss = sec.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Normaliza contador de discagens (prefere total_discados; fallback para discados)
  const getDialed = (c: any) => (c?.total_discados ?? c?.discados ?? 0);

  // Abrir ficha do contato (exibir todos os campos do mailing desse número)
  const openContactSheet = (contact: NormalizedContact) => {
    try {
      const raw: any = contact?.raw || {};

      // 1) Extrair e normalizar dados_extras (jsonb)
      let extras: any = raw?.dados_extras ?? {};
      if (typeof extras === 'string') {
        try {
          extras = JSON.parse(extras);
        } catch {
          // manter string se não for JSON válido
        }
      }

      // 2) Flatten superficial dos extras (apenas 1 nível) com chaves amigáveis
      const flatExtras: Record<string, any> = {};
      if (extras && typeof extras === 'object' && !Array.isArray(extras)) {
        Object.entries(extras).forEach(([k, v]) => {
          if (v === undefined || v === null || v === '') return;
          const niceKey = String(k).replace(/\s+/g, '_').replace(/\W/g, '_').toLowerCase();
          flatExtras[niceKey] = v;
        });
      } else if (Array.isArray(extras)) {
        flatExtras['dados_extras'] = extras;
      } else if (typeof extras === 'string') {
        flatExtras['dados_extras'] = extras;
      }

      // 3) Construir base priorizando name/number visíveis + demais campos do raw (exceto dados_extras)
      const { dados_extras, ...restRaw } = raw;
      const base: any = {
        name: contact.name,
        number: contact.number,
        ...restRaw,
        ...flatExtras
      };

      setContactSheetData(base);
      setContactSheetOpen(true);
    } catch (e) {
      console.error('Erro ao abrir ficha do contato:', e);
      showToast('Não foi possível abrir a ficha do contato', 'error');
    }
  };
  const closeContactSheet = () => { setContactSheetOpen(false); setContactSheetData(null); };

  // Abrir ficha do número atual (busca local e, se necessário, resolve no backend para trazer dados_extras)
  const openCurrentNumberSheet = async () => {
    try {
      if (!callTargetNumber) {
        showToast('Sem número da chamada atual', 'error');
        return;
      }

      // Normalizar números para comparação
      const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
      const strip55 = (s: string) => (s.startsWith('55') && s.length > 11) ? s.slice(2) : s;
      const targetDigits = strip55(onlyDigits(callTargetNumber));

      let candidate: NormalizedContact | null = null;
      if (lastDialedContact && strip55(onlyDigits(lastDialedContact.number)) === targetDigits) {
        candidate = lastDialedContact;
      } else {
        const found = campaignContacts.find((c: any) => strip55(onlyDigits(c.number)) === targetDigits);
        if (found) candidate = found as NormalizedContact;
      }

      // Se não achou ou está sem dados_extras, tentar resolver no backend (precisa de campanha)
      if (!candidate || !(candidate as any)?.raw?.dados_extras) {
        const campaignId = autoDialerCampaign?.id || reviewingCampaign?.id;
        const token = localStorage.getItem('agent_token');
        if (campaignId && token) {
          const agentParam = agentData?.id ? `&agentId=${agentData.id}` : '';
          const url = `${API_BASE}/api/mailings/${campaignId}/contacts/resolve?phone=${encodeURIComponent(callTargetNumber)}${agentParam}`;
          try {
            const resp = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.success && data.data) {
                const r = data.data;
                const enriched = {
                  id: String(r.id || candidate?.id || callTargetNumber),
                  name: r.name || candidate?.name || callTarget || callTargetNumber,
                  number: r.phone || candidate?.number || callTargetNumber,
                  raw: { ...(candidate?.raw || {}), ...r }
                } as NormalizedContact;
                candidate = enriched;
              }
            }
          } catch (e) {
            console.warn('⚠️ Falha ao resolver contato no backend:', e);
          }
        }
      }

      if (!candidate) {
        // Construir com dados mínimos
        candidate = { id: callTargetNumber, name: callTarget || callTargetNumber, number: callTargetNumber } as NormalizedContact;
      }
      openContactSheet(candidate);
    } catch (e) {
      console.error('Erro ao abrir ficha do número atual:', e);
      showToast('Erro ao abrir ficha', 'error');
    }
  };

  // Increment campaign dialed counter in backend
  const incrementCampaignDial = async (campaignId: string) => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token || !campaignId) {
        console.warn('⚠️ [AutoDialer] Sem token ou campaignId para incrementar discados');
        return;
      }
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = `${base}/api/mailings/${campaignId}/dial`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error('❌ [AutoDialer] Falha ao incrementar discados:', res.status, txt);
      } else {
        console.log('✅ [AutoDialer] Discados incrementado para campanha', campaignId);
      }
    } catch (err) {
      console.error('❌ [AutoDialer] Erro ao incrementar discados:', err);
    }
  };

  // Advance helper using stable contacts list + index
  const advanceByIndex = () => {
    const total = autoDialerContactsRef.current.length;
    let idx = autoDialerIndexRef.current + 1;
    const running = autoDialerRunningRef.current;
    const paused = autoDialerPausedRef.current;
    console.log(`➡️ [AutoDialer] advanceByIndex idx=${idx}/${total} running=${running} paused=${paused}`);
    if (!running || paused || awaitingClassificationRef.current) {
      if (awaitingClassificationRef.current) {
        console.log('⏸️ [AutoDialer] Aguardando avaliação, não avançando.');
      }
      return;
    }
    if (idx >= total) {
      console.log('🏁 [AutoDialer] Fim da campanha pelo índice');
      stopAutoDialer();
      return;
    }
    autoDialerIndexRef.current = idx;
    const remaining = autoDialerContactsRef.current.slice(idx + 1);
    const next = autoDialerContactsRef.current[idx];
    setAutoDialerCurrentContact(next);
    setAutoDialerQueueSafe(remaining);
    // Disparar próxima chamada
    startNextAutoCall([next, ...remaining]);
    // Reabastecer em background
    void ensureAutoQueueReplenish();
  };

  // remove duplicate placeholder (noop)

  // WebRTC functions
  const waitForJsSIP = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).JsSIP) {
        resolve((window as any).JsSIP);
        return;
      }

      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      const checkInterval = setInterval(() => {
        attempts++;
        if (typeof window !== 'undefined' && (window as any).JsSIP) {
          clearInterval(checkInterval);
          resolve((window as any).JsSIP);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error('JsSIP library failed to load'));
        }
      }, 100);
    });
  };

  const connectWebRTC = async () => {
    if (!agentData?.ramal) {
      showToast('Ramal do agente não encontrado para WebRTC', 'error');
      return;
    }

    setWebrtcConnecting(true);

    // Buscar senha real do ramal no banco de dados
    let webrtcPassword = '';
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        showToast('Token de autenticação não encontrado', 'error');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/ramal/${agentData.ramal}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.senha) {
          webrtcPassword = data.data.senha;
          console.log('🔐 Senha do ramal obtida do banco de dados');
        } else {
          showToast('Senha do ramal não encontrada no banco de dados', 'error');
          setWebrtcConnecting(false);
          return;
        }
      } else {
        showToast('Erro ao buscar dados do ramal', 'error');
        setWebrtcConnecting(false);
        return;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar senha do ramal:', error);
      showToast('Erro ao buscar senha do ramal', 'error');
      setWebrtcConnecting(false);
      return;
    }

    try {
      // Aguardar JsSIP carregar
      const JsSIP = await waitForJsSIP();
      
      console.log('🔐 Configurações WebRTC:', {
        ramal: agentData.ramal,
        uri: `sip:${agentData.ramal}@minhasip.cloud`,
        websocket: process.env.NEXT_PUBLIC_WSS_DOMAIN || "wss://minhasip.cloud:8089/ws",
        hasPassword: !!webrtcPassword
      });
      
      const socket = new JsSIP.WebSocketInterface(process.env.NEXT_PUBLIC_WSS_DOMAIN || "wss://minhasip.cloud:8089/ws");
      const ua = new JsSIP.UA({
        sockets: [socket],
        uri: `sip:${agentData.ramal}@minhasip.cloud`,
        password: webrtcPassword,
        session_timers: false,
        register: true,
        // Configurações aprimoradas para WebRTC
        pcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ],
          iceCandidatePoolSize: 10
        }
      });

      ua.on('connected', () => {
        console.log('✅ WebRTC conectado ao WebSocket');
        setWebrtcConnected(true);
      });

      ua.on('registered', () => {
        console.log('✅ WebRTC registrado');
        setWebrtcRegistered(true);
        setWebrtcConnecting(false);
        showToast('Conectado com Sucesso!', 'success');
      });

      ua.on('registrationFailed', (e: any) => {
        console.error('❌ Falha no registro WebRTC:', e.cause);
        setWebrtcRegistered(false);
        setWebrtcConnecting(false);
        showToast('Falha no registro WebRTC: ' + e.cause, 'error');
      });

      ua.on('disconnected', () => {
        console.log('🔴 WebRTC desconectado');
        setWebrtcConnected(false);
        setWebrtcRegistered(false);
      });

      ua.on('newRTCSession', (e: any) => {
        const session = e.session;
        setWebrtcSession(session);
        
        console.log('📞 Nova sessão WebRTC criada');
        
        session.on('progress', () => {
          console.log('📞 Chamada em progresso');
          setCallStatus('ringing');
          callRangRef.current = true;
          
          // Configurar som de chamando (ringback)
          try {
            const ringbackAudio = document.getElementById('ringbackAudio') as HTMLAudioElement;
            if (ringbackAudio) {
              // Usar tom de chamada padrão do navegador ou stream remoto se disponível
              const remoteStream = session.connection?.getRemoteStreams?.()?.[0];
              if (remoteStream) {
                ringbackAudio.srcObject = remoteStream;
                ringbackAudio.play().catch(e => console.warn('⚠️ Erro ao reproduzir ringback:', e));
                console.log('🔔 Som de chamando configurado');
              }
            }
          } catch (error) {
            console.warn('⚠️ Erro ao configurar som de chamando:', error);
          }
        });
        
        session.on('confirmed', () => {
          console.log('✅ Chamada WebRTC estabelecida');
          setCallStatus('connected');
          setCallDuration(0);
          callConfirmedRef.current = true;
          
          // Parar som de chamando
          try {
            const ringbackAudio = document.getElementById('ringbackAudio') as HTMLAudioElement;
            if (ringbackAudio) {
              ringbackAudio.pause();
              ringbackAudio.srcObject = null;
              console.log('🔇 Som de chamando parado');
            }
          } catch (error) {
            console.warn('⚠️ Erro ao parar som de chamando:', error);
          }
          
          // Configurar áudio da chamada
          try {
            // Configurar áudio remoto (da pessoa que atendeu)
            const remoteStream = session.connection.getRemoteStreams()[0];
            const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
            if (remoteAudio && remoteStream) {
              remoteAudio.srcObject = remoteStream;
              remoteAudio.play().catch(e => console.warn('⚠️ Erro ao reproduzir áudio remoto:', e));
              console.log('🔊 Áudio remoto configurado');
            }
            
            // Configurar áudio local (nosso microfone) - opcional para monitoramento
            const localStream = session.connection.getLocalStreams()[0];
            const localAudio = document.getElementById('localAudio') as HTMLAudioElement;
            if (localAudio && localStream) {
              localAudio.srcObject = localStream;
              // Não reproduzir áudio local para evitar feedback
              console.log('🎤 Áudio local configurado (mudo)');
            }
          } catch (error) {
            console.error('❌ Erro ao configurar áudio:', error);
          }
          
          // Iniciar contador de tempo
          const timer = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
          setCallTimer(timer);
          
          // Iniciar monitoramento de qualidade
          if (session.connection) {
            startQualityMonitoring(session.connection);
          }
        });
        
        session.on('ended', (e: any) => {
          console.log('📞 Chamada WebRTC encerrada:', e);
          void finalizeAndLogCall('ended', e);
          
          // Limpar áudio
          try {
            const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
            const localAudio = document.getElementById('localAudio') as HTMLAudioElement;
            if (remoteAudio) {
              remoteAudio.srcObject = null;
              remoteAudio.pause();
            }
            if (localAudio) {
              localAudio.srcObject = null;
              localAudio.pause();
            }
            console.log('🔇 Áudio limpo após encerrar chamada');
          } catch (error) {
            console.warn('⚠️ Erro ao limpar áudio:', error);
          }
          
          // Limpar flag de hangup intencional se existir
          if (session._isIntentionalHangup) {
            delete session._isIntentionalHangup;
          }
          // Abrir classificação (obrigatória) antes de limpar estados
          try {
            const endNumber = String(callTargetNumber || '');
            const endDuration = callDuration;
            openClassificationModal(endNumber, endDuration);
          } catch {}
          
          setWebrtcSession(null);
          setCallStatus('idle');
          setCallTarget('');
          setCallTargetNumber('');
          setCallDuration(0);
          setIsMuted(false);
          // Fechar ficha automaticamente ao encerrar a chamada
          setContactSheetOpen(false);
          setContactSheetData(null);
          
          // Parar monitoramento de qualidade
          stopQualityMonitoring();
          // Garantir que timer seja parado
          stopCallTimer();
          
        });
        
        session.on('failed', (e: any) => {
          // Verificar se é um hangup intencional
          if (session._isIntentionalHangup) {
            console.log('✅ Chamada encerrada intencionalmente');
            return;
          }
          
          // Verificar se a causa da falha é um hangup normal
          if (e && e.cause === 'Terminated') {
            console.log('✅ Chamada terminada normalmente');
            return;
          }
          
          const info = getWebRTCFailureInfo(e);
          console.error('❌ Falha na chamada WebRTC:', info, e);
          void finalizeAndLogCall('failed', e);
          setWebrtcSession(null);
          setCallStatus('idle');
          setCallTarget('');
          setCallTargetNumber('');
          setCallDuration(0);
          setIsMuted(false);
          // Fechar ficha automaticamente ao falhar/desligar
          setContactSheetOpen(false);
          setContactSheetData(null);
          
          // Parar monitoramento de qualidade
          stopQualityMonitoring();
          // Garantir que timer seja parado
          stopCallTimer();
          // Evitar spam de toasts quando Autodialer estiver rodando
          if (!autoDialerRunningRef.current) {
            const details = info.status ? ` (${info.status}${info.phrase ? ' ' + info.phrase : ''})` : '';
            showToast(`Falha na chamada: ${info.category}${details}`,'error');
          }
        });
      });

      setWebrtcUA(ua);
      ua.start();
      
    } catch (error) {
      console.error('❌ Erro ao conectar WebRTC:', error);
      setWebrtcConnecting(false);
      if (error instanceof Error && error.message.includes('JsSIP library failed to load')) {
        showToast('Biblioteca JsSIP não pôde ser carregada. Recarregue a página.', 'error');
      } else {
        showToast('Erro ao conectar WebRTC: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'error');
      }
    }
  };

  const disconnectWebRTC = () => {
    if (webrtcUA) {
      setWebrtcConnecting(true);
      try {
        webrtcUA.stop();
        setWebrtcUA(null);
        setWebrtcConnected(false);
        setWebrtcRegistered(false);
        setWebrtcSession(null);
        // Garantir estado de chamada e UI limpos
        setCallStatus('idle');
        setCallTarget('');
        setCallTargetNumber('');
        setCallDuration(0);
        setIsMuted(false);
        setContactSheetOpen(false);
        setContactSheetData(null);
        setWebrtcConnecting(false);
        showToast('Desconectado com Sucesso!', 'success');
      } catch (error) {
        console.error('❌ Erro ao desconectar WebRTC:', error);
        setWebrtcConnecting(false);
      }
    }
  };

  const makeWebRTCCall = () => {
    if (!webrtcUA || !webrtcRegistered) {
      showToast('WebRTC não está conectado/registrado', 'error');
      return;
    }

    if (!dialNumber.trim()) {
      showToast('Digite um número para ligar', 'error');
      return;
    }

    try {
      const options = {
        mediaConstraints: { 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }, 
          video: false 
        },
        rtcConfiguration: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      };

      setCallTarget(dialNumber);
      setCallTargetNumber(dialNumber);
      lastDialedNumberRef.current = dialNumber;
      setCallStatus('calling');
      
      // Add to recent calls
      setRecentCalls(prev => {
        const newCall = {
          number: dialNumber,
          status: 'Chamando',
          duration: 0,
          timestamp: new Date()
        };
        const updated = [newCall, ...prev.filter(call => call.number !== dialNumber)];
        return updated.slice(0, 5); // Keep only last 5 calls
      });
      
      const session = webrtcUA.call(`sip:${dialNumber}@minhasip.cloud`, options);
      setWebrtcSession(session);
      // Contexto de chamada manual
      resetCallContext();
      callInitiatedAtRef.current = Date.now();
      callNumberRef.current = dialNumber;
      callCampaignIdRef.current = null;
      callContactIdRef.current = null;
      
    } catch (error) {
      console.error('❌ Erro ao fazer chamada WebRTC:', error);
      showToast('Erro ao fazer chamada', 'error');
      setCallStatus('idle');
    }
  };

  const hangupWebRTCCall = () => {
    if (webrtcSession) {
      try {
        // Flag para indicar que é um hangup intencional
        webrtcSession._isIntentionalHangup = true;
        webrtcSession.terminate();
        setWebrtcSession(null);
        setCallStatus('idle');
        setCallTarget('');
        setCallTargetNumber('');
        setCallDuration(0);
        setIsMuted(false);
        // Fechar ficha se estiver aberta
        setContactSheetOpen(false);
        setContactSheetData(null);
        
        // Parar monitoramento de qualidade
        stopQualityMonitoring();
        
        if (callTimer) {
          clearInterval(callTimer);
          setCallTimer(null);
        }
        
        showToast('Chamada encerrada', 'success');
      } catch (error) {
        console.error('❌ Erro ao encerrar chamada WebRTC:', error);
      }
    }
  };

  // Helper para garantir que o track de áudio atual obedeça ao estado de mute
  const setAudioMuteState = (mute: boolean) => {
    try {
      if (!webrtcSession) return;
      const localStream = webrtcSession.connection.getLocalStreams?.()[0];
      const audioTracks: MediaStreamTrack[] = localStream ? localStream.getAudioTracks() : [];
      audioTracks.forEach(t => (t.enabled = !mute));

      const sender = webrtcSession.connection.getSenders?.().find((s: any) => s.track && s.track.kind === 'audio');
      if (sender && sender.track) {
        sender.track.enabled = !mute;
      }
      console.log(`🔁 setAudioMuteState -> mute=${mute}`, {
        tracks: audioTracks.map(t => ({ id: t.id, enabled: t.enabled })),
        senderEnabled: sender?.track?.enabled
      });
    } catch (e) {
      console.warn('⚠️ Falha ao aplicar estado de mute direto no track:', e);
    }
  };

  const toggleMute = () => {
    if (webrtcSession && callStatus === 'connected') {
      try {
        if (isMuted) {
          // Unmute
          webrtcSession.unmute({ audio: true });
          setAudioMuteState(false);
          setIsMuted(false);
          showToast('Microfone ativado', 'success');
        } else {
          // Mute
          webrtcSession.mute({ audio: true });
          setAudioMuteState(true);
          setIsMuted(true);
          showToast('Microfone mutado', 'success');
        }
      } catch (error) {
        console.error('❌ Erro ao alternar mute:', error);
      }
    }
  };

  const formatCallDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Call Quality Monitor Class
  class CallQualityMonitor {
    private pc: RTCPeerConnection | null = null;
    private lastStats: RTCStatsReport | null = null;
    private lastStatsTime: number = 0;

    constructor(peerConnection: RTCPeerConnection) {
      this.pc = peerConnection;
    }

    async getConnectionStats(): Promise<{
      packetLoss: number;
      jitter: number;
      rtt: number;
      audioLevel: number;
      bitrate: number;
      codec: string;
      networkType: string;
    }> {
      if (!this.pc) {
        throw new Error('PeerConnection não disponível');
      }

      try {
        const stats = await this.pc.getStats();
        const currentTime = Date.now();
        
        let packetLoss = 0;
        let jitter = 0;
        let rtt = 0;
        let audioLevel = 0;
        let bitrate = 0;
        let codec = 'unknown';
        let networkType = 'unknown';

        stats.forEach((report) => {
          // Inbound RTP Stats (recebimento)
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            if (report.packetsLost && report.packetsReceived) {
              packetLoss = (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100;
            }
            if (report.jitter !== undefined) {
              jitter = report.jitter * 1000; // Convert to ms
            }
            if (report.audioLevel !== undefined) {
              audioLevel = report.audioLevel;
            }
            
            // Calculate bitrate
            if (this.lastStats && this.lastStatsTime) {
              const lastReport = Array.from(this.lastStats.values()).find(
                (r: any) => r.type === 'inbound-rtp' && r.kind === 'audio' && r.ssrc === report.ssrc
              );
              if (lastReport && report.bytesReceived && lastReport.bytesReceived) {
                const timeDiff = (currentTime - this.lastStatsTime) / 1000;
                const bytesDiff = report.bytesReceived - lastReport.bytesReceived;
                bitrate = Math.round((bytesDiff * 8) / timeDiff); // bits per second
              }
            }
          }

          // Outbound RTP Stats (envio)
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            // Additional outbound metrics can be added here
          }

          // Candidate Pair Stats (RTT)
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              rtt = report.currentRoundTripTime * 1000; // Convert to ms
            }
            
            // Network type detection
            if (report.localCandidateId) {
              const localCandidate = stats.get(report.localCandidateId);
              if (localCandidate && localCandidate.networkType) {
                networkType = localCandidate.networkType;
              }
            }
          }

          // Codec Stats
          if (report.type === 'codec' && report.mimeType && report.mimeType.includes('audio')) {
            codec = report.mimeType.split('/')[1] || 'unknown';
          }
        });

        // Store current stats for next calculation
        this.lastStats = stats;
        this.lastStatsTime = currentTime;

        return {
          packetLoss: Math.round(packetLoss * 100) / 100,
          jitter: Math.round(jitter * 100) / 100,
          rtt: Math.round(rtt * 100) / 100,
          audioLevel: Math.round(audioLevel * 100) / 100,
          bitrate,
          codec,
          networkType
        };
      } catch (error) {
        console.error('❌ Erro ao obter estatísticas de qualidade:', error);
        throw error;
      }
    }

    getQualityRating(stats: {
      packetLoss: number;
      jitter: number;
      rtt: number;
    }): { rating: 'excellent' | 'good' | 'fair' | 'poor'; color: string } {
      // Excellent: < 1% packet loss, < 30ms jitter, < 150ms RTT
      // Good: < 3% packet loss, < 50ms jitter, < 300ms RTT
      // Fair: < 5% packet loss, < 100ms jitter, < 500ms RTT
      // Poor: >= 5% packet loss, >= 100ms jitter, >= 500ms RTT
      
      if (stats.packetLoss < 1 && stats.jitter < 30 && stats.rtt < 150) {
        return { rating: 'excellent', color: '#10b981' };
      } else if (stats.packetLoss < 3 && stats.jitter < 50 && stats.rtt < 300) {
        return { rating: 'good', color: '#3b82f6' };
      } else if (stats.packetLoss < 5 && stats.jitter < 100 && stats.rtt < 500) {
        return { rating: 'fair', color: '#f59e0b' };
      } else {
        return { rating: 'poor', color: '#ef4444' };
      }
    }
  }

  // Start quality monitoring
  const startQualityMonitoring = (peerConnection: RTCPeerConnection) => {
    if (qualityMonitorInterval) {
      clearInterval(qualityMonitorInterval);
    }

    const monitor = new CallQualityMonitor(peerConnection);
    
    const interval = setInterval(async () => {
      try {
        const stats = await monitor.getConnectionStats();
        setCallQuality(stats);
        
        // Log quality issues
        const quality = monitor.getQualityRating(stats);
        if (quality.rating === 'poor') {
          console.warn('⚠️ [QualityMonitor] Qualidade de chamada ruim detectada:', stats);
        }
      } catch (error) {
        console.error('❌ [QualityMonitor] Erro no monitoramento:', error);
      }
    }, 2000); // Update every 2 seconds

    setQualityMonitorInterval(interval);
  };

  // Stop quality monitoring
  const stopQualityMonitoring = () => {
    if (qualityMonitorInterval) {
      clearInterval(qualityMonitorInterval);
      setQualityMonitorInterval(null);
    }
    setCallQuality(null);
  };

  // ============================
  // Pós-chamada: Classificação
  // ============================
  const openClassificationModal = (number: string, durationSec: number) => {
    try {
      if (!agentData?.classification) return; // somente se obrigatório
      if (showClassification) return; // evitar abrir duas vezes
      // Garantir número correto (fallback para último discado)
      const n = String(number || lastDialedNumberRef.current || '');
      setClassificationNumber(n);
      setClassificationDuration(Math.max(0, Math.floor(durationSec || 0)));
      setClassificationRating(0);
      setClassificationReason('');
      setShowClassification(true);
      // Pausar autodiscagem até salvar avaliação
      setAwaiting(true);
      pauseAutoDialer();
      try { (window as any)?.showToast?.('Pausado para avaliação do atendimento', 'success'); } catch {}
    } catch {}
  };

  const handleSubmitClassification = async () => {
    if (!agentData?.classification) {
      setShowClassification(false);
      return;
    }
    if (classificationRating <= 0) {
      try { (window as any)?.showToast?.('Selecione de 1 a 5 estrelas', 'error'); } catch {}
      return;
    }
    setSavingClassification(true);
    try {
      const numToSend = String(classificationNumber || lastDialedNumberRef.current || '');
      if (!numToSend) {
        try { (window as any)?.showToast?.('Número inválido para avaliação', 'error'); } catch {}
        return;
      }
      const resp = await classificationService.submit({
        rating: classificationRating,
        reason: classificationReason || null,
        number: numToSend,
        duration: classificationDuration,
      });
      if (resp.success) {
        try { (window as any)?.showToast?.('Classificação salva com sucesso!', 'success'); } catch {}
        setShowClassification(false);
        setClassificationRating(0);
        setClassificationReason('');
        setClassificationNumber('');
        setClassificationDuration(0);
        // Retomar autodiscagem (se ativa)
        setAwaiting(false);
        if (autoDialerRunningRef.current) {
          resumeAutoDialer();
        }
      } else {
        try { (window as any)?.showToast?.(resp.message || 'Erro ao salvar classificação', 'error'); } catch {}
      }
    } catch (e) {
      try { (window as any)?.showToast?.('Erro ao salvar classificação', 'error'); } catch {}
    } finally {
      setSavingClassification(false);
    }
  };

  // Função para obter indicador de qualidade para UI
  const getQualityIndicator = () => {
    if (!callQuality) return { rating: 'desconhecida', color: '#9ca3af' };
    // Instanciar com objeto fictício apenas para usar o helper de rating
    const monitor = new CallQualityMonitor({} as any);
    return monitor.getQualityRating(callQuality);
  };

  // ...

  const getCallStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return `Ligando para ${callTarget}`;
      case 'ringing':
        return `Chamando ${callTarget}`;
      case 'connected':
        return `Cliente Atendeu, em chamada (${formatCallDuration(callDuration)})`;
      default:
        return '';
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const mapCallState = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'up':
        return 'Em conversa';
      case 'ring':
      case 'ringing':
        return 'Chamando';
      case 'hold':
        return 'Em espera';
      default:
        return 'Chamando';
    }
  };

  // Real-time duration calculation
  const calculateRealTimeDuration = (startTime: Date): number => {
    return Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
  };

  // Modal handlers
  const openConfirmHangup = (call: ActiveCall) => {
    setConfirmHangupTarget(call);
    setConfirmHangupOpen(true);
  };

  const closeConfirmHangup = () => {
    setConfirmHangupOpen(false);
    setConfirmHangupTarget(null);
    setConfirmHangupLoading(false);
  };

  const confirmHangup = async () => {
    if (!confirmHangupTarget) return;
    try {
      setConfirmHangupLoading(true);
      await handleHangupCall(confirmHangupTarget.id);
    } finally {
      closeConfirmHangup();
    }
  };

  // Auto-close transfer modal if target call disappears (apenas do ramal)
  useEffect(() => {
    if (!transferModalOpen || !transferTarget) return;
    const stillExists = filteredCalls.some((c) => c.id === transferTarget.id);
    if (!stillExists) {
      setTransferModalOpen(false);
      setTransferTarget(null);
    }
  }, [filteredCalls, transferModalOpen, transferTarget]);

  // Load active calls function (DEPRECATED - agora usa useActiveCallsOptimized)
  const loadActiveCalls = async () => {
    try {
      // Se não há dados pré-carregados, mostrar loading
      const preloadedData = localStorage.getItem('agent_active_calls_preloaded');
      // Removido setLoadingCalls - agora controlado pelo hook otimizado

      const token = localStorage.getItem('agent_token');
      if (!token) {
        console.warn('⚠️ [Dashboard] Token não encontrado para chamadas ativas');
        return;
      }

      // Get current agent data to use user_id for filtering
      if (!agentData?.user_id) {
        console.warn('⚠️ [Dashboard] Dados do agente não encontrados para chamadas ativas');
        return;
      }

      console.log('📞 [Dashboard] Buscando chamadas ativas para user_id:', agentData.user_id);
      console.log('📞 [Dashboard] Ramal do agente:', agentData.ramal);
      
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/active-calls?accountcode=${agentData.user_id}`;
      console.log('📞 [Dashboard] URL da requisição:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📞 [Dashboard] Status da resposta:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📞 [Dashboard] Resposta completa da API:', JSON.stringify(data, null, 2));
        
        if (data.success) {
          if (data.data?.records && Array.isArray(data.data.records)) {
            console.log('📞 [Dashboard] Número de registros encontrados:', data.data.records.length);
            
            // Map ARI data to our format with better error handling
            const mappedCalls = data.data.records
              .filter((record: any) => {
                // Filtrar apenas chamadas que envolvem o ramal do agente logado
                const channelName = String(record.name || '').toLowerCase();
                const agentExtension = String(agentData?.ramal || '');
                
                if (!agentExtension) {
                  console.warn('⚠️ [Dashboard] Ramal do agente não encontrado para filtragem');
                  return false;
                }
                
                // Verificar se o canal contém o ramal do agente (formato: PJSIP/1001-xxxxx)
                const extensionMatch = channelName.includes(`pjsip/${agentExtension.toLowerCase()}-`) ||
                                     channelName.includes(`/${agentExtension}-`) ||
                                     channelName === `pjsip/${agentExtension.toLowerCase()}`;
                
                console.log('🔍 [Dashboard] Filtrando canal:', {
                  channelName,
                  agentExtension,
                  match: extensionMatch
                });
                
                return extensionMatch;
              })
              .map((record: any) => {
                // Calculate start time from creationtime or use current time as fallback
                const startTime = record.creationtime ? new Date(record.creationtime) : new Date(Date.now() - (record.duration || 0) * 1000);
                const realTimeDuration = Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
                
                const mappedCall = {
                  id: record.id || record.channelId || record.name || `call-${Date.now()}`,
                  callerid: record.caller?.number || record.callerid || 'Desconhecido',
                  destination: record.connected?.number || record.dialplan?.exten || record.exten || record.destination || 'Desconhecido',
                  duration: realTimeDuration,
                  status: mapCallState(record.state || record.channelState),
                  startTime: startTime,
                  extension: agentData?.ramal
                };
                
                console.log('📞 [Dashboard] Chamada mapeada (filtrada):', mappedCall);
                return mappedCall;
              })
              .filter((call: ActiveCall) => call.id); // Filter out any calls without valid IDs
            
            console.log('📞 [Dashboard] Total de chamadas válidas:', mappedCalls.length);
            setLocalCalls(mappedCalls);
            
            // Limpar managingCall se a chamada gerenciada não existe mais
            if (managingCall && !mappedCalls.find((call: ActiveCall) => call.id === managingCall)) {
              console.log('🧹 [Dashboard] Limpando chamada gerenciada que não existe mais:', managingCall);
              setManagingCall(null);
              setManagingCallSnapshot(null);
              setDtmfCapturing(false);
              setCapturedDigits('');
              setAudioInjecting(false);
            }
            
            console.log('✅ [Dashboard] Chamadas ativas atualizadas no estado');
            // Atualizar dados pré-carregados para próxima vez
            localStorage.setItem('agent_active_calls_preloaded', JSON.stringify(mappedCalls));
          } else {
            console.log('📞 [Dashboard] Nenhuma chamada ativa encontrada');
            setLocalCalls([]);
            localStorage.setItem('agent_active_calls_preloaded', JSON.stringify([]));
            
            // Limpar estados quando não há chamadas ativas
            if (managingCall) {
              console.log('🧹 [Dashboard] Limpando estados - nenhuma chamada ativa');
              setManagingCall(null);
              setManagingCallSnapshot(null);
              setDtmfCapturing(false);
              setCapturedDigits('');
              setAudioInjecting(false);
            }
          }
        } else {
          console.error('❌ [Dashboard] API retornou success: false:', data.message);
          // Manter dados pré-carregados se houver erro
          if (!preloadedData) {
            setLocalCalls([]);
          }
          
          // Limpar estados quando há erro na API
          if (managingCall) {
            console.log('🧹 [Dashboard] Limpando estados - erro na API');
            setManagingCall(null);
            setManagingCallSnapshot(null);
            setDtmfCapturing(false);
            setCapturedDigits('');
            setAudioInjecting(false);
          }
        }
      } else {
        console.error('❌ [Dashboard] Erro na API chamadas ativas:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ [Dashboard] Detalhes do erro:', errorText);
        // Manter dados pré-carregados se houver erro
        if (!preloadedData) {
          setLocalCalls([]);
        }
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro na função loadActiveCalls:', error);
      // Manter dados pré-carregados se houver erro
      const preloadedData = localStorage.getItem('agent_active_calls_preloaded');
      if (!preloadedData) {
        setLocalCalls([]);
      }
      
      // Limpar estados quando há erro na função
      if (managingCall) {
        console.log('🧹 [Dashboard] Limpando estados - erro na função');
        setManagingCall(null);
        setManagingCallSnapshot(null);
        setDtmfCapturing(false);
        setCapturedDigits('');
        setAudioInjecting(false);
      }
    } finally {
      // Loading state agora é controlado pelo hook otimizado
    }
  };

  const handleSaveCallerId = async () => {
    if (!agentData || !tempCallerId.trim()) return;

    setSavingCallerId(true);
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        showToast('Token de autenticação não encontrado', 'error');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/${agentData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          callerid: tempCallerId.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        // Atualizar dados locais
        setAgentData(prev => prev ? { ...prev, callerid: tempCallerId.trim() } : null);
        setEditingCallerId(false);
        setTempCallerId('');
        showToast('Caller ID atualizado com sucesso!', 'success');
      } else {
        showToast(data.message || 'Erro ao atualizar Caller ID', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar Caller ID:', error);
      showToast('Erro de conexão ao salvar Caller ID', 'error');
    } finally {
      setSavingCallerId(false);
    }
  };

  const handleHangupCall = async (callId: string) => {
    try {
      // Bloquear desligamento de chamadas que não pertencem ao ramal do agente
      const target = filteredCalls.find((c) => c.id === callId && String(c.extension || '').trim() === String(agentData?.ramal || '').trim());
      if (!target) {
        console.warn('[SECURITY] Hangup bloqueado: chamada não pertence ao ramal do agente', { callId, ramal: agentData?.ramal });
        showToast('Operação não permitida para este ramal', 'error');
        return;
      }
      const token = localStorage.getItem('agent_token');
      const response = await fetch(`${API_BASE}/api/active-calls/hangup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: callId })
      });

      const data = await response.json();
      if (data.success) {
        console.log('✅ [Dashboard] Chamada desligada com sucesso:', data.message);
        // Atualização otimista: remover a chamada da lista local imediatamente
        setLocalCalls(prev => prev.filter(c => c.id !== callId));
        // Limpar estados relacionados se necessário
        if (managingCall === callId) {
          setManagingCall(null);
          setManagingCallSnapshot(null); // Limpar snapshot para evitar piscar
          setDtmfCapturing(false);
          setCapturedDigits('');
          setAudioInjecting(false);
        }
      } else {
        console.error('❌ [Dashboard] Erro ao desligar chamada:', data.message);
        alert(`Erro: ${data.message}`);
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao desligar chamada:', error);
      alert('Erro interno ao desligar chamada');
    }
  };

  const handleTransferCall = async (callId: string) => {
    // Abrir modal de transferência com a chamada selecionada (somente do ramal do agente)
    const found = filteredCalls.find((c) => c.id === callId);
    if (!found) {
      console.warn('⚠️ [SECURITY] Transferência bloqueada: chamada não pertence ao ramal do agente', { callId, ramal: agentData?.ramal });
      showToast('Operação não permitida para este ramal', 'error');
      return;
    }
    const ext = found.extension || agentData?.ramal || '';
    const optimizedCall: OptimizedActiveCall = {
      id: found.id,
      extension: ext,
      agentName: '',
      callerNumber: found.callerid || '',
      callerName: undefined,
      userId: agentData ? String(agentData.user_id || '') : undefined,
      direction: 'inbound',
      status: 'talking',
      duration: found.duration || 0,
      startTime: found.startTime || new Date(),
      destination: found.destination || undefined,
      queue: undefined,
    };

    setTransferTarget(optimizedCall);
    setTransferModalOpen(true);
  };

  const loadAgentCampaigns = async () => {
    if (!agentData?.id) return;

    try {
      // Se não há dados pré-carregados, mostrar loading
      const preloadedData = localStorage.getItem('agent_campaigns_preloaded');
      if (!preloadedData) {
        setLoadingCampaigns(true);
      }

      const token = localStorage.getItem('agent_token');
      if (!token) {
        console.warn('⚠️ [Dashboard] Token não encontrado para campanhas');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/mailings/agent/${agentData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAgentCampaigns(data.data);
          // Atualizar dados pré-carregados para próxima vez
          localStorage.setItem('agent_campaigns_preloaded', JSON.stringify(data.data));
        } else {
          setAgentCampaigns([]);
        }
      } else {
        console.error('❌ [Dashboard] Erro ao buscar campanhas:', response.status);
        // Manter dados pré-carregados se houver erro
        if (!preloadedData) {
          setAgentCampaigns([]);
        }
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao carregar campanhas:', error);
      // Manter dados pré-carregados se houver erro
      const preloadedData = localStorage.getItem('agent_campaigns_preloaded');
      if (!preloadedData) {
        setAgentCampaigns([]);
      }
    } finally {
      setLoadingCampaigns(false);
    }
  };

  // Iniciar autodiscagem com seed e buffer de 20 contatos
  const handleStartAutoCampaign = async (campaign: any) => {
    if (!webrtcUA || !webrtcRegistered) {
      showToast('WebRTC não está conectado. Conecte antes de iniciar a discagem automática.', 'error');
      return;
    }

    if (!agentData?.id) {
      showToast('Carregando dados do agente... Tente novamente em alguns segundos.', 'error');
      return;
    }

    try {
      setAutoStarting(true);
      setLoadingContacts(true);
      const token = localStorage.getItem('agent_token');
      if (!token) {
        showToast('Token de autenticação do agente não encontrado', 'error');
        return;
      }

      // Pré-checagem: campanha tem contatos atribuídos a este agente?
      const hasForAgent = await checkContactsForAgent(campaign.id);
      if (!hasForAgent) {
        showToast('Esta campanha não possui contatos atribuídos ao seu ramal. Selecione outra campanha ou redistribua os contatos.', 'error');
        return;
      }

      // Seed 2-níveis: 50 ativa + 50 memória
      const seeded = await seedTwoTier(campaign.id);
      if ((seeded.activeCount || 0) === 0) {
        showToast('Nenhum contato disponível no momento para este ramal nesta campanha.', 'error');
        return;
      }

      // Preparar estado da campanha
      setAutoDialerCampaign(campaign);
      setAutoDialerRunning(true);
      setAutoDialerPaused(false);
      // Atualizar refs imediatamente para evitar race em callbacks async
      autoDialerRunningRef.current = true;
      autoDialerPausedRef.current = false;
      setAutoDialerStats({
        total: autoDialerContactsRef.current.length,
        completed: 0,
        successful: 0,
        failed: 0,
        remaining: Math.max(0, autoDialerContactsRef.current.length - 1)
      });
      // Iniciar primeira chamada passando o estado diretamente
      startNextAutoCallWithState(autoDialerContactsRef.current, true, false);
      // Reabastecer fila em background
      void ensureAutoQueueReplenish();
      // Agendar reabastecimento contínuo a cada 2s enquanto rodando
      if (autoReplenishTimerRef.current) {
        clearInterval(autoReplenishTimerRef.current);
      }
      autoReplenishTimerRef.current = setInterval(() => {
        if (autoDialerRunningRef.current && !autoDialerPausedRef.current) {
          void ensureAutoQueueReplenish();
        }
      }, 2000);
      console.log(`🤖 [AutoDialer] Iniciando campanha automática: ${campaign.name} (ativa=${autoDialerContactsRef.current.length}, memória=${autoMemoryBufferRef.current.length})`);
    } catch (error) {
      console.error('❌ [AutoDialer] Erro ao iniciar campanha automática:', error);
      showToast('Erro ao iniciar campanha automática', 'error');
    } finally {
      setAutoStarting(false);
      setLoadingContacts(false);
    }
  };

const pauseAutoDialer = () => {
  setAutoDialerPaused(true);
  if (autoDialerTimeout) {
    clearTimeout(autoDialerTimeout);
    setAutoDialerTimeout(null);
  }
  if (autoReplenishTimerRef.current) {
    clearInterval(autoReplenishTimerRef.current);
    autoReplenishTimerRef.current = null;
  }
  console.log('⏸️ [AutoDialer] Pausado');
};

const resumeAutoDialer = () => {
  if (!autoDialerRunning) return;
  
  setAutoDialerPaused(false);
  autoDialerPausedRef.current = false;
  console.log('▶️ [AutoDialer] Retomando discagem automática');
  // Reiniciar reabastecimento em background
  if (autoReplenishTimerRef.current) {
    clearInterval(autoReplenishTimerRef.current);
  }
  autoReplenishTimerRef.current = setInterval(() => {
    if (autoDialerRunningRef.current && !autoDialerPausedRef.current) {
      void ensureAutoQueueReplenish();
    }
  }, 2000);
  
  // Continuar com a fila atual imediatamente
  if (autoDialerQueue.length > 0) {
    setTimeout(() => {
      startNextAutoCall(autoDialerQueue);
    }, 100);
  }
};

  const handleCloseReview = () => {
    setReviewingCampaign(null);
    setCampaignContacts([]);
    setContactsPage(1);
    setContactsTotal(0);
  };

  const handleContactsPageChange = async (newPage: number) => {
    if (reviewingCampaign) {
      setContactsPage(newPage);
      await loadCampaignContacts(reviewingCampaign.id, newPage);
    }
  };

  const handleCallContact = async (contact: {id: string, name: string, number: string}) => {
    if (!reviewingCampaign) return;

    // Verificar se WebRTC está conectado antes de prosseguir
    if (!webrtcUA || !webrtcRegistered) {
      showToast('WebRTC não está conectado. Conecte primeiro para fazer chamadas.', 'error');
      return;
    }

    try {
      // Realizar a chamada primeiro
      setDialNumber(contact.number);
      
      // Fazer a chamada WebRTC com configurações de áudio
      const session = webrtcUA.call(`sip:${contact.number}@minhasip.cloud`, {
        sessionTimersExpires: 120,
        mediaConstraints: {
          audio: true,
          video: false
        },
        rtcConfiguration: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        }
      });
      // Iniciar destaque imediatamente
      setManualActiveContactId(contact.id);
      // Memorizar último contato discado (para ficha no discador) incluindo raw quando disponível
      setLastDialedContact(contact as any);

      // Configurar áudio usando o padrão moderno (track event)
      const attachRemoteAudio = (sess: any) => {
        try {
          const pc = sess.connection; // RTCPeerConnection
          pc.addEventListener('track', (evt: any) => {
            console.log('📻 [WebRTC] Stream de áudio recebido via track event');
            const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
            if (remoteAudio && evt.streams && evt.streams[0]) {
              remoteAudio.srcObject = evt.streams[0];
              remoteAudio.volume = 1.0;
              remoteAudio.autoplay = true;
              remoteAudio.play().catch(err => {
                console.log('Tentando reproduzir áudio após interação do usuário:', err);
                // Tentar novamente após um pequeno delay
                setTimeout(() => {
                  remoteAudio.play().catch(e => console.log('Erro final ao reproduzir áudio:', e));
                }, 100);
              });
            }
          });
        } catch (e) {
          console.log('⚠️ Não foi possível anexar áudio remoto: ' + e);
        }
      };

      attachRemoteAudio(session);

      // Aguardar o início da chamada para contabilizar e destacar contato ativo
      session.on('progress', async () => {
        console.log('📞 [Dashboard] Chamada iniciando...');
        setManualActiveContactId(contact.id);
        
        // Agora sim contabilizar a discagem no backend
        const token = localStorage.getItem('agent_token');
        if (token) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/mailings/${reviewingCampaign.id}/dial`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contactIndex: parseInt(contact.id) - 1
            })
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`✅ [Dashboard] Discagem contabilizada: ${data.data.total_discados} total`);
            showToast(`Chamada iniciada para ${contact.name}`, 'success');
          } else {
            console.error('❌ [Dashboard] Erro ao contabilizar discagem:', response.status);
          }
        }
      });

      // Ao finalizar a chamada, remover contato e limpar destaque
      session.on('ended', () => {
        console.log('📴 [Dashboard] Chamada finalizada');
        setManualActiveContactId((curr) => curr === contact.id ? null : curr);
        // Remover o contato da lista somente ao finalizar
        setCampaignContacts(prev => {
          const updated = prev.filter(c => c.id !== contact.id);
          if (updated.length < 3 && reviewingCampaign) {
            loadCampaignContacts(reviewingCampaign.id, contactsPage);
          }
          return updated;
        });
      });

      session.on('failed', () => {
        showToast(`Falha ao conectar com ${contact.name}`, 'error');
        // Em caso de falha, apenas limpar destaque (não remover)
        setManualActiveContactId((curr) => curr === contact.id ? null : curr);
      });

      // Garantir destaque também quando a chamada é aceita
      session.on('accepted', () => {
        setManualActiveContactId(contact.id);
      });

      setWebrtcSession(session);
      setCallStatus('calling');
      setCallTarget(contact.name);
      setCallTargetNumber(contact.number);
      lastDialedNumberRef.current = contact.number;
      
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao processar discagem:', error);
      showToast('Erro ao processar discagem', 'error');
    }
  };

  // Função para injetar áudio na chamada WebRTC
  const injectAudioToCall = async (audioId: string) => {
    if (!webrtcSession || !audioId) {
      showToast('Sessão WebRTC não ativa ou áudio não selecionado', 'error');
      return;
    }

    try {
      console.log('🎵 Iniciando injeção de áudio:', audioId);
      
      // Injeção de áudio sem interferir no controle de mute
      console.log('🎵 Iniciando injeção de áudio sem alterar estado do microfone');
      
      // Buscar URL do áudio
      const token = localStorage.getItem('agent_token');
      const audioUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audios/play/${audioId}?token=${token}`;
      
      // Criar elemento de áudio
      const audioElement = new Audio(audioUrl);
      audioElement.crossOrigin = 'anonymous';
      
      // Aguardar carregamento do áudio
      await new Promise((resolve, reject) => {
        audioElement.oncanplaythrough = resolve;
        audioElement.onerror = reject;
        audioElement.load();
      });

      // Obter o stream atual da sessão WebRTC
      const localStream = webrtcSession.connection.getLocalStreams()[0];
      if (!localStream) {
        showToast('Stream local não encontrado', 'error');
        return;
      }

      // Salvar track original para restaurar depois
      const originalTrack = localStream.getAudioTracks()[0];
      setOriginalAudioTrack(originalTrack);

      // Criar AudioContext se não existir
      let ctx = audioContext;
      if (!ctx) {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
      }

      // Criar nós de áudio
      const audioElementSource = ctx.createMediaElementSource(audioElement);
      const microphoneSource = ctx.createMediaStreamSource(localStream);
      const destination = ctx.createMediaStreamDestination();
      const gainNode = ctx.createGain();
      const micGainNode = ctx.createGain();

      // Conectar áudio do arquivo
      audioElementSource.connect(gainNode);
      gainNode.connect(destination);

      // Conectar microfone com controle baseado no modo selecionado
      microphoneSource.connect(micGainNode);
      micGainNode.connect(destination);

      // Não alteramos o ganho do microfone aqui; respeitamos o estado manual (mute/unmute) do usuário
      // Se o usuário mutou via botão, o track ficará desabilitado pelo WebRTC.
      // Caso contrário, deixa o ganho normal.
      micGainNode.gain.value = 1.0;

      // Substituir o track de áudio na sessão WebRTC
      const audioTrack = destination.stream.getAudioTracks()[0];
      const sender = webrtcSession.connection.getSenders().find((s: any) => 
        s.track && s.track.kind === 'audio'
      );

      if (sender) {
        await sender.replaceTrack(audioTrack);
        console.log('✅ Track de áudio substituído');
      }

      // Reproduzir o áudio
      audioElement.play();
      setCurrentAudioElement(audioElement);
      setAudioInjecting(true);
      showToast('Áudio injetado na chamada', 'success');

      // Quando o áudio terminar, apenas restaurar o microfone mas manter o card aberto
      audioElement.onended = async () => {
        try {
          console.log('🎵 Áudio terminou, restaurando microfone...');
          
          // Parar o áudio atual
          if (currentAudioElement) {
            currentAudioElement.pause();
            currentAudioElement.currentTime = 0;
            setCurrentAudioElement(null);
          }

          // Restaurar track original
          if (webrtcSession && originalAudioTrack) {
            const sender = webrtcSession.connection.getSenders().find((s: any) => 
              s.track && s.track.kind === 'audio'
            );
            
            if (sender) {
              await sender.replaceTrack(originalAudioTrack);
              console.log('✅ Track de áudio original restaurado');
            }
          }

          setOriginalAudioTrack(null);
          showToast('Áudio finalizado.', 'success');
          
          // NÃO fechar o card de injeção de áudio (manter audioInjecting = true)
          
        } catch (error) {
          console.error('❌ Erro ao restaurar microfone após áudio:', error);
          showToast('Erro ao restaurar microfone', 'error');
        }
      };

    } catch (error) {
      console.error('❌ Erro ao injetar áudio:', error);
      showToast('Erro ao injetar áudio: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'error');
    }
  };

  // Função para parar a injeção de áudio (sem desmute automático)
  const stopAudioInjection = async () => {
    try {
      console.log('🛑 Parando injeção de áudio...');
      
      // Parar o áudio atual
      if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        setCurrentAudioElement(null);
      }

      // Restaurar track original
      if (webrtcSession && originalAudioTrack) {
        const sender = webrtcSession.connection.getSenders().find((s: any) => 
          s.track && s.track.kind === 'audio'
        );
        
        if (sender) {
          await sender.replaceTrack(originalAudioTrack);
          console.log('✅ Track de áudio original restaurado');
        }
      }

      setOriginalAudioTrack(null);
      showToast('Áudio parado.', 'success');
      
    } catch (error) {
      console.error('❌ Erro ao parar injeção de áudio:', error);
      showToast('Erro ao parar áudio', 'error');
    }
  };

    const loadAgentWithStatus = async (ramal: string) => {
      try {
        if (!ramal || ramal === 'undefined') {
          console.warn('⚠️ [Dashboard] Ramal inválido:', ramal);
          return;
        }

        const token = localStorage.getItem('agent_token');
        if (!token) {
          console.warn('⚠️ [Dashboard] Token não encontrado');
          return;
        }

        console.log('🔍 [Dashboard] Buscando status do ramal:', ramal);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agents/ramal/${ramal}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Update extension status from backend
            setExtensionStatus(data.data.liveStatus === 'online' ? 'online' : 'offline');
            console.log('✅ [Dashboard] Status atualizado:', data.data.liveStatus);
          }
        } else {
          console.error('❌ [Dashboard] Erro na API:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error loading agent status:', error);
      }
    };

    const loadCallStats = async (ramal: string) => {
      try {
        if (!ramal || ramal === 'undefined') {
          console.warn('⚠️ [Dashboard] Ramal inválido para CDR:', ramal);
          return;
        }

        const token = localStorage.getItem('agent_token');
        if (!token) {
          console.warn('⚠️ [Dashboard] Token não encontrado para CDR');
          return;
        }

        console.log('📊 [Dashboard] Buscando estatísticas de chamadas para ramal:', ramal);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/cdr/agent/${ramal}?limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('📊 [Dashboard] Resposta da API CDR:', data);
          
          if (data.success && data.data) {
            const stats = data.data.stats;
            setCallStats({
              today: stats?.today_calls || 0,
              total: stats?.total_calls || 0
            });
            console.log('✅ [Dashboard] Estatísticas carregadas:', { 
              hoje: stats?.today_calls || 0, 
              total: stats?.total_calls || 0,
              answered: stats?.answered_calls || 0,
              duration: stats?.total_duration || 0
            });
          }
        } else {
          console.error('❌ [Dashboard] Erro na API CDR:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ [Dashboard] Detalhes do erro:', errorText);
        }
      } catch (error) {
        console.error('Error loading call stats:', error);
      }
    };

  // Função para carregar dados pré-carregados do localStorage
  const loadPreloadedData = () => {
    try {
      // 1. Carregar configuração do dashboard
      const configData = localStorage.getItem('agent_dashboard_config');
      if (configData) {
        const config = JSON.parse(configData);
        setDashboardConfig(config);
        console.log('✅ [Dashboard] Configuração pré-carregada:', config);
      }

      // 2. Carregar campanhas pré-carregadas
      const campaignsData = localStorage.getItem('agent_campaigns_preloaded');
      if (campaignsData) {
        const campaigns = JSON.parse(campaignsData);
        setAgentCampaigns(campaigns);
        console.log('✅ [Dashboard] Campanhas pré-carregadas:', campaigns);
      }

      // 3. Carregar chamadas ativas pré-carregadas
      const callsData = localStorage.getItem('agent_active_calls_preloaded');
      if (callsData) {
        const calls = JSON.parse(callsData);
        // Garantir que calls seja sempre um array
        if (Array.isArray(calls)) {
          setLocalCalls(calls);
          console.log('✅ [Dashboard] Chamadas ativas pré-carregadas:', calls);
        } else {
          setLocalCalls([]);
          console.warn('⚠️ [Dashboard] Dados de chamadas pré-carregadas inválidos, usando array vazio');
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar dados pré-carregados:', error);
    }
  };

  // Função para carregar dados do agente
  const loadAgentData = async () => {
    try {
      setLoading(true);
      console.log('🔄 [Dashboard] Carregando dados do agente...');
      
      // Primeiro, carregar dados pré-carregados para renderização imediata
      loadPreloadedData();
      
      // First try to get from localStorage
      const storedData = agentAuthService.getStoredAgentData();
      if (storedData) {
        console.log('✅ [Dashboard] Dados do agente carregados do localStorage:', storedData);
        setAgentData(storedData);
        setTempCallerId(storedData.callerid || '');
        setLoading(false);
        return;
      }

      // If not in localStorage, try to get from API
      const response = await agentAuthService.getCurrentAgent();
      if (response.success && response.data) {
        console.log('✅ [Dashboard] Dados do agente carregados da API:', response.data);
        setAgentData(response.data);
        setTempCallerId(response.data.callerid || '');
      } else {
        console.error('❌ [Dashboard] Erro ao carregar dados do agente:', response.message);
        // Redirect to login if not authenticated
        window.location.href = '/agent/login';
      }
    } catch (error) {
      console.error('❌ [Dashboard] Erro ao carregar dados do agente:', error);
      window.location.href = '/agent/login';
    } finally {
      setLoading(false);
    }
  };

  // useEffect para carregar dados iniciais
  useEffect(() => {
    loadAgentData();
  }, []);

  // useEffect para carregar áudios quando agentData estiver disponível
  useEffect(() => {
    if (agentData?.id) {
      loadAvailableAudios();
    }
  }, [agentData?.id]);

  // useEffect para carregar campanhas quando agentData estiver disponível
  useEffect(() => {
    if (agentData?.id) {
      loadAgentCampaigns();
    }
  }, [agentData?.id]);

  // Realtime status_sip via Supabase (igual à página /agents). Sem polling.
  useEffect(() => {
    if (!agentData?.user_id || !agentData?.ramal) return;

    // Primeiro: uma consulta direta via API para status atual
    (async () => {
      try {
        await loadAgentWithStatus(agentData.ramal);
      } catch (e) {
        console.warn('⚠️ Erro ao carregar status inicial via API', e);
      }
    })();

    // Listener para updates de status_sip
    const removeListener = agentsRealtimeService.addListener((update) => {
      if (update.ramal === agentData.ramal) {
        // Mapear status_sip ('online' | 'offline' | 'busy' | 'away') para badge local ('online' | 'offline')
        setExtensionStatus(update.status === 'online' ? 'online' : 'offline');
      }
    });

    // Iniciar realtime somente para o ramal do agente logado
    agentsRealtimeService.startRealtimeForAgents([String(agentData.ramal)], String(agentData.user_id));

    return () => {
      // Limpar listener e parar o realtime ao sair da página
      try { removeListener(); } catch {}
      try { agentsRealtimeService.stopRealtime(); } catch {}
    };
  }, [agentData?.user_id, agentData?.ramal]);

  // Chamadas Hoje: sem polling. Apenas uma chamada na entrada / mudança de ramal
  useEffect(() => {
    if (!agentData?.ramal) return;
    (async () => {
      try {
        await loadCallStats(agentData.ramal);
      } catch (e) {
        console.warn('⚠️ Erro ao carregar Chamadas Hoje na entrada', e);
      }
    })();
  }, [agentData?.ramal]);

  // Separate useEffect for active calls polling (only after agentData is loaded)
  useEffect(() => {
    // Polling legado desativado. O fluxo oficial de dados é via useActiveCallsOptimized.
    // Mantido propositalmente vazio para evitar chamadas duplicadas e flicker.
    console.log('[Dashboard] Polling legado desativado; usando useActiveCallsOptimized');
  }, [agentData?.user_id]);

  // Real-time duration update for active calls (apenas do ramal)
  useEffect(() => {
    if (filteredCalls.length === 0) return;

    const durationInterval = setInterval(() => {
      // Mock function for now - remove when calculateRealTimeDuration is properly implemented
      console.log('Updating call durations...');
    }, 1000); // Update every second

    return () => {
      clearInterval(durationInterval);
    };
  }, [filteredCalls.length]);

  // 🧹 CLEANUP SEGURO - Limpeza de recursos no unmount (OTIMIZAÇÃO SEGURA)
  useEffect(() => {
    return () => {
      console.log('[Dashboard] 🧹 Executando cleanup seguro...');
      
      // Limpar intervals de qualidade de chamada
      if (qualityMonitorInterval) {
        clearInterval(qualityMonitorInterval);
        console.log('[Dashboard] ✅ Quality monitor interval limpo');
      }
      
      // Limpar subscription DTMF do Supabase
      if (dtmfSubscription) {
        try {
          dtmfSubscription.unsubscribe();
          console.log('[Dashboard] ✅ DTMF subscription removida');
        } catch (error) {
          console.warn('[Dashboard] ⚠️ Erro ao remover DTMF subscription:', error);
        }
      }
      
      // Pausar áudio atual se estiver tocando
      if (currentAudioElement) {
        try {
          currentAudioElement.pause();
          currentAudioElement.currentTime = 0;
          console.log('[Dashboard] ✅ Áudio atual pausado');
        } catch (error) {
          console.warn('[Dashboard] ⚠️ Erro ao pausar áudio:', error);
        }
      }
      
      // Limpar timer de chamada se ativo
      if (callTimer) {
        clearInterval(callTimer);
        console.log('[Dashboard] ✅ Call timer limpo');
      }
      
      // Limpar timeout do toast se ativo
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        console.log('[Dashboard] ✅ Toast timeout limpo');
      }
      
      console.log('[Dashboard] 🎯 Cleanup concluído com sucesso');
    };
  }, []); // Executar apenas no unmount

  const startCallTimer = () => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    setCallTimer(timer);
  };

  const stopCallTimer = () => {
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
  };

  // Função para carregar áudios disponíveis
  const loadAvailableAudios = async () => {
    if (!agentData?.id) return;
    
    setLoadingAudios(true);
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        console.error('Token não encontrado');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audios/agent/${agentData.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableAudios(data.data || []);
          console.log(`✅ ${data.data?.length || 0} áudios carregados`);
        }
      } else {
        console.error('Erro ao carregar áudios:', response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar áudios:', error);
    } finally {
      setLoadingAudios(false);
    }
  };

  if (loading) {
    return (
      <AgentLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100%'
        }}>
          <Activity size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </AgentLayout>
    );
  }

  const stats = [
    {
      title: 'Chamadas Hoje',
      value: callStats.today,
      icon: PhoneCall,
      color: '#10b981',
      bgColor: '#ecfdf5'
    },
    {
      title: 'CallerID (BINA)',
      value: agentData?.callerid || 'Não configurado',
      icon: PhoneCall,
      color: '#10b981',
      bgColor: '#ecfdf5'
    },
    {
      title: 'Status',
      value: extensionStatus === 'online' ? 'Online' : 'Offline',
      icon: Activity,
      color: extensionStatus === 'online' ? '#10b981' : '#ef4444',
      bgColor: extensionStatus === 'online' ? '#ecfdf5' : '#fef2f2'
    },
    {
      title: 'WebRTC (Chamadas via Navegador)',
      value: agentData?.webrtc ? 'Habilitado' : 'Desabilitado',
      icon: Users,
      color: agentData?.webrtc ? '#10b981' : '#64748b',
      bgColor: agentData?.webrtc ? '#ecfdf5' : '#f1f5f9'
    }
  ];

  return (
    <AgentLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ 
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          columnGap: '16px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: '#1e293b',
              margin: 0,
              marginBottom: '8px'
            }}>
              Dashboard do Agente
            </h1>
            <p style={{ 
              color: '#64748b', 
              margin: 0,
              fontSize: '16px'
            }}>
              Bem-vindo, {agentData?.agente_name}! Aqui está o seu painel de controle de trabalho (: 
            </p>
          </div>
          {/* Agent Info + Work Timer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <AgentInfoPills 
              ramal={agentData?.ramal}
              agentName={agentData?.agente_name}
              userName={agentData?.user_name}
            />
            {/* Work Timer Widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {workLoading ? (
                <div style={{
                  background: '#f8fafc',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: 9999,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Verificando jornada...
                </div>
              ) : workSession ? (
                <>
                  {/* Timer + status */}
                  <div style={{
                    background: workBreak ? '#fff7ed' : '#ecfeff',
                    color: workBreak ? '#9a3412' : '#0e7490',
                    border: `1px solid ${workBreak ? '#fed7aa' : '#a5f3fc'}`,
                    borderRadius: 9999,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    ...(workActionLoading ? { animation: 'pulse 1.5s ease-in-out infinite' } : {})
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: workBreak ? '#f97316' : '#06b6d4' }} />
                    {workBreak ? `Em pausa${workBreak.reason_code ? `: ${workBreak.reason_code}` : ''}` : 'Jornada ativa'}
                    <span style={{ opacity: 0.7 }}>·</span>
                    <span>{formatHMS(computeNetSessionSeconds())}</span>
                  </div>
                  {/* Controls */}
                  {workBreak ? (
                    <button onClick={handleWorkResume} disabled={workActionLoading} style={{ ...BUTTON_STYLES.primary }}>
                      {workActionLoading ? (
                        <>
                          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Retomando...
                        </>
                      ) : (
                        <>
                          <Play size={14} /> Retomar
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button onClick={handleOpenPause} disabled={workActionLoading} style={{ ...BUTTON_STYLES.blueOutline }}>
                        <Pause size={14} /> Pausar
                      </button>
                      <button onClick={handleWorkStop} disabled={workActionLoading} style={{ ...BUTTON_STYLES.dangerOutline }}>
                        {workActionLoading ? (
                          <>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finalizando...
                          </>
                        ) : (
                          <>
                            <StopCircle size={14} /> Finalizar
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button onClick={handleWorkStart} disabled={workActionLoading || showClassification} style={{ ...BUTTON_STYLES.primary }}>
                  {workActionLoading ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Iniciando...
                    </>
                  ) : (
                    <>
                      <Play size={14} /> Iniciar Jornada
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal minimalista e moderno: Motivo da Pausa */}
        {pauseModalOpen && (
          <div style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15,23,42,0.35)', 
            backdropFilter: 'blur(2px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
          }}>
            <div style={{ 
              width: '380px', 
              maxWidth: '92vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              background: 'linear-gradient(180deg, #ffffff, #f9fafb)', 
              borderRadius: 16, 
              border: '1px solid #e5e7eb', 
              padding: 18, 
              boxShadow: '0 12px 30px rgba(2, 6, 23, 0.15)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 999, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pause size={16} color="#4f46e5" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Motivo da Pausa</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Escolha um motivo ou adicione uma observação</div>
                </div>
              </div>

              {/* Chips de motivo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 12 }}>
                {['banheiro','cafe','almoco','reuniao','treinamento','pessoal','outros'].map((opt) => {
                  const selected = pauseReason === opt;
                  return (
                    <button 
                      key={opt} 
                      onClick={() => setPauseReason(opt)} 
                      style={{
                        background: selected ? 'linear-gradient(135deg, #e0e7ff, #eef2ff)' : '#f3f4f6',
                        border: selected ? '1px solid #c7d2fe' : '1px solid #e5e7eb',
                        color: '#111827',
                        borderRadius: 999, 
                        padding: '8px 10px', 
                        fontSize: 12, 
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        transition: 'background 0.15s ease, border-color 0.15s ease'
                      }}
                    >{opt}</button>
                  );
                })}
              </div>

              {/* Observação */}
              <div style={{ marginBottom: 12 }}>
                <textarea 
                  value={pauseReasonText} 
                  onChange={(e) => setPauseReasonText(e.target.value)} 
                  placeholder="Observação (opcional)"
                  rows={3}
                  style={{ 
                    width: '100%', 
                    maxWidth: '100%',
                    minHeight: 80,
                    maxHeight: '40vh',
                    border: '1px solid #e5e7eb', 
                    background: '#f9fafb',
                    borderRadius: 10, 
                    padding: 10, 
                    fontSize: 12,
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word'
                  }} 
                />
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setPauseModalOpen(false)} style={{ 
                  background: 'white', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: 10, 
                  padding: '8px 12px', 
                  fontSize: 12, 
                  color: '#111827', 
                  cursor: 'pointer' 
                }}>Cancelar</button>
                <button onClick={handleConfirmPause} disabled={workActionLoading} style={{ 
                  background: '#111827', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 10, 
                  padding: '8px 12px', 
                  fontSize: 12, 
                  cursor: workActionLoading ? 'not-allowed' : 'pointer',
                  opacity: workActionLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  {workActionLoading ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Pausando...
                    </>
                  ) : (
                    <>
                      <Pause size={14} /> Confirmar Pausa
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '24px',
          marginBottom: '32px'
        }}>
          {stats.map((stat, index) => (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              bgColor={stat.bgColor}
              isEditable={stat.title === 'CallerID (BINA)'}
              isEditing={editingCallerId}
              tempValue={tempCallerId}
              isSaving={savingCallerId}
              onEdit={() => {
                setEditingCallerId(true);
                setTempCallerId(agentData?.callerid || '');
              }}
              onSave={handleSaveCallerId}
              onCancel={() => {
                setEditingCallerId(false);
                setTempCallerId('');
              }}
              onTempValueChange={setTempCallerId}
            />
          ))}
        </div>

        {/* Three Main Blocks */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {/* WebRTC Dialer Block */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            opacity: agentData?.webrtc ? 1 : 0.6,
            position: 'relative',
            minHeight: '420px',
            justifySelf: 'start',
            width: '100%',
            maxWidth: '420px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Phone size={20} color="#10b981" />
                Discador WebRTC
              </h3>
              
              {agentData?.webrtc && (
                <button
                  onClick={webrtcRegistered ? disconnectWebRTC : connectWebRTC}
                  disabled={webrtcConnecting}
                  style={{
                    background: webrtcConnecting 
                      ? 'linear-gradient(135deg, #6b7280, #4b5563)' 
                      : webrtcRegistered 
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)' 
                        : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: webrtcConnecting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: webrtcConnecting 
                      ? '0 2px 4px rgba(107, 114, 128, 0.3)'
                      : webrtcRegistered 
                        ? '0 2px 4px rgba(34, 197, 94, 0.3)' 
                        : '0 2px 4px rgba(59, 130, 246, 0.3)',
                    opacity: webrtcConnecting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => {
                    if (!webrtcConnecting) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = webrtcRegistered ? '0 4px 8px rgba(34, 197, 94, 0.4)' : '0 4px 8px rgba(59, 130, 246, 0.4)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!webrtcConnecting) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = webrtcRegistered ? '0 2px 4px rgba(34, 197, 94, 0.3)' : '0 2px 4px rgba(59, 130, 246, 0.3)';
                    }
                  }}
                >
                  {webrtcConnecting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                  {webrtcConnecting 
                    ? (webrtcRegistered ? 'Desconectando...' : 'Conectando...') 
                    : (webrtcRegistered ? 'Desconectar' : 'Conectar')
                  }
                </button>
              )}
            </div>

            {/* CallerID Section removido do discador WebRTC — agora está no card de estatísticas */}
            
            {/* Verificar se WebRTC está habilitado */}
            {!agentData?.webrtc && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}>
                  <Lock size={24} color="white" />
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#64748b',
                  margin: '0 0 8px 0'
                }}>
                  WebRTC Não Ativado
                </h4>
                <p style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  margin: 0,
                  lineHeight: '1.5',
                  maxWidth: '250px'
                }}>
                  A função de chamadas via navegador não está habilitada para sua conta.
                </p>
              </div>
            )}
            
            {/* Display or Call Overlay */}
            {callStatus === 'idle' ? (
              <></>
            ) : (
              <CallStatusOverlay
                callStatus={callStatus}
                callDuration={callDuration}
                callTarget={callTarget}
                callTargetNumber={callTargetNumber}
                isMuted={isMuted}
                onHangup={hangupWebRTCCall}
                onToggleMute={toggleMute}
                onPause={() => showToast('Função pausar em desenvolvimento', 'error')}
                onSMS={(phoneNumber: string) => {
                  // Abrir painel SMS com número pré-preenchido
                  console.log('🔥 Clicou SMS, número extraído:', phoneNumber);
                  if ((window as any).openSMSPanel) {
                    console.log('🔥 Chamando openSMSPanel com:', phoneNumber);
                    (window as any).openSMSPanel(phoneNumber);
                  } else {
                    console.log('❌ openSMSPanel não encontrado no window');
                  }
                }}
                onViewSheet={openCurrentNumberSheet}
                sheetData={contactSheetOpen ? contactSheetData : null}
                onCloseSheet={closeContactSheet}
              />
            )}
            
            
            {/* Recent Calls View */}
            {showRecentCalls ? (
              <RecentCallsList
                recentCalls={recentCalls}
                onCallSelect={(number) => setDialNumber(number)}
                onClose={() => setShowRecentCalls(false)}
              />
            ) : (
              <>
                {/* Keypad */}
                {callStatus === 'idle' && (
                  <DialerKeypad
                    dialNumber={dialNumber}
                    onNumberChange={setDialNumber}
                    disabled={!agentData?.webrtc}
                  />
                )}
              </>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              filter: agentData?.webrtc ? 'none' : 'blur(2px)'
            }}>
              {callStatus === 'idle' ? (
                <>
                  <button
                    onClick={webrtcRegistered ? makeWebRTCCall : () => showToast('Conecte primeiro para fazer chamadas', 'error')}
                    disabled={!agentData?.webrtc || !dialNumber.trim() || showClassification}
                    style={{
                      flex: 1,
                      background: (agentData?.webrtc && webrtcRegistered && dialNumber.trim()) 
                        ? 'linear-gradient(135deg, #10b981, #059669)' 
                        : '#94a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: (agentData?.webrtc && webrtcRegistered && dialNumber.trim()) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <PhoneCall size={18} />
                    Ligar
                  </button>
                  
                  {agentData?.webrtc && recentCalls.length > 0 && (
                    <button
                      onClick={() => setShowRecentCalls(!showRecentCalls)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    >
                      <Clock size={16} />
                      Recentes
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={hangupWebRTCCall}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '16px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <PhoneOff size={18} />
                    Desligar
                  </button>
                  <button
                    onClick={openCurrentNumberSheet}
                    style={{
                      background: '#ffffff',
                      color: '#1f2937',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '16px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                      minWidth: '140px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <Eye size={18} />
                    Ver Ficha
                  </button>
                  
                  {callStatus === 'connected' && (
                    <button
                      onClick={toggleMute}
                      style={{
                        background: isMuted 
                          ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
                          : 'linear-gradient(135deg, #6b7280, #4b5563)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '16px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.2s',
                        minWidth: '120px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      {isMuted ? '🔊' : '🔇'}
                      {isMuted ? 'Desmutar' : 'Mutar'}
                    </button>
                  )}
                </>
              )}
            </div>
            {/* Inline Contact Sheet Panel - Aparência refinada */}
            {contactSheetOpen && contactSheetData && (
              <div style={{
                marginTop: '16px',
                background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px',
                boxShadow: '0 6px 14px rgba(2, 6, 23, 0.06)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: 0.3 }}>Ficha do Contato</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{contactSheetData.name}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>{contactSheetData.number}</div>
                  </div>
                  <button onClick={closeContactSheet} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', color: '#334155', fontWeight: 600 }}>Fechar</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', maxHeight: '260px', overflowY: 'auto', paddingRight: 2 }}>
                  {(() => {
                    const friendlyLabels: Record<string, string> = {
                      cpf: 'CPF',
                      cnpj: 'CNPJ',
                      documento: 'Documento',
                      email: 'E-mail',
                      emails: 'E-mails',
                      celular: 'Celular',
                      mobile: 'Celular',
                      telefone: 'Telefone',
                      phone: 'Telefone',
                      ddd: 'DDD',
                      ddi: 'DDI',
                      endereco: 'Endereço',
                      address: 'Endereço',
                      rua: 'Rua',
                      endereco_rua: 'Rua',
                      numero: 'Número',
                      bairro: 'Bairro',
                      cidade: 'Cidade',
                      municipio: 'Município',
                      estado: 'UF',
                      uf: 'UF',
                      cep: 'CEP',
                      origem: 'Origem',
                      origem_campanha: 'Origem Campanha',
                      campanha: 'Campanha',
                      score: 'Score',
                      bancopagto: 'Banco',
                      banco: 'Banco',
                      agenciapagto: 'Agência',
                      agencia: 'Agência',
                      contacorrente: 'Conta Corrente'
                    };
                    const toLabel = (key: string) => friendlyLabels[key.toLowerCase()] || key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
                    const preferredOrder = ['telefone','phone','celular','cpf','cnpj','documento','email','emails','bancopagto','banco','agenciapagto','agencia','contacorrente','cep','endereco','address','rua','numero','bairro','cidade','municipio','estado','uf','origem','origem_campanha','campanha','score'];
                    const entries = Object.entries(contactSheetData)
                      .filter(([k, v]) => {
                        const key = String(k);
                        if (['name','number','id'].includes(key)) return false;
                        const empty = (v === null || v === undefined) ||
                          (typeof v === 'string' && v.trim().length === 0) ||
                          (Array.isArray(v) && v.length === 0) ||
                          (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
                        return !empty;
                      })
                      .sort(([aK],[bK]) => {
                        const a = String(aK).toLowerCase();
                        const b = String(bK).toLowerCase();
                        const ai = preferredOrder.indexOf(a);
                        const bi = preferredOrder.indexOf(b);
                        if (ai !== -1 && bi !== -1) return ai - bi;
                        if (ai !== -1) return -1;
                        if (bi !== -1) return 1;
                        return a.localeCompare(b);
                      });
                    return entries.map(([k, v]) => {
                      let display: string = '';
                      if (Array.isArray(v)) {
                        display = v.map((it) => (typeof it === 'object' ? JSON.stringify(it) : String(it))).join(', ');
                      } else if (v && typeof v === 'object') {
                        display = JSON.stringify(v, null, 2);
                      } else {
                        display = String(v ?? '');
                      }
                      return (
                        <div key={String(k)} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: 0.2, marginBottom: 6 }}>{toLabel(String(k))}</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>{display}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Classification Modal Overlay (post-call) */}
            {agentData?.webrtc && agentData?.classification && showClassification && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
                <div style={{ width: '100%', maxWidth: 360, background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, boxShadow: '0 12px 30px rgba(2,6,23,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Avaliar atendimento</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{classificationNumber || '—'} · {formatHMS(Math.max(0, classificationDuration))}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, margin: '10px 0 14px 0', justifyContent: 'center' }}>
                    {[1,2,3,4,5].map((i) => (
                      <button key={i} onClick={() => setClassificationRating(i)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', transform: i <= classificationRating ? 'scale(1.05)' : 'scale(1.0)' }} title={`${i} estrela${i>1?'s':''}`}>
                        <Star size={24} color={i <= classificationRating ? '#f59e0b' : '#d1d5db'} fill={i <= classificationRating ? '#fbbf24' : 'none'} />
                      </button>
                    ))}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <textarea value={classificationReason} onChange={(e) => setClassificationReason(e.target.value)} placeholder="Motivo/observação (opcional)" rows={3} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, fontSize: 12, color: '#0f172a', resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleSubmitClassification} disabled={savingClassification || classificationRating === 0} style={{ flex: 1, background: classificationRating > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : '#94a3b8', color: 'white', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 700, cursor: classificationRating>0 && !savingClassification ? 'pointer' : 'not-allowed' }}>
                      {savingClassification ? 'Salvando...' : 'Salvar avaliação'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Active Calls Block */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            gridColumn: 'span 2'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e293b',
              margin: '0 0 20px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <PhoneCall size={20} color="#3b82f6" />
              Chamadas Ativas & Gerenciamento da Chamada
            </h3>
            <div style={{
              opacity: isTransitioning ? 0 : 1,
              transform: isTransitioning ? 'translateX(-20px)' : 'translateX(0)',
              transition: 'all 0.3s ease-in-out'
            }}>
              {filteredCalls.length === 0 ? (
                (() => {
                  // Limpar estado de gerenciamento quando não há chamadas
                  if (managingCall) {
                    setManagingCall(null);
                    setManagingCallSnapshot(null);
                    setDtmfCapturing(false);
                    setCapturedDigits('');
                    setAudioInjecting(false);
                  }
                  return (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '60px 20px',
                      color: '#64748b',
                      textAlign: 'center',
                      minHeight: '200px'
                    }}>
                      <Phone size={48} color="#cbd5e1" style={{ marginBottom: '16px', opacity: 0.6 }} />
                      <p style={{ 
                        margin: 0, 
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#9ca3af'
                      }}>
                        Nenhuma chamada ativa
                      </p>
                    </div>
                  );
                })()
              ) : managingCall && filteredCalls.find(c => c.id === managingCall) ? (
              // Call Management Interface (com fallback para snapshot)
              (() => {
                const liveCall = filteredCalls.find(c => c.id === managingCall);
                const call = liveCall || (managingCallSnapshot && managingCallSnapshot.id === managingCall ? managingCallSnapshot : null);
                if (!call) return null;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Header with back button */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <button
                        onClick={() => {
                          setManagingCall(null);
                          setDtmfCapturing(false);
                          setCapturedDigits('');
                          setManagingCallSnapshot(null);
                        }}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ArrowLeft size={16} color="#64748b" />
                      </button>
                      <h4 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        Gerenciando Chamada {call.destination} - {formatDuration(call.duration)}
                      </h4>
                      {!liveCall && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '12px',
                          color: '#64748b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Loader2 size={14} className="spin" />
                          Sincronizando...
                        </span>
                      )}
                    </div>


                    {/* Call Management Interface - Redesigned */}
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      {/* Content */}
                      <div style={{ padding: '20px' }}>
                        {/* Action Cards Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '16px',
                          marginBottom: '20px'
                        }}>
                          {/* DTMF Card */}
                          <div style={{
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            {/* DTMF Header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '12px'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                              }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  background: '#6b7280',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <Hash size={12} color="white" />
                                </div>
                                <div>
                                  <h6 style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1e293b'
                                  }}>Captura DTMF</h6>
                                  <p style={{
                                    margin: 0,
                                    fontSize: '11px',
                                    color: '#64748b'
                                  }}>Tons de discagem</p>
                                </div>
                              </div>
                              
                              {/* Status Badge */}
                              <div style={{
                                background: dtmfCapturing ? '#374151' : '#9ca3af',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '600',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {dtmfCapturing ? 'ATIVO' : 'INATIVO'}
                              </div>
                            </div>
                            
                            {/* DTMF Controls */}
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              marginBottom: '12px'
                            }}>
                              <button
                                title={dtmfCapturing ? "Parar captura de tons DTMF" : "Iniciar captura de tons DTMF"}
                                onClick={() => {
                                  if (dtmfCapturing) {
                                    stopDTMFCapture();
                                  } else {
                                    startDTMFCapture(managingCall!);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  background: dtmfCapturing ? '#dc2626' : '#374151',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '10px 16px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                <Hash size={14} />
                                {dtmfCapturing ? 'Parar' : 'Iniciar'}
                              </button>
                            </div>
                            {capturedDigits && (
                              <div style={{
                                display: 'flex',
                                gap: '6px',
                                marginBottom: '12px'
                              }}>
                                <button
                                  title="Baixar dígitos DTMF capturados"
                                  onClick={() => downloadDigits(managingCall!, capturedDigits)}
                                  style={{
                                    flex: 1,
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <Download size={12} />
                                  Baixar
                                </button>
                                <button
                                  title="Limpar dígitos capturados"
                                  onClick={() => clearCapturedDigits(managingCall!)}
                                  style={{
                                    flex: 1,
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <Trash2 size={12} />
                                  Limpar
                                </button>
                              </div>
                            )}
                            
                            {/* DTMF Display Panel */}
                            {dtmfCapturing && (
                              <div style={{
                                background: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '10px'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  marginBottom: '10px'
                                }}>
                                  <div style={{
                                    width: '6px',
                                    height: '6px',
                                    background: '#10b981',
                                    borderRadius: '50%',
                                    animation: 'pulse 1.5s ease-in-out infinite'
                                  }} />
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: '#059669',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}>
                                    Capturando
                                  </span>
                                </div>
                                
                                {/* Digits Display */}
                                <div style={{
                                  background: 'white',
                                  border: '1px solid #d1fae5',
                                  borderRadius: '6px',
                                  padding: '10px',
                                  textAlign: 'center',
                                  minHeight: '40px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <span style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    fontFamily: 'monospace',
                                    letterSpacing: '2px',
                                    color: capturedDigits ? '#1e293b' : '#9ca3af'
                                  }}>
                                    {capturedDigits ? capturedDigits.replace(/,/g, ' ') : '• • •'}
                                  </span>
                                </div>
                                
                                {capturedDigits && (
                                  <div style={{
                                    marginTop: '6px',
                                    fontSize: '10px',
                                    color: '#059669',
                                    textAlign: 'center',
                                    fontWeight: '500'
                                  }}>
                                    {capturedDigits.split(',').length} dígitos capturados
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Audio Injection Card */}
                          <div style={{
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            {/* Audio Header */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '12px'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                              }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  background: '#6b7280',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <Music size={12} color="white" />
                                </div>
                                <div>
                                  <h6 style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#1e293b'
                                  }}>Injeção de Áudio</h6>
                                  <p style={{
                                    margin: 0,
                                    fontSize: '11px',
                                    color: '#64748b'
                                  }}>Reproduzir áudio</p>
                                </div>
                              </div>
                              
                              {/* Status Badge */}
                              <div style={{
                                background: audioInjecting ? '#374151' : '#9ca3af',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: '600',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {audioInjecting ? 'ATIVO' : 'INATIVO'}
                              </div>
                            </div>
                            
                            {/* Audio Controls */}
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              marginBottom: '12px'
                            }}>
                              <button
                                onClick={() => setAudioInjecting(!audioInjecting)}
                                style={{
                                  flex: 1,
                                  background: audioInjecting ? '#dc2626' : '#374151',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '10px 16px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                <Music size={14} />
                                {audioInjecting ? 'Parar' : 'Iniciar'}
                              </button>
                            </div>
                            
                            {/* Audio Selection Panel */}
                            {audioInjecting && (
                              <div style={{
                                background: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '8px'
                                }}>
                                  <h6 style={{
                                    margin: 0,
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: '#111827'
                                  }}>Seleção de Áudio</h6>
                                </div>
                                  
                                {/* Audio Selector */}
                                <select
                                  title="Selecionar áudio para injetar na chamada"
                                  value={selectedAudio}
                                  onChange={(e) => setSelectedAudio(e.target.value)}
                                  disabled={loadingAudios}
                                  style={{
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    marginBottom: '10px',
                                    background: 'white',
                                    opacity: loadingAudios ? 0.6 : 1,
                                    cursor: loadingAudios ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  <option value="">
                                    {loadingAudios ? 'Carregando...' : 'Selecionar áudio'}
                                  </option>
                                  {availableAudios.map((audio) => (
                                    <option key={audio.id} value={audio.id}>
                                      {audio.isExclusive ? '⭐ ' : ''}{audio.name}
                                    </option>
                                  ))}
                                </select>
                                  
                                {/* Microphone Mode Info */}
                                <div style={{
                                  background: '#f9fafb',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  padding: '8px',
                                  marginBottom: '8px'
                                }}>
                                  <p style={{
                                    margin: 0,
                                    fontSize: '11px',
                                    color: '#374151'
                                  }}>
                                    Controle manual: mute o microfone antes de reproduzir áudio. Use o botão Mute/Unmute para controlar.
                                  </p>
                                </div>
                                  
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      title="Reproduzir áudio selecionado na chamada"
                                      aria-label="Reproduzir áudio na chamada"
                                      disabled={!selectedAudio}
                                      style={{
                                        flex: 1,
                                        background: selectedAudio ? '#10b981' : '#9ca3af',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '9999px',
                                        padding: '8px 10px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        cursor: selectedAudio ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                      }}
                                      onClick={() => {
                                        if (selectedAudio) {
                                          injectAudioToCall(selectedAudio);
                                        }
                                      }}
                                    >
                                      <Play size={12} />
                                      Play
                                    </button>
                                    
                                    <button
                                      title="Parar reprodução de áudio na chamada"
                                      aria-label="Parar áudio"
                                      style={BUTTON_STYLES.secondary}
                                      onClick={() => {
                                        stopAudioInjection();
                                      }}
                                    >
                                      <Square size={12} />
                                      Stop
                                    </button>
                                  </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Call Actions Section */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '16px',
                        marginTop: '16px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            background: '#ef4444',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <PhoneOff size={12} color="white" />
                          </div>
                          <div>
                            <h6 style={{
                              margin: 0,
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e293b'
                            }}>Ações da Chamada</h6>
                            <p style={{
                              margin: 0,
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Controle da chamada</p>
                          </div>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '8px'
                        }}>
                          <button
                            title={isMuted ? "Ativar microfone" : "Silenciar microfone"}
                            onClick={toggleMute}
                            style={{
                              background: isMuted ? '#f59e0b' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                            {isMuted ? 'Unmute' : 'Mute'}
                          </button>
                          <button
                            title="Transferir chamada para outro destino"
                            style={{
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            <ArrowRightLeft size={14} />
                            Transferir
                          </button>
                          <button
                            title="Encerrar esta chamada permanentemente"
                            onClick={() => openConfirmHangup(call)}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            <PhoneOff size={14} />
                            Desligar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Call List View (filtered)
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.isArray(filteredCalls) && filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '2px 6px'
                          }}>Caller ID</span>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '12px' }}>{call.callerid}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '2px 6px'
                          }}>Destino</span>
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: '12px' }}>{call.destination}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '2px 6px'
                          }}>Duração</span>
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: '12px' }}>{formatDuration(call.duration)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '2px 6px'
                          }}>Status</span>
                          <span style={{
                            background: call.status === 'Em conversa' ? '#10b981' : '#f59e0b',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: 700
                          }}>
                            {call.status === 'Em conversa' ? 'Falando' : call.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        title="Desligar"
                        onClick={() => openConfirmHangup(call)}
                        style={{
                          background: 'white',
                          color: '#ef4444',
                          border: '1px solid #fecaca',
                          borderRadius: '9999px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <PhoneOff size={12} />
                        <span>Desligar</span>
                      </button>
                      <button
                        title="Gerenciar"
                        onClick={() => setManagingCall(call.id)}
                        style={{
                          background: 'white',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: '9999px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Settings size={12} />
                        <span>Gerenciar</span>
                      </button>
                      <button
                        title="Transferir"
                        onClick={() => handleTransferCall(call.id)}
                        style={{
                          background: 'white',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: '9999px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <ArrowRightLeft size={12} />
                        <span>Transferir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* WebRTC Call Quality Monitor - Sidebar */}
        {callStatus === 'connected' && callQuality && (
          <>
            {/* Sidebar Toggle */}
            <div style={{
              position: 'fixed',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
              cursor: 'pointer',
              background: 'white',
              borderRadius: '12px 0 0 12px',
              padding: '20px 8px',
              boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              borderRight: 'none',
              transition: 'all 0.3s ease'
            }}
            onClick={() => setQualityCardExpanded(!qualityCardExpanded)}
            >
              <div style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                letterSpacing: '1px',
                whiteSpace: 'nowrap'
              }}>
                Qualidade da Chamada
              </div>
            </div>

            {/* Expanded Panel */}
            {qualityCardExpanded && (
              <div style={{
                position: 'fixed',
                right: '0',
                top: '0',
                bottom: '0',
                width: '400px',
                background: 'white',
                boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.15)',
                zIndex: 999,
                padding: '24px',
                overflowY: 'auto',
                animation: 'slideInRight 0.3s ease'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#374151',
                  margin: 0
                }}>
                  Qualidade da Chamada
                </h3>
                <button
                  onClick={() => setQualityCardExpanded(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '16px',
                marginBottom: '16px'
              }}>
                  {/* Packet Loss */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: callQuality.packetLoss > 5 ? '#ef4444' : callQuality.packetLoss > 2 ? '#f59e0b' : '#10b981',
                      marginBottom: '4px'
                    }}>
                      {callQuality.packetLoss.toFixed(1)}%
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      Perda de Pacotes
                    </div>
                  </div>
                  
                  {/* Jitter */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: callQuality.jitter > 30 ? '#ef4444' : callQuality.jitter > 20 ? '#f59e0b' : '#10b981',
                      marginBottom: '4px'
                    }}>
                      {callQuality.jitter.toFixed(0)}ms
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      Jitter
                    </div>
                  </div>
                  
                  {/* RTT */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: callQuality.rtt > 200 ? '#ef4444' : callQuality.rtt > 150 ? '#f59e0b' : '#10b981',
                      marginBottom: '4px'
                    }}>
                      {callQuality.rtt.toFixed(0)}ms
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      Latência (RTT)
                    </div>
                  </div>
                  
                  {/* Audio Level */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: callQuality.audioLevel < 0.1 ? '#ef4444' : callQuality.audioLevel < 0.3 ? '#f59e0b' : '#10b981',
                      marginBottom: '4px'
                    }}>
                      {(callQuality.audioLevel * 100).toFixed(0)}%
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      Nível de Áudio
                    </div>
                  </div>
                  
                  {/* Bitrate */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: callQuality.bitrate < 32000 ? '#ef4444' : callQuality.bitrate < 64000 ? '#f59e0b' : '#10b981',
                      marginBottom: '4px'
                    }}>
                      {(callQuality.bitrate / 1000).toFixed(0)}k
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      Bitrate
                    </div>
                  </div>
                  
                  {/* Codec */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#374151',
                      marginBottom: '4px'
                    }}>
                      {callQuality.codec || 'N/A'}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      fontWeight: '500'
                    }}>
                      Codec
                    </div>
                  </div>
                </div>
                
                {/* Network Type */}
                <div style={{
                  padding: '12px',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: '500'
                  }}>
                    Tipo de Conexão: 
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: '#374151',
                    fontWeight: '600'
                  }}>
                    {callQuality.networkType || 'Desconhecido'}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
          {/* Live Call Management Block */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            display: 'none'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '500',
              color: '#374151',
              margin: '0 0 16px 0',
              paddingBottom: '12px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              Gerenciamento de Chamadas
            </h3>
            
            {/* Verificar se auto_discagem está habilitada */}
            {!agentData?.auto_discagem ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                opacity: 0.6,
                minHeight: '200px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}>
                  <Lock size={24} color="white" />
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#64748b',
                  margin: '0 0 8px 0'
                }}>
                  Função Não Ativada
                </h4>
                <p style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  O gerenciamento de chamadas automáticas não está habilitado para sua conta.
                </p>
              </div>
            ) : (
              <div style={{ padding: '20px' }}>
                {loadingCampaigns ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center'
                  }}>
                    <Activity size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#64748b',
                      margin: '12px 0 0 0'
                    }}>
                      Carregando campanhas...
                    </p>
                  </div>
                ) : !loadingCampaigns && agentCampaigns.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px'
                    }}>
                      <Activity size={24} color="white" />
                    </div>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#f59e0b',
                      margin: '0 0 8px 0'
                    }}>
                      Nenhuma Campanha Vinculada
                    </h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#64748b',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Não há campanhas de mailing vinculadas ao seu ramal.
                    </p>
                  </div>
                ) : reviewingCampaign ? (
                  /* Manual Review UI inside Campaigns card */
                  <div ref={campaignReviewRef}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 4px 0'
                        }}>
                          {reviewingCampaign.name}
                        </h5>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          <span>{getDialed(reviewingCampaign)}/{reviewingCampaign.total || 0}</span>
                          <span>{Math.round(((getDialed(reviewingCampaign)) / (reviewingCampaign.total || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <button
                        onClick={handleCloseReview}
                        style={{
                          background: 'white',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        ← Voltar
                      </button>
                    </div>

                    {/* Loading State */}
                    {loadingContacts && (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#64748b'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          border: '3px solid #e2e8f0',
                          borderTop: '3px solid #10b981',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 16px'
                        }}></div>
                        Carregando contatos...
                      </div>
                    )}

                    {/* Contacts Grid */}
                    {!loadingContacts && campaignContacts.length > 0 && (
                      <>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginBottom: '16px'
                        }}>
                          {campaignContacts.map((contact) => {
                            const isActive = (manualActiveContactId === contact.id) || ((callTargetNumber === contact.number) && callStatus !== 'idle');
                            return (
                            <div
                              key={contact.id}
                              style={{
                                background: isActive ? 'linear-gradient(135deg, #eff6ff, #ffffff)' : '#fafafa',
                                borderRadius: '6px',
                                padding: '12px',
                                border: isActive ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                                boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                                animation: isActive ? 'contactPulse 1.6s ease-in-out infinite' : undefined,
                                borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#9ca3af';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              <div>
                                <h6 style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#374151',
                                  margin: '0 0 2px 0'
                                }}>
                                  {contact.name}
                                </h6>
                                <p style={{
                                  fontSize: '12px',
                                  color: '#6b7280',
                                  margin: 0
                                }}>
                                  {contact.number}
                                </p>
                                {isActive && (
                                  <span style={{ fontSize: '11px', color: '#1d4ed8', background: '#dbeafe', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '999px' }}>
                                    Em chamada
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleCallContact(contact)}
                                  disabled={!webrtcUA || !webrtcRegistered || isActive}
                                  style={{
                                    background: (!webrtcUA || !webrtcRegistered) ? '#9ca3af' : (isActive ? '#2563eb' : '#374151'),
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '400',
                                    cursor: (!webrtcUA || !webrtcRegistered || isActive) ? 'not-allowed' : 'pointer',
                                    transition: 'background-color 0.2s ease',
                                    opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6
                                  }}
                                  onMouseOver={(e) => {
                                    if (webrtcUA && webrtcRegistered && !isActive) {
                                      e.currentTarget.style.background = '#1f2937';
                                    }
                                  }}
                                  onMouseOut={(e) => {
                                    if (webrtcUA && webrtcRegistered && !isActive) {
                                      e.currentTarget.style.background = '#374151';
                                    }
                                  }}
                                >
                                  {(!webrtcUA || !webrtcRegistered) ? 'Off' : (isActive ? 'Em chamada…' : 'Ligar')}
                                </button>
                                {(isActive || true) && (
                                  <button
                                    onClick={() => openContactSheet(contact)}
                                    style={{
                                      background: '#ffffff',
                                      color: '#374151',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      padding: '6px 10px',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                                  >
                                    Ver Ficha
                                  </button>
                                )}
                              </div>
                            </div>
                          );})}
                        </div>

                        {/* Pagination */}
                        {contactsTotal > contactsPerPage && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px',
                            background: '#fafafa',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <button
                              onClick={() => handleContactsPageChange(contactsPage - 1)}
                              disabled={contactsPage <= 1}
                              style={{
                                background: contactsPage <= 1 ? '#f3f4f6' : 'white',
                                color: contactsPage <= 1 ? '#9ca3af' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '400',
                                cursor: contactsPage <= 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              ← Ant
                            </button>
                            <span style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              padding: '0 8px'
                            }}>
                              {contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}
                            </span>
                            <button
                              onClick={() => handleContactsPageChange(contactsPage + 1)}
                              disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)}
                              style={{
                                background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : 'white',
                                color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '400',
                                cursor: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Próx →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : reviewingCampaign ? (
                  /* Manual Review UI inside Campaigns card (visible block) */
                  <div ref={campaignReviewRef}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 4px 0'
                        }}>
                          {reviewingCampaign.name}
                        </h5>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          <span>{getDialed(reviewingCampaign)}/{reviewingCampaign.total || 0}</span>
                          <span>{Math.round(((getDialed(reviewingCampaign)) / (reviewingCampaign.total || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <button
                        onClick={handleCloseReview}
                        style={{
                          background: 'white',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        ← Voltar
                      </button>
                    </div>

                    {/* Loading State */}
                    {loadingContacts && (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#64748b'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          border: '3px solid #e2e8f0',
                          borderTop: '3px solid #10b981',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 16px'
                        }}></div>
                        Carregando contatos...
                      </div>
                    )}

                    {/* Contacts Grid */}
                    {!loadingContacts && campaignContacts.length > 0 && (
                      <>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginBottom: '16px'
                        }}>
                          {campaignContacts.map((contact) => (
                            <div
                              key={contact.id}
                              style={{
                                background: '#fafafa',
                                borderRadius: '6px',
                                padding: '12px',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'border-color 0.2s ease'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#9ca3af';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              <div>
                                <h6 style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#374151',
                                  margin: '0 0 2px 0'
                                }}>
                                  {contact.name}
                                </h6>
                                <p style={{
                                  fontSize: '12px',
                                  color: '#6b7280',
                                  margin: 0
                                }}>
                                  {contact.number}
                                </p>
                              </div>
                              <button
                                onClick={() => handleCallContact(contact)}
                                disabled={!webrtcUA || !webrtcRegistered}
                                style={{
                                  background: (webrtcUA && webrtcRegistered) ? '#374151' : '#9ca3af',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  cursor: (webrtcUA && webrtcRegistered) ? 'pointer' : 'not-allowed',
                                  transition: 'background-color 0.2s ease',
                                  opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6
                                }}
                                onMouseOver={(e) => {
                                  if (webrtcUA && webrtcRegistered) {
                                    e.currentTarget.style.background = '#1f2937';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (webrtcUA && webrtcRegistered) {
                                    e.currentTarget.style.background = '#374151';
                                  }
                                }}
                              >
                                {(webrtcUA && webrtcRegistered) ? 'Ligar' : 'Off'}
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {contactsTotal > contactsPerPage && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px',
                            background: '#fafafa',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <button
                              onClick={() => handleContactsPageChange(contactsPage - 1)}
                              disabled={contactsPage <= 1}
                              style={{
                                background: contactsPage <= 1 ? '#f3f4f6' : 'white',
                                color: contactsPage <= 1 ? '#9ca3af' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '400',
                                cursor: contactsPage <= 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              ← Ant
                            </button>
                            <span style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              padding: '0 8px'
                            }}>
                              {contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}
                            </span>
                            <button
                              onClick={() => handleContactsPageChange(contactsPage + 1)}
                              disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)}
                              style={{
                                background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : 'white',
                                color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '400',
                                cursor: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Próx →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {!loadingContacts && campaignContacts.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                        Nenhum contato para exibir nesta página.
                      </div>
                    )}
                  </div>
                ) : reviewingCampaign ? (
                  /* Manual Review UI inside Campaigns card (visible block) */
                  <div ref={campaignReviewRef}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 4px 0'
                        }}>
                          {reviewingCampaign.name}
                        </h5>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          <span>{getDialed(reviewingCampaign)}/{reviewingCampaign.total || 0}</span>
                          <span>{Math.round(((getDialed(reviewingCampaign)) / (reviewingCampaign.total || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <button
                        onClick={handleCloseReview}
                        style={{
                          background: 'white',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        ← Voltar
                      </button>
                    </div>

                    {/* Loading State */}
                    {loadingContacts && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                        Carregando contatos...
                      </div>
                    )}

                    {/* Contacts Grid */}
                    {!loadingContacts && campaignContacts.length > 0 && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                          {campaignContacts.map((contact) => (
                            <div
                              key={contact.id}
                              style={{ background: '#fafafa', borderRadius: '6px', padding: '12px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s ease' }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                            >
                              <div>
                                <h6 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: '0 0 2px 0' }}>{contact.name}</h6>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{contact.number}</p>
                              </div>
                              <button
                                onClick={() => handleCallContact(contact)}
                                disabled={!webrtcUA || !webrtcRegistered}
                                style={{ background: (webrtcUA && webrtcRegistered) ? '#374151' : '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: '400', cursor: (webrtcUA && webrtcRegistered) ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s ease', opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6 }}
                                onMouseOver={(e) => { if (webrtcUA && webrtcRegistered) { e.currentTarget.style.background = '#1f2937'; } }}
                                onMouseOut={(e) => { if (webrtcUA && webrtcRegistered) { e.currentTarget.style.background = '#374151'; } }}
                              >
                                {(webrtcUA && webrtcRegistered) ? 'Ligar' : 'Off'}
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {contactsTotal > contactsPerPage && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', background: '#fafafa', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                            <button onClick={() => handleContactsPageChange(contactsPage - 1)} disabled={contactsPage <= 1} style={{ background: contactsPage <= 1 ? '#f3f4f6' : 'white', color: contactsPage <= 1 ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: '400', cursor: contactsPage <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}>← Ant</button>
                            <span style={{ fontSize: '12px', color: '#6b7280', padding: '0 8px' }}>{contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}</span>
                            <button onClick={() => handleContactsPageChange(contactsPage + 1)} disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)} style={{ background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : 'white', color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: '400', cursor: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}>Próx →</button>
                          </div>
                        )}
                      </>
                    )}
                    {!loadingContacts && campaignContacts.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                        Nenhum contato para exibir nesta página.
                      </div>
                    )}
                  </div>
                ) : reviewingCampaign ? (
                  /* Manual Review UI inside Campaigns card (final visible block) */
                  <div ref={campaignReviewRef}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{ fontSize: '16px', fontWeight: '500', color: '#374151', margin: '0 0 4px 0' }}>
                          {reviewingCampaign.name}
                        </h5>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                          <span>{getDialed(reviewingCampaign)}/{reviewingCampaign.total || 0}</span>
                          <span>{Math.round(((getDialed(reviewingCampaign)) / (reviewingCampaign.total || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <button
                        onClick={handleCloseReview}
                        style={{
                          background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '4px',
                          padding: '6px 12px', fontSize: '12px', fontWeight: '400', cursor: 'pointer', transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      >
                        ← Voltar
                      </button>
                    </div>

                    {loadingContacts && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                        Carregando contatos...
                      </div>
                    )}

                    {!loadingContacts && campaignContacts.length > 0 && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                          {campaignContacts.map((contact) => {
                            const isActive = manualActiveContactId === contact.id;
                            return (
                            <div key={contact.id} style={{ 
                              background: isActive ? 'linear-gradient(135deg, #eff6ff, #ffffff)' : '#fafafa',
                              borderRadius: '6px',
                              padding: '12px',
                              border: isActive ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                              boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.18)' : 'none',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                              animation: isActive ? 'contactPulse 1.6s ease-in-out infinite' : undefined,
                              borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent'
                            }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = isActive ? '#93c5fd' : '#e5e7eb'; }}
                            >
                              <div>
                                <h6 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: '0 0 2px 0' }}>{contact.name}</h6>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{contact.number}</p>
                                {isActive && (
                                  <span style={{ fontSize: '11px', color: '#1d4ed8', background: '#dbeafe', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '999px' }}>
                                    Em chamada
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleCallContact(contact)}
                                  disabled={!webrtcUA || !webrtcRegistered || isActive}
                                  style={{ background: (!webrtcUA || !webrtcRegistered) ? '#9ca3af' : (isActive ? '#2563eb' : '#374151'), color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: '400', cursor: (!webrtcUA || !webrtcRegistered || isActive) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s ease', opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6 }}
                                  onMouseOver={(e) => { if (webrtcUA && webrtcRegistered && !isActive) { e.currentTarget.style.background = '#1f2937'; } }}
                                  onMouseOut={(e) => { if (webrtcUA && webrtcRegistered && !isActive) { e.currentTarget.style.background = '#374151'; } }}
                                >
                                  {(!webrtcUA || !webrtcRegistered) ? 'Off' : (isActive ? 'Em chamada…' : 'Ligar')}
                                </button>
                                {(isActive || true) && (
                                  <button
                                    onClick={() => openContactSheet(contact)}
                                    style={{ background: '#ffffff', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                                  >
                                    Ver Ficha
                                  </button>
                                )}
                              </div>
                            </div>
                          );})}
                        </div>

                        {contactsTotal > contactsPerPage && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', background: '#fafafa', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                            <button onClick={() => handleContactsPageChange(contactsPage - 1)} disabled={contactsPage <= 1} style={{ background: contactsPage <= 1 ? '#f3f4f6' : 'white', color: contactsPage <= 1 ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: '400', cursor: contactsPage <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}>← Ant</button>
                            <span style={{ fontSize: '12px', color: '#6b7280', padding: '0 8px' }}>{contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}</span>
                            <button onClick={() => handleContactsPageChange(contactsPage + 1)} disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)} style={{ background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : 'white', color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: '400', cursor: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}>Próx →</button>
                          </div>
                        )}
                      </>
                    )}
                    {!loadingContacts && campaignContacts.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                        Nenhum contato para exibir nesta página.
                      </div>
                    )}
                  </div>
                ) : reviewingCampaign ? (
                  /* Auto Dialer Control Panel */
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 4px 0'
                        }}>
                          🤖 Discagem Automática
                        </h5>
                        <p style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          margin: 0
                        }}>
                          {autoDialerCampaign?.name}
                        </p>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: autoDialerPaused ? '#f59e0b' : '#10b981',
                          animation: autoDialerPaused ? 'none' : 'pulse 2s infinite'
                        }} />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: autoDialerPaused ? '#f59e0b' : '#10b981'
                        }}>
                          {autoDialerPaused ? 'Pausado' : 'Executando'}
                        </span>
                      </div>
                    </div>

                    {/* Estatísticas */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#374151'
                        }}>
                          {autoDialerStats.total}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          textTransform: 'uppercase'
                        }}>
                          Total
                        </div>
                      </div>
                      
                      <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#10b981'
                        }}>
                          {autoDialerStats.successful}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          textTransform: 'uppercase'
                        }}>
                          Sucesso
                        </div>
                      </div>
                      
                      <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#ef4444'
                        }}>
                          {autoDialerStats.failed}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          textTransform: 'uppercase'
                        }}>
                          Falhas
                        </div>
                      </div>
                      
                      <div style={{
                        textAlign: 'center',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#f59e0b'
                        }}>
                          {autoDialerStats.remaining}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#6b7280',
                          textTransform: 'uppercase'
                        }}>
                          Restantes
                        </div>
                      </div>
                    </div>

                    {/* Contato Atual */}
                    {autoDialerCurrentContact && (
                      <div style={{
                        background: 'white',
                        borderRadius: '6px',
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>
                          Contato Atual:
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          {autoDialerCurrentContact.name} - {autoDialerCurrentContact.number}
                        </div>
                      </div>
                    )}

                    {/* Próximo Contato */}
                    {autoDialerQueue && autoDialerQueue.length > 0 && (
                      <div style={{
                        background: 'white',
                        borderRadius: '6px',
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>
                          Próximo Contato:
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#374151'
                        }}>
                          {autoDialerQueue[0].name} - {autoDialerQueue[0].number}
                        </div>
                      </div>
                    )}

                    {/* Barra de Progresso */}
                    <div style={{
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          Progresso
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          {Math.round((autoDialerStats.completed / autoDialerStats.total) * 100)}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: '#f3f4f6',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(autoDialerStats.completed / autoDialerStats.total) * 100}%`,
                          height: '100%',
                          background: '#10b981',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    {/* Controles */}
                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'center'
                    }}>
                      {!autoDialerPaused ? (
                        <button
                          onClick={pauseAutoDialer}
                          style={{
                            background: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '400',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          ⏸️ Pausar
                        </button>
                      ) : (
                        <button
                          onClick={resumeAutoDialer}
                          style={{
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: '400',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          ▶️ Continuar
                        </button>
                      )}
                      
                      <button
                        onClick={restartAutoDialer}
                        style={{
                          background: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        🔄 Reiniciar
                      </button>
                      
                      <button
                        onClick={stopAutoDialer}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        🛑 Parar
                      </button>
                    </div>
                  </div>
                ) : reviewingCampaign ? (
                  /* Campaign Review Expanded View */
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 4px 0'
                        }}>
                          {reviewingCampaign.name}
                        </h5>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          <span>{getDialed(reviewingCampaign)}/{reviewingCampaign.total || 0}</span>
                          <span>{Math.round(((getDialed(reviewingCampaign)) / (reviewingCampaign.total || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <button
                        onClick={handleCloseReview}
                        style={{
                          background: 'white',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        ← Voltar
                      </button>
                    </div>

                    {/* Loading State */}
                    {loadingContacts && (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#64748b'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          border: '3px solid #e2e8f0',
                          borderTop: '3px solid #10b981',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 16px'
                        }}></div>
                        Carregando contatos...
                      </div>
                    )}

                    {/* Contacts Grid */}
                    {!loadingContacts && campaignContacts.length > 0 && (
                      <>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginBottom: '16px'
                        }}>
                          {campaignContacts.map((contact, index) => (
                            <div
                              key={contact.id}
                              style={{
                                background: '#fafafa',
                                borderRadius: '6px',
                                padding: '12px',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'border-color 0.2s ease'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#9ca3af';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              <div>
                                <h6 style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#374151',
                                  margin: '0 0 2px 0'
                                }}>
                                  {contact.name}
                                </h6>
                                <p style={{
                                  fontSize: '12px',
                                  color: '#6b7280',
                                  margin: 0
                                }}>
                                  {contact.number}
                                </p>
                              </div>
                              <button
                                onClick={() => handleCallContact(contact)}
                                disabled={!webrtcUA || !webrtcRegistered}
                                style={{
                                  background: (webrtcUA && webrtcRegistered) ? '#374151' : '#9ca3af',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  cursor: (webrtcUA && webrtcRegistered) ? 'pointer' : 'not-allowed',
                                  transition: 'background-color 0.2s ease',
                                  opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6
                                }}
                                onMouseOver={(e) => {
                                  if (webrtcUA && webrtcRegistered) {
                                    e.currentTarget.style.background = '#1f2937';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (webrtcUA && webrtcRegistered) {
                                    e.currentTarget.style.background = '#374151';
                                  }
                                }}
                              >
                                {(webrtcUA && webrtcRegistered) ? 'Ligar' : 'Off'}
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {contactsTotal > contactsPerPage && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px',
                            background: '#fafafa',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <button
                              onClick={() => handleContactsPageChange(contactsPage - 1)}
                              disabled={contactsPage <= 1}
                              style={{
                                background: contactsPage <= 1 ? '#f3f4f6' : 'white',
                                color: contactsPage <= 1 ? '#9ca3af' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '400',
                                cursor: contactsPage <= 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              ← Ant
                            </button>
                            
                            <span style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              padding: '0 8px'
                            }}>
                              {contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}
                            </span>
                            
                            <button
                              onClick={() => handleContactsPageChange(contactsPage + 1)}
                              disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)}
                              style={{
                                background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : 'white',
                                color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '400',
                                cursor: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              Prox →
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Empty State */}
                    {!loadingContacts && campaignContacts.length === 0 && (
                      <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#64748b',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{
                          fontSize: '48px',
                          marginBottom: '16px'
                        }}>
                          📋
                        </div>
                        <h6 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          margin: '0 0 8px 0'
                        }}>
                          Nenhum contato encontrado
                        </h6>
                        <p style={{
                          fontSize: '14px',
                          margin: 0
                        }}>
                          Esta campanha não possui contatos disponíveis.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Campaign List View */
                  <div>
                    <div style={{
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0'
                        }}>
                          Campanhas ({agentCampaigns.length})
                        </h4>
                      </div>
                    </div>

                    {/* Auto Dialer Status */}
                    {autoDialerRunning && (
                      <div style={{
                        background: '#f0f9ff',
                        border: '1px solid #0ea5e9',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <div>
                            <h6 style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#0369a1',
                              margin: '0 0 4px 0'
                            }}>
                              🤖 Discagem Automática Ativa
                            </h6>
                            <p style={{
                              fontSize: '12px',
                              color: '#0284c7',
                              margin: 0
                            }}>
                              {autoDialerCampaign?.name}
                            </p>
                          </div>
                          <div style={{
                            display: 'flex',
                            gap: '8px'
                          }}>
                            {autoDialerPaused ? (
                              <button
                                onClick={resumeAutoDialer}
                                style={{
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                ▶️ Retomar
                              </button>
                            ) : (
                              <button
                                onClick={pauseAutoDialer}
                                style={{
                                  background: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                ⏸️ Pausar
                              </button>
                            )}
                            <button
                              onClick={stopAutoDialer}
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              🛑 Parar
                            </button>
                          </div>
                        </div>
                        
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            background: 'white',
                            borderRadius: '4px',
                            padding: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#0369a1'
                            }}>
                              {autoDialerStats.completed}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: '#64748b'
                            }}>
                              Realizadas
                            </div>
                          </div>
                          <div style={{
                            background: 'white',
                            borderRadius: '4px',
                            padding: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#10b981'
                            }}>
                              {autoDialerStats.successful}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: '#64748b'
                            }}>
                              Atendidas
                            </div>
                          </div>
                          <div style={{
                            background: 'white',
                            borderRadius: '4px',
                            padding: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#ef4444'
                            }}>
                              {autoDialerStats.failed}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: '#64748b'
                            }}>
                              Falharam
                            </div>
                          </div>
                          <div style={{
                            background: 'white',
                            borderRadius: '4px',
                            padding: '8px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#f59e0b'
                            }}>
                              {autoDialerStats.remaining}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: '#64748b'
                            }}>
                              Restantes
                            </div>
                          </div>
                        </div>
                        
                        <div style={{
                          width: '100%',
                          height: '4px',
                          background: '#e0f2fe',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${autoDialerStats.total > 0 ? (autoDialerStats.completed / autoDialerStats.total) * 100 : 0}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        
                        {autoDialerPaused && (
                          <div style={{
                            marginTop: '8px',
                            fontSize: '12px',
                            color: '#f59e0b',
                            textAlign: 'center',
                            fontWeight: '500'
                          }}>
                            ⏸️ Discagem pausada
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {agentCampaigns.map((campaign, index) => {
                        const progress = campaign.total > 0 ? (getDialed(campaign) / campaign.total) * 100 : 0;
                        const remaining = Math.max(0, campaign.total - getDialed(campaign));
                        
                        return (
                        <div
                          key={campaign.id}
                          style={{
                            background: '#fafafa',
                            borderRadius: '6px',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            transition: 'border-color 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <h6 style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#374151',
                              margin: '0'
                            }}>
                              {campaign.name}
                            </h6>
                            
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <button
                                onClick={() => { showToast('Abrindo revisão manual...', 'success'); handleReviewCampaign(campaign); }}
                                style={{
                                  background: 'white',
                                  color: '#6b7280',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background = '#f9fafb';
                                  e.currentTarget.style.borderColor = '#9ca3af';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background = 'white';
                                  e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                              >
                                Manual
                              </button>
                              
                              <button
                                onClick={() => handleStartAutoCampaign(campaign)}
                                disabled={!webrtcUA || !webrtcRegistered || autoStarting}
                                style={{
                                  background: (webrtcUA && webrtcRegistered && !autoStarting) ? '#374151' : '#9ca3af',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  cursor: (webrtcUA && webrtcRegistered && !autoStarting) ? 'pointer' : 'not-allowed',
                                  transition: 'background-color 0.2s ease',
                                  opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onMouseOver={(e) => {
                                  if (webrtcUA && webrtcRegistered && !autoStarting) {
                                    e.currentTarget.style.background = '#1f2937';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (webrtcUA && webrtcRegistered && !autoStarting) {
                                    e.currentTarget.style.background = '#374151';
                                  }
                                }}
                              >
                                {autoStarting && (
                                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                                )}
                                {autoStarting ? 'Processando...' : 'Auto'}
                              </button>
                            </div>
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            fontSize: '12px',
                            color: '#6b7280',
                            marginTop: '8px'
                          }}>
                            <span>{getDialed(campaign)}/{campaign.total}</span>
                            <div style={{
                              flex: 1,
                              height: '2px',
                              background: '#f3f4f6',
                              borderRadius: '1px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: '#9ca3af',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <span>{progress.toFixed(0)}%</span>
                          </div>

                          {/* Inline expand when this campaign is selected for manual review */}
                          {reviewingCampaign?.id === campaign.id && (
                            <div ref={campaignReviewRef} style={{
                              marginTop: '12px',
                              background: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              padding: '12px'
                            }}>
                              {/* Loading */}
                              {loadingContacts && (
                                <div style={{ textAlign: 'center', color: '#6b7280' }}>Carregando contatos...</div>
                              )}
                              {/* Contacts */}
                              {!loadingContacts && campaignContacts.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {campaignContacts.map((contact) => (
                                    <div key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}>
                                      <div>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{contact.name}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{contact.number}</div>
                                      </div>
                                      <button
                                        onClick={() => handleCallContact(contact)}
                                        disabled={!webrtcUA || !webrtcRegistered}
                                        style={{ background: (webrtcUA && webrtcRegistered) ? '#374151' : '#9ca3af', color: '#fff', border: 0, borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: (webrtcUA && webrtcRegistered) ? 'pointer' : 'not-allowed' }}
                                      >
                                        {(webrtcUA && webrtcRegistered) ? 'Ligar' : 'Off'}
                                      </button>
                                    </div>
                                  ))}
                                  {/* Pagination */}
                                  {contactsTotal > contactsPerPage && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                      <button onClick={() => handleContactsPageChange(contactsPage - 1)} disabled={contactsPage <= 1} style={{ background: contactsPage <= 1 ? '#f3f4f6' : '#fff', color: contactsPage <= 1 ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>← Ant</button>
                                      <span style={{ fontSize: 12, color: '#6b7280' }}>{contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}</span>
                                      <button onClick={() => handleContactsPageChange(contactsPage + 1)} disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)} style={{ background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : '#fff', color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>Próx →</button>
                                    </div>
                                  )}
                                </div>
                              )}
                              {!loadingContacts && campaignContacts.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#6b7280' }}>Nenhum contato para exibir nesta página.</div>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Agent Details Card - Container Only (inner cards removed) */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background Pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '200px',
            height: '200px',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
            borderRadius: '50%',
            transform: 'translate(50%, -50%)',
            zIndex: 0
          }} />
          
          {/* Gerenciamento de Campanhas - Renderização condicional baseada em dashboardConfig */}
          {(!dashboardConfig || dashboardConfig?.cards?.campanhas?.enabled !== false) && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#374151',
                margin: '0 0 16px 0',
                paddingBottom: '12px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Gerenciamento de Campanhas
              </h3>

            {/* Verificar se auto_discagem está habilitada */}
            {!agentData?.auto_discagem ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                opacity: 0.6,
                minHeight: '200px'
              }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  animation: 'pulse 2s infinite'
                }}>
                  <Lock size={24} color="white" />
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#64748b',
                  margin: '0 0 8px 0'
                }}>
                  Função Não Ativada
                </h4>
                <p style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  O gerenciamento de chamadas automáticas não está habilitado para sua conta.
                </p>
              </div>
            ) : (
              <div style={{ padding: '20px' }}>
                {loadingCampaigns ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center'
                  }}>
                    <Activity size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#64748b',
                      margin: '12px 0 0 0'
                    }}>
                      Carregando campanhas...
                    </p>
                  </div>
                ) : !loadingCampaigns && agentCampaigns.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px'
                    }}>
                      <Activity size={24} color="white" />
                    </div>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#f59e0b',
                      margin: '0 0 8px 0'
                    }}>
                      Nenhuma Campanha Vinculada
                    </h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#64748b',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      Não há campanhas de mailing vinculadas ao seu ramal.
                    </p>
                  </div>
                ) : reviewingCampaign ? (
                  /* Manual Review UI - visible block (fix) */
                  <div ref={campaignReviewRef}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                      <div>
                        <h5 style={{ fontSize: '16px', fontWeight: '500', color: '#374151', margin: '0 0 4px 0' }}>{reviewingCampaign.name}</h5>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
                          <span>{getDialed(reviewingCampaign)}/{reviewingCampaign.total || 0}</span>
                          <span>{Math.round(((getDialed(reviewingCampaign)) / (reviewingCampaign.total || 1)) * 100)}%</span>
                        </div>
                      </div>
                      <button onClick={handleCloseReview} style={{ background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: '400', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      >
                        ← Voltar
                      </button>
                    </div>

                    {loadingContacts && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                        Carregando contatos...
                      </div>
                    )}

                    {!loadingContacts && campaignContacts.length > 0 && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                          {campaignContacts.map((contact) => (
                            <div key={contact.id} style={{ background: '#fafafa', borderRadius: '6px', padding: '12px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s ease' }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                            >
                              <div>
                                <h6 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: '0 0 2px 0' }}>{contact.name}</h6>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{contact.number}</p>
                              </div>
                              <button
                                onClick={() => handleCallContact(contact)}
                                disabled={!webrtcUA || !webrtcRegistered}
                                style={{ background: (webrtcUA && webrtcRegistered) ? '#374151' : '#9ca3af', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', fontWeight: '400', cursor: (webrtcUA && webrtcRegistered) ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s ease', opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6 }}
                                onMouseOver={(e) => { if (webrtcUA && webrtcRegistered) { e.currentTarget.style.background = '#1f2937'; } }}
                                onMouseOut={(e) => { if (webrtcUA && webrtcRegistered) { e.currentTarget.style.background = '#374151'; } }}
                              >
                                {(webrtcUA && webrtcRegistered) ? 'Ligar' : 'Off'}
                              </button>
                            </div>
                          ))}
                        </div>

                        {contactsTotal > contactsPerPage && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px', background: '#fafafa', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                            <button onClick={() => handleContactsPageChange(contactsPage - 1)} disabled={contactsPage <= 1} style={{ background: contactsPage <= 1 ? '#f3f4f6' : 'white', color: contactsPage <= 1 ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: '400', cursor: contactsPage <= 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}>← Ant</button>
                            <span style={{ fontSize: '12px', color: '#6b7280', padding: '0 8px' }}>{contactsPage}/{Math.ceil(contactsTotal / contactsPerPage)}</span>
                            <button onClick={() => handleContactsPageChange(contactsPage + 1)} disabled={contactsPage >= Math.ceil(contactsTotal / contactsPerPage)} style={{ background: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#f3f4f6' : 'white', color: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? '#9ca3af' : '#374151', border: '1px solid #d1d5db', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: '400', cursor: contactsPage >= Math.ceil(contactsTotal / contactsPerPage) ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}>Próx →</button>
                          </div>
                        )}
                      </>
                    )}
                    {!loadingContacts && campaignContacts.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>
                        Nenhum contato para exibir nesta página.
                      </div>
                    )}
                  </div>
                ) : autoDialerRunning ? (
                  /* Auto Dialer Control Panel */
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      <div>
                        <h5 style={{
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#374151',
                          margin: '0 0 4px 0'
                        }}>
                          🤖 Discagem Automática
                        </h5>
                        <p style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          margin: 0
                        }}>
                          {autoDialerCampaign?.name}
                        </p>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: autoDialerPaused ? '#f59e0b' : '#10b981',
                          animation: autoDialerPaused ? 'none' : 'pulse 2s infinite'
                        }} />
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: autoDialerPaused ? '#f59e0b' : '#10b981'
                        }}>
                          {autoDialerPaused ? 'Pausado' : 'Executando'}
                        </span>
                      </div>
                    </div>
                    {/* Controles */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!autoDialerPaused ? (
                            <button
                              onClick={pauseAutoDialer}
                              style={{
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              ⏸️ Pausar
                            </button>
                          ) : (
                            <button
                              onClick={resumeAutoDialer}
                              style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              ▶️ Retomar
                            </button>
                          )}
                          <button
                            onClick={stopAutoDialer}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            🛑 Parar
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Estatísticas resumidas */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ background: 'white', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#0369a1' }}>{autoDialerStats.completed}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Realizadas</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#10b981' }}>{autoDialerStats.successful}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Atendidas</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#ef4444' }}>{autoDialerStats.failed}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Falharam</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b' }}>{autoDialerStats.remaining}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Restantes</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#e0f2fe', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${autoDialerStats.total > 0 ? (autoDialerStats.completed / autoDialerStats.total) * 100 : 0}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    {autoDialerPaused && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#f59e0b', textAlign: 'center', fontWeight: '500' }}>
                        ⏸️ Discagem pausada
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: reviewingCampaign ? 'unset' : '300px',
                    overflowY: reviewingCampaign ? 'visible' : 'auto'
                  }}>
                    {agentCampaigns.map((campaign) => {
                      const progress = campaign.total > 0 ? (getDialed(campaign) / campaign.total) * 100 : 0;
                      return (
                        <div key={campaign.id} style={{
                          background: '#fafafa',
                          borderRadius: '6px',
                          padding: '12px',
                          border: '1px solid #e5e7eb',
                          transition: 'border-color 0.2s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <h6 style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: 0 }}>{campaign.name}</h6>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                onClick={() => { showToast('Abrindo revisão manual...', 'success'); handleReviewCampaign(campaign); }}
                                style={{
                                  background: 'white',
                                  color: '#6b7280',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                              >
                                Manual
                              </button>
                              <button
                                onClick={() => handleStartAutoCampaign(campaign)}
                                disabled={!webrtcUA || !webrtcRegistered || autoStarting}
                                style={{
                                  background: (webrtcUA && webrtcRegistered && !autoStarting) ? '#374151' : '#9ca3af',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  fontWeight: '400',
                                  cursor: (webrtcUA && webrtcRegistered && !autoStarting) ? 'pointer' : 'not-allowed',
                                  transition: 'background-color 0.2s ease',
                                  opacity: (webrtcUA && webrtcRegistered) ? 1 : 0.6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onMouseOver={(e) => { if (webrtcUA && webrtcRegistered && !autoStarting) { e.currentTarget.style.background = '#1f2937'; }}}
                                onMouseOut={(e) => { if (webrtcUA && webrtcRegistered && !autoStarting) { e.currentTarget.style.background = '#374151'; }}}
                              >
                                {autoStarting && (
                                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                                )}
                                {autoStarting ? 'Processando...' : 'Auto'}
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                            <span>{getDialed(campaign)}/{campaign.total}</span>
                            <div style={{ flex: 1, height: '2px', background: '#f3f4f6', borderRadius: '1px', overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: '#9ca3af', transition: 'width 0.3s ease' }} />
                            </div>
                            <span>{progress.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            </div>
          )}
        </div>

      </div>

      {/* Confirm Hangup Modal */}
      {confirmHangupOpen && confirmHangupTarget && (
        <div style={{
          position: 'fixed', 
          inset: 0, 
          display: 'grid', 
          placeItems: 'center',
          background: 'rgba(15,23,42,0.45)', 
          backdropFilter: 'blur(6px)', 
          zIndex: 50
        }}>
          <div style={{
            width: 'min(520px, 92vw)', 
            borderRadius: '1rem',
            background: 'rgba(255,255,255,0.98)',
            border: '1px solid rgba(226,232,240,0.8)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '1rem 1.25rem', 
              borderBottom: '1px solid #eef2f7' 
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                fontWeight: 700, 
                color: '#0f172a' 
              }}>
                Confirmar desligamento
              </h3>
              <button 
                onClick={closeConfirmHangup} 
                aria-label="Fechar" 
                style={{
                  border: '1px solid rgba(15,23,42,0.08)', 
                  background: 'transparent',
                  width: 32, 
                  height: 32, 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.25rem', color: '#334155' }}>
              <p style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                Tem certeza que deseja encerrar esta chamada?
              </p>
              <div style={{
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '0.75rem',
                background: 'rgba(248,250,252,0.6)', 
                border: '1px solid #e5e7eb', 
                borderRadius: 12, 
                padding: '0.75rem'
              }}>
                <div>
                  <strong>Origem</strong>
                  <div>{confirmHangupTarget?.callerid || '—'}</div>
                </div>
                <div>
                  <strong>Destino</strong>
                  <div>{confirmHangupTarget?.destination || '—'}</div>
                </div>
                <div>
                  <strong>Duração</strong>
                  <div>{confirmHangupTarget ? formatDuration(confirmHangupTarget.duration) : '—'}</div>
                </div>
                <div>
                  <strong>Status</strong>
                  <div>{confirmHangupTarget?.status || '—'}</div>
                </div>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '0.75rem', 
              padding: '1rem 1.25rem', 
              borderTop: '1px solid #eef2f7' 
            }}>
              <button 
                onClick={closeConfirmHangup} 
                disabled={confirmHangupLoading} 
                style={{
                  padding: '0.6rem 1rem', 
                  borderRadius: 10, 
                  border: '1px solid #e5e7eb', 
                  background: 'white', 
                  cursor: 'pointer', 
                  color: '#334155', 
                  fontWeight: 600
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmHangup} 
                disabled={confirmHangupLoading} 
                style={{
                  padding: '0.6rem 1rem', 
                  borderRadius: 10, 
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
                  color: 'white', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  opacity: confirmHangupLoading ? 0.8 : 1
                }}
              >
                {confirmHangupLoading ? 'Desligando...' : 'Desligar agora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Call Modal */}
      {transferModalOpen && transferTarget && (
        <TransferCallModal
          isOpen={transferModalOpen}
          onClose={() => {
            setTransferModalOpen(false);
            setTransferTarget(null);
          }}
          call={transferTarget}
          onTransferComplete={() => {
            setTransferModalOpen(false);
            setTransferTarget(null);
            if (typeof refetchActiveCalls === 'function') {
              refetchActiveCalls();
            }
          }}
        />
      )}


      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          fontSize: '14px',
          fontWeight: '500',
          maxWidth: '350px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        /* Efeito de pulso específico para o contato ativo */
        @keyframes contactPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59,130,246,0.25);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(59,130,246,0.08);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59,130,246,0.0);
          }
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          50% { transform: translate(-50%, -50%) rotate(180deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes waveMove {
          0%, 100% {
            transform: translateX(0) translateY(0);
          }
          25% {
            transform: translateX(-10px) translateY(-5px);
          }
          50% {
            transform: translateX(0) translateY(-10px);
          }
          75% {
            transform: translateX(10px) translateY(-5px);
          }
        }
      `}</style>
      
      {/* Hidden audio elements for WebRTC */}
      <audio 
        id="remoteAudio" 
        autoPlay 
        playsInline 
        style={{ display: 'none' }}
      />
      <audio 
        id="localAudio" 
        autoPlay 
        playsInline 
        muted 
        style={{ display: 'none' }}
      />
      <audio 
        id="ringbackAudio" 
        loop 
        style={{ display: 'none' }}
      />

      {/* Floating SMS Button */}
      <FloatingSMSButton 
        agentId={agentData?.id} 
        userId={agentData?.user_id}
      />
    </AgentLayout>
  );
}
