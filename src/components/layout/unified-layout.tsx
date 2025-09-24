'use client';

import { useState, useEffect, useRef } from 'react';
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
  UserCheck,
  Activity,
  Music,
  Users,
  Shield,
  CreditCard,
  PhoneCall,
  Clock,
  FileText,
  Building,
  Building2,
  Bell,
  Database,
  DollarSign,
  Home,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { authService, type AuthUser } from '@/lib/auth';
import { agentAuthService, type AgentData } from '@/services/agentAuthService';
import { useToast } from '@/components/ui/toast';
import { AnimatedBackground } from './animated-background';
import { activeCallsService } from '@/services/activeCallsService';

interface MenuItem {
  name: string;
  href: string;
  icon: any;
  description: string;
  roles?: string[];
}

interface LayoutConfig {
  type: 'admin' | 'agent';
  title: string;
  menuItems: MenuItem[];
  showActiveCalls?: boolean;
}

interface UnifiedLayoutProps {
  children: React.ReactNode;
  config: LayoutConfig;
}

const adminMenuItems: MenuItem[] = [
  // Itens principais (navigation)
  { name: 'Dashboard', href: '/dashboard', icon: Home, description: 'Visão geral do sistema' },
  { name: 'Agentes', href: '/agents', icon: Users, description: 'Gerenciar agentes' },
  { name: 'Áudios', href: '/audios', icon: Music, description: 'Gerenciar arquivos de áudio' },
  { name: 'Relatórios', href: '/reports', icon: FileText, description: 'Relatórios gerais' },
  { name: 'CDR', href: '/cdr', icon: Phone, description: 'Registros de chamadas (CDR)' },
  { name: 'Mailings', href: '/mailings', icon: FileText, description: 'Campanhas e listas de contatos' },
  { name: 'Configurações', href: '/config', icon: Settings, description: 'Preferências e configurações' },

  // Seção administrativa (adminNavigation)
  { name: 'Usuários', href: '/admin/users', icon: UserCheck, description: 'Gerenciar usuários do sistema' },
  { name: 'Financeiro', href: '/admin/financial', icon: DollarSign, description: 'Gestão financeira' },
  { name: 'Planos', href: '/admin/plans', icon: CreditCard, description: 'Gerenciar planos' },
  { name: 'Notificações', href: '/admin/notifications', icon: Bell, description: 'Alertas e notificações' },
  { name: 'Real-Time Calls', href: '/admin/real-time-calls', icon: Activity, description: 'Chamadas em tempo real' },
  { name: 'Terminações', href: '/admin/terminations', icon: Database, description: 'Terminações e rotas' },
  { name: 'Relatório do Sistema', href: '/admin/system-report', icon: BarChart3, description: 'Relatórios do sistema' },
  { name: 'Agentes All', href: '/admin/agents-all', icon: Users, description: 'Administração de todos os agentes' },
  { name: 'Revendedor', href: '/admin/reseller', icon: Building2, description: 'Área do revendedor' }
];

const agentMenuItems: MenuItem[] = [
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

export function UnifiedLayout({ children, config }: UnifiedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userData, setUserData] = useState<AuthUser | AgentData | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { success, error } = useToast();
  const [activeCallsCount, setActiveCallsCount] = useState(0);
  const navRef = useRef<HTMLDivElement | null>(null);
  const [navShadowTop, setNavShadowTop] = useState(false);
  const [navShadowBottom, setNavShadowBottom] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false); // fechado por padrão para evitar rolagem
  const [mainOpen, setMainOpen] = useState(true);

  // ✅ MONITORAMENTO CONDICIONAL DE CHAMADAS ATIVAS
  useEffect(() => {
    let removeActiveCallsListener: (() => void) | null = null;

    if (userData && config.showActiveCalls) {
      activeCallsService.startPolling(window.location.pathname);
      removeActiveCallsListener = activeCallsService.addListener((data) => {
        setActiveCallsCount(data.count);
      });
    } else {
      activeCallsService.stopPolling();
      setActiveCallsCount(0);
    }

    return () => {
      if (removeActiveCallsListener) removeActiveCallsListener();
    };
  }, [userData, config.showActiveCalls]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (config.type === 'admin') {
          if (!authService.isAuthenticated()) {
            window.location.href = '/login';
            return;
          }
          const user = authService.getCurrentUser();
          if (user) {
            setUserData(user);
          }
        } else {
          if (!agentAuthService.isAuthenticated()) {
            window.location.href = '/login';
            return;
          }
          const storedData = agentAuthService.getStoredAgentData();
          if (storedData) {
            setUserData(storedData);
          }
          const result = await agentAuthService.getCurrentAgent();
          if (result.success && result.data) {
            setUserData(result.data);
          }
        }
      } catch (err) {
        console.error('[UNIFIED LAYOUT] Auth check error:', err);
        window.location.href = '/login';
      }
    };

    checkAuth();
  }, [config.type]);

  // Intelligent scroll: update scroll shadows on nav scroll
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onScroll = () => {
      const top = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      setNavShadowTop(top > 2);
      setNavShadowBottom(max - top > 2);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [sidebarOpen, config.type]);

  // Auto-scroll active item into view when route changes or sidebar toggles
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const active = el.querySelector('a[aria-current="page"]') as HTMLElement | null;
    if (active) {
      const topTarget = Math.max(0, active.offsetTop - 72);
      el.scrollTo({ top: topTarget, behavior: 'smooth' });
    }
  }, [sidebarOpen, pathname]);

  const handleLogout = async () => {
    try {
      if (config.type === 'admin') {
        await authService.logout();
      } else {
        await agentAuthService.logout();
      }
      success('Logout realizado com sucesso!');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/login');
    }
  };

  const getDisplayName = () => {
    if (!userData) return config.type === 'admin' ? 'Admin' : 'Agente';
    
    if (config.type === 'admin') {
      return (userData as AuthUser).name;
    } else {
      return (userData as AgentData).agente_name;
    }
  };

  const getDisplayInfo = () => {
    if (!userData) return config.type === 'admin' ? 'Sistema' : '----';
    
    if (config.type === 'admin') {
      const user = userData as AuthUser;
      return user.role === 'admin' ? 'Administrador' : user.role;
    } else {
      const agent = userData as AgentData;
      return `Ramal ${agent.ramal}`;
    }
  };

  const getStatusInfo = () => {
    if (config.type === 'agent' && userData) {
      const agent = userData as AgentData;
      return {
        status: agent.status_sip || 'offline',
        color: agent.status_sip === 'online' ? '#10b981' : '#ef4444'
      };
    }
    return null;
  };

  const displayName = getDisplayName();
  const displayInfo = getDisplayInfo();
  const statusInfo = getStatusInfo();

  // Agrupar itens: principais e seção administrativa (para admin)
  const mainMenuItems = config.menuItems.filter((i) => !i.href.startsWith('/admin'));
  const adminSectionItems = config.menuItems.filter((i) => i.href.startsWith('/admin'));

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
            padding: '12px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: config.type === 'admin'
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 700
                }}>
                  {displayName?.charAt(0)?.toUpperCase() || (config.type === 'admin' ? 'A' : 'G')}
                </div>
                <div style={{ lineHeight: 1.15 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                    {displayName || (config.type === 'admin' ? 'Administrador' : 'Agente')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {displayInfo}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Info moved to header */}

          {/* Active Calls Card (for admin) */}
          {config.showActiveCalls && config.type === 'admin' && (
            <div style={{
              margin: sidebarOpen ? '20px' : '12px',
              padding: sidebarOpen ? '16px' : '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderRadius: '12px',
              color: 'white'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center'
              }}>
                <PhoneCall size={20} />
                {sidebarOpen && (
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: '700' }}>
                      {activeCallsCount}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                      Chamadas Ativas
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation compacta, sem rolagem */}
          <nav className="nav-wrap" style={{ flex: 1, padding: sidebarOpen ? '12px' : '8px' }}>
            <div ref={navRef} className="nav-scroll">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {mainOpen && mainMenuItems.map((item) => {
                  const isActive = pathname === item.href;
                  
                  return (
                    <li key={item.name} style={{ marginBottom: '4px' }}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: sidebarOpen ? '8px 10px' : '8px',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: isActive ? (config.type === 'admin' ? '#3b82f6' : '#667eea') : '#64748b',
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
                          if (window.innerWidth < 768) {
                            setSidebarOpen(false);
                          }
                        }}
                      >
                        <item.icon size={20} />
                        {sidebarOpen && (
                          <div style={{ lineHeight: 1.1 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>
                              {item.name}
                            </div>
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {/* Seção Administrativa - colapsável */}
                {adminSectionItems.length > 0 && (
                  <li style={{ marginTop: '6px', marginBottom: adminOpen ? '4px' : 0 }}>
                    <button
                      type="button"
                      onClick={() => setAdminOpen(v => !v)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'transparent',
                        border: 0,
                        color: '#64748b',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '.04em',
                        textTransform: 'uppercase',
                        padding: '4px 2px',
                        cursor: 'pointer',
                        borderRadius: '6px'
                      }}
                    >
                      {adminOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      Administração
                    </button>
                  </li>
                )}
                {adminOpen && adminSectionItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name} style={{ marginBottom: '4px' }}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: sidebarOpen ? '8px 10px' : '8px',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: isActive ? (config.type === 'admin' ? '#3b82f6' : '#667eea') : '#64748b',
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
                          if (window.innerWidth < 768) {
                            setSidebarOpen(false);
                          }
                        }}
                      >
                        <item.icon size={20} />
                        {sidebarOpen && (
                          <div style={{ lineHeight: 1.1 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>
                              {item.name}
                            </div>
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            {/* Scroll shadows removed; sidebar compact avoids scrolling */}
          </nav>

          {/* Logout */}
          <div style={{ 
            padding: sidebarOpen ? '14px' : '10px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: sidebarOpen ? '8px 10px' : '8px',
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
      <style jsx>{`
        .nav-wrap { position: relative; height: 100%; }
        .nav-scroll { height: 100%; overflow: hidden; }
        .nav-scroll::-webkit-scrollbar { width: 8px; }
        .nav-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.35); border-radius: 999px; }
        .nav-wrap:hover .nav-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.55); }
        .nav-scroll { scrollbar-width: none; }
      `}</style>
    </AnimatedBackground>
  );
}

// Predefined configurations
export const adminLayoutConfig: LayoutConfig = {
  type: 'admin',
  title: 'Painel Admin',
  menuItems: adminMenuItems,
  showActiveCalls: false
};

export const agentLayoutConfig: LayoutConfig = {
  type: 'agent',
  title: 'Área do Agente',
  menuItems: agentMenuItems,
  showActiveCalls: false
};
