'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, 
  Phone, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User,
  Activity,
  Music,
  Loader2
} from 'lucide-react';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';
import { useToast } from '@/components/ui/toast';
import { AnimatedBackground } from './animated-background';
import { unifiedAuthService } from '@/lib/unifiedAuth';
import { workSessionsService } from '@/services/workSessionsService';
import { AgentWebRTCProvider, useAgentWebRTC } from '@/contexts/AgentWebRTCContext';

interface AgentLayoutProps {
  children: React.ReactNode;
}

function AgentLayoutInner({ children }: AgentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { success, error } = useToast();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutActionLoading, setLogoutActionLoading] = useState(false);
  const [logoutContext, setLogoutContext] = useState<{ hasSession: boolean; hasBreak: boolean } | null>(null);
  const [logoutChecking, setLogoutChecking] = useState(false);
  
  // WebRTC context
  const webrtc = useAgentWebRTC();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!agentAuthService.isAuthenticated()) {
          window.location.href = '/login';
          return;
        }

        // Get stored data immediately to prevent flickering
        const storedData = agentAuthService.getStoredAgentData();
        if (storedData) {
          setAgentData(storedData);
        }

        // Try to get fresh data in background
        const result = await agentAuthService.getCurrentAgent();
        if (result.success && result.data) {
          setAgentData(result.data);
        }
      } catch (err) {
        console.error('[AGENT LAYOUT] Auth check error:', err);
        window.location.href = '/login';
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    let intervalId: number | null = null;

    const runCheck = async () => {
      try {
        await unifiedAuthService.checkAndHandleExpiry();
      } catch (e) {
        console.error('[AGENT LAYOUT] Session expiry check failed:', e);
      }
    };

    // Initial check on mount
    runCheck();
    // Periodic check every 60 seconds
    intervalId = window.setInterval(runCheck, 60000);

    // Check when tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const performLogout = async () => {
    try {
      // Disconnect WebRTC before logout
      if (webrtc.webrtcConnected) {
        console.log('🔌 Desconectando WebRTC no logout...');
        webrtc.disconnectWebRTC();
      }
      
      await agentAuthService.logout();
      success('Logout realizado com sucesso!');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  const handleLogout = async () => {
    if (logoutConfirmOpen || logoutChecking || logoutActionLoading) {
      return;
    }
    // Abre o modal imediatamente para evitar sensação de lentidão
    setLogoutConfirmOpen(true);
    setLogoutChecking(true);
    setLogoutContext(null);

    try {
      const active = await workSessionsService.getActive();
      const hasSession = !!active?.data?.session;
      const hasBreak = !!active?.data?.break;
      if (active?.success) {
        setLogoutContext({ hasSession, hasBreak });
      } else {
        setLogoutContext({ hasSession: false, hasBreak: false });
      }
    } catch (err) {
      // fallback genérico: prosseguiremos com mensagem neutra
      setLogoutContext({ hasSession: false, hasBreak: false });
    } finally {
      setLogoutChecking(false);
    }
  };

  const handleConfirmLogoutAndStop = async () => {
    try {
      setLogoutActionLoading(true);
      try {
        await workSessionsService.stop();
      } catch (e) {
        // Mesmo se falhar, seguimos para logout para não travar o usuário
      }
      await performLogout();
    } finally {
      setLogoutActionLoading(false);
      setLogoutConfirmOpen(false);
    }
  };

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/agent/dashboard',
      icon: BarChart3,
      description: 'Visão geral das suas atividades'
    },
    {
      name: 'CDR',
      href: '/agent/cdr',
      icon: Phone,
      description: 'Histórico de chamadas'
    },
    {
      name: 'Áudios',
      href: '/agent/audios',
      icon: Music,
      description: 'Gerenciar arquivos de áudio'
    },
    {
      name: 'Configurações',
      href: '/agent/settings',
      icon: Settings,
      description: 'Configurações do ramal'
    }
  ];

  // Show layout immediately with fallback data to prevent flickering
  const displayData = agentData || {
    agente_name: 'Agente',
    ramal: '----',
    status_sip: 'offline'
  };

  return (
    <>
    <AnimatedBackground>
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarOpen ? '280px' : '80px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRight: '1px solid rgba(226, 232, 240, 0.5)',
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            {sidebarOpen && (
              <div>
                <h2 style={{ 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  color: '#1e293b',
                  margin: 0
                }}>
                  Área do Agente
                </h2>
                <p style={{ 
                  fontSize: '12px', 
                  color: '#64748b',
                  margin: 0
                }}>
                Ramal {displayData.ramal} • 
                  <span style={{ 
                     color: webrtc.webrtcRegistered ? '#10b981' : webrtc.webrtcConnecting ? '#f59e0b' : '#ef4444',
                     fontWeight: '600'
                   }}>
                     {webrtc.webrtcRegistered ? 'Online' : webrtc.webrtcConnecting ? 'Conectando...' : 'Offline'}
                   </span>
                 </p>
              </div>
            )}
          </div>

          {/* Agent Info */}
          <div style={{
            padding: sidebarOpen ? '20px' : '12px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                {displayData?.agente_name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              
              {sidebarOpen && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {displayData?.agente_name || 'Agente'}
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#64748b',
                    margin: 0
                  }}>
                    Ramal {displayData?.ramal || '----'}
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '4px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: displayData?.status_sip === 'online' ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#64748b',
                      textTransform: 'capitalize'
                    }}>
                      {displayData?.status_sip || 'offline'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: sidebarOpen ? '20px' : '12px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                
                return (
                  <li key={item.name} style={{ marginBottom: '8px' }}>
                    <Link
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: sidebarOpen ? '12px 16px' : '12px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: isActive ? '#667eea' : '#64748b',
                        background: isActive ? '#f1f5f9' : 'transparent',
                        transition: 'all 0.2s ease',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center'
                      }}
                      onMouseOver={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.color = '#1e293b';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#64748b';
                        }
                      }}
                      onClick={() => {
                        // Close sidebar on mobile after navigation
                        if (window.innerWidth < 768) {
                          setSidebarOpen(false);
                        }
                      }}
                    >
                      <item.icon size={20} />
                      {sidebarOpen && (
                        <div>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '500',
                            marginBottom: '2px'
                          }}>
                            {item.name}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            opacity: 0.7
                          }}>
                            {item.description}
                          </div>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout */}
          <div style={{ 
            padding: sidebarOpen ? '20px' : '12px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              onClick={handleLogout}
              disabled={logoutConfirmOpen || logoutChecking || logoutActionLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarOpen ? '12px 16px' : '12px',
                borderRadius: '8px',
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: (logoutConfirmOpen || logoutChecking || logoutActionLoading) ? 'not-allowed' : 'pointer',
                width: '100%',
                transition: 'background 0.2s ease',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                opacity: (logoutConfirmOpen || logoutChecking || logoutActionLoading) ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (!(logoutConfirmOpen || logoutChecking || logoutActionLoading)) {
                  e.currentTarget.style.background = '#fef2f2';
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'none';
              }}
            >
              <LogOut size={20} />
              {sidebarOpen && (
                <span style={{ fontSize: '14px', fontWeight: '500' }}>
                  Sair
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto'
        }}>
          {children}
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 5,
              display: window.innerWidth < 768 ? 'block' : 'none'
            }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </AnimatedBackground>
    {logoutConfirmOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', width: 360, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Confirmar saída</div>
          {logoutChecking ? (
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Verificando status da sua jornada...
            </p>
          ) : (
            <p style={{ fontSize: 12, color: '#475569', margin: '0 0 12px 0' }}>
              {logoutContext?.hasBreak
                ? 'Você está em pausa. Ao confirmar, sua jornada será finalizada e você será desconectado.'
                : logoutContext?.hasSession
                  ? 'Você está com a jornada em curso. Ao confirmar, sua jornada será finalizada e você será desconectado.'
                  : 'Ao confirmar, você será desconectado. Caso exista uma jornada ativa, ela será finalizada automaticamente.'}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setLogoutConfirmOpen(false)} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#111827', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleConfirmLogoutAndStop} disabled={logoutActionLoading} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: logoutActionLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {logoutActionLoading ? (<><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finalizando...</>) : 'Confirmar e sair'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export function AgentLayout({ children }: AgentLayoutProps) {
  return (
    <AgentWebRTCProvider>
      <AgentLayoutInner>{children}</AgentLayoutInner>
    </AgentWebRTCProvider>
  );
}
