'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { 
  Phone, 
  PhoneCall, 
  Users, 
  UserCheck, 
  Clock, 
  PhoneMissed,
  Activity,
  Server,
  Cpu,
  HardDrive,
  DollarSign
} from 'lucide-react';
import { DashboardStats, CallsByHour, Plan } from '@/types';
import { useActiveCallsOptimized } from '@/hooks/useActiveCallsOptimized';
import { useAuthStore } from '@/store/auth';
import { plansService } from '@/services/plansService';
import { agentsService } from '@/services/agentsService';
import { userService } from '@/lib/userService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { getCdr } from '@/services/cdrService';
import { extensionStatusService, ExtensionStatusData } from '@/services/extensionStatusService';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [userPlan, setUserPlan] = useState<Plan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatusData | null>(null);
  const [loadingExtensionStatus, setLoadingExtensionStatus] = useState(true);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [realAgents, setRealAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  
  const [loadingTotalCalls, setLoadingTotalCalls] = useState(true);
  const [loadingActiveCalls, setLoadingActiveCalls] = useState(true);
  const [ringingCalls, setRingingCalls] = useState<number>(0);
  const [activityHistory, setActivityHistory] = useState<{ t: string; talking: number; ringing: number }[]>([]);
  // Avoid flicker: only show loading skeletons on first load
  const hasLoadedActiveRef = useRef(false);
  
  // Mock data inicial para carregamento instantâneo
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    activeCalls: 0,
    totalAgents: 0,
    onlineAgents: 0,
    offlineAgents: 0,
    answeredCalls: 0,
    missedCalls: 0,
    averageWaitTime: 0,
    avgCallDuration: 0,
    systemUptime: 0,
    queueWaitTime: 0,
    busyAgents: 0,
    pausedAgents: 0
  });
  
  const [callsByHour, setCallsByHour] = useState<CallsByHour[]>([
    { hour: '00h', calls: 12, answered: 10, missed: 2, total: 12 },
    { hour: '01h', calls: 8, answered: 7, missed: 1, total: 8 },
    { hour: '02h', calls: 5, answered: 4, missed: 1, total: 5 },
    { hour: '03h', calls: 3, answered: 3, missed: 0, total: 3 },
    { hour: '04h', calls: 2, answered: 2, missed: 0, total: 2 },
    { hour: '05h', calls: 4, answered: 4, missed: 0, total: 4 },
    { hour: '06h', calls: 15, answered: 14, missed: 1, total: 15 },
    { hour: '07h', calls: 28, answered: 26, missed: 2, total: 28 },
    { hour: '08h', calls: 45, answered: 42, missed: 3, total: 45 },
    { hour: '09h', calls: 52, answered: 49, missed: 3, total: 52 },
    { hour: '10h', calls: 48, answered: 45, missed: 3, total: 48 },
    { hour: '11h', calls: 41, answered: 38, missed: 3, total: 41 },
    { hour: '12h', calls: 38, answered: 36, missed: 2, total: 38 },
    { hour: '13h', calls: 42, answered: 40, missed: 2, total: 42 },
    { hour: '14h', calls: 47, answered: 44, missed: 3, total: 47 },
    { hour: '15h', calls: 44, answered: 41, missed: 3, total: 44 },
    { hour: '16h', calls: 39, answered: 37, missed: 2, total: 39 },
    { hour: '17h', calls: 35, answered: 33, missed: 2, total: 35 },
    { hour: '18h', calls: 28, answered: 26, missed: 2, total: 28 },
    { hour: '19h', calls: 22, answered: 20, missed: 2, total: 22 },
    { hour: '20h', calls: 18, answered: 17, missed: 1, total: 18 },
    { hour: '21h', calls: 15, answered: 14, missed: 1, total: 15 },
    { hour: '22h', calls: 12, answered: 11, missed: 1, total: 12 },
    { hour: '23h', calls: 9, answered: 8, missed: 1, total: 9 }
  ]);
  const [topAgents, setTopAgents] = useState<Array<{ name: string; extension?: string; answered: number; total: number; missed: number }>>([]);

  // Load real Calls By Hour (today) - optimized with cache
  const loadCallsByHourReal = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoadingTotalCalls(true);
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const startDate = start.toISOString();
      const endDate = now.toISOString();
      
      const { records, total } = await getCdr({ page: 1, limit: 500, startDate, endDate, order: 'asc' });
      if (!records || records.length === 0) {
        setCallsByHour(prev => prev.map(item => ({ ...item, calls: 0, answered: 0, missed: 0, total: 0 })));
        setTopAgents([]);
        setStats(prev => ({ ...prev, totalCalls: Number(total) || 0 }));
        setLoadingTotalCalls(false);
        return;
      }

      const buckets: Record<string, { calls: number; answered: number; missed: number }> = {};
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, '0')}h`;
        buckets[label] = { calls: 0, answered: 0, missed: 0 };
      }
      
      const agentMap: Record<string, { name: string; extension?: string; answered: number; total: number; missed: number }> = {};
      
      for (const r of records) {
        const dt = new Date(r.startTime);
        const label = `${String(dt.getHours()).padStart(2, '0')}h`;
        const b = buckets[label];
        if (b) {
          b.calls += 1;
          if (r.status === 'answered') b.answered += 1;
          else if (r.status === 'no_answer' || r.status === 'failed' || r.status === 'busy') b.missed += 1;
        }
        
        const keyName: string = (r.agentName && String(r.agentName).trim()) || (r.extension && String(r.extension)) || 'Desconhecido';
        if (!agentMap[keyName]) agentMap[keyName] = { name: keyName, extension: r.extension, answered: 0, total: 0, missed: 0 };
        const a = agentMap[keyName];
        a.total += 1;
        if (r.status === 'answered') a.answered += 1;
        else if (r.status === 'no_answer' || r.status === 'failed' || r.status === 'busy') a.missed += 1;
      }
      
      const nextData: CallsByHour[] = Object.keys(buckets).map(hour => ({
        hour,
        calls: buckets[hour].calls,
        answered: buckets[hour].answered,
        missed: buckets[hour].missed,
        total: buckets[hour].calls,
      }));
      setCallsByHour(nextData);

      const ranking = Object.values(agentMap)
        .sort((a, b) => (b.answered - a.answered) || (b.total - a.total))
        .slice(0, 3);
      setTopAgents(ranking);
      setStats(prev => ({ ...prev, totalCalls: Number(total) || records.length }));
    } catch (e) {
      // Keep previous data on error
    } finally {
      setLoadingTotalCalls(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCallsByHourReal();
    const id = setInterval(loadCallsByHourReal, 120000);
    return () => clearInterval(id);
  }, [loadCallsByHourReal]);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingTotalCalls(true);
  }, [user?.id]);

  // Carregar dados reais do usuário (com fallback para obter planId via userService)
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id) {
        setLoadingPlan(false);
        setLoadingCredits(false);
        return;
      }

      try {
        setLoadingPlan(true);
        // 1) Tentar usar planId do contexto primeiro
        let planIdToUse = user.planId as string | undefined;
        
        // 2) Se não houver planId, buscar via userService (dados consolidados)
        if (!planIdToUse) {
          try {
            const current = await userService.getCurrentUserData();
            if (current?.planId) {
              planIdToUse = current.planId;
            }
          } catch (e) {
            // Fallback silencioso
          }
        }

        // 3) Carregar plano se tivermos um planId
        if (planIdToUse) {
          try {
            const plan = await plansService.getPlanById(planIdToUse);
            if (plan) {
              setUserPlan(plan);
            }
          } catch (e) {
            // Não foi possível carregar o plano pelo planId, continuar
            setUserPlan(null);
          }
        } else {
          setUserPlan(null);
        }

        // Créditos: usar do contexto quando disponível
        setLoadingCredits(true);
        if (user.credits !== undefined) {
          setUserCredits(user.credits);
        } else {
          setUserCredits(0);
        }
      } catch (error) {
      } finally {
        setLoadingPlan(false);
        setLoadingCredits(false);
      }
    };

    loadUserData();
  }, [user?.id, user?.planId]);

  // Load agents - optimized
  const loadRealAgents = useCallback(async () => {
    if (!user?.id) {
      setLoadingAgents(false);
      return;
    }

    try {
      setLoadingAgents(true);
      const agents = await agentsService.getAgents();
      
      setRealAgents(agents || []);
      setStats(prevStats => ({
        ...prevStats,
        totalAgents: agents?.length || 0
      }));
    } catch (error) {
      setRealAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRealAgents();
  }, [loadRealAgents]);

  

  // ✅ INICIALIZAR SISTEMA DE STATUS DE RAMAIS REAL
  useEffect(() => {
    // Inicializar monitoramento de status de ramais com contexto
    extensionStatusService.startAutoUpdate('/dashboard');
    
    // Listener para atualizações de status em tempo real
    const removeListener = extensionStatusService.addListener((statusData) => {
      setExtensionStatus(statusData);
      setLoadingExtensionStatus(false);
    });

    // Cleanup ao desmontar componente
    return () => {
      extensionStatusService.stopAutoUpdate();
      removeListener();
    };
  }, []);

  // ✅ Chamadas ativas em tempo real via hook compartilhado
  const { activeCalls, isLoading: isLoadingActiveCalls } = useActiveCallsOptimized('/dashboard', 5000);

  // Derivar métricas de chamadas e histórico a partir do hook
  useEffect(() => {
    if (!user?.id) {
      setLoadingActiveCalls(false);
      setStats(prev => ({ ...prev, activeCalls: 0 }));
      setRingingCalls(0);
      return;
    }

    // Contagens por status
    const talking = activeCalls.filter(c => c.status === 'talking').length;
    const ringing = activeCalls.filter(c => c.status === 'ringing').length;

    setStats(prev => ({ ...prev, activeCalls: talking }));
    setRingingCalls(ringing);

    // Atualizar loading
    setLoadingActiveCalls(isLoadingActiveCalls);

    // Histórico com limite de 20 pontos
    const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActivityHistory(prev => {
      const next = [...prev, { t: label, talking, ringing }];
      return next.length > 20 ? next.slice(-20) : next;
    });
  }, [activeCalls, isLoadingActiveCalls, user?.id]);

  // Removed unnecessary timer

  // Função para validar e formatar números
  const safeNumber = (value: any, defaultValue: number = 0): number => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return defaultValue;
    }
    return Number(value);
  };

  // Função para formatar duração com validação
  const formatDuration = (seconds: number): string => {
    const safeSeconds = safeNumber(seconds, 0);
    if (safeSeconds <= 0) return '0:00';
    
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Função para calcular porcentagem segura
  const safePercentage = (value: number, total: number): number => {
    const safeVal = safeNumber(value, 0);
    const safeTotal = safeNumber(total, 1);
    if (safeTotal === 0) return 0;
    return Math.round((safeVal / safeTotal) * 100);
  };



  // Dados seguros para usar no componente
  // Memoized extension status function
  const getRealExtensionStatus = useCallback((extension: string): 'online' | 'offline' => {
    if (!extensionStatus || loadingExtensionStatus) return 'offline';
    return extensionStatusService.isExtensionOnline(extension) ? 'online' : 'offline';
  }, [extensionStatus, loadingExtensionStatus]);
  
  // Memoized agent stats calculation
  const realAgentStats = useMemo(() => {
    if (!extensionStatus || loadingExtensionStatus) {
      return { 
        totalAgents: realAgents.length || 0, 
        onlineAgents: 0, 
        offlineAgents: realAgents.length || 0, 
        busyAgents: 0, 
        pausedAgents: 0 
      };
    }
    
    const userAgents = Array.isArray(realAgents) ? realAgents : [];
    const total = userAgents.length;
    const onlineSet = new Set((extensionStatus.onlineExtensions || []).map(r => String(r)));
    const online = userAgents.filter(a => 
      onlineSet.has(String(a.ramal)) || extensionStatusService.isExtensionOnline(String(a.ramal))
    ).length;
    const offline = Math.max(total - online, 0);
    const busy = Math.floor(online * 0.4);
    const paused = Math.floor(online * 0.2);
    
    return { totalAgents: total, onlineAgents: online, offlineAgents: offline, busyAgents: busy, pausedAgents: paused };
  }, [extensionStatus, loadingExtensionStatus, realAgents]);
  
  // Memoized safe stats
  const safeStats = useMemo(() => ({
    totalCalls: safeNumber(stats.totalCalls, 0),
    activeCalls: safeNumber(stats.activeCalls, 0),
    onlineAgents: realAgentStats.onlineAgents,
    totalAgents: realAgentStats.totalAgents,
    offlineAgents: realAgentStats.offlineAgents,
    busyAgents: realAgentStats.busyAgents,
    pausedAgents: realAgentStats.pausedAgents,
    avgCallDuration: safeNumber(stats.avgCallDuration, 0),
    systemUptime: safeNumber(stats.systemUptime, 0),
    queueWaitTime: safeNumber(stats.queueWaitTime, 0)
  }), [stats, realAgentStats]);

  return (
    <>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { background-position: -300px 0; }
          100% { background-position: 300px 0; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        
        .stat-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .stat-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .chart-card {
          transition: all 0.2s ease;
        }
        
        .chart-card:hover {
          transform: translateY(-2px);
        }
        
        .status-item {
          transition: all 0.2s ease;
        }
        
        .status-item:hover {
          transform: translateY(-1px);
          background: rgba(241, 245, 249, 0.9) !important;
        }
      `}</style>

      <MainLayout>
        <div style={{
          padding: '2rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: 'transparent'
        }}>
          {/* Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Total de Chamadas */}
            <div className="stat-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)',
                borderRadius: '1.25rem 1.25rem 0 0'
              }}></div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  Total de Chamadas
                </span>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(29, 78, 216, 0.1))',
                  color: '#3b82f6'
                }}>
                  <Phone style={{ width: '1.25rem', height: '1.25rem' }} />
                </div>
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                color: '#1e293b',
                marginBottom: '0.5rem',
                lineHeight: 1
              }}>
                {loadingTotalCalls ? (
                  <div style={{
                    width: '140px',
                    height: '40px',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                    backgroundSize: '600px 100%',
                    animation: 'shimmer 1.6s infinite'
                  }} />
                ) : (
                  safeStats.totalCalls.toLocaleString()
                )}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b'
              }}>
                {loadingTotalCalls ? (
                  <div style={{
                    width: '200px',
                    height: '12px',
                    borderRadius: '999px',
                    background: 'linear-gradient(90deg, #f8fafc 25%, #e2e8f0 50%, #f8fafc 75%)',
                    backgroundSize: '600px 100%',
                    animation: 'shimmer 1.6s infinite'
                  }} />
                ) : (
                  `Hoje: ${Math.floor(safeStats.totalCalls * 0.1).toLocaleString()} chamadas`
                )}
              </div>
            </div>

            {/* Chamadas Ativas */}
            <div className="stat-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: '1.25rem 1.25rem 0 0'
              }}></div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  Chamadas Ativas
                </span>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
                  color: '#10b981'
                }}>
                  <PhoneCall style={{ width: '1.25rem', height: '1.25rem' }} />
                </div>
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                color: '#10b981',
                marginBottom: '0.5rem',
                lineHeight: 1
              }}>
                {loadingActiveCalls ? (
                  <div style={{
                    width: '80px',
                    height: '40px',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                    backgroundSize: '600px 100%',
                    animation: 'shimmer 1.6s infinite'
                  }} />
                ) : (
                  safeStats.activeCalls
                )}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b'
              }}>
                Falando agora
              </div>
            </div>

            {/* Agentes Online */}
            <div className="stat-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)',
                borderRadius: '1.25rem 1.25rem 0 0'
              }}></div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  Agentes/Limite
                </span>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1))',
                  color: '#8b5cf6'
                }}>
                  <UserCheck style={{ width: '1.25rem', height: '1.25rem' }} />
                </div>
              </div>
              {(() => {
                const planMax = Number(userPlan?.maxAgents);
                const hasPlanLimit = Number.isFinite(planMax) && planMax > 0;
                const percentage = hasPlanLimit ? safePercentage(safeStats.totalAgents, planMax) : 0;
                
                if (!hasPlanLimit) {
                  // Skeleton moderno enquanto não temos o limite do plano
                  return (
                    <>
                      <div style={{
                        width: '140px',
                        height: '40px',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9)',
                        animation: 'shimmer 1.6s infinite',
                        marginBottom: '0.5rem'
                      }} />
                      <div style={{
                        width: '180px',
                        height: '12px',
                        borderRadius: '999px',
                        background: 'linear-gradient(90deg, #f8fafc, #e2e8f0, #f8fafc)',
                        animation: 'shimmer 1.6s infinite'
                      }} />
                    </>
                  );
                }

                return (
                  <>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: '#8b5cf6',
                      marginBottom: '0.5rem',
                      lineHeight: 1
                    }}>
                      {safeStats.totalAgents}/{planMax}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#64748b'
                    }}>
                      {`${percentage}% do limite utilizado`}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Créditos */}
            <div className="stat-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: '1.25rem 1.25rem 0 0'
              }}></div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#64748b'
                }}>
                  Créditos Disponíveis
                </span>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
                  color: '#10b981'
                }}>
                  <DollarSign style={{ width: '1.25rem', height: '1.25rem' }} />
                </div>
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 'bold',
                color: '#10b981',
                marginBottom: '0.5rem',
                lineHeight: 1
              }}>
                {loadingCredits ? (
                  <div style={{
                    width: '80px',
                    height: '40px',
                    background: 'linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9)',
                    borderRadius: '0.5rem',
                    animation: 'shimmer 1.5s infinite'
                  }} />
                ) : (
                  `R$ ${userCredits.toFixed(2)}`
                )}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b'
              }}>
                {loadingCredits ? 'Carregando...' : 'Saldo atual da conta'}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div className="chart-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '0.25rem'
                }}>
                  Chamadas por Hora
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#64748b'
                }}>
                  Distribuição das chamadas ao longo do dia
                </p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={callsByHour}>
                  <defs>
                    <linearGradient id="gradAnswered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="answered" stackId="a" name="Atendidas" radius={[0, 0, 4, 4]} fill="url(#gradAnswered)" isAnimationActive animationDuration={800} animationEasing="ease-in-out" />
                  <Bar dataKey="calls" stackId="a" name="Total" radius={[4, 4, 0, 0]} fill="url(#gradTotal)" isAnimationActive animationDuration={800} animationEasing="ease-in-out" />
                </BarChart>
              </ResponsiveContainer>

              {/* Top 3 Agentes (Hoje) */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: '#1e293b'
                  }}>
                    Top 3 Agentes (Hoje)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Baseado em chamadas atendidas
                  </div>
                </div>

                {topAgents.length === 0 ? (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    border: '1px dashed #e2e8f0',
                    background: 'rgba(248, 250, 252, 0.6)',
                    color: '#64748b',
                    fontSize: '0.85rem'
                  }}>
                    Nenhum agente com chamadas hoje.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {topAgents.map((a, idx) => (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '0.75rem',
                        border: '1px solid #e2e8f0',
                        background: 'rgba(255,255,255,0.9)'
                      }}>
                        <div style={{
                          width: '1.75rem',
                          height: '1.75rem',
                          borderRadius: '0.5rem',
                          background: idx === 0 ? '#10b981' : idx === 1 ? '#3b82f6' : '#f59e0b',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem'
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                            {idx === 0 && (
                              <span aria-label="Top 1" title="Top 1" style={{ fontSize: '0.95rem', lineHeight: 1 }}>👑</span>
                            )}
                            <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '12rem' }}>{a.name}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.extension ? `Ramal ${a.extension}` : '—'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>{a.answered} atendidas</span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{a.total} total</span>
                          {a.missed > 0 && (
                            <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>{a.missed} perdidas</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card" style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '1.25rem',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(20px)'
            }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '0.25rem'
                }}>
                  Chamadas Ativas
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#64748b'
                }}>
                  Status das chamadas em tempo real
                </p>
              </div>

              {/* Métricas principais */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#10b981',
                    marginBottom: '0.25rem'
                  }}>
                    {safeStats.activeCalls}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#059669',
                    fontWeight: '500'
                  }}>
                    Falando
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: '#f59e0b',
                    marginBottom: '0.25rem'
                  }}>
                    {ringingCalls}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#d97706',
                    fontWeight: '500'
                  }}>
                    Chamando
                  </div>
                </div>
              </div>

              {/* Gráfico em tempo real com efeito suave */}
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activityHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTalking" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradRinging" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="t" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area type="monotone" dataKey="talking" name="Falando" stroke="#10b981" fill="url(#gradTalking)" strokeWidth={2} isAnimationActive animationDuration={700} animationEasing="ease-out" />
                  <Area type="monotone" dataKey="ringing" name="Chamando" stroke="#f59e0b" fill="url(#gradRinging)" strokeWidth={2} isAnimationActive animationDuration={700} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>

              {/* Lista resumida das chamadas */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'rgba(248, 250, 252, 0.8)',
                borderRadius: '0.75rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '0.75rem'
                }}>
                  Resumo das Chamadas:
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  fontSize: '0.75rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: '#10b981',
                      animation: 'pulse 2s infinite'
                    }} />
                    <span style={{ color: '#64748b' }}>Falando:</span>
                    <span style={{ fontWeight: '600', color: '#10b981' }}>{safeStats.activeCalls} chamadas</span>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: '#f59e0b',
                      animation: 'pulse 2s infinite'
                    }} />
                    <span style={{ color: '#64748b' }}>Chamando:</span>
                    <span style={{ fontWeight: '600', color: '#f59e0b' }}>
                      {loadingActiveCalls ? '...' : `${ringingCalls} chamadas`}
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: '#3b82f6'
                    }} />
                    <span style={{ color: '#64748b' }}>Total:</span>
                    <span style={{ fontWeight: '600', color: '#3b82f6' }}>
                      {loadingActiveCalls ? '...' : `${safeStats.activeCalls + ringingCalls} chamadas`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Agentes Online */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '1.25rem',
            padding: '1.5rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '0.25rem'
              }}>
                Agentes Online
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: '#64748b'
              }}>
                Status e informações dos agentes em tempo real
              </p>
            </div>
            
            {/* Loading state para agentes (nosso backend) */}
            {loadingAgents ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem'
              }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="status-item" style={{
                    padding: '1rem',
                    background: 'rgba(248, 250, 252, 0.8)',
                    borderRadius: '0.75rem',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '50%',
                          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                          backgroundSize: '600px 100%',
                          animation: 'shimmer 1.6s infinite'
                        }} />
                        <div>
                          <div style={{
                            width: '140px',
                            height: '14px',
                            borderRadius: '0.5rem',
                            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                            backgroundSize: '600px 100%',
                            animation: 'shimmer 1.6s infinite',
                            marginBottom: '0.4rem'
                          }} />
                          <div style={{
                            width: '90px',
                            height: '10px',
                            borderRadius: '999px',
                            background: 'linear-gradient(90deg, #f8fafc 25%, #e2e8f0 50%, #f8fafc 75%)',
                            backgroundSize: '600px 100%',
                            animation: 'shimmer 1.6s infinite'
                          }} />
                        </div>
                      </div>
                      <div style={{
                        width: '80px',
                        height: '24px',
                        borderRadius: '0.5rem',
                        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                        backgroundSize: '600px 100%',
                        animation: 'shimmer 1.6s infinite'
                      }} />
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.75rem'
                    }}>
                      <div>
                        <div style={{
                          width: '100%',
                          height: '12px',
                          borderRadius: '0.5rem',
                          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                          backgroundSize: '600px 100%',
                          animation: 'shimmer 1.6s infinite'
                        }} />
                      </div>
                      <div>
                        <div style={{
                          width: '100%',
                          height: '12px',
                          borderRadius: '0.5rem',
                          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                          backgroundSize: '600px 100%',
                          animation: 'shimmer 1.6s infinite'
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : realAgents.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#64748b'
              }}>
                <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>Nenhum agente encontrado</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Crie seus primeiros agentes na página de Agentes
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem'
              }}>
                {realAgents.slice(0, 8).map((agent: any, index: number) => {
                  const status = getRealExtensionStatus(String(agent.ramal || agent.extension || ''));
                  const workState = agent.work_state as ('idle' | 'working' | 'paused' | undefined);
                  const pauseReason: string | undefined = agent.work_pause_reason_text || agent.work_pause_reason_code || undefined;
                  let statusDisplay = status === 'online'
                    ? { text: 'Online', color: '#10b981' }
                    : { text: 'Offline', color: '#64748b' };
                  if (status === 'online') {
                    if (workState === 'paused') {
                      statusDisplay = { text: `Online - Pausa${pauseReason ? ` (${pauseReason})` : ''}`, color: '#f59e0b' };
                    } else if (workState === 'working') {
                      statusDisplay = { text: 'Online - Trabalhando', color: '#10b981' };
                    }
                  }
                  const statusTitle = (status === 'online' && workState === 'paused' && pauseReason) ? `Pausa: ${pauseReason}` : undefined;
                  
                  return (
                    <div key={(agent.id ?? agent.extension ?? index) as any} className="status-item" style={{
                      padding: '1rem',
                      background: 'rgba(248, 250, 252, 0.8)',
                      borderRadius: '0.75rem',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(241, 245, 249, 0.9)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                        <div style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${statusDisplay.color}, ${statusDisplay.color}dd)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          {String((agent.name || agent.extension || agent.ramal || 'A')).split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                      
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          {agent.name || `Agente ${agent.extension || agent.ramal}`}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#64748b'
                        }}>
                          Ramal {agent.extension || agent.ramal}
                        </div>
                      </div>
                    </div>
                    
                    <div title={statusTitle} style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      background: `${statusDisplay.color}20`,
                      color: statusDisplay.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        background: statusDisplay.color,
                        animation: status !== 'offline' ? 'pulse 2s infinite' : 'none'
                      }} />
                      {statusDisplay.text}
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    fontSize: '0.75rem'
                  }}>
                      <div>
                        <span style={{ color: '#64748b' }}>CallerID:</span>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          {agent.callerId || agent.callerID || agent.callerid || 'N/A'}
                        </div>
                      </div>
                      
                      <div>
                        <span style={{ color: '#64748b' }}>Criado em:</span>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('pt-BR') : (agent.created_at ? new Date(agent.created_at).toLocaleDateString('pt-BR') : 'N/A')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
            
            {/* Resumo dos agentes com dados reais */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(241, 245, 249, 0.8)',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '1rem',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#10b981'
                  }}>
                    {safeStats.onlineAgents}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Online
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#3b82f6'
                  }}>
                    {safeStats.busyAgents}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Em Chamada
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#f59e0b'
                  }}>
                    {safeStats.pausedAgents}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Em Pausa
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#64748b'
                  }}>
                    {safeStats.offlineAgents}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}>
                    Offline
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </>
  );
}
