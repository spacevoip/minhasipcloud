'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/main-layout';
import { agentsService } from '@/services/agentsService';
import { usersService } from '@/services/usersService';
import { externalAgentsService } from '@/services/externalAgentsService';
// Permissões agora vêm do DONO DO RAMAL (usersService.getUserById)
import { useToast } from '@/components/ui/toast';
import { getCdr } from '@/services/cdrService';
import { agentCache } from '@/app/agents/manage/cache';
import { agentsCache, type CachedAgent } from '@/app/agents/agentsCache';
import { permissionsCache } from '@/app/agents/manage/permissionsCache';
import { agentsRealtimeService } from '@/services/agentsRealtimeService';
import { logger } from '@/lib/logger';
import { authService } from '@/lib/auth';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  X, 
  Eye, 
  EyeOff, 
  Copy,
  Check, 
  Phone,
  Mail,
  Building,
  Settings,
  Clock,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Zap
} from 'lucide-react';

interface Agent {
  id: string;
  extension: string;
  name: string;
  password: string;
  callerId: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  blocked: boolean;
  webrtc: boolean;
  autoDiscagem: boolean;
  upAudio: boolean;
  smsEnvio: boolean;
  createdAt: Date;
  lastActivity: Date;
  userId: string;
}

interface UserPermissions {
  webrtc: boolean;
  auto_discagem: boolean;
  sms_send: boolean;
  up_audio: boolean;
}

// Normaliza datas quando vindas do cache (localStorage serializa Date como string)
const reviveAgentDates = (raw: any): Agent => {
  const toDate = (v: any) => (v instanceof Date ? v : (v ? new Date(v) : new Date()));
  return {
    ...raw,
    lastActivity: toDate(raw?.lastActivity),
    createdAt: toDate(raw?.createdAt),
  } as Agent;
};

export default function AgentManagePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const toast = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para edição
  const [editingCallerId, setEditingCallerId] = useState(false);
  const [tempCallerId, setTempCallerId] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [editingPassword, setEditingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Controle de polling externo
  const [loadedExternalOnce, setLoadedExternalOnce] = useState(false);
  // Controle do sistema realtime unificado
  const [realtimeActive, setRealtimeActive] = useState(false);
  // Ref para controle do listener realtime
  const realtimeListenerRef = useRef<(() => void) | null>(null);
  // Estados de loading para toggles
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [loadingWebRTC, setLoadingWebRTC] = useState(false);
  const [loadingAutoDiscagem, setLoadingAutoDiscagem] = useState(false);
  const [loadingUpAudio, setLoadingUpAudio] = useState(false);
  const [loadingSmsEnvio, setLoadingSmsEnvio] = useState(false);
  // CDR-based live stats
  const [todayAnswered, setTodayAnswered] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [avgDurationSec, setAvgDurationSec] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);

  // Permissões carregadas?
  const permsLoaded = userPermissions !== null;

  // 🔁 Helpers para sincronizar o cache da lista de /agents
  const patchAgentsListCache = (partial: Partial<CachedAgent> & { id: string }) => {
    try {
      const list = agentsCache.get();
      if (!list || list.length === 0) return;
      const idx = list.findIndex(a => a.id === partial.id);
      if (idx === -1) return;
      const current = list[idx];
      const updated: CachedAgent = {
        ...current,
        ...partial,
        // Garantias de tipos
        extension: String(partial.extension ?? current.extension),
        createdAt: String(partial.createdAt ?? current.createdAt),
        lastActivity: partial.lastActivity ?? current.lastActivity
      };
      const next = [...list];
      next[idx] = updated;
      agentsCache.set(next);
    } catch {}
  };

  const touchAgentsListCache = () => {
    try {
      const list = agentsCache.get();
      if (list) agentsCache.set(list);
    } catch {}
  };

  const loadAgent = async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setLoading(true);
        setError(null);
        
        // Buscar apenas o agente específico por ID
        const foundAgent = await agentsService.getAgentById(agentId);
        if (!foundAgent) {
          setError(`Agente com ID ${agentId} não encontrado no sistema`);
          return;
        }

        // Converter dados reais para formato da interface
        
        
        const formattedAgent: Agent = {
          id: foundAgent.id,
          extension: (foundAgent as any).ramal ?? (foundAgent as any).extension,
          name: (foundAgent as any).name ?? (foundAgent as any).agente_name,
          password: (foundAgent as any).password ?? (foundAgent as any).senha ?? '',
          callerId: (foundAgent as any).callerid ?? (foundAgent as any).callerId ?? (foundAgent as any).ramal ?? (foundAgent as any).extension,
          status: ((foundAgent as any).status ?? 'offline') as Agent['status'],
          blocked: Boolean((foundAgent as any).blocked ?? (foundAgent as any).bloqueio),
          webrtc: Boolean((foundAgent as any).webrtc),
          autoDiscagem: ((v: any) => v === true || v === 1 || v === '1')(
            (foundAgent as any).auto_discagem ?? (foundAgent as any).autoDiscagem
          ),
          upAudio: Boolean((foundAgent as any).up_audio),
          smsEnvio: Boolean((foundAgent as any).sms_send),
          createdAt: (foundAgent as any).createdAt ? new Date((foundAgent as any).createdAt) : new Date(),
          lastActivity: (foundAgent as any).lastActivity ? new Date((foundAgent as any).lastActivity) : new Date(),
          userId: (foundAgent as any).userId || (foundAgent as any).user_id || ''
        };
        
        setAgent(formattedAgent);
        setTempCallerId(formattedAgent.callerId);
        setTempName(formattedAgent.name);
        // Atualiza cache local para este agente
        if (agentId) {
          try { agentCache.invalidate(agentId); } catch {}
          try { agentCache.set(agentId, formattedAgent); } catch {}
        }
        
        // Buscar permissões DO DONO DO RAMAL (userId do agente), não do usuário logado
        try {
          if (formattedAgent.userId) {
            const owner = await usersService.getUserById(formattedAgent.userId);
            const perms: UserPermissions = {
              webrtc: Boolean((owner as any)?.webrtc),
              auto_discagem: Boolean((owner as any)?.auto_discagem),
              sms_send: Boolean((owner as any)?.sms_send),
              up_audio: Boolean((owner as any)?.up_audio)
            };
            setUserPermissions(perms);
            // Cachear por ID do dono do ramal
            try { permissionsCache.set(String(formattedAgent.userId), perms); } catch {}
          } else {
            // Sem userId: fallback permissivo
            setUserPermissions({ webrtc: true, auto_discagem: true, sms_send: true, up_audio: true });
          }
        } catch (err) {
          console.warn('Não foi possível buscar permissões do usuário dono do ramal:', err);
          // Fallback permissivo
          setUserPermissions({ webrtc: true, auto_discagem: true, sms_send: true, up_audio: true });
        }
        
      } catch (err: any) {
        setError(`Erro ao carregar dados do agente: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

  // Hidrata imediatamente do cache local (se existir) para evitar piscar
  useEffect(() => {
    if (!agentId) return;
    const cached = agentCache.get<Agent>(agentId);
    if (cached) {
      const revived = reviveAgentDates(cached as any);
      setAgent(revived);
      setTempCallerId(revived.callerId);
      setTempName(revived.name);
      // Hidratar permissões do cache imediatamente para evitar flicker
      if (revived.userId) {
        const cachedPerms = permissionsCache.get(revived.userId);
        if (cachedPerms) setUserPermissions(cachedPerms);
      }
      setLoading(false);
    }
  }, [agentId]);

  // Busca os dados reais; se houver cache, faz em modo silencioso
  useEffect(() => {
    if (agentId) {
      const cached = agentCache.get<Agent>(agentId);
      loadAgent({ silent: !!cached });
    }
  }, [agentId]);

  // 🔴 SISTEMA UNIFICADO: Realtime + Fallback External
  useEffect(() => {
    if (!agent?.extension || !agent?.userId) return;

    const user = authService.getCurrentUser();
    if (!user?.id) {
      logger.info('⚠️ Usuário não encontrado para realtime em /agents/manage/');
      return;
    }

    logger.info(`🔴 Iniciando sistema unificado para ramal: ${agent.extension}`);

    // 1️⃣ PRIORIDADE: Sistema Realtime (Supabase)
    const startRealtimeSystem = () => {
      try {
        // Verificar se deve ativar realtime
        if (!agentsRealtimeService.shouldActivateRealtime('/agents/manage')) {
          logger.info('📄 Página /agents/manage usando fallback externo');
          return false;
        }

        logger.info('✅ Realtime ativado para /agents/manage');

        // Listener para updates realtime
        const unsubscribeRealtime = agentsRealtimeService.addListener((update) => {
          logger.info(`🔴 MANAGE LISTENER: ${update.ramal} → ${update.status} (${update.isRealtime ? 'Realtime' : 'Fallback'})`);
          
          // Verificar se é o ramal correto
          if (String(update.ramal) !== String(agent.extension)) {
            logger.info(`🔴 Ignorando update para ramal diferente: ${update.ramal} vs ${agent.extension}`);
            return;
          }

          // Atualizar estado do agente - APENAS STATUS
          setAgent(prev => {
            if (!prev) return prev;
            
            const updated = {
              ...prev,
              status: update.status,
              lastActivity: update.lastSeen ? new Date(update.lastSeen) : new Date()
              // callerId NÃO deve ser alterado pelo sistema de status
            } as Agent;
            
            logger.info(`🔄 MANAGE AGENT UPDATED: ${updated.extension} → ${updated.status}`);
            return updated;
          });
        });

        // Iniciar realtime para este ramal específico
        agentsRealtimeService.startRealtimeForAgents([String(agent.extension)], user.id);
        
        // Salvar referência do listener
        realtimeListenerRef.current = unsubscribeRealtime;
        setRealtimeActive(true);
        
        logger.info(`🔴 Realtime iniciado para ramal ${agent.extension}`);
        return true;
      } catch (error) {
        logger.error('❌ Erro ao iniciar sistema realtime:', error);
        return false;
      }
    };

    // 2️⃣ FALLBACK: Sistema External (API Externa)
    const startFallbackSystem = async () => {
      try {
        logger.info(`🔄 Iniciando fallback externo para ramal: ${agent.extension}`);
        
        const res = await externalAgentsService.getAgentsByUserId(agent.userId);
        if (!res.success) {
          logger.warn('⚠️ Fallback externo falhou');
          return;
        }

        const ui = externalAgentsService.formatAgentsForUI(res.data);
        const match = ui.find(a => a.extension === agent.extension);
        if (!match) {
          logger.warn(`⚠️ Ramal ${agent.extension} não encontrado no fallback`);
          return;
        }

        // Fallback deve atualizar APENAS STATUS - não callerId
        const next = {
          status: (match.status === 'online' || match.status === 'offline') ? match.status : 'offline'
          // callerId removido - não deve ser alterado pelo sistema de status
        } as Partial<Agent>;

        const changed = next.status !== agent.status;

        if (changed) {
          setAgent(prev => prev ? { ...prev, ...next } as Agent : prev);
          logger.info(`🔄 FALLBACK UPDATE: ${agent.extension} → ${next.status}`);
        }
        
        setLoadedExternalOnce(true);
      } catch (error) {
        logger.error('❌ Erro no fallback externo:', error);
      }
    };

    // 🎯 ESTRATÉGIA: Tentar Realtime primeiro, fallback se falhar
    const realtimeStarted = startRealtimeSystem();
    
    if (!realtimeStarted) {
      // Se realtime falhou, usar fallback
      startFallbackSystem();
    }

    // Cleanup
    return () => {
      if (realtimeListenerRef.current) {
        logger.info('🔴 Removendo listener realtime em /agents/manage');
        realtimeListenerRef.current();
        realtimeListenerRef.current = null;
      }
      setRealtimeActive(false);
    };
  }, [agent?.extension, agent?.userId, editingCallerId]);

  // Fetch today's CDRs for this agent's extension and compute stats
  useEffect(() => {
    if (!agent?.extension) return;

    let cancelled = false;

    const startOfToday = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const computeStats = (records: any[]) => {
      const ext = String(agent.extension);
      const involved = records.filter((r: any) => {
        const rx = String(r.extension || '');
        const from = String(r.from || '');
        const to = String(r.to || '');
        return rx === ext || from === ext || to === ext;
      });
      const total = involved.length;
      const answered = involved.filter((r: any) => r.status === 'answered');
      const answeredCount = answered.length;
      const avg = answeredCount > 0
        ? Math.round(answered.reduce((acc: number, r: any) => acc + (Number(r.duration) || 0), 0) / answeredCount)
        : 0;

      return { total, answered: answeredCount, avgSec: avg };
    };

    const fetchToday = async () => {
      try {
        if (!cancelled) setStatsLoading(true);
        const start = startOfToday().toISOString();
        const end = new Date().toISOString();
        const pageLimit = 200;
        let page = 1;
        const cap = 2000;
        const all: any[] = [];
        let fetched = 0;
        let totalPages = 1;

        do {
          const resp = await getCdr({ startDate: start, endDate: end, limit: pageLimit, order: 'desc', page });
          const recs = resp.records || [];
          all.push(...recs);
          fetched += recs.length;
          totalPages = resp.totalPages || totalPages;
          page += 1;
          if (fetched >= cap) break;
          if (recs.length === 0) break;
          if (page > totalPages) break;
        } while (!cancelled);

        const { total, answered, avgSec } = computeStats(all);
        if (!cancelled) {
          setTodayTotal(total);
          setTodayAnswered(answered);
          setAvgDurationSec(avgSec);
        }
      } catch (e) {
        
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    // Executar somente uma vez ao entrar na página (após extension válido)
    fetchToday();

    return () => {
      cancelled = true;
    };
  }, [agent?.extension]);

  const getStatusBadge = (status: Agent['status']) => {
    const statusConfig = {
      online: { 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.15))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: '#10b981',
        label: 'Online',
        dotColor: '#10b981'
      },
      offline: { 
        background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(107, 114, 128, 0.15))',
        border: '1px solid rgba(107, 114, 128, 0.3)',
        color: '#6b7280',
        label: 'Offline',
        dotColor: '#6b7280'
      },
      busy: { 
        background: 'linear-gradient(135deg, rgba(245, 101, 101, 0.1), rgba(245, 101, 101, 0.15))',
        border: '1px solid rgba(245, 101, 101, 0.3)',
        color: '#f56565',
        label: 'Ocupado',
        dotColor: '#f56565'
      },
      away: { 
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.15))',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        color: '#fbbf24',
        label: 'Ausente',
        dotColor: '#fbbf24'
      }
    };

    const config = statusConfig[status];
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        background: config.background,
        border: config.border,
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: config.color
      }}>
        <div style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '50%',
          background: config.dotColor,
          animation: status === 'online' ? 'pulse 2s infinite' : 'none'
        }} />
        {config.label}
      </div>
    );
  };

  const formatCallerIdDisplay = (callerId: string) => {
    if (!callerId) return '';
    
    if (callerId.length === 11) {
      return `${callerId.slice(0, 2)} ${callerId.slice(2, 7)}-${callerId.slice(7)}`;
    } else if (callerId.length === 10) {
      return `${callerId.slice(0, 2)} ${callerId.slice(2, 6)}-${callerId.slice(6)}`;
    }
    
    return callerId;
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      
    }
  };

  const startEditingCallerId = () => {
    setEditingCallerId(true);
    setTempCallerId(agent?.callerId || '');
  };

  const saveCallerId = async () => {
    if (!agent || !tempCallerId.trim()) return;
    
    try {
      
      // Atualizar no backend via agentsService
      await agentsService.updateAgent(agent.id, {
        callerid: tempCallerId.trim()
      });
      
      // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Atualizar estado local imediatamente
      const updatedAgent = { ...agent, callerId: tempCallerId.trim() };
      setAgent(updatedAgent);
      setEditingCallerId(false);
      // Atualiza cache
      try { agentCache.invalidate(agent.id); } catch {}
      try { agentCache.set(agent.id, updatedAgent); } catch {}
      // 🔁 Atualiza cache da lista de /agents
      patchAgentsListCache({ id: agent.id, callerId: tempCallerId.trim() });
      touchAgentsListCache();
      
      toast.success('CallerId atualizado', 'O CallerId foi salvo com sucesso no sistema');
      
    } catch (error) {
      // Reverter para valor original em caso de erro
      setTempCallerId(agent.callerId);
      toast.error('Erro ao salvar CallerId', 'Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  const cancelEditingCallerId = () => {
    setEditingCallerId(false);
    setTempCallerId('');
  };

  const startEditingName = () => {
    setEditingName(true);
    setTempName(agent?.name || '');
  };

  const saveName = async () => {
    if (!agent || !tempName.trim()) return;
    
    try {
      
      // Atualizar no backend via agentsService
      await agentsService.updateAgent(agent.id, {
        agente_name: tempName.trim()
      });
      
      // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Atualizar estado local imediatamente
      const updatedAgent = { ...agent, name: tempName.trim() };
      setAgent(updatedAgent);
      setEditingName(false);
      // Atualiza cache
      try { agentCache.invalidate(agent.id); } catch {}
      try { agentCache.set(agent.id, updatedAgent); } catch {}
      // 🔁 Atualiza cache da lista de /agents
      patchAgentsListCache({ id: agent.id, name: tempName.trim() });
      touchAgentsListCache();
      
      toast.success('Nome atualizado', 'O nome do agente foi salvo com sucesso no sistema');
      
    } catch (error) {
      // Reverter para valor original em caso de erro
      setTempName(agent.name);
      toast.error('Erro ao salvar nome', 'Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  const cancelEditingName = () => {
    setTempName(agent?.name || '');
    setEditingName(false);
  };

  // ✅ FUNÇÕES DE EDIÇÃO DE SENHA COM ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR
  const startEditingPassword = () => {
    setEditingPassword(true);
    setTempPassword(agent?.password || '');
  };

  const savePassword = async () => {
    if (!agent || !tempPassword.trim()) return;
    
    if (tempPassword.length < 4) {
      toast.error('Senha inválida', 'A senha deve ter pelo menos 4 caracteres');
      return;
    }
    
    try {
      
      // Atualizar no backend via agentsService
      await agentsService.updateAgent(agent.id, {
        senha: tempPassword.trim()
      });
      
      // ✅ ATUALIZAÇÃO AUTOMÁTICA SEM PISCAR - Atualizar estado local imediatamente
      const updatedAgent = { ...agent, password: tempPassword.trim() };
      setAgent(updatedAgent);
      setEditingPassword(false);
      // Atualiza cache
      try { agentCache.invalidate(agent.id); } catch {}
      try { agentCache.set(agent.id, updatedAgent); } catch {}
      // 🔁 Atualiza cache da lista de /agents
      patchAgentsListCache({ id: agent.id, password: tempPassword.trim() });
      touchAgentsListCache();
      
      toast.success('Senha atualizada', 'A senha do agente foi salva com sucesso no sistema');
      
    } catch (error) {
      // Reverter para valor original em caso de erro
      setTempPassword(agent.password);
      toast.error('Erro ao salvar senha', 'Não foi possível salvar as alterações. Tente novamente.');
    }
  };

  const cancelEditingPassword = () => {
    setEditingPassword(false);
    setTempPassword('');
  };

  // ✅ FUNÇÕES DE TOGGLE PARA STATUS
  const toggleBlocked = async () => {
    if (!agent || loadingBlocked) return;
    
    try {
      setLoadingBlocked(true);
      const newBlockedStatus = !agent.blocked;
      
      await agentsService.updateAgent(agent.id, {
        blocked: newBlockedStatus
      });
      
      const updatedAgent = { ...agent, blocked: newBlockedStatus };
      setAgent(updatedAgent);
      try { agentCache.invalidate(agent.id); } catch {}
      try { agentCache.set(agent.id, updatedAgent); } catch {}
      // 🔁 Atualiza cache da lista de /agents (isActive inverso de blocked)
      patchAgentsListCache({ id: agent.id, isActive: !newBlockedStatus });
      touchAgentsListCache();
      
      toast.success(
        newBlockedStatus ? 'Agente bloqueado' : 'Agente desbloqueado',
        `O ramal foi ${newBlockedStatus ? 'bloqueado' : 'desbloqueado'} com sucesso`
      );
      
    } catch (error) {
      toast.error('Erro ao alterar status', 'Não foi possível alterar o status de bloqueio');
    } finally {
      setLoadingBlocked(false);
    }
  };

  const toggleWebRTC = async () => {
    if (!agent || loadingWebRTC) return;
    
    // Verificar se o usuário tem permissão para WebRTC
    if (!userPermissions?.webrtc) {
      toast.error('Permissão negada', 'O usuário não tem permissão para usar WebRTC. Ative primeiro no perfil do usuário.');
      return;
    }
    
    try {
      setLoadingWebRTC(true);
      const newWebRTCStatus = !agent.webrtc;
      
      await agentsService.updateAgent(agent.id, {
        webrtc: newWebRTCStatus
      });
      
      const updatedAgent = { ...agent, webrtc: newWebRTCStatus };
      setAgent(updatedAgent);
      try { agentCache.invalidate(agent.id); } catch {}
      try { agentCache.set(agent.id, updatedAgent); } catch {}
      
      toast.success(
        newWebRTCStatus ? 'WebRTC ativado' : 'WebRTC desativado',
        `O WebPhone foi ${newWebRTCStatus ? 'ativado' : 'desativado'} com sucesso`
      );
      
    } catch (error) {
      toast.error('Erro ao alterar WebRTC', 'Não foi possível alterar o status do WebRTC');
    } finally {
      setLoadingWebRTC(false);
    }
  };

  const toggleAutoDiscagem = async () => {
    if (!agent || loadingAutoDiscagem) return;
    
    // Verificar se o usuário tem permissão para Auto Discagem
    if (!userPermissions?.auto_discagem) {
      toast.error('Permissão negada', 'O usuário não tem permissão para usar Auto Discagem. Ative primeiro no perfil do usuário.');
      return;
    }
    
    try {
      setLoadingAutoDiscagem(true);
      const newAutoDiscagemStatus = !agent.autoDiscagem;
      
      await agentsService.updateAgent(agent.id, {
        auto_discagem: newAutoDiscagemStatus
      });
      
      const updatedAgent = { ...agent, autoDiscagem: newAutoDiscagemStatus };
      setAgent(updatedAgent);
      try { agentCache.invalidate(agent.id); } catch {}
      try { agentCache.set(agent.id, updatedAgent); } catch {}
      
      toast.success(
        newAutoDiscagemStatus ? 'Auto Discagem ativada' : 'Auto Discagem desativada',
        `A Auto Discagem foi ${newAutoDiscagemStatus ? 'ativada' : 'desativada'} com sucesso`
      );
      
    } catch (error) {
      toast.error('Erro ao alterar Auto Discagem', 'Não foi possível alterar o status da Auto Discagem');
    } finally {
      setLoadingAutoDiscagem(false);
    }
  };

  // Função para alternar Upload Audio
  const toggleUpAudio = async () => {
    if (!agent || loadingUpAudio) return;
    // Verificar permissão do dono do ramal
    if (!userPermissions?.up_audio) {
      toast.error('Permissão negada', 'O usuário não tem permissão para Upload de Áudio. Ative primeiro no perfil do usuário.');
      return;
    }
    
    try {
      setLoadingUpAudio(true);
      const newUpAudioStatus = !agent.upAudio;
      
      await agentsService.updateAgent(agent.id, {
        up_audio: newUpAudioStatus
      });
      
      const updatedAgent = { ...agent, upAudio: newUpAudioStatus };
      setAgent(updatedAgent);
      
      // Atualizar cache
      try { agentCache.set(agentId, updatedAgent); } catch {}
      
      toast.success(
        newUpAudioStatus ? 'Upload de áudio ativado' : 'Upload de áudio desativado',
        `O upload de áudio foi ${newUpAudioStatus ? 'ativado' : 'desativado'} com sucesso`
      );
    } catch (error) {
      console.error('Erro ao alterar upload de áudio:', error);
      toast.error('Erro ao alterar upload de áudio', 'Não foi possível alterar o status do upload de áudio');
    } finally {
      setLoadingUpAudio(false);
    }
  };

  // Função para alternar Envio de SMS
  const toggleSmsEnvio = async () => {
    if (!agent || loadingSmsEnvio) return;
    // Verificar permissão do dono do ramal
    if (!userPermissions?.sms_send) {
      toast.error('Permissão negada', 'O usuário não tem permissão para Envio de SMS. Ative primeiro no perfil do usuário.');
      return;
    }
    
    try {
      setLoadingSmsEnvio(true);
      const newSmsEnvioStatus = !agent.smsEnvio;
      
      await agentsService.updateAgent(agent.id, {
        sms_send: newSmsEnvioStatus
      });
      
      const updatedAgent = { ...agent, smsEnvio: newSmsEnvioStatus };
      setAgent(updatedAgent);
      
      // Atualizar cache
      try { agentCache.set(agentId, updatedAgent); } catch {}
      
      toast.success(
        newSmsEnvioStatus ? 'Envio de SMS ativado' : 'Envio de SMS desativado',
        `O envio de SMS foi ${newSmsEnvioStatus ? 'ativado' : 'desativado'} com sucesso`
      );
    } catch (error) {
      console.error('Erro ao alterar envio de SMS:', error);
      toast.error('Erro ao alterar envio de SMS', 'Não foi possível alterar o status do envio de SMS');
    } finally {
      setLoadingSmsEnvio(false);
    }
  };

  // ✅ FUNÇÃO OTIMIZADA - Recarregar dados apenas quando necessário (não após edições locais)
  const refreshAgentData = async (forceRefresh = false) => {
    if (!agentId) return;
    
    try {
      if (forceRefresh) {
        setLoading(true);
      }
      
      const foundAgent = await agentsService.getAgentById(agentId);
      
      if (!foundAgent) {
        toast.error('Agente não encontrado', 'O agente pode ter sido removido do sistema');
        return;
      }

      const formattedAgent: Agent = {
        id: foundAgent.id,
        name: foundAgent.name,
        extension: foundAgent.ramal,
        status: foundAgent.status,
        lastActivity: foundAgent.lastActivity ? new Date(foundAgent.lastActivity) : new Date(),
        callerId: foundAgent.callerid || foundAgent.ramal,
        password: foundAgent.password || '******',
        webrtc: Boolean(foundAgent.webrtc),
        blocked: Boolean(foundAgent.blocked),
        autoDiscagem: ((v: any) => v === true || v === 1 || v === '1')(
          (foundAgent as any).auto_discagem ?? (foundAgent as any).autoDiscagem
        ),
        upAudio: Boolean((foundAgent as any).up_audio),
        smsEnvio: Boolean((foundAgent as any).sms_send),
        createdAt: foundAgent.createdAt ? new Date(foundAgent.createdAt) : new Date(),
        userId: foundAgent.userId || (foundAgent as any).user_id || ''
      };
      
      setAgent(formattedAgent);
      setTempCallerId(formattedAgent.callerId);
      setTempName(formattedAgent.name);
      try { agentCache.invalidate(agentId); } catch {}
      try { agentCache.set(agentId, formattedAgent); } catch {}
      
      toast.success('Dados atualizados', 'Os dados do agente foram recarregados com sucesso');
      
    } catch (error: any) {
      toast.error('Erro ao atualizar', 'Não foi possível recarregar os dados do agente');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{
          padding: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            fontSize: '1.125rem',
            color: '#6b7280'
          }}>
            <div style={{
              position: 'relative',
              width: '3rem',
              height: '3rem'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                border: '4px solid rgba(99, 102, 241, 0.1)',
                borderTop: '4px solid #6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '1rem',
                height: '1rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite'
              }} />
            </div>
            <div style={{
              textAlign: 'center',
              fontWeight: '500'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>Carregando dados do agente...</div>
              <div style={{
                fontSize: '0.875rem',
                color: '#9ca3af',
                opacity: '0.8'
              }}>Aguarde um momento</div>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.8); }
          }
        `}</style>
      </MainLayout>
    );
  }

  if (error || !agent) {
    return (
      <MainLayout>
        <div style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: '1rem'
        }}>
          <div style={{
            fontSize: '1.25rem',
            color: '#ef4444',
            fontWeight: '600'
          }}>
            {error || 'Agente não encontrado'}
          </div>
          <button
            onClick={() => router.push('/agents')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
            Voltar para Agentes
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        {/* Header com botão voltar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => router.push('/agents')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(243, 244, 246, 0.8)',
              border: '1px solid rgba(209, 213, 219, 0.8)',
              borderRadius: '0.5rem',
              color: '#374151',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
            Voltar
          </button>

          {/* Botão de Atualizar */}
          <button
            onClick={() => loadAgent()}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              width: '3rem',
              height: '3rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }}
            title="Atualizar dados do agente"
          >
            <RefreshCw style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
          <div>
            <h1 style={{
              fontSize: '1.875rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: 0
            }}>
              Gerenciamento do Agente ({agent.name} - {agent.extension})
            </h1>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '2rem',
          maxWidth: '1400px'
        }}>
          {/* Card Informações Básicas */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 1.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#22c55e' }} />
              Informações & Segurança
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Nome do Agente */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Nome do Agente
                </label>
                {editingName ? (
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}>
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'white',
                        border: '2px solid #6366f1',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#1e293b',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                    <button onClick={saveName} style={{ padding: '0.5rem', background: '#22c55e', border: 'none', borderRadius: '0.375rem', color: 'white', cursor: 'pointer' }}>
                      <Save style={{ width: '1rem', height: '1rem' }} />
                    </button>
                    <button onClick={cancelEditingName} style={{ padding: '0.5rem', background: '#ef4444', border: 'none', borderRadius: '0.375rem', color: 'white', cursor: 'pointer' }}>
                      <X style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '0.75rem',
                    background: 'white',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={startEditingName}
                  >
                    <span>{agent.name}</span>
                    <Edit style={{ width: '1rem', height: '1rem', color: '#6366f1' }} />
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Status Atual
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {getStatusBadge(agent.status)}
                  <span style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Última atividade: {agent.lastActivity.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* CallerID */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  CallerID
                </label>
                {editingCallerId ? (
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}>
                    <input
                      type="text"
                      value={tempCallerId}
                      onChange={(e) => setTempCallerId(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'white',
                        border: '2px solid #6366f1',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#1e293b',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                    <button onClick={saveCallerId} style={{ padding: '0.5rem', background: '#22c55e', border: 'none', borderRadius: '0.375rem', color: 'white', cursor: 'pointer' }}>
                      <Save style={{ width: '1rem', height: '1rem' }} />
                    </button>
                    <button onClick={cancelEditingCallerId} style={{ padding: '0.5rem', background: '#ef4444', border: 'none', borderRadius: '0.375rem', color: 'white', cursor: 'pointer' }}>
                      <X style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '0.75rem',
                    background: 'white',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={startEditingCallerId}
                  >
                    <span>{formatCallerIdDisplay(agent.callerId)}</span>
                    <Edit style={{ width: '1rem', height: '1rem', color: '#6366f1' }} />
                  </div>
                )}
              </div>

              {/* Senha do Ramal */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Senha do Ramal
                </label>
                {editingPassword ? (
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}>
                    <input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '2px solid #6366f1',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={savePassword}
                      style={{
                        padding: '0.5rem',
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                      title="Salvar senha"
                    >
                      <Check style={{ width: '1rem', height: '1rem' }} />
                    </button>
                    <button
                      onClick={cancelEditingPassword}
                      style={{
                        padding: '0.5rem',
                        background: '#ef4444',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                      title="Cancelar edição"
                    >
                      <X style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '0.75rem',
                    background: 'white',
                    border: '1px solid rgba(209, 213, 219, 0.8)',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>
                      {showPassword ? agent.password : '••••••••'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          padding: '0.25rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b'
                        }}
                        title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      >
                        {showPassword ? 
                          <EyeOff style={{ width: '1rem', height: '1rem' }} /> : 
                          <Eye style={{ width: '1rem', height: '1rem' }} />
                        }
                      </button>
                      <button
                        onClick={() => copyToClipboard(agent.password, 'senha')}
                        style={{
                          padding: '0.25rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b'
                        }}
                        title="Copiar senha"
                      >
                        <Copy style={{ width: '1rem', height: '1rem' }} />
                      </button>
                      <button
                        onClick={startEditingPassword}
                        style={{
                          padding: '0.25rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6366f1'
                        }}
                        title="Editar senha"
                      >
                        <Edit style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(226, 232, 240, 0.5)',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => copyToClipboard(agent.extension, 'ramal')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '0.5rem',
                    color: '#6366f1',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
                  Copiar Ramal
                </button>
                <button
                  onClick={() => copyToClipboard(agent.password, 'senha')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.1))',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '0.5rem',
                    color: '#22c55e',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <Copy style={{ width: '0.875rem', height: '0.875rem' }} />
                  Copiar Senha
                </button>
              </div>
            </div>
          </div>

          {/* Card Segurança */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 1.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />
              Controle
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Status de Bloqueio */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Status de Bloqueio
                </label>
                <div style={{
                  padding: '0.75rem',
                  background: agent.blocked 
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05))'
                    : 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))',
                  border: agent.blocked 
                    ? '1px solid rgba(239, 68, 68, 0.2)'
                    : '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer'
                }}
                onClick={toggleBlocked}
                >
                  <div style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: agent.blocked ? '#ef4444' : '#22c55e'
                  }} />
                  <span style={{
                    fontWeight: '600',
                    color: agent.blocked ? '#dc2626' : '#16a34a'
                  }}>
                    {agent.blocked ? 'Bloqueado' : 'Desbloqueado'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loadingBlocked ? (
                      <div style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        border: '2px solid rgba(99, 102, 241, 0.2)',
                        borderTop: '2px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : agent.blocked ? (
                      <ToggleRight style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />
                    ) : (
                      <ToggleLeft style={{ width: '1.25rem', height: '1.25rem', color: '#22c55e' }} />
                    )}
                    {agent.blocked && !loadingBlocked && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#dc2626',
                        fontWeight: '500'
                      }}>
                        Suspenso
                      </span>
                    )}
                    {loadingBlocked && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#6366f1',
                        fontWeight: '500'
                      }}>
                        Alterando...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* WebRTC */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  WebRTC (WebPhone)
                </label>
                <div style={{
                  padding: '0.75rem',
                  background: !permsLoaded
                    ? 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))'
                    : (!userPermissions?.webrtc 
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05))'
                      : (agent.webrtc 
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))')
                      ),
                  border: !permsLoaded
                    ? '1px solid rgba(107, 114, 128, 0.2)'
                    : (!userPermissions?.webrtc 
                      ? '1px solid rgba(239, 68, 68, 0.2)'
                      : (agent.webrtc 
                        ? '1px solid rgba(34, 197, 94, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)')
                      ),
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: permsLoaded && userPermissions?.webrtc ? 'pointer' : 'not-allowed',
                  opacity: permsLoaded && userPermissions?.webrtc ? 1 : 0.6
                }}
                onClick={permsLoaded && userPermissions?.webrtc ? toggleWebRTC : undefined}
                >
                  <div style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: agent.webrtc ? '#22c55e' : '#6b7280'
                  }} />
                  <span style={{
                    fontWeight: '600',
                    color: agent.webrtc ? '#16a34a' : '#6b7280'
                  }}>
                    {agent.webrtc ? 'Ativado' : 'Desativado'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loadingWebRTC ? (
                      <div style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        border: '2px solid rgba(99, 102, 241, 0.2)',
                        borderTop: '2px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : agent.webrtc ? (
                      <ToggleRight style={{ width: '1.25rem', height: '1.25rem', color: '#22c55e' }} />
                    ) : (
                      <ToggleLeft style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
                    )}
                    <span style={{
                      fontSize: '0.75rem',
                      color: loadingWebRTC ? '#6366f1' : (!permsLoaded ? '#64748b' : (!userPermissions?.webrtc ? '#ef4444' : '#64748b'))
                    }}>
                      {loadingWebRTC ? 'Alterando...' : (!permsLoaded ? 'Verificando...' : (!userPermissions?.webrtc ? 'Sem permissão' : (agent.webrtc ? 'Navegador' : 'Desabilitado')))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Auto Discagem */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Auto Discagem
                </label>
                <button
                  type="button"
                  disabled={loadingAutoDiscagem || !permsLoaded || userPermissions?.auto_discagem === false}
                  style={{
                  padding: '0.75rem',
                  background: !permsLoaded
                    ? 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))'
                    : (userPermissions?.auto_discagem === false
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05))'
                      : (agent.autoDiscagem 
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))')
                      ),
                  border: !permsLoaded
                    ? '1px solid rgba(107, 114, 128, 0.2)'
                    : (userPermissions?.auto_discagem === false
                      ? '1px solid rgba(239, 68, 68, 0.2)'
                      : (agent.autoDiscagem 
                        ? '1px solid rgba(99, 102, 241, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)')
                      ),
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  textAlign: 'left',
                  cursor: (loadingAutoDiscagem || !permsLoaded || userPermissions?.auto_discagem === false) ? 'not-allowed' : 'pointer',
                  opacity: (loadingAutoDiscagem || !permsLoaded || userPermissions?.auto_discagem === false) ? 0.6 : 1
                }}
                onClick={!(loadingAutoDiscagem || !permsLoaded || userPermissions?.auto_discagem === false) ? toggleAutoDiscagem : undefined}
                >
                  <div style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: agent.autoDiscagem ? '#6366f1' : '#6b7280'
                  }} />
                  <span style={{
                    fontWeight: '600',
                    color: agent.autoDiscagem ? '#6366f1' : '#6b7280'
                  }}>
                    {agent.autoDiscagem ? 'Ativado' : 'Desativado'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loadingAutoDiscagem ? (
                      <div style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        border: '2px solid rgba(99, 102, 241, 0.2)',
                        borderTop: '2px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : agent.autoDiscagem ? (
                      <ToggleRight style={{ width: '1.25rem', height: '1.25rem', color: '#6366f1' }} />
                    ) : (
                      <ToggleLeft style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
                    )}
                    {!loadingAutoDiscagem && (
                      <Zap style={{ width: '1rem', height: '1rem', color: agent.autoDiscagem ? '#6366f1' : '#6b7280' }} />
                    )}
                    <span style={{
                      fontSize: '0.75rem',
                      color: loadingAutoDiscagem ? '#6366f1' : (!permsLoaded ? '#64748b' : (userPermissions?.auto_discagem === false ? '#ef4444' : '#64748b'))
                    }}>
                      {loadingAutoDiscagem ? 'Alterando...' : (!permsLoaded ? 'Verificando...' : (userPermissions?.auto_discagem === false ? 'Sem permissão' : (agent.autoDiscagem ? 'Automática' : 'Manual')))}
                    </span>
                  </div>
                </button>
              </div>

              {/* Permitir Upload Audio */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Permitir Upload Audio
                </label>
                <div style={{
                  padding: '0.75rem',
                  background: !permsLoaded || userPermissions?.up_audio === false
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05))'
                    : agent.upAudio 
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))'
                      : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))',
                  border: !permsLoaded || userPermissions?.up_audio === false
                    ? '1px solid rgba(239, 68, 68, 0.2)'
                    : agent.upAudio 
                      ? '1px solid rgba(34, 197, 94, 0.2)'
                      : '1px solid rgba(107, 114, 128, 0.2)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: !permsLoaded || userPermissions?.up_audio === false ? 'not-allowed' : 'pointer',
                  opacity: !permsLoaded || userPermissions?.up_audio === false ? 0.6 : 1
                }}
                onClick={permsLoaded && userPermissions?.up_audio !== false ? toggleUpAudio : undefined}
                >
                  <div style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: agent.upAudio ? '#22c55e' : '#6b7280'
                  }} />
                  <span style={{
                    fontWeight: '600',
                    color: agent.upAudio ? '#16a34a' : '#6b7280'
                  }}>
                    {agent.upAudio ? 'Ativado' : 'Desativado'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loadingUpAudio ? (
                      <div style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        border: '2px solid rgba(99, 102, 241, 0.2)',
                        borderTop: '2px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : agent.upAudio ? (
                      <ToggleRight style={{ width: '1.25rem', height: '1.25rem', color: '#22c55e' }} />
                    ) : (
                      <ToggleLeft style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
                    )}
                    <span style={{
                      fontSize: '0.75rem',
                      color: loadingUpAudio ? '#6366f1' : (!permsLoaded || userPermissions?.up_audio === false ? '#ef4444' : '#64748b')
                    }}>
                      {loadingUpAudio ? 'Alterando...' : (!permsLoaded || userPermissions?.up_audio === false ? 'Sem permissão' : (agent.upAudio ? 'Permitido' : 'Bloqueado'))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Envio de SMS */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Envio de SMS
                </label>
                <button
                  type="button"
                  disabled={loadingSmsEnvio || !permsLoaded || userPermissions?.sms_send === false}
                  style={{
                  padding: '0.75rem',
                  background: !permsLoaded
                    ? 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))'
                    : (userPermissions?.sms_send === false
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(220, 38, 38, 0.05))'
                      : (agent.smsEnvio 
                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))'
                        : 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(75, 85, 99, 0.05))')
                      ),
                  border: !permsLoaded
                    ? '1px solid rgba(107, 114, 128, 0.2)'
                    : (userPermissions?.sms_send === false
                      ? '1px solid rgba(239, 68, 68, 0.2)'
                      : (agent.smsEnvio 
                        ? '1px solid rgba(34, 197, 94, 0.2)'
                        : '1px solid rgba(107, 114, 128, 0.2)')
                      ),
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  textAlign: 'left',
                  cursor: (loadingSmsEnvio || !permsLoaded || userPermissions?.sms_send === false) ? 'not-allowed' : 'pointer',
                  opacity: (loadingSmsEnvio || !permsLoaded || userPermissions?.sms_send === false) ? 0.6 : 1
                }}
                onClick={!(loadingSmsEnvio || !permsLoaded || userPermissions?.sms_send === false) ? toggleSmsEnvio : undefined}
                >
                  <div style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: agent.smsEnvio ? '#22c55e' : '#6b7280'
                  }} />
                  <span style={{
                    fontWeight: '600',
                    color: agent.smsEnvio ? '#16a34a' : '#6b7280'
                  }}>
                    {agent.smsEnvio ? 'Ativado' : 'Desativado'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loadingSmsEnvio ? (
                      <div style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        border: '2px solid rgba(99, 102, 241, 0.2)',
                        borderTop: '2px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                    ) : agent.smsEnvio ? (
                      <ToggleRight style={{ width: '1.25rem', height: '1.25rem', color: '#22c55e' }} />
                    ) : (
                      <ToggleLeft style={{ width: '1.25rem', height: '1.25rem', color: '#6b7280' }} />
                    )}
                    <span style={{
                      fontSize: '0.75rem',
                      color: loadingSmsEnvio ? '#6366f1' : (!permsLoaded ? '#64748b' : (userPermissions?.sms_send === false ? '#ef4444' : '#64748b'))
                    }}>
                      {loadingSmsEnvio ? 'Alterando...' : (!permsLoaded ? 'Verificando...' : (userPermissions?.sms_send === false ? 'Sem permissão' : (agent.smsEnvio ? 'Permitido' : 'Bloqueado')))}
                    </span>
                  </div>
                </button>
              </div>

            </div>
          </div>

          {/* Card Detalhes & Estatísticas */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 1.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <Settings style={{ width: '1.25rem', height: '1.25rem', color: '#8b5cf6' }} />
              Detalhes & Estatísticas
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Data de Cadastro */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Data de Cadastro
                </label>
                <div style={{
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))',
                  border: '1px solid rgba(34, 197, 94, 0.1)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Clock style={{ width: '1rem', height: '1rem', color: '#22c55e' }} />
                  <span>{agent.createdAt.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    {Math.floor((Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24))} dias atrás
                  </span>
                </div>
              </div>

              {/* Última Atualização */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Última Atualização
                </label>
                <div style={{
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
                  border: '1px solid rgba(99, 102, 241, 0.1)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <RefreshCw style={{ width: '1rem', height: '1rem', color: '#6366f1' }} />
                  <span>{agent.lastActivity.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              </div>

              {/* Estatísticas de Chamadas */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem'
              }}>
                <div>
                  <label style={{
                    fontSize: '0.875rem',
                    color: '#374151',
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Chamadas Hoje
                  </label>
                  <div style={{
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(245, 158, 11, 0.05))',
                    border: '1px solid rgba(251, 191, 36, 0.1)',
                    borderRadius: '0.5rem',
                    fontSize: '1.5rem',
                    color: '#1e293b',
                    fontWeight: '700',
                    textAlign: 'center'
                  }}>
                    {todayTotal.toLocaleString()}
                  </div>
                </div>
                <div>
                  <label style={{
                    fontSize: '0.875rem',
                    color: '#374151',
                    fontWeight: '600',
                    display: 'block',
                    marginBottom: '0.5rem'
                  }}>
                    Total Atendidas
                  </label>
                  <div style={{
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(34, 197, 94, 0.1)',
                    borderRadius: '0.5rem',
                    fontSize: '1.5rem',
                    color: '#1e293b',
                    fontWeight: '700',
                    textAlign: 'center'
                  }}>
                    {todayAnswered.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Duração Média - CDR real */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Duração Média das Chamadas
                </label>
                <div style={{
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.05))',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  borderRadius: '0.5rem',
                  fontSize: '1.25rem',
                  color: '#1e293b',
                  fontWeight: '700',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  <Clock style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
                  {Math.floor(avgDurationSec / 60)}:{String(avgDurationSec % 60).padStart(2, '0')}
                  {statsLoading && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '500' }}>(atualizando...)</span>
                  )}
                </div>
              </div>

              {/* Performance do Dia - CDR real */}
              <div>
                <label style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  fontWeight: '600',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Performance do Dia
                </label>
                <div style={{
                  padding: '1rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(34, 197, 94, 0.05))',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: '#16a34a'
                    }}>
                      {todayAnswered}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#16a34a',
                      fontWeight: '500'
                    }}>
                      Chamadas
                    </div>
                  </div>
                  <div style={{
                    width: '1px',
                    height: '2rem',
                    background: 'rgba(16, 185, 129, 0.25)'
                  }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: '#22c55e'
                    }}>
                      {Math.floor(avgDurationSec / 60)}:{String(avgDurationSec % 60).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#22c55e',
                      fontWeight: '500'
                    }}>
                      Média
                    </div>
                  </div>
                  <div style={{
                    width: '1px',
                    height: '2rem',
                    background: 'rgba(16, 185, 129, 0.25)'
                  }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: (todayTotal > 0 ? '#059669' : '#6b7280')
                    }}>
                      {todayTotal > 0 ? `${Math.round((todayAnswered / Math.max(todayTotal, 1)) * 100)}%` : '0%'}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#10b981',
                      fontWeight: '500'
                    }}>
                      Sucesso (Hoje)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
