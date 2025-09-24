'use client';

import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  BarChart3,
  Users,
  Phone,
  FileText,
  Settings,
  Menu,
  X,
  Home,
  UserCheck,
  PhoneCall,
  LogOut,
  Shield,
  CreditCard,
  Database,
  Activity,
  Globe,
  DollarSign,
  Building2,
  UserCog,
  Bell,
  Music,
  TrendingUp
} from 'lucide-react';
import { authService } from '@/lib/auth';
import { unifiedAuthService } from '@/lib/unifiedAuth';
import { useLayoutData } from '@/hooks/useLayoutData';
import PlanStatusCard from './PlanStatusCard';
import NotificationDropdown from './NotificationDropdown';
import { Plan } from '@/types';

interface MainLayoutProps {
  children: React.ReactNode;
  // When true, disables periodic polling done by the layout (auth checks, session expiry checks, suspension checks)
  disablePolling?: boolean;
}

// 🎨 Sistema de cores refinado por role - Azul-cinza com degradê esfumaçado
const roleColorSchemes = {
  admin: {
    primary: '#475569', // Azul-cinza escuro
    primaryLight: '#94a3b8', // Azul-cinza claro
    secondary: 'rgba(248, 250, 252, 0.8)', // Branco esfumaçado
    accent: '#334155', // Azul-cinza mais escuro
    gradient: 'linear-gradient(135deg, #667eea, rgba(255, 255, 255, 0.9))',
    gradientLight: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(255, 255, 255, 0.95))',
    border: 'rgba(102, 126, 234, 0.15)',
    shadow: 'rgba(102, 126, 234, 0.2)'
  },
  reseller: {
    primary: '#059669', // Verde sutil para diferenciação
    primaryLight: '#6ee7b7',
    secondary: 'rgba(248, 250, 252, 0.8)',
    accent: '#047857',
    gradient: 'linear-gradient(135deg, #10b981, rgba(255, 255, 255, 0.9))',
    gradientLight: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.95))',
    border: 'rgba(16, 185, 129, 0.15)',
    shadow: 'rgba(16, 185, 129, 0.2)'
  },
  collaborator: {
    primary: '#475569', // Mesmo azul-cinza
    primaryLight: '#94a3b8',
    secondary: 'rgba(248, 250, 252, 0.8)',
    accent: '#334155',
    gradient: 'linear-gradient(135deg, #667eea, rgba(255, 255, 255, 0.9))',
    gradientLight: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(255, 255, 255, 0.95))',
    border: 'rgba(102, 126, 234, 0.15)',
    shadow: 'rgba(102, 126, 234, 0.2)'
  },
  user: {
    primary: '#475569', // Azul-cinza padrão do sistema
    primaryLight: '#94a3b8',
    secondary: 'rgba(248, 250, 252, 0.8)',
    accent: '#334155',
    gradient: 'linear-gradient(135deg, #667eea, rgba(255, 255, 255, 0.9))',
    gradientLight: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(255, 255, 255, 0.95))',
    border: 'rgba(102, 126, 234, 0.15)',
    shadow: 'rgba(102, 126, 234, 0.2)'
  }
} as const;

type UserRole = keyof typeof roleColorSchemes;

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Agentes', href: '/agents', icon: Users },
  { name: 'Áudios', href: '/audios', icon: Music },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'CDR', href: '/cdr', icon: Phone },
  { name: 'Mailings', href: '/mailings', icon: FileText },
  { name: 'Configurações', href: '/config', icon: Settings },
];

// Navegação exclusiva para administradores
const adminNavigation = [
  { name: 'Usuários', href: '/admin/users', icon: UserCheck },
  { name: 'Financeiro', href: '/admin/financial', icon: DollarSign },
  { name: 'Planos', href: '/admin/plans', icon: CreditCard },
  { name: 'Notificações', href: '/admin/notifications', icon: Bell },
  { name: 'Real-Time Calls', href: '/admin/real-time-calls', icon: Activity },
  { name: 'Terminações', href: '/admin/terminations', icon: Database },
  { name: 'Relatório do Sistema', href: '/admin/system-report', icon: BarChart3 },
  { name: 'Agentes All', href: '/admin/agents-all', icon: Users },
  { name: 'Revendedor', href: '/admin/reseller', icon: Building2 },
];

// Navegação exclusiva para colaboradores
const collaboratorNavigation = [
  { name: 'Usuários', href: '/admin/users', icon: UserCheck },
  { name: 'Revendedor', href: '/admin/reseller', icon: Building2 },
  { name: 'Agentes All', href: '/admin/agents-all', icon: Users },
  { name: 'Real-Time Calls', href: '/admin/real-time-calls', icon: Activity },
];

// Navegação exclusiva para revendedores
const resellerNavigation = [
  { name: 'Dashboard', href: '/reseller/dashboard', icon: Home },
  { name: 'Clientes', href: '/reseller/clients', icon: Building2 },
  { name: 'Agentes All', href: '/reseller/agents', icon: Users },
  { name: 'Planos', href: '/reseller/plans', icon: CreditCard },
  { name: 'Notificações', href: '/reseller/notifications', icon: Bell },
  { name: 'Configurações', href: '/reseller/config', icon: Settings },
  { name: 'Relatórios All', href: '/reseller/reports', icon: FileText },
  { name: 'Financeiro', href: '/reseller/financial', icon: DollarSign },
];

function MainLayout({ children, disablePolling = false }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifHoverOpen, setNotifHoverOpen] = useState(false);
  const [notifPinnedOpen, setNotifPinnedOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // ✅ Cache local do role para evitar piscar do menu
  const [cachedUserRole, setCachedUserRole] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_role') || null;
    }
    return null;
  });

  // Hook consolidado para todos os dados do layout
  const {
    userData: realUserData,
    planData: userPlan,
    notifications: notifRecent,
    loading: isLoading,
    error,
    daysRemaining,
    planName,
    isPlanActive,
    planStatusText,
    notificationCount: notifCount,
    refetch,
    invalidateCache,
    setPollingEnabled
  } = useLayoutData();

  // Allow page to control layout polling
  const pollingAppliedRef = useRef<boolean | null>(null);
  useEffect(() => {
    const targetEnabled = !disablePolling;
    // Only apply when the desired state changes to avoid re-render loops (StrictMode safe)
    if (pollingAppliedRef.current !== targetEnabled) {
      try {
        setPollingEnabled(targetEnabled);
        pollingAppliedRef.current = targetEnabled;
      } catch {}
    }
  }, [disablePolling, setPollingEnabled]);
  
  // ✅ Atualizar cache do role quando dados chegarem
  useEffect(() => {
    if (realUserData?.role && realUserData.role !== cachedUserRole) {
      setCachedUserRole(realUserData.role);
      localStorage.setItem('user_role', realUserData.role);
    }
  }, [realUserData?.role, cachedUserRole]);
  
  // ✅ Usar role em cache ou dados reais (o que estiver disponível primeiro)
  const currentUserRole = realUserData?.role || cachedUserRole;
  
  // 🎨 Cores dinâmicas baseadas no role
  const currentColors = useMemo(() => {
    const role = (currentUserRole as UserRole) || 'user';
    return roleColorSchemes[role] || roleColorSchemes.user;
  }, [currentUserRole]);

  // Monitorar autenticação e redirecionar se necessário
  useEffect(() => {
    if (!isLoading && !realUserData) {
      router.push('/login');
    }
  }, [isLoading, realUserData, router]);

  // Verificação periódica de autenticação
  useEffect(() => {
    if (disablePolling) return;
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setPollingEnabled(false);
        router.push('/login');
      }
    };

    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router, setPollingEnabled, disablePolling]);

  // Absolute session expiry enforcement (1 hour)
  useEffect(() => {
    if (disablePolling) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await unifiedAuthService.checkAndHandleExpiry();
      } catch {}
    };
    // initial check
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [disablePolling]);

  // Detect suspension by polling /me periodically
  useEffect(() => {
    if (disablePolling) return;
    let mounted = true;
    const pollSuspension = async () => {
      try {
        const apiUser = await authService.getCurrentUserFromAPI();
        if (!mounted) return;
        if (apiUser?.status === 'suspended') {
          await handleLogout();
        }
      } catch {}
    };
    const id = setInterval(pollSuspension, 2 * 60 * 1000);
    // run once shortly after mount to catch immediate suspensions
    setTimeout(pollSuspension, 15 * 1000);
    return () => { mounted = false; clearInterval(id); };
  }, [disablePolling]);

  // Listen for forced logout events from API layer
  useEffect(() => {
    const onForce = () => {
      try { setPollingEnabled(false); } catch {}
      router.push('/login');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('app:force-logout', onForce);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('app:force-logout', onForce);
      }
    };
  }, [router, setPollingEnabled]);

  // Hook para detectar tamanho da tela
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    // Verificar tamanho inicial
    checkScreenSize();

    // Adicionar listener para mudanças de tamanho
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleLogout = async () => {
    try {
      setPollingEnabled(false); // Para o polling antes do logout
      await authService.logout();
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      localStorage.removeItem('token');
      router.push('/login');
    }
  };

  // Dias restantes já calculados pelo hook useLayoutData

  // Funções de utilidade memoizadas movidas para useLayoutData

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex'
    }}>
      {/* Mobile overlay */}
      {sidebarOpen && !isDesktop && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '16rem',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        transform: isDesktop ? 'translateX(0)' : (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'),
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header with Logo */}
        <div style={{
          padding: '1.5rem 1rem',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: !isDesktop ? 'space-between' : 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%'
          }}>
            <img 
              src="/logo.png" 
              alt="Logo"
              style={{
                height: '4rem',
                width: '13rem',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: '0.5rem',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
              }}
            />
          </div>
          
          {!isDesktop && (
            <button
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute',
                right: '1rem'
              }}
              onClick={() => setSidebarOpen(false)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <X style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: '1rem 0',
          overflowY: 'auto'
        }}>
          {/* Menu Principal - Condicional baseado no role (com cache) */}
          {(() => {
            switch(currentUserRole) {
              case 'collaborator': return collaboratorNavigation;
              case 'reseller': return resellerNavigation;
              case 'admin': return navigation;
              case 'user':
              default: return navigation;
            }
          })().map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  position: 'relative',
                  overflow: 'hidden',
                  background: isActive ? currentColors.gradientLight : 'transparent',
                  color: isActive ? currentColors.primary : '#64748b',
                  border: isActive ? `1px solid ${currentColors.border}` : '1px solid transparent',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformOrigin: 'left center'
                }}
                onClick={() => setSidebarOpen(false)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.transform = 'translateX(8px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 8px 25px -8px rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.transform = 'translateX(0) scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '3px',
                    height: '60%',
                    background: currentColors.gradient,
                    borderRadius: '0 2px 2px 0'
                  }} />
                )}
                
                <div className="menu-icon" style={{
                  marginRight: '0.75rem',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  background: isActive ? currentColors.gradient : 'rgba(148, 163, 184, 0.1)',
                  color: isActive ? 'white' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? `0 4px 12px -2px ${currentColors.shadow}` : 'none'
                }}>
                  <item.icon style={{ width: '1rem', height: '1rem' }} />
                </div>
                
                <span style={{
                  fontWeight: isActive ? '600' : '500'
                }}>
                  {item.name}
                </span>
              </Link>
            );
          })}
          
          {/* Seção Administrativa - Apenas para Administradores */}
          {currentUserRole === 'admin' && (
            <>
              <div style={{
                margin: '1rem 0 0.5rem 0',
                padding: '0 1rem',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Shield style={{ width: '0.875rem', height: '0.875rem' }} />
                Administração
              </div>
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href;
                // Cores específicas para seção administrativa (vermelho sutil para diferenciação)
                const adminColors = {
                  primary: '#dc2626',
                  gradient: 'linear-gradient(135deg, #dc2626, rgba(255, 255, 255, 0.9))',
                  gradientLight: 'linear-gradient(135deg, rgba(220, 38, 38, 0.08), rgba(255, 255, 255, 0.95))',
                  border: 'rgba(220, 38, 38, 0.15)',
                  shadow: 'rgba(220, 38, 38, 0.2)'
                };
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="menu-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      textDecoration: 'none',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      position: 'relative',
                      overflow: 'hidden',
                      background: isActive ? adminColors.gradientLight : 'transparent',
                      color: isActive ? adminColors.primary : '#64748b',
                      border: isActive ? `1px solid ${adminColors.border}` : '1px solid transparent',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transformOrigin: 'left center'
                    }}
                    onClick={() => setSidebarOpen(false)}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                        e.currentTarget.style.color = '#374151';
                        e.currentTarget.style.transform = 'translateX(8px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px -8px rgba(220, 38, 38, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#64748b';
                        e.currentTarget.style.transform = 'translateX(0) scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '3px',
                        height: '60%',
                        background: adminColors.gradient,
                        borderRadius: '0 2px 2px 0',
                        boxShadow: `0 2px 8px ${adminColors.shadow}`
                      }} />
                    )}
                    
                    <div style={{
                      marginRight: '0.75rem',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      background: isActive ? adminColors.gradient : 'rgba(148, 163, 184, 0.1)',
                      color: isActive ? 'white' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isActive ? `0 4px 8px -2px ${adminColors.shadow}` : 'none'
                    }}>
                      <item.icon style={{ width: '1rem', height: '1rem' }} />
                    </div>
                    
                    <span style={{
                      fontWeight: isActive ? '600' : '500'
                    }}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Plan Information */}
        <div style={{
          padding: '1.5rem 1rem',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          <div style={{
            padding: '1rem',
            background: currentColors.gradientLight,
            borderRadius: '0.75rem',
            border: `1px solid ${currentColors.border}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 8px -2px rgba(99, 102, 241, 0.3)'
              }}>
                <TrendingUp style={{ width: '0.875rem', height: '0.875rem', color: 'white' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  {isLoading ? 'Carregando...' : planName}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#64748b'
                }}>
                  {isLoading ? '...' : `Vence em ${daysRemaining} dias`}
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <div style={{
                width: '0.375rem',
                height: '0.375rem',
                borderRadius: '50%',
                background: isPlanActive ? '#10b981' : '#f56565',

              }} />
              <span style={{
                fontSize: '0.75rem',
                color: isPlanActive ? '#10b981' : '#f56565',
                fontWeight: '500'
              }}>
                Status: {isLoading ? 'Verificando...' : planStatusText}
              </span>
            </div>
            
            <button style={{
              width: '100%',
              padding: '0.5rem',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem'
            }}

            title="Renovar plano"
            >
              <Activity size={16} style={{ marginRight: '0.25rem' }} />
              <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} />
              Renovar
            </button>
          </div>
        </div>

        {/* User info */}
        <div className="user-info" style={{
          padding: '1rem',
          borderTop: '1px solid rgba(226, 232, 240, 0.8)',
          background: 'rgba(248, 250, 252, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              padding: '0.5rem',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: '0.5rem',
              color: 'white',
              marginRight: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserCheck style={{ width: '1rem', height: '1rem' }} />
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#1e293b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {realUserData?.name || 'Administrador'}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b'
              }}>
                {currentUserRole === 'admin' ? 'Administrador' : 
                 currentUserRole === 'reseller' ? 'Revendedor' :
                 currentUserRole === 'collaborator' ? 'Colaborador' : 'Usuário'}
              </div>
            </div>
            
            <button
              style={{
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                color: '#64748b',

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={handleLogout}
              className="logout-button"
              title="Sair"

            >
              <LogOut className="menu-icon" style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        marginLeft: isDesktop ? '16rem' : 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%'
      }}>
        {/* Top bar */}
        <header style={{
          height: '4.5rem',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95))',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}>
          <div style={{
            height: '100%',
            padding: '0 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Left Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem'
            }}>
              <button
                style={{
                  padding: '0.75rem',
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '1px solid rgba(226, 232, 240, 0.6)',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  color: '#64748b',
  
                  display: isDesktop ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                }}
                onClick={() => setSidebarOpen(true)}

              >
                <Menu style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
              
              {/* Page Title with Breadcrumb Style */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.75rem',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 8px -2px rgba(99, 102, 241, 0.3)'
                }}>
                  {(() => {
                    const currentPage = navigation.find(item => item.href === pathname);
                    const IconComponent = currentPage?.icon || Home;
                    return <IconComponent style={{ width: '1.25rem', height: '1.25rem', color: 'white' }} />;
                  })()}
                </div>
                
                <div>
                  <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0,
                    lineHeight: 1.2
                  }}>
                    {navigation.find(item => item.href === pathname)?.name || 'PABX Pro'}
                  </h1>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontWeight: '500',
                    marginTop: '0.125rem'
                  }}>
                    Bem-vindo de volta, {realUserData?.name || 'Administrador'}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}>
              {/* Plan Status Card - Componente otimizado */}
              <Suspense fallback={<div style={{ width: '200px', height: '48px', background: '#f1f5f9', borderRadius: '0.75rem', animation: 'pulse 2s infinite' }} />}>
                <PlanStatusCard
                  daysRemaining={daysRemaining}
                  planName={planName}
                  isLoading={isLoading}
                />
              </Suspense>

              {/* Enhanced Notifications - Componente otimizado */}
              <Suspense fallback={<div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '1rem', animation: 'pulse 2s infinite' }} />}>
                <NotificationDropdown
                  notifications={notifRecent}
                  notificationCount={notifCount}
                  isOpen={notifHoverOpen}
                  isPinned={notifPinnedOpen}
                  onTogglePinned={() => setNotifPinnedOpen(v => !v)}
                  onMouseEnter={() => setNotifHoverOpen(true)}
                  onMouseLeave={() => setNotifHoverOpen(false)}
                />
              </Suspense>
              
              {/* Logout Button - Otimizado com CSS */}
              <button
                className="logout-button"
                onClick={handleLogout}
                title="Sair do sistema"
              >
                <LogOut style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          overflow: 'auto'
        }}>
          {children}
        </main>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes iconBounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-3px);
          }
          60% {
            transform: translateY(-2px);
          }
        }
        
        .menu-item {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: left center;
        }
        
        .menu-item:hover .menu-icon {
          animation: iconBounce 0.6s ease-in-out;
        }
        
        .logout-button {
          padding: 0.875rem;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.12));
          border: 1px solid rgba(239, 68, 68, 0.15);
          border-radius: 1rem;
          cursor: pointer;
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px -1px rgba(239, 68, 68, 0.1);
          width: 3rem;
          height: 3rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .logout-button:hover {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.18));
          color: #dc2626;
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 12px 20px -4px rgba(239, 68, 68, 0.25);
        }
        
        
        @media (max-width: 1023px) {
          .sidebar {
            transform: ${sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'} !important;
          }
          
          .main-content {
            margin-left: 0 !important;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
        
        /* Performance optimizations */
        .menu-item, .menu-icon, .logout-button {
          will-change: transform, box-shadow;
        }
        
        .menu-item:not(:hover), .logout-button:not(:hover) {
          will-change: auto;
        }
        
        /* GPU acceleration for smooth animations */
        .menu-item, .menu-icon {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
}

export { MainLayout };
export default MainLayout;
