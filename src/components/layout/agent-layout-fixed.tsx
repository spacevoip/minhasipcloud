'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  Phone, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User,
  Activity
} from 'lucide-react';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';
import { useToast } from '@/components/ui/toast';
import { AnimatedBackground } from './animated-background';

interface AgentLayoutProps {
  children: React.ReactNode;
}

export function AgentLayout({ children }: AgentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { success, error } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[AGENT LAYOUT] Checking authentication...');
        
        if (!agentAuthService.isAuthenticated()) {
          console.log('[AGENT LAYOUT] Not authenticated, redirecting to login');
          window.location.href = '/login';
          return;
        }

        console.log('[AGENT LAYOUT] Agent is authenticated, loading data...');

        // Try to get fresh agent data
        const result = await agentAuthService.getCurrentAgent();
        if (result.success && result.data) {
          console.log('[AGENT LAYOUT] Fresh agent data loaded:', result.data.agente_name);
          setAgentData(result.data);
        } else {
          // Fallback to stored data
          const storedData = agentAuthService.getStoredAgentData();
          if (storedData) {
            console.log('[AGENT LAYOUT] Using stored agent data:', storedData.agente_name);
            setAgentData(storedData);
          } else {
            console.log('[AGENT LAYOUT] No agent data found, redirecting to login');
            window.location.href = '/login';
            return;
          }
        }
      } catch (err) {
        console.error('[AGENT LAYOUT] Auth check error:', err);
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await agentAuthService.logout();
      success('Logout realizado com sucesso!');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
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
      name: 'Configurações',
      href: '/agent/settings',
      icon: Settings,
      description: 'Configurações do ramal'
    }
  ];

  if (loading) {
    return (
      <AnimatedBackground>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Activity size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Carregando...</p>
          </div>
        </div>
      </AnimatedBackground>
    );
  }

  if (!agentData) {
    return null;
  }

  return (
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
                  Ramal {agentData.ramal}
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
                {agentData?.agente_name?.charAt(0)?.toUpperCase() || 'A'}
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
                    {agentData?.agente_name || 'Agente'}
                  </p>
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#64748b',
                    margin: 0
                  }}>
                    Ramal {agentData?.ramal || '----'}
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
                      background: agentData?.status_sip === 'online' ? '#10b981' : '#ef4444'
                    }} />
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#64748b',
                      textTransform: 'capitalize'
                    }}>
                      {agentData?.status_sip || 'offline'}
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
                const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;
                
                return (
                  <li key={item.name} style={{ marginBottom: '8px' }}>
                    <a
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
                    </a>
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarOpen ? '12px 16px' : '12px',
                borderRadius: '8px',
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                width: '100%',
                transition: 'background 0.2s ease',
                justifyContent: sidebarOpen ? 'flex-start' : 'center'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#fef2f2';
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
  );
}
