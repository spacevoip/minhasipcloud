'use client';

import { useState, useEffect, useRef } from 'react';

// Animações CSS modernas
const modernAnimations = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.7; }
  }
  
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-10px); }
  }
  
  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }
  
  @keyframes fadeInOut {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  
  @keyframes slideIn {
    from { transform: translateX(-20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.3); }
    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.6); }
  }
`;

// Injetar CSS no documento
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = modernAnimations;
  document.head.appendChild(styleElement);
}
import { Save, User, Lock, CreditCard, Bell, Shield, Settings, Eye, EyeOff, Check, X } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuthStore } from '@/store/auth';
import { userService } from '../../lib/userService';
import { authService, AuthUser } from '@/lib/auth';
import { plansService } from '@/services/plansService';
import { Plan } from '@/types';
import { ModernLoading } from '@/components/ui/modern-loading';
import { notificationsService } from '@/lib/notificationsService';

// Função para formatar telefone brasileiro
const formatPhoneBrazil = (phone: string): string => {
  if (!phone) return '';
  
  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');
  
  // Remove o 55 do início se existir
  const cleanNumbers = numbers.startsWith('55') && numbers.length > 11 
    ? numbers.substring(2) 
    : numbers;
  
  // Formata conforme o tamanho
  if (cleanNumbers.length === 11) {
    // Celular: (11) 95886-2870
    return `(${cleanNumbers.substring(0, 2)}) ${cleanNumbers.substring(2, 7)}-${cleanNumbers.substring(7)}`;
  } else if (cleanNumbers.length === 10) {
    // Fixo: (11) 5886-2870
    return `(${cleanNumbers.substring(0, 2)}) ${cleanNumbers.substring(2, 6)}-${cleanNumbers.substring(6)}`;
  }
  
  // Se não tem formato válido, retorna como está
  return phone;
};

// Função para medir força da senha
const getPasswordStrength = (password: string) => {
  if (!password) return { score: 0, label: '', color: '#e5e7eb', feedback: [] };
  
  let score = 0;
  let feedback: string[] = [];
  
  // Critérios de força
  if (password.length >= 8) score += 1;
  else feedback.push('Mínimo 8 caracteres');
  
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Letra minúscula');
  
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Letra maiúscula');
  
  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Número');
  
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Símbolo especial');
  
  // Definir cor e label baseado no score
  if (score <= 1) return { score, label: 'Muito fraca', color: '#ef4444', feedback };
  if (score === 2) return { score, label: 'Fraca', color: '#f59e0b', feedback };
  if (score === 3) return { score, label: 'Média', color: '#eab308', feedback };
  if (score === 4) return { score, label: 'Forte', color: '#22c55e', feedback };
  return { score, label: 'Muito forte', color: '#16a34a', feedback };
};

// UX hooks inline implementation
const useToast = () => ({
  success: (message: string) => {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #10b981; color: white;
      padding: 12px 24px; border-radius: 8px; z-index: 1000; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    toast.textContent = `✅ ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  },
  error: (message: string) => {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #ef4444; color: white;
      padding: 12px 24px; border-radius: 8px; z-index: 1000; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    toast.textContent = `❌ ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  }
});

export default function ConfigPage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<Plan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const lastSnapshotRef = useRef<string>('');
  const [currentUserState, setCurrentUserState] = useState<AuthUser | null>(null);
  // Notifications state
  const [myNotifications, setMyNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifPagination, setNotifPagination] = useState<{ limit: number; offset: number; total?: number }>({ limit: 10, offset: 0, total: undefined });
  const [notifHasMore, setNotifHasMore] = useState(false);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    company: '',
    credits: 0,
    lastAccess: '',
    lastIpAccess: '',
    devicesConnected: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [planData] = useState({
    planName: 'PABX Pro Enterprise',
    maxExtensions: 500,
    usedExtensions: 127,
    features: ['Gravação de chamadas', 'Relatórios avançados', 'API completa', 'Suporte 24/7'],
    renewalDate: '2024-12-31',
    monthlyPrice: 299.90
  });
  
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    browser: true,
    sound: true
  });

  // Carregar dados reais do usuário (via backend API /auth-v2/me)
  useEffect(() => {
    const loadUserData = async () => {
      if (user?.id) {
        try {
          const apiUser = await authService.getCurrentUserFromAPI();
          if (apiUser) {
            setCurrentUserState(apiUser);
            // Snapshot relevant fields to avoid unnecessary updates
            const snapshot = JSON.stringify({
              id: apiUser.id,
              name: (apiUser as any).name || '',
              email: apiUser.email || '',
              phone: (apiUser as any).phone || '',
              role: apiUser.role || '',
              company: (apiUser as any).company || '',
              credits: apiUser.credits || 0,
              lastLoginAt: (apiUser as any).lastLoginAt || null,
              planId: apiUser.planId || null,
              planExpiresAt: apiUser.planExpiresAt || null,
              planStatus: (apiUser as any).planStatus ?? null,
              daysRemaining: (apiUser as any).daysRemaining ?? null,
            });
            if (snapshot !== lastSnapshotRef.current) {
              lastSnapshotRef.current = snapshot;
              setProfile({
                name: (apiUser as any).name || '',
                email: apiUser.email || '',
                phone: (apiUser as any).phone || '',
                role: userService.mapRole(apiUser.role) || '',
                company: (apiUser as any).company || '',
                credits: apiUser.credits || 0,
                lastAccess: (apiUser as any).lastLoginAt ? new Date((apiUser as any).lastLoginAt).toLocaleString('pt-BR') : 'Nunca',
                lastIpAccess: 'Em Desenvolvimento',
                devicesConnected: ''
              });
            }

            if (apiUser.planId) {
              try {
                // Only fetch/assign plan if changed
                if (!userPlan || userPlan.id !== apiUser.planId) {
                  const planData = await plansService.getPlanById(apiUser.planId);
                  setUserPlan(planData);
                }
              } catch (error) {
                // Error loading user plan
              }
            }
          }
        } catch (error) {
          // Error loading user data
          toast.error('Erro ao carregar dados do perfil');
        } finally {
          setLoading(false);
          setPlanLoading(false);
        }
      } else {
        setLoading(false);
        setPlanLoading(false);
      }
    };

    // 6s polling with cleanup
    let intervalId: number | null = null;
    const run = async () => {
      await loadUserData();
    };
    // first run
    run();
    intervalId = window.setInterval(run, 6000);
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Helper: time ago
  const timeAgo = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diff = Math.max(0, (now.getTime() - date.getTime()) / 1000);
    const units: [number, string][] = [
      [60, 'seg'],
      [60, 'min'],
      [24, 'h'],
      [30, 'd'],
      [12, 'm'],
    ];
    let value = diff;
    let unit = 's';
    for (let i = 0; i < units.length && value >= units[i][0]; i++) {
      value = Math.floor(value / units[i][0]);
      unit = units[i][1];
    }
    value = Math.floor(value);
    return `${value}${unit} atrás`;
  };

  // Load user notifications when opening the section
  useEffect(() => {
    const load = async (reset = true) => {
      if (activeSection !== 'notifications') return;
      if (!user?.id && !currentUserState?.id) return;
      setNotifLoading(true);
      setNotifError(null);
      try {
        const limit = reset ? 10 : notifPagination.limit;
        const offset = reset ? 0 : notifPagination.offset;
        const res = await notificationsService.my({ limit, offset });
        const items = res.data || [];
        setMyNotifications(reset ? items : [...myNotifications, ...items]);
        const total = res.pagination?.total ?? (reset ? items.length : myNotifications.length + items.length);
        const newOffset = offset + items.length;
        setNotifPagination({ limit, offset: newOffset, total });
        setNotifHasMore(newOffset < (total ?? newOffset));
      } catch (e: any) {
        setNotifError(e?.message || 'Erro ao carregar notificações');
      } finally {
        setNotifLoading(false);
      }
    };
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const refreshNotifications = async () => {
    try {
      setNotifLoading(true);
      setNotifError(null);
      const res = await notificationsService.my({ limit: 10, offset: 0 });
      setMyNotifications(res.data || []);
      const total = res.pagination?.total ?? (res.data || []).length;
      setNotifPagination({ limit: 10, offset: (res.data || []).length, total });
      setNotifHasMore((res.data || []).length < (total ?? 0));
    } catch (e: any) {
      setNotifError(e?.message || 'Erro ao atualizar notificações');
    } finally {
      setNotifLoading(false);
    }
  };

  const loadMoreNotifications = async () => {
    try {
      if (notifLoading || !notifHasMore) return;
      setNotifLoading(true);
      const res = await notificationsService.my({ limit: notifPagination.limit, offset: notifPagination.offset });
      const items = res.data || [];
      setMyNotifications((prev) => [...prev, ...items]);
      const total = res.pagination?.total ?? (myNotifications.length + items.length);
      const newOffset = notifPagination.offset + items.length;
      setNotifPagination({ ...notifPagination, offset: newOffset, total });
      setNotifHasMore(newOffset < (total ?? newOffset));
    } catch (e: any) {
      setNotifError(e?.message || 'Erro ao carregar mais');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsService.markRead(id);
      setMyNotifications((prev) => prev.map((n) => n.id === id ? { ...n, recipient_status: 'read', read_at: new Date().toISOString() } : n));
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao marcar como lida');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await notificationsService.dismiss(id);
      setMyNotifications((prev) => prev.map((n) => n.id === id ? { ...n, recipient_status: 'dismissed', dismissed_at: new Date().toISOString() } : n));
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao dispensar');
    }
  };

  const handleSaveProfile = () => {
    toast.success('Perfil atualizado com sucesso!');
  };

  const handleChangePassword = async () => {
    // Validações
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Preencha todos os campos!');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('As senhas não coincidem!');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres!');
      return;
    }
    
    // Verificar força da senha
    const strength = getPasswordStrength(passwordData.newPassword);
    if (strength.score < 3) {
      toast.error('Senha muito fraca! Use uma senha mais forte.');
      return;
    }
    
    try {
      // Verificar se há token válido
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado. Faça login novamente.');
      }
      
      // Token found and user ID verified
      
      // Tentar decodificar o token para ver sua estrutura
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          // Token payload decoded
        }
      } catch (e) {
        // Error decoding token
      }
      
      // Chamar API real para alterar senha
      const response = await fetch(`http://localhost:3001/api/users-v2/${user?.id}/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          newPassword: passwordData.newPassword
        })
      });
      
      // API response received
      
      const result = await response.json();
      // Response body processed
      
      if (!response.ok) {
        // API error occurred
        throw new Error(result.error || result.message || 'Erro ao alterar senha');
      }
      
      // Password changed successfully
      
      // Limpar campos
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Notificar sucesso
      toast.success('Senha alterada com sucesso! Você será redirecionado para fazer login novamente.');
      
      // Aguardar 2 segundos para o usuário ver a mensagem
      setTimeout(() => {
        // Fazer logout automático (limpar tokens e dados)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Automatic logout for security after password change
        
        // Redirecionar para página de login
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      // Error changing password
      
      // Tratar erros específicos da API
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('Dados inválidos')) {
        toast.error('Senha não atende aos critérios de segurança!');
      } else if (errorMessage.includes('Acesso negado')) {
        toast.error('Você não tem permissão para alterar esta senha!');
      } else if (errorMessage.includes('Usuário não encontrado')) {
        toast.error('Usuário não encontrado!');
      } else {
        toast.error('Erro ao alterar senha. Tente novamente.');
      }
    }
  };

  const sections = [
    { id: 'profile', name: 'Perfil', icon: User },
    { id: 'password', name: 'Alterar Senha', icon: Lock },
    { id: 'plan', name: 'Informações do Plano', icon: CreditCard },
    { id: 'notifications', name: 'Notificações', icon: Bell },
    { id: 'security', name: 'Segurança', icon: Shield },
    { id: 'system', name: 'Sistema', icon: Settings }
  ];

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    transition: 'all 0.2s ease',
    backgroundColor: '#ffffff',
    color: '#1f2937'
  };

  const buttonStyle = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  // Bloco de status do plano (pré-computado para evitar IIFE dentro do JSX)
  const planStatusBlock = (() => {
    const currentUser = (currentUserState || user) as any;
    if (!currentUser?.planExpiresAt) {
      return (
        <div style={{
          padding: '1.25rem',
          background: 'linear-gradient(135deg, rgba(156, 163, 175, 0.08), rgba(107, 114, 128, 0.08))',
          borderRadius: '0.75rem',
          border: '1px solid rgba(156, 163, 175, 0.15)',
          marginTop: '1rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '2rem',
            marginBottom: '0.5rem'
          }}>📅</div>
          <div style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#6b7280',
            marginBottom: '0.25rem'
          }}>
            Plano Ilimitado
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: '#9ca3af'
          }}>
            Sem data de expiração
          </div>
        </div>
      );
    }

    const expirationDate = new Date(currentUser.planExpiresAt);
    const daysRemaining = typeof currentUser.daysRemaining === 'number' ? currentUser.daysRemaining : null;

    let bgGradient: string, borderColor: string, textColor: string, icon: string, statusText: string, urgencyLevel: string;
    if (daysRemaining !== null && daysRemaining < 0) {
      bgGradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.12))';
      borderColor = 'rgba(239, 68, 68, 0.25)';
      textColor = '#dc2626';
      icon = '🚨';
      statusText = 'EXPIRADO';
      urgencyLevel = 'CRÍTICO';
    } else if (daysRemaining !== null && daysRemaining <= 3) {
      bgGradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 101, 101, 0.1))';
      borderColor = 'rgba(239, 68, 68, 0.2)';
      textColor = '#ef4444';
      icon = '⚠️';
      statusText = 'CRÍTICO';
      urgencyLevel = 'RENOVAR URGENTE';
    } else if (daysRemaining !== null && daysRemaining <= 7) {
      bgGradient = 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1))';
      borderColor = 'rgba(245, 158, 11, 0.2)';
      textColor = '#f59e0b';
      icon = '⏰';
      statusText = 'ATENÇÃO';
      urgencyLevel = 'RENOVAR EM BREVE';
    } else if (daysRemaining !== null && daysRemaining <= 30) {
      bgGradient = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1))';
      borderColor = 'rgba(59, 130, 246, 0.2)';
      textColor = '#3b82f6';
      icon = '📅';
      statusText = 'NORMAL';
      urgencyLevel = 'ACOMPANHAR';
    } else {
      bgGradient = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))';
      borderColor = 'rgba(16, 185, 129, 0.2)';
      textColor = '#10b981';
      icon = '✅';
      statusText = 'ATIVO';
      urgencyLevel = 'PLANO EM DIA';
    }

    return (
      <div style={{
        padding: '1.25rem',
        background: bgGradient,
        borderRadius: '0.75rem',
        border: `1px solid ${borderColor}`,
        marginTop: '1rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          padding: '0.25rem 0.5rem',
          background: textColor,
          color: 'white',
          fontSize: '0.625rem',
          fontWeight: '700',
          borderRadius: '0.375rem',
          letterSpacing: '0.05em'
        }}>
          {statusText}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            fontSize: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '4rem',
            height: '4rem',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            backdropFilter: 'blur(10px)'
          }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: textColor,
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem'
            }}>
              {daysRemaining !== null && daysRemaining < 0 ? (
                <>
                  <span>{Math.abs(daysRemaining)}</span>
                  <span style={{ fontSize: '1rem', fontWeight: '500' }}>dias em atraso</span>
                </>
              ) : daysRemaining !== null ? (
                <>
                  <span>{daysRemaining}</span>
                  <span style={{ fontSize: '1rem', fontWeight: '500' }}>
                    {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                  </span>
                </>
              ) : (
                <>
                  <span>—</span>
                  <span style={{ fontSize: '1rem', fontWeight: '500' }}>dias restantes</span>
                </>
              )}
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: textColor, marginBottom: '0.5rem' }}>
              {urgencyLevel}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>📅</span>
              <span>
                {daysRemaining !== null && daysRemaining < 0 ? 'Expirou em:' : 'Expira em:'} {expirationDate.toLocaleDateString('pt-BR', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', height: '0.25rem', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '0.125rem', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: textColor,
            width: daysRemaining === null ? '50%' : (
              daysRemaining < 0 ? '100%' : daysRemaining <= 7 ? '15%' : daysRemaining <= 30 ? '50%' : '85%'
            ),
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
    );
  })();



  return (
    <MainLayout>
      <div style={{ 
        padding: '2rem', 
        minHeight: '100vh',
        background: '#f8fafc'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>Configurações</h1>
          <p style={{
            color: '#374151',
            fontSize: '1.1rem',
            fontWeight: '500'
          }}>Gerencie suas preferências e configurações do sistema</p>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Sidebar */}
          <div style={{
            width: '280px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '1rem',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            height: 'fit-content'
          }}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '1rem'
            }}>Seções</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      backgroundColor: isActive ? '#3b82f6' : 'transparent',
                      color: isActive ? 'white' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Icon size={18} />
                    {section.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            {/* Loading State */}
            {loading && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '3rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }} />
                <div style={{ color: '#64748b' }}>Carregando informações do perfil...</div>
              </div>
            )}

            {/* Profile Section */}
            {!loading && activeSection === 'profile' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '3rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    background: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>Informações do Perfil</h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Atualize suas informações pessoais e de contato
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', maxWidth: '800px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Nome Completo</label>
                    <input
                      type="text"
                      value={profile.name}
                      readOnly
                      style={{
                        ...inputStyle,
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                      placeholder="Nome não pode ser alterado"
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>E-mail</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                      style={inputStyle}
                      placeholder="Digite seu e-mail"
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Telefone/WhatsApp</label>
                    <input
                      type="tel"
                      value={formatPhoneBrazil(profile.phone)}
                      onChange={(e) => {
                        const numbersOnly = e.target.value.replace(/\D/g, '');
                        setProfile(prev => ({ ...prev, phone: numbersOnly }));
                      }}
                      style={inputStyle}
                      placeholder="(11) 95886-2870"
                      maxLength={15}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Empresa</label>
                    <input
                      type="text"
                      value={profile.company}
                      readOnly
                      style={{
                        ...inputStyle,
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                      placeholder="Empresa não pode ser alterada"
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Tipo/Acesso</label>
                    <input
                      type="text"
                      value={profile.role}
                      readOnly
                      style={{
                        ...inputStyle,
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        cursor: 'not-allowed'
                      }}
                      placeholder="Tipo/Acesso não pode ser alterado"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSaveProfile}
                    style={buttonStyle}
                  >
                    <Save size={16} />
                    Salvar Perfil
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'password' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px -2px rgba(239, 68, 68, 0.3)'
                  }}>
                    <Lock style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>Alterar Senha</h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Mantenha sua conta segura com uma senha forte
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '3rem', alignItems: 'start' }}>
                  {/* Campos de Senha */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '350px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>Nova Senha</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                          style={{ ...inputStyle, paddingRight: '3rem' }}
                          placeholder="Digite sua nova senha (mínimo 8 caracteres)"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b'
                          }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      
                      {/* Barra de Força da Senha */}
                      {passwordData.newPassword && (() => {
                        const strength = getPasswordStrength(passwordData.newPassword);
                        return (
                          <div style={{ marginTop: '0.75rem' }}>
                            {/* Barra de progresso */}
                            <div style={{
                              width: '100%',
                              height: '0.5rem',
                              backgroundColor: '#e5e7eb',
                              borderRadius: '0.25rem',
                              overflow: 'hidden',
                              marginBottom: '0.5rem'
                            }}>
                              <div style={{
                                width: `${(strength.score / 5) * 100}%`,
                                height: '100%',
                                backgroundColor: strength.color,
                                transition: 'all 0.3s ease',
                                borderRadius: '0.25rem'
                              }}></div>
                            </div>
                            
                            {/* Label da força */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.75rem'
                            }}>
                              <span style={{ 
                                color: strength.color,
                                fontWeight: '600'
                              }}>
                                {strength.label}
                              </span>
                              <span style={{ color: '#64748b' }}>
                                {passwordData.newPassword.length}/8+ caracteres
                              </span>
                            </div>
                            
                            {/* Feedback de critérios faltantes */}
                            {strength.feedback.length > 0 && (
                              <div style={{
                                marginTop: '0.5rem',
                                fontSize: '0.75rem',
                                color: '#64748b'
                              }}>
                                Faltam: {strength.feedback.join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '0.5rem'
                      }}>Confirmar Nova Senha</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        style={inputStyle}
                        placeholder="Confirme sua nova senha"
                      />
                      
                      {/* Validação de confirmação */}
                      {passwordData.confirmPassword && passwordData.newPassword && (
                        <div style={{
                          marginTop: '0.5rem',
                          fontSize: '0.75rem',
                          color: passwordData.newPassword === passwordData.confirmPassword ? '#22c55e' : '#ef4444'
                        }}>
                          {passwordData.newPassword === passwordData.confirmPassword 
                            ? '✅ Senhas coincidem' 
                            : '❌ Senhas não coincidem'
                          }
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dicas de Senha */}
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: '0.5rem',
                    padding: '1.5rem',
                    fontSize: '0.875rem',
                    color: '#92400e',
                    height: 'fit-content'
                  }}>
                    <strong>Dicas para uma senha segura:</strong>
                    <ul style={{ marginTop: '0.75rem', paddingLeft: '1rem', lineHeight: '1.6' }}>
                      <li>Use pelo menos 8 caracteres</li>
                      <li>Combine letras maiúsculas e minúsculas</li>
                      <li>Inclua números e símbolos</li>
                      <li>Evite informações pessoais</li>
                    </ul>
                  </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleChangePassword}
                    style={{
                      ...buttonStyle,
                      backgroundColor: '#ef4444'
                    }}
                  >
                    <Lock size={16} />
                    Alterar Senha
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '3rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Carregando dados do perfil...</p>
              </div>
            )}

            {/* Profile Section */}
            {!loading && activeSection === 'profile' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px -2px rgba(239, 68, 68, 0.3)'
                  }}>
                    <Lock style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>Informações de Segurança</h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Mantenha sua conta segura com essas informações
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '350px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Último Acesso</label>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      {profile.lastAccess}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Último IP de Acesso</label>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      {profile.lastIpAccess}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: '#374151',
                      marginBottom: '0.5rem'
                    }}>Dispositivos Conectados</label>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      {profile.devicesConnected}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Seção de Plano com dados reais */}
            {activeSection === 'plan' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  <div style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CreditCard style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                  </div>
                  <div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#1e293b',
                      marginBottom: '0.25rem'
                    }}>
                      Informações do Plano
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Detalhes do seu plano atual
                    </p>
                  </div>
                </div>

                {planLoading && (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ color: '#64748b' }}>Carregando informações do plano...</div>
                  </div>
                )}
                {!planLoading && userPlan && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '1.5rem'
                  }}>
                    {/* Informações Básicas do Plano */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.05))',
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      border: '1px solid rgba(16, 185, 129, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '1rem'
                      }}>
                        Plano Atual
                      </h3>
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                          fontSize: '1.5rem',
                          fontWeight: 'bold',
                          color: '#10b981',
                          marginBottom: '0.25rem'
                        }}>
                          {userPlan.name}
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>
                          R$ {userPlan.price.toFixed(2).replace('.', ',')}
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#64748b'
                        }}>
                          por {userPlan.periodDays} dias
                        </div>
                      </div>
                      <div style={{
                        padding: '0.75rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '0.5rem',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                      }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: '#10b981'
                        }}>
                          Status: Ativo
                        </div>
                      </div>

                      {/* Dias Restantes do Plano - Versão Premium */}
                      {planStatusBlock}
                    </div>

                    {/* Recursos do Plano */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.05))',
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      border: '1px solid rgba(59, 130, 246, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#1e293b',
                        marginBottom: '1rem'
                      }}>
                        Recursos Inclusos
                      </h3>
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.75rem'
                        }}>
                          <Check style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                            Até {userPlan.maxAgents} agentes
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.75rem'
                        }}>
                          <Check style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                            Chamadas ilimitadas
                          </span>
                        </div>
                        {userPlan.features && userPlan.features.map((feature, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.75rem'
                          }}>
                            <Check style={{ width: '1rem', height: '1rem', color: '#10b981' }} />
                            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Descrição do Plano */}
                    {userPlan.description && (
                      <div style={{
                        gridColumn: '1 / -1',
                        background: 'linear-gradient(135deg, rgba(156, 163, 175, 0.05), rgba(107, 114, 128, 0.05))',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        border: '1px solid rgba(156, 163, 175, 0.1)'
                      }}>
                        <h3 style={{
                          fontSize: '1.125rem',
                          fontWeight: '600',
                          color: '#1e293b',
                          marginBottom: '1rem'
                        }}>
                          Descrição
                        </h3>
                        <p style={{
                          fontSize: '0.875rem',
                          color: '#374151',
                          lineHeight: '1.5'
                        }}>
                          {userPlan.description}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {!planLoading && !userPlan && (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    background: 'linear-gradient(135deg, rgba(245, 101, 101, 0.05), rgba(220, 38, 38, 0.05))',
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(245, 101, 101, 0.1)'
                  }}>
                    <div style={{ color: '#ef4444', marginBottom: '0.5rem' }}>⚠️</div>
                    <div style={{ color: '#374151', fontWeight: '500' }}>Nenhum plano encontrado</div>
                    <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Entre em contato com o suporte</div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'notifications' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '3rem', height: '3rem', borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Bell style={{ width: '1.5rem', height: '1.5rem', color: 'white' }} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.25rem' }}>Notificações</h2>
                      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Mensagens e avisos destinados a você</p>
                    </div>
                  </div>
                  <button onClick={refreshNotifications} style={{ ...buttonStyle, backgroundColor: '#f59e0b' }}>Atualizar</button>
                </div>

                {notifError && (
                  <div style={{
                    padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)',
                    background: 'rgba(239, 68, 68, 0.08)', color: '#b91c1c', marginBottom: '1rem'
                  }}>
                    {notifError}
                  </div>
                )}

                {notifLoading && myNotifications.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Carregando notificações...</div>
                )}

                {!notifLoading && myNotifications.length === 0 && !notifError && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nenhuma notificação.</div>
                )}

                {myNotifications.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {myNotifications.map((n) => {
                      const isRead = n.recipient_status === 'read';
                      const isDismissed = n.recipient_status === 'dismissed';
                      const borderColor = isDismissed ? '#e5e7eb' : isRead ? '#a7f3d0' : '#fde68a';
                      const bg = isDismissed ? 'rgba(229, 231, 235, 0.5)' : isRead ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)';
                      const badgeColor = isDismissed ? '#6b7280' : isRead ? '#10b981' : '#f59e0b';
                      const badgeText = isDismissed ? 'Dispensada' : isRead ? 'Lida' : 'Nova';
                      return (
                        <div key={n.id} style={{
                          border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1rem', background: bg
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span style={{
                                  padding: '0.125rem 0.5rem', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 700,
                                  background: badgeColor, color: 'white', letterSpacing: '0.03em'
                                }}>{badgeText}</span>
                                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{timeAgo(n.created_at)}</span>
                              </div>
                              <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>{n.title}</div>
                              <div style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.4 }}>{n.message}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <button
                                onClick={() => handleMarkRead(n.id)}
                                disabled={isRead || isDismissed}
                                style={{
                                  ...buttonStyle,
                                  backgroundColor: isRead ? '#9ca3af' : '#10b981',
                                  opacity: isRead || isDismissed ? 0.6 : 1,
                                  padding: '0.5rem 0.75rem'
                                }}
                              >
                                <Check size={16} /> Marcar lida
                              </button>
                              <button
                                onClick={() => handleDismiss(n.id)}
                                disabled={isDismissed}
                                style={{
                                  ...buttonStyle,
                                  backgroundColor: '#ef4444',
                                  opacity: isDismissed ? 0.6 : 1,
                                  padding: '0.5rem 0.75rem'
                                }}
                              >
                                <X size={16} /> Dispensar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  {notifHasMore && (
                    <button onClick={loadMoreNotifications} disabled={notifLoading} style={{ ...buttonStyle, backgroundColor: '#3b82f6' }}>
                      {notifLoading ? 'Carregando...' : 'Carregar mais'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                textAlign: 'center'
              }}>
                <Shield size={48} style={{ color: '#8b5cf6', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
                  Segurança
                </h2>
                <p style={{ color: '#64748b' }}>Seção em desenvolvimento</p>
              </div>
            )}

            {activeSection === 'system' && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '1rem',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                textAlign: 'center'
              }}>
                <Settings size={48} style={{ color: '#64748b', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem' }}>
                  Sistema
                </h2>
                <p style={{ color: '#64748b' }}>Seção em desenvolvimento</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
