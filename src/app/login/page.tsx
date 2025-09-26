'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import Script from 'next/script'
import { useAuthStore } from '@/store/auth';
import { agentAuthService } from '@/services/agentAuthService';
import { ToastProvider, useToast } from '@/components/ui/toast';
import AgentWelcomeLoader from '@/components/AgentWelcomeLoader';

function LoginContent() {
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loginMode, setLoginMode] = useState('email'); // 'email' or 'agent'
  const [email, setEmail] = useState('');
  const [agentId, setAgentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // signup states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [referral, setReferral] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [cpfCnpjError, setCpfCnpjError] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState('');
  const [isAgent, setIsAgent] = useState(false);
  const [showAgentLoader, setShowAgentLoader] = useState(false);
  const [countdown, setCountdown] = useState(7);
  const [emailPlanExpiredAt, setEmailPlanExpiredAt] = useState<string | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  
  // SMS Validation states
  useEffect(() => {
    const id = requestAnimationFrame(() => setUiReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const [smsStep, setSmsStep] = useState<'phone' | 'code' | 'verified'>('phone');
  const [smsCode, setSmsCode] = useState('');
  const [smsCodeSent, setSmsCodeSent] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  
  // New UX features states
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const cpfInputRef = useRef<HTMLInputElement | null>(null);
  
  const router = useRouter();
  const { login, register, logout } = useAuthStore();
  const toast = useToast();

  // Agent ramal pre-validation state
  const [ramalStatus, setRamalStatus] = useState<{
    loading: boolean;
    owner_status?: string;
    agent_blocked?: boolean;
    owner_name?: string;
    message?: string;
    owner_plan_status?: boolean | null;
    owner_plan_expires_at?: string | null;
    owner_plan_expired?: boolean | null;
  }>({ loading: false });

  // Load saved credentials on component mount
  useEffect(() => {
    try {
      const savedCredentials = localStorage.getItem('saved_credentials');
      const savedPreferences = localStorage.getItem('login_preferences');
      
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        if (credentials.email) {
          setEmail(credentials.email);
          setLoginMode('email');
        } else if (credentials.ramal) {
          setAgentId(credentials.ramal);
          setLoginMode('agent');
        }
        setSaveCredentials(true);
      }
      
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        setSaveCredentials(preferences.saveCredentials || false);
        setKeepLoggedIn(preferences.keepLoggedIn || false);
      }
    } catch (error) {
      console.warn('Erro ao carregar credenciais salvas:', error);
    }
  }, []);

  // Save credentials helper
  const saveCredentialsToStorage = useCallback((email?: string, ramal?: string) => {
    if (saveCredentials) {
      const credentials = email ? { email } : { ramal };
      localStorage.setItem('saved_credentials', JSON.stringify(credentials));
    } else {
      localStorage.removeItem('saved_credentials');
    }
    
    // Save preferences
    const preferences = { saveCredentials, keepLoggedIn };
    localStorage.setItem('login_preferences', JSON.stringify(preferences));
  }, [saveCredentials, keepLoggedIn]);

  // Helper: reset forms and transient messages when switching between login modes
  const resetAuthUI = useCallback(() => {
    try {
      setError(null as any);
      setEmailError('');
      setCpfCnpjError('');
      setIsLoading(false);
      // Don't reset email/agentId if saveCredentials is enabled
      if (!saveCredentials) {
        setAgentId('');
        setEmail('');
      }
      setPassword('');
      setShowAgentLoader(false);
      setRamalStatus({ loading: false });
    } catch {}
  }, [saveCredentials]);

  const checkUserDashboardReady = async (userRole: string) => {
    try {
      // Verificar se o dashboard está pronto fazendo uma requisição de teste
      const token = localStorage.getItem('token');
      if (token) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        console.log('🔗 [login/page.tsx] Auth check:', {
          url: apiUrl,
          source: process.env.NEXT_PUBLIC_API_URL ? '✅ env var' : '⚠️  fallback'
        });
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          // Redirecionar imediatamente, mantendo o overlay até a navegação ocorrer
          if (userRole === 'reseller') router.push('/reseller/dashboard');
          else router.push('/dashboard');
        } else {
          // Fallback: redirecionar mesmo se a verificação falhar
          if (userRole === 'reseller') router.push('/reseller/dashboard');
          else router.push('/dashboard');
        }
      } else {
        // Fallback: redirecionar mesmo sem token
        if (userRole === 'reseller') router.push('/reseller/dashboard');
        else router.push('/dashboard');
      }
    } catch (error) {
      console.error('Erro ao verificar dashboard:', error);
      // Fallback: redirecionar em caso de erro
      if (userRole === 'reseller') router.push('/reseller/dashboard');
      else router.push('/dashboard');
    }
  };

  // helpers: formatters and validators (memoizados)
  const simpleEmailValid = useCallback((value: string) => value.includes('@') && value.includes('.'), []);
  
  const formatBRPhone = useCallback((v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (m, a, b, c) => [
          a ? `(${a}` : '',
          a && a.length === 2 ? ') ' : '',
          b,
          c ? `-${c}` : ''
        ].join(''))
        .replace(/\(\) /, '');
    }
    return digits
      .replace(/(\d{0,2})(\d{0,5})(\d{0,4}).*/, (m, a, b, c) => [
        a ? `(${a}` : '',
        a && a.length === 2 ? ') ' : '',
        b,
        c ? `-${c}` : ''
      ].join(''))
      .replace(/\(\) /, '');
  }, []);

  // Debounced check for agent ramal status (owner suspension and ramal bloqueio)
  useEffect(() => {
    let alive = true;
    if (authTab !== 'login' || loginMode !== 'agent') return;
    const ramal = agentId?.trim();
    if (!ramal) {
      setRamalStatus({ loading: false });
      return;
    }
    setRamalStatus((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/agent-auth/ramal-status?ramal=${encodeURIComponent(ramal)}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (data?.success && data?.data) {
          const { owner_status, agent_blocked, owner_name, owner_plan_status, owner_plan_expires_at, owner_plan_expired } = data.data as any;
          const msg = owner_status === 'suspended'
            ? 'Conta suspensa do proprietário'
            : (owner_status === 'inactive' || !owner_status)
              ? 'Conta do proprietário inativa. Entre em contato com o suporte.'
              : (owner_plan_status === false || owner_plan_expired)
                ? 'Plano do proprietário expirado ou inativo. Entre em contato com o suporte.'
                : agent_blocked
                  ? 'Ramal bloqueado. Entre em contato com o administrador.'
                  : undefined;
          setRamalStatus({ loading: false, owner_status, agent_blocked, owner_name, message: msg, owner_plan_status, owner_plan_expires_at, owner_plan_expired });
        } else {
          setRamalStatus({ loading: false });
        }
      } catch {
        if (!alive) return;
        setRamalStatus({ loading: false });
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [agentId, authTab, loginMode]);

  // Ensure the effect runs only after the signup form is mounted
  useEffect(() => {
    if (authTab !== 'signup') return;
    const el = formTopRef.current;
    if (!el) return;
    // scroll and highlight
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('pulse-focus');
    const t = setTimeout(() => el.classList.remove('pulse-focus'), 800);
    return () => clearTimeout(t);
  }, [authTab]);
  // no-op: referral UI removido por solicitação
  const formatCpfCnpj = useCallback((v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }, []);

  // Fixed handlers to avoid inline useCallback
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatBRPhone(e.target.value));
  }, [formatBRPhone]);

  const handleCpfCnpjChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfCnpj(formatCpfCnpj(e.target.value));
    if (cpfCnpjError) setCpfCnpjError('');
  }, [formatCpfCnpj, cpfCnpjError]);

  // SMS Validation handlers
  const sendSmsCode = useCallback(async () => {
    const digits = phone.replace(/\D/g, '');
    if (!phone || digits.length < 8) {
      setError('Por favor, informe um número de telefone válido.');
      return;
    }

    setSmsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (data.success) {
        setSmsCodeSent(true);
        setSmsStep('code');
        setSmsCountdown(60);
        
        // Countdown timer
        const timer = setInterval(() => {
          setSmsCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        toast.success('Código SMS enviado!', `Verifique seu telefone ${data.phone}`);
      } else {
        setError(data.error || 'Erro ao enviar código SMS. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao enviar SMS:', err);
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSmsLoading(false);
    }
  }, [phone, toast]);

  const verifySmsCode = useCallback(async () => {
    if (!smsCode || smsCode.length !== 6) {
      setError('Por favor, informe o código de 6 dígitos.');
      return;
    }

    setSmsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/sms/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code: smsCode }),
      });

      const data = await response.json();

      if (data.success) {
        setPhoneVerified(true);
        setSmsStep('verified');
        toast.success('Telefone verificado!', 'Número móvel confirmado com sucesso.');
      } else {
        setError(data.error || 'Código inválido. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao verificar SMS:', err);
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSmsLoading(false);
    }
  }, [phone, smsCode, toast]);

  const resetSmsValidation = useCallback(() => {
    setSmsStep('phone');
    setSmsCode('');
    setSmsCodeSent(false);
    setPhoneVerified(false);
    setSmsCountdown(0);
  }, []);

  // Return to phone editing and focus the input
  const correctPhoneNumber = useCallback(() => {
    resetSmsValidation();
    setTimeout(() => phoneInputRef.current?.focus(), 0);
  }, [resetSmsValidation]);

  // Computed value for signup button state
  const isSignupButtonDisabled = useMemo(() => {
    if (authTab !== 'signup') return false;
    return isLoading || !termsAccepted || !phoneVerified;
  }, [authTab, isLoading, termsAccepted, phoneVerified]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setEmailError('');
    setCpfCnpjError('');

    try {
      if (authTab === 'login') {
        if (loginMode === 'agent') {
          // Agent authentication
          if (!agentId || !password) {
            setError('Por favor, informe o ramal e senha.');
            setIsLoading(false);
            return;
          }

          // Block submission if pre-check indicates suspended/inactive/blocked
          if (ramalStatus?.owner_status === 'suspended') {
            setError('suspended');
            setIsLoading(false);
            return;
          }
          if (!ramalStatus.loading && (ramalStatus?.owner_status === 'inactive' || !ramalStatus?.owner_status)) {
            if (ramalStatus?.owner_status !== undefined) {
              setError('⚠️ Usuário Inativo\n\nSua conta está inativa.\nEntre em contato com o suporte para mais informações.');
              setIsLoading(false);
              return;
            }
          }
          if (ramalStatus?.agent_blocked) {
            setError('🚫 Ramal Bloqueado\n\nSeu ramal foi bloqueado temporariamente.\nEntre em contato com o administrador.');
            setIsLoading(false);
            return;
          }
          // Bloquear se plano do proprietário expirado/inativo
          if (!ramalStatus.loading && ((ramalStatus as any)?.owner_plan_status === false || (ramalStatus as any)?.owner_plan_expired)) {
            setError('⚠️ Plano Expirado\n\nO plano do proprietário está expirado ou inativo. Entre em contato com o suporte.');
            setIsLoading(false);
            return;
          }

          const result = await agentAuthService.login({
            ramal: agentId,
            senha: password
          });

          if (result.success && result.data) {
            // Save credentials if enabled
            saveCredentialsToStorage(undefined, agentId);
            
            // Mostrar loader do agente
            setWelcomeUser(result.data.agent.agente_name);
            setShowAgentLoader(true);
            // O redirecionamento será feito pelo AgentWelcomeLoader após 5 segundos
          } else {
            if (result.message?.includes('bloqueado')) {
              setError('🚫 Ramal Bloqueado\n\nSeu ramal foi bloqueado temporariamente.\nEntre em contato com o administrador.');
            } else if (result.message?.includes('inativo')) {
              setError('⚠️ Usuário Inativo\n\nSua conta está inativa.\nEntre em contato com o suporte para mais informações.');
            } else if (result.message?.includes('suspensa')) {
              setError('suspended');
            } else {
              setError(result.message || 'Ramal ou senha inválidos');
            }
          }
        } else {
          // Regular user authentication
          if (!simpleEmailValid(email)) {
            setError('Por favor, insira um e-mail válido (ex: usuario@dominio.com).');
            setIsLoading(false);
            return;
          }

          const result = await login(email, password);
          if (result.success && result.user) {
            // Plano: bloquear login quando plano expirado/inativo
            try {
              const u: any = result.user as any;
              const expiresAt = u.planExpiresAt || u.plan_expires_at || null;
              const statusField = (typeof u.planStatus !== 'undefined') ? u.planStatus : u.plan_status;
              const expiredByDate = expiresAt ? (new Date(expiresAt).getTime() <= Date.now()) : false;
              const isExpired = (statusField === false) || expiredByDate;
              if (isExpired) {
                setEmailPlanExpiredAt(expiresAt);
                setError('plan_expired');
                try { await logout(); } catch {}
                setIsLoading(false);
                return;
              }
            } catch {}
            // Save credentials if enabled
            saveCredentialsToStorage(email, undefined);
            
            // Mostrar efeito de boas-vindas
            setWelcomeUser(result.user.name || result.user.email);
            setIsAgent(false);
            setShowWelcome(true);
            setCountdown(7);
            
            // Contador regressivo
            const countdownInterval = setInterval(() => {
              setCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  // Iniciar verificação imediatamente mantendo overlay visível
                  checkUserDashboardReady(result.user?.role || 'user');
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          } else {
            if (result.message?.includes('suspenso')) {
              setError('suspended');
            } else if (result.message?.includes('inativa')) {
              setError('⚠️ Conta Inativa\n\nSua conta está inativa.\nEntre em contato com o suporte para mais informações.');
            } else {
              setError(result.message || 'Email ou senha inválidos');
            }
          }
        }
      } else {
        // signup validation
        if (!name.trim()) {
          setError('Por favor, informe seu nome.');
          setIsLoading(false);
          return;
        }
        if (!simpleEmailValid(email)) {
          setError('Informe um e-mail válido para cadastro.');
          setIsLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('A senha deve ter no mínimo 8 caracteres.');
          setIsLoading(false);
          return;
        }
        if (!/[A-Za-z]/.test(password)) {
          setError('A senha deve conter pelo menos uma letra.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('As senhas não conferem.');
          setIsLoading(false);
          return;
        }
        if (!termsAccepted) {
          setError('Você precisa aceitar os Termos de Serviço para continuar.');
          setIsLoading(false);
          return;
        }
        if (!phoneVerified) {
          setError('Por favor, verifique seu número de telefone antes de continuar.');
          setIsLoading(false);
          return;
        }

        const result = await register({ name, email, password, phone, cpfCnpj, referral, termsAccepted });
        if (result.success && result.user) {
          toast.success('Conta criada com sucesso!', 'Redirecionando para o painel...');
          if (result.user.role === 'reseller') router.push('/reseller/dashboard');
          else router.push('/dashboard');
        } else {
          const msg = (result.message || '').toLowerCase();
          // Detectar conflitos específicos
          if (msg.includes('cpf') || msg.includes('cnpj')) {
            setCpfCnpjError('Este CPF/CNPJ já está cadastrado.');
            setError('');
            // Focar no campo CPF/CNPJ
            setTimeout(() => cpfInputRef.current?.focus(), 0);
          } else if (msg.includes('e-mail') || msg.includes('email')) {
            setEmailError('Este e-mail já está cadastrado.');
            setError('');
            // Focar no campo e-mail
            setTimeout(() => emailInputRef.current?.focus(), 0);
          } else {
            setError(result.message || 'Não foi possível criar a conta');
          }
        }
      }
    } catch (err) {
      setError(authTab === 'login' ? 'Erro ao fazer login. Tente novamente.' : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [authTab, loginMode, agentId, password, email, name, phone, cpfCnpj, referral, termsAccepted, confirmPassword, simpleEmailValid, login, register, router, toast]);

  const promoItems = useMemo(() => [
    { text: 'Troncos SIP ilimitados. Escale suas operações sem limites.', img: '/img/login-illustrations/conta-sip-ilimitada.svg' },
    { text: 'Rotas premium com baixa latência. Voz clara de ponta a ponta.', img: '/img/login-illustrations/rotas-premium.svg' },
    { text: 'Antispam inteligente. Bloqueie robocalls e priorize o que importa.', img: '/img/login-illustrations/anti-spam.svg' },
    { text: 'PABX em nuvem. Ramais, filas e URA sob seu controle.', img: '/img/login-illustrations/pabx-em-nuvem.svg' },
    { text: 'Telefonia ilimitada para alta demanda. Performance sem gargalos.', img: '/img/login-illustrations/telefonia-ilimitada.svg' },
    { text: 'Qualidade HD+ com QoS. Menos jitter, mais negócios.', img: '/img/login-illustrations/voz-hd-plus.svg' },
    { text: 'Troncos potentes para grandes volumes. Confiabilidade 24/7.', img: '/img/login-illustrations/troncos-potentes.svg' },
  ] as const, []);

  const [tagIndex, setTagIndex] = useState(0);
  useEffect(() => {
    if (!uiReady) return;
    const start = Math.floor(Math.random() * promoItems.length);
    setTagIndex(start);
    const id = setInterval(() => {
      setTagIndex((i) => (i + 1) % promoItems.length);
    }, 12000);
    return () => clearInterval(id);
  }, [promoItems.length, uiReady]);

  return (
    <>
      {/* Loader do Agente */}
      {showAgentLoader && (
        <AgentWelcomeLoader 
          agentName={welcomeUser}
          onPageLoaded={() => setShowAgentLoader(false)}
        />
      )}

      {/* Tela de Boas-vindas para Usuários */}
      {showWelcome && !isAgent && (
        <div className={`welcome-overlay ${isFadingOut ? 'fade-out' : ''}`}>
          <div className="welcome-content">
            <div className="soundwave-container">
              <div className="soundwave-line">
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
                <div className="wave-segment"></div>
              </div>
            </div>
            <div className="welcome-text">
              <h1>👋 Olá, {welcomeUser.split(' ')[0]}! Seja muito bem-vindo ao Melhor PABX 🎉</h1>
              <p>⏳ Aguarde um instante, estamos preparando o seu ambiente de trabalho...</p>
              <div className="countdown">{countdown}</div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Styles - ClaimColony Inspired Design */}
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        :global(html, body, #__next) { margin: 0; padding: 0; height: 100%; width:100%; }
        :global(body) { background: #e6f1ff; }
        :root {
          --primary-500: #3b82f6;
          --primary-600: #2563eb;
          --accent-500: #06b6d4;
          --muted-500: #64748b;
          --text-strong: #0f172a;
          --surface: #ffffff;
          --radius-lg: 14px;
          --shadow-sm: 0 2px 8px rgba(2,8,23,0.05);
          --duration-sm: 180ms;
          --duration-md: 260ms;
          --duration-lg: 420ms;
          --ease: cubic-bezier(0.22, 1, 0.36, 1);
          --divider-width: 80px;
          --divider-overlap: 28px;
        }
        .login-container {
          display: flex;
          min-height: 100dvh;
          width: 100vw;
          background: #ffffff;
          color: #0f172a;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol;
          -webkit-tap-highlight-color: transparent;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          contain: layout paint;
        }

        /* Right art panel (order 2) */
        .art-side {
          order: 2;
          flex: 0 0 52%;
          min-height: 100%;
          background: radial-gradient(900px 700px at 70% 30%, rgba(59,130,246,.15), rgba(59,130,246,0)) ,
                      linear-gradient(180deg, #e6f1ff 0%, #e7f1ff 40%, #e6f1ff 100%);
          position: relative;
          overflow: hidden;
          /* Smoothly fade the left edge into the white container background to avoid a hard seam */
          -webkit-mask-image: linear-gradient(90deg,
            rgba(0,0,0,0) 0px,
            rgba(0,0,0,0.04) 24px,
            rgba(0,0,0,0.14) 80px,
            rgba(0,0,0,0.35) 160px,
            rgba(0,0,0,0.65) 260px,
            #000 340px
          );
          mask-image: linear-gradient(90deg,
            rgba(0,0,0,0) 0px,
            rgba(0,0,0,0.04) 24px,
            rgba(0,0,0,0.14) 80px,
            rgba(0,0,0,0.35) 160px,
            rgba(0,0,0,0.65) 260px,
            #000 340px
          );
          will-change: -webkit-mask-image, mask-image;
        }

        /* Fog-like divider between art-side and white form-side (dual layer) */
        .art-side::before,
        .art-side::after {
          display: none;
        }

        /* Soft divider pseudo-elements removed in favor of a mask-based fade */

        /* Gate visibility to when UI is ready */
        /* no-op: divider disabled */

        /* Disable divider on stacked mobile layout */
        @media (max-width: 900px) {
          .art-side { -webkit-mask-image: none; mask-image: none; }
        }

        /* brand removed per request */

        /* Horizontal soundwave */
        .soundwave { position:absolute; left: -10%; right: -10%; top: 54%; height: 160px; pointer-events:none; opacity:.35; overflow: hidden; }
        .soundwave svg { width: 100%; height: 100%; display:block; filter: drop-shadow(0 8px 18px rgba(2,8,23,.08)); }
        /* sweeping element goes beyond container width and moves horizontally */
        .soundwave .sweep { position:absolute; inset: 0; width: 160%; height: 100%; transform: translateX(-22%); animation: sweepX 18s var(--ease) infinite alternate; animation-play-state: paused; }
        .login-container[data-ready="true"] .soundwave .sweep { animation-play-state: running; }
        .soundwave path { fill: none; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 8 14; stroke-dashoffset: 0; animation: waveDash 12s linear infinite; animation-play-state: paused; }
        .soundwave path.alt { opacity:.6; stroke-width: 2; stroke-dasharray: 10 18; animation-duration: 14s; }
        .login-container[data-ready="true"] .soundwave path { animation-play-state: running; }
        @keyframes waveDash { 0% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -800 } }
        @keyframes sweepX { 0% { transform: translateX(-22%) } 100% { transform: translateX(22%) } }

        /* Hero image removed per request */

        /* Mesh gradient layer */
        .mesh { position:absolute; inset:-10%; pointer-events:none; mix-blend: screen; opacity: .7; }
        .mesh::before, .mesh::after { content:''; position:absolute; border-radius: 50%; filter: blur(60px); animation-play-state: paused; }
        .mesh::before { width: 520px; height: 520px; left: -6%; top: 10%; background: radial-gradient(circle at 30% 30%, rgba(14,165,233,.55), rgba(14,165,233,0)); animation: drift 26s ease-in-out infinite; }
        .mesh::after { width: 600px; height: 600px; right: -8%; top: 18%; background: radial-gradient(circle at 70% 70%, rgba(29,78,216,.55), rgba(29,78,216,0)); animation: drift 32s ease-in-out infinite reverse; }
        @keyframes drift { 0%,100% { transform: translate3d(0,0,0)} 50% { transform: translate3d(0,-12px,0)} }
        .login-container[data-ready="true"] .mesh::before,
        .login-container[data-ready="true"] .mesh::after { animation-play-state: running; }

        /* Subtle grid overlay */
        .grid { position:absolute; inset:-20% -10% -10% -10%; background:
          linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,0)),
          repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 1px, transparent 1px, transparent 32px),
          repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 1px, transparent 1px, transparent 32px);
          /* removed mask-image to avoid faded edge that may look like a border */
          opacity: .28; transform: rotate(-1.5deg) translateY(-2%); will-change: transform; animation: gridFloat 24s ease-in-out infinite; animation-play-state: paused;
        }
        @keyframes gridFloat { 0%,100% { transform: rotate(-1.5deg) translateY(-2%)} 50% { transform: rotate(-1.5deg) translateY(0)} }
        .login-container[data-ready="true"] .grid { animation-play-state: running; }

        /* Grain */
        .grain { position:absolute; inset:0; pointer-events:none; opacity:.06; mix-blend-mode: overlay; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.6"/></svg>'); background-size: 300px 300px; }

        /* Taglines (text only) */
        .tagline-wrap { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; padding: 0 6%; }
        .tagline-block { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; max-width: 980px; width: 100%; text-align:center; opacity: 0; transform: translateY(6px); transition: opacity var(--duration-lg) var(--ease), transform var(--duration-lg) var(--ease); }
        .login-container[data-ready="true"] .tagline-block { opacity: 1; transform: none; transition-delay: 80ms; }
        .tagline { font-weight: 700; font-size: clamp(22px, 4vw, 48px); line-height: 1.16; letter-spacing: -.08px; background: linear-gradient(180deg, #2563eb 0%, #60a5fa 100%); -webkit-background-clip: text; background-clip: text; color: transparent; animation: textSwitch 12s ease-in-out both; animation-play-state: paused; will-change: opacity, transform, filter, letter-spacing, background-position; }
        .login-container[data-ready="true"] .tagline { animation-play-state: running; }
        @keyframes textSwitch {
          0%   { opacity: 0; transform: translateY(4px) scale(.992); filter: blur(2px); letter-spacing: -.2px; }
          6%   { opacity: 1; transform: translateY(0) scale(1);   filter: blur(0);   letter-spacing: -.08px; }
          94%  { opacity: 1; transform: translateY(0) scale(1);   filter: blur(0);   letter-spacing: -.08px; }
          100% { opacity: 0; transform: translateY(-4px) scale(.994); filter: blur(2px); letter-spacing: -.18px; }
        }

        /* Abstract light blobs (VOIP vibe) */
        .blob { position: absolute; filter: blur(60px); opacity: .6; will-change: transform; }
        .blob.a { width: 560px; height: 560px; background: radial-gradient(circle at 30% 30%, rgba(56, 189, 248, .55), rgba(56, 189, 248, 0)); top: -120px; left: -80px; animation: blob 22s ease-in-out infinite; }
        .blob.b { width: 520px; height: 520px; background: radial-gradient(circle at 70% 70%, rgba(45, 212, 191, .5), rgba(45, 212, 191, 0)); bottom: -140px; left: 10%; animation: blob 28s ease-in-out infinite reverse; }
        .blob.c { width: 460px; height: 460px; background: radial-gradient(circle at 50% 50%, rgba(129, 140, 248, .45), rgba(129, 140, 248, 0)); top: 20%; right: -120px; animation: blob 26s ease-in-out infinite; }
        @keyframes blob { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(0,-20px,0) scale(1.05); } }

        /* Left form panel (order 1) */
        .form-side {
          order: 1;
          flex: 1;
          min-height: 100%;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity var(--duration-md) var(--ease), transform var(--duration-md) var(--ease);
        }
        .login-container[data-ready="true"] .form-side { opacity: 1; transform: none; }

        .form-wrap { width: 100%; max-width: 600px; }
        .logo { display:flex; align-items:center; gap:12px; margin-bottom: 20px; justify-content: center; }
        .logo-mark { height: 280px; width: auto; display:block; max-width: 100%; object-fit: contain; image-rendering: -webkit-optimize-contrast; }
        .logo-name { display: none; }
        .form-head { color: #0b1220; margin-bottom: 18px; }
        .form-head h2 { font-size: 36px; font-weight: 800; margin-bottom: 6px; letter-spacing: -.2px; }
        .form-head p { color: #6b7280; font-size: 14px; }
        .tabs { display:flex; background:#f3f4f6; border-radius: 14px; padding: 4px; width: fit-content; gap:4px; margin: 18px 0 22px; }
        .tab { height:38px; padding:0 16px; border-radius: 12px; background: transparent; border:0; font-weight:700; color:#6b7280; cursor:pointer; }
        
        /* Login Options Checkboxes - Bem distribuído e responsivo */
        .login-options {
          margin: 20px 0 24px 0;
          padding: 18px;
          background: rgba(249, 250, 251, 0.8);
          border-radius: 12px;
          border: 1px solid rgba(229, 231, 235, 0.6);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        
        .checkbox-group {
          margin-bottom: 18px;
        }
        
        .checkbox-group:last-child {
          margin-bottom: 0;
        }
        
        .checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          user-select: none;
          padding: 4px 0;
          transition: all 0.2s ease;
        }
        
        .checkbox-label:hover {
          transform: translateX(1px);
        }
        
        .checkbox-input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }
        
        .checkbox-custom {
          width: 20px;
          height: 20px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
          margin-top: 2px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .checkbox-input:checked + .checkbox-custom {
          background: #2563eb;
          border-color: #2563eb;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
        }
        
        .checkbox-input:checked + .checkbox-custom::after {
          content: '✓';
          color: white;
          font-size: 13px;
          font-weight: bold;
        }
        
        .checkbox-custom:hover {
          border-color: #2563eb;
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        }
        
        .checkbox-text {
          font-weight: 600;
          color: #374151;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .checkbox-description {
          color: #6b7280;
          font-size: 12px;
          margin: 4px 0 0 32px;
          line-height: 1.4;
          font-weight: 400;
        }
        .tab.active { background:#ffffff; color:#0b1220; box-shadow: 0 1px 2px rgba(2,8,23,0.06), 0 0 0 1px rgba(2,8,23,0.04) inset; }

        .login-form { width: 100%; }
        .form-group { margin-bottom: 16px; }
        .form-label-group { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .form-label { display: block; font-size: 13px; font-weight: 700; color: #334155; }
        .form-group .form-label { margin-bottom: 8px; }
        .switch-login-btn { background: none; border: 0; font-size: 12px; font-weight: 700; color: #1d4ed8; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: background .2s; }
        .switch-login-btn:hover { background: rgba(29, 78, 216, 0.1); }
        .form-input { width: 100%; height: 52px; border: 0; background: #ffffff; border-radius: 14px; padding: 0 14px 0 44px; font-size: 15px; color: #0f172a; outline: none; transition: box-shadow .2s, background .2s; box-shadow: 0 2px 8px rgba(2,8,23,0.05); }
        .form-input::placeholder { color: #94a3b8; opacity: .9; }
        .form-input:focus { box-shadow: 0 0 0 4px rgba(34,211,238,.20), 0 2px 8px rgba(2,8,23,0.05); background: #ffffff; }
        .form-input:focus-visible { outline: 2px solid var(--primary-500); outline-offset: 2px; }
        .password-wrapper { position: relative; }
        .icon-left { position:absolute; left:14px; top:50%; transform:translateY(-50%); width:20px; height:20px; color:#94a3b8 }
        .password-input { padding-right: 44px; }
        .password-toggle { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:0; color:#64748b; cursor:pointer; padding:6px; border-radius:10px; }
        .password-toggle:hover { color:#0f172a }
        .strength { height: 6px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin-top: 8px; }
        .strength span { display:block; height:100%; background: linear-gradient(90deg,#34d399,#60a5fa); transition: width .25s ease; }

        /* Login options: side-by-side compact layout */
        .login-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 16px;
          align-items: start;
          margin: 6px 0 10px;
        }
        .checkbox-group { min-width: 0; }
        .checkbox-label { display: flex; align-items: center; gap: 10px; }
        .checkbox-text { font-size: 14px; line-height: 1.3; }
        .checkbox-description { margin: 3px 0 0 32px; font-size: 12px; color: #6b7280; }
        @media (max-width: 720px) { .login-options { grid-template-columns: 1fr; } }

        /* modern signup layout - Bem distribuído */
        .card { background:#fff; border:1px solid rgba(2,8,23,.06); border-radius:16px; padding:18px; box-shadow: 0 8px 24px -16px rgba(2,8,23,.2); margin-bottom:18px; }
        .card h3 { font-size:14px; color:#0b1220; margin-bottom:12px; letter-spacing:.1px; font-weight: 700; }
        .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
        .grid-1 { display:grid; grid-template-columns: 1fr; gap:14px; }
        @media (max-width: 640px){ .grid-2 { grid-template-columns: 1fr } }

        /* Sticky mobile submit bar so user doesn't need to scroll */
        .sticky-actions { position: fixed; left: 0; right: 0; bottom: 0; padding: 10px 14px; background: linear-gradient(180deg, rgba(255,255,255,.4), rgba(255,255,255,.9)); backdrop-filter: blur(10px); border-top: 1px solid rgba(2,8,23,.06); z-index: 50; display:none; }
        .sticky-actions .login-button { height: 48px; border-radius: 12px; }
        @media (max-width: 1024px) { .sticky-actions { display:block } }
        
        /* SMS Validation Styles */
        .sms-validation { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 8px; background: #fafbfc; }
        .sms-validation.verified { border-color: #10b981; background: #f0fdf4; }
        .sms-validation.error { border-color: #ef4444; background: #fef2f2; }
        
        .sms-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .sms-header .icon { width: 20px; height: 20px; }
        .sms-header .icon.success { color: #10b981; }
        .sms-header .icon.pending { color: #f59e0b; }
        .sms-header .title { font-size: 14px; font-weight: 600; color: #374151; }
        
        .sms-content { display: flex; flex-direction: column; gap: 12px; }
        .sms-input-group { display: flex; gap: 8px; align-items: center; }
        .sms-code-input { flex: 1; height: 44px; border: 1px solid #d1d5db; border-radius: 8px; padding: 0 12px; font-size: 16px; text-align: center; letter-spacing: 2px; font-family: monospace; }
        .sms-code-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        
        .sms-button { height: 44px; padding: 0 16px; border: 0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .sms-button.primary { background: #3b82f6; color: white; }
        .sms-button.primary:hover:not(:disabled) { background: #2563eb; }
        .sms-button.secondary { background: #f3f4f6; color: #6b7280; }
        .sms-button.secondary:hover:not(:disabled) { background: #e5e7eb; }
        .sms-button:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .sms-status { font-size: 13px; color: #6b7280; display: flex; align-items: center; gap: 6px; }
        .sms-status.success { color: #10b981; }
        .sms-status.error { color: #ef4444; }
        
        .sms-countdown { font-size: 13px; color: #f59e0b; font-weight: 600; }
        
        .phone-input-wrapper { position: relative; }
        .phone-verify-btn { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); height: 48px; padding: 0 16px; background: #3b82f6; color: white; border: 0; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .phone-verify-btn:hover:not(:disabled) { background: #2563eb; }
        .phone-verify-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .phone-verify-btn.verified { background: #10b981; }
        .phone-input-wrapper { transition: opacity .25s ease, transform .25s ease; }
        .phone-input-wrapper.dimmed { opacity: .5; transform: scale(.995); pointer-events: none; }
        .sms-validation { transition: opacity .28s ease, transform .28s ease; }
        .sms-validation.enter { opacity: 1; transform: translateY(0); }
        .sms-validation { opacity: 0.999; transform: translateY(0); }
        
        @media (max-width: 640px) {
          .logo-mark { height: 160px; max-width: 100%; }
          .sms-input-group { flex-direction: column; }
          .sms-code-input { width: 100%; }
          .phone-verify-btn { position: static; transform: none; width: 100%; margin-top: 8px; }
        }

        .row { display:flex; align-items:center; justify-content:space-between; margin: 10px 0 16px; }
        .checkbox { display:flex; align-items:center; gap:8px; font-size: 13px; color:#334155; }
        .checkbox input { width:16px; height:16px; border:0; background: #ffffff; border-radius:4px; accent-color: #06b6d4; }
        .link { color:#0891b2; text-decoration:none; font-size:13px; font-weight:700; }
        .link:hover { text-decoration:underline; }

        /* pulse focus effect for smooth guidance to signup form */
        .pulse-focus { box-shadow: 0 0 0 0 rgba(34,211,238,0.6); animation: pulseFocus 0.7s ease-out 1; border-radius: 14px; }
        @keyframes pulseFocus { from { box-shadow: 0 0 0 0 rgba(34,211,238,0.6) } to { box-shadow: 0 0 0 10px rgba(34,211,238,0) } }

        .login-button { width:100%; height:52px; background: #1d4ed8; color:#ffffff; border:0; border-radius:14px; font-weight:800; letter-spacing:.2px; cursor:pointer; box-shadow: 0 16px 36px -16px rgba(29,78,216,.5); transition: transform .15s, box-shadow .2s, opacity .2s; display:flex; align-items:center; justify-content:center; gap:10px; }
        .login-button:focus-visible { outline: 2px solid var(--primary-500); outline-offset: 2px; }
        .login-button:hover { transform: translateY(-1px); box-shadow: 0 24px 40px -16px rgba(14,165,233,.6), 0 16px 32px -16px rgba(6,182,212,.55) }
        .login-button:disabled { opacity:.4; cursor:not-allowed; transform:none; box-shadow: none; }
        .login-button:disabled:hover { transform:none; box-shadow: none; }

        .error-message { background: #fff7ed; color: #9a3412; border: 0; border-radius: 10px; padding: 10px 12px; font-size: 13px; line-height: 1.35; white-space: pre-line; margin: 8px 0 12px; }

        .social { display:flex; align-items:center; gap:14px; margin:16px 0 10px }
        .social-btn { width:44px; height:44px; border-radius: 999px; border:1px solid rgba(2,8,23,.08); display:flex; align-items:center; justify-content:center; background:#fff; cursor:pointer }
        .social-sep { text-align:center; color:#6b7280; font-size:12px; margin:14px 0 }
        .foot { margin-top: 22px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size: 12px; text-align:center }
        .muted-link { color:#64748b; text-decoration:none; }
        .muted-link:hover { text-decoration:underline; }

        /* Loader spin keyframes used by Loader2 icon */
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Responsivo aprimorado */
        @media (max-width: 1200px) {
          .art-side { flex: 0 0 45%; }
          .form-side { padding: 1.5rem 1rem; }
        }
        
        @media (max-width: 1024px) {
          .brand { left: 20px; top: 20px }
          .tagline { font-size: 42px; }
          .art-side { flex: 0 0 40%; }
        }
        
        @media (max-width: 900px) {
          .login-container { flex-direction: column; }
          .art-side { order:1; min-height: 40vh; flex: none; }
          .form-side { order:2; min-height: 60vh; }
          .tagline { font-size: 36px; line-height: 1.2; }
        }

        @media (max-width: 768px) {
          .art-side { min-height: 35vh; }
          .form-side { padding: 1rem; }
          .brand { left: 16px; top: 16px }
          .tagline { font-size: 32px; line-height: 1.18; }
          .form-wrap { max-width: 560px; }
        }
        
        @media (max-width: 640px) {
          .art-side { min-height: 30vh; }
          .tagline { font-size: 28px; }
        }

        @media (max-width: 480px) {
          .form-wrap { max-width: 100%; }
          .form-input { font-size: 16px; }
          .tagline { font-size: 24px; line-height: 1.24; }
          .art-side { min-height: 25vh; }
        }
        
        @media (max-width: 360px) {
          .tagline { font-size: 20px; }
          .form-side { padding: 0.75rem; }
        }

        /* Welcome Screen Styles */
        .welcome-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #e0f2fe 0%, #f8fafc 50%, #e0f7fa 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: welcomeFadeIn 0.5s ease-out;
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }

        .welcome-overlay.fade-out {
          opacity: 0;
          transform: scale(0.95);
        }

        .welcome-content {
          text-align: center;
          color: #1e40af;
          animation: welcomeSlideUp 0.8s ease-out 0.2s both;
        }

        .soundwave-container {
          margin-bottom: 2rem;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 20px;
        }

        .soundwave-line {
          display: flex;
          align-items: center;
          gap: 2px;
          width: 300px;
          height: 4px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }

        .wave-segment {
          width: 15px;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd);
          border-radius: 2px;
          animation: waveFlow 2s ease-in-out infinite;
          opacity: 0;
        }

        .wave-segment:nth-child(1) { animation-delay: 0s; }
        .wave-segment:nth-child(2) { animation-delay: 0.1s; }
        .wave-segment:nth-child(3) { animation-delay: 0.2s; }
        .wave-segment:nth-child(4) { animation-delay: 0.3s; }
        .wave-segment:nth-child(5) { animation-delay: 0.4s; }
        .wave-segment:nth-child(6) { animation-delay: 0.5s; }
        .wave-segment:nth-child(7) { animation-delay: 0.6s; }
        .wave-segment:nth-child(8) { animation-delay: 0.7s; }
        .wave-segment:nth-child(9) { animation-delay: 0.8s; }
        .wave-segment:nth-child(10) { animation-delay: 0.9s; }
        .wave-segment:nth-child(11) { animation-delay: 1.0s; }
        .wave-segment:nth-child(12) { animation-delay: 1.1s; }
        .wave-segment:nth-child(13) { animation-delay: 1.2s; }
        .wave-segment:nth-child(14) { animation-delay: 1.3s; }
        .wave-segment:nth-child(15) { animation-delay: 1.4s; }
        .wave-segment:nth-child(16) { animation-delay: 1.5s; }
        .wave-segment:nth-child(17) { animation-delay: 1.6s; }
        .wave-segment:nth-child(18) { animation-delay: 1.7s; }
        .wave-segment:nth-child(19) { animation-delay: 1.8s; }
        .wave-segment:nth-child(20) { animation-delay: 1.9s; }

        .welcome-text h1 {
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #1e40af;
        }

        .welcome-text p {
          font-size: 1.1rem;
          font-weight: 400;
          color: #64748b;
          margin-bottom: 1rem;
        }

        .agent-subtitle {
          font-size: 0.95rem;
          font-weight: 400;
          color: #64748b;
          margin-bottom: 1.5rem;
          opacity: 0.8;
        }

        .countdown {
          font-size: 2.25rem;
          font-weight: 300;
          color: #3b82f6;
          opacity: 0.8;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        @keyframes welcomeFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes welcomeSlideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        @keyframes waveFlow {
          0% { 
            opacity: 0;
            transform: scaleX(0.5);
          }
          50% { 
            opacity: 1;
            transform: scaleX(1);
          }
          100% { 
            opacity: 0;
            transform: scaleX(0.5);
          }
        }

        /* Mobile adjustments for welcome screen */
        @media (max-width: 768px) {
          .welcome-text h1 {
            font-size: 1.75rem;
          }
          .welcome-text p {
            font-size: 1rem;
          }
          .countdown {
            font-size: 2rem;
          }
          .soundwave-line {
            width: 250px;
          }
          .wave-segment {
            width: 12px;
          }
        }

        /* Respect user preference for reduced motion */
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
          .ufo, .stars, .blob, .mesh, .grid, .grain { animation: none !important; }
          .soundwave path { animation: none !important; }
          .soundwave .sweep { animation: none !important; transform: none !important; }
          .tagline, .tag-ill { animation: none !important; opacity: 1 !important; }
          .welcome-overlay { animation: none !important; }
          .welcome-content { animation: none !important; }
          .wave-segment { animation: none !important; opacity: 0.5 !important; }
        }
      `}</style>

      <div className="login-container" data-ready={uiReady ? 'true' : 'false'}>
        {/* Right art panel */}
        <div className="art-side">
          {/* Decorative layers */}
          <div className="mesh" aria-hidden="true" />
          <div className="grid" aria-hidden="true" />
          <div className="grain" aria-hidden="true" />
          {/* Horizontal sound wave */}
          <div className="soundwave" aria-hidden="true">
            <div className="sweep">
              <svg viewBox="0 0 960 160" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="swg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path d="M0 80 C 80 20, 160 140, 240 80 S 400 20, 480 80 S 640 140, 720 80 S 880 20, 960 80" stroke="url(#swg)" />
                <path className="alt" d="M0 90 C 80 50, 160 130, 240 90 S 400 50, 480 90 S 640 130, 720 90 S 880 50, 960 90" stroke="url(#swg)" />
              </svg>
            </div>
          </div>
          {/* hero image removed */}
          <div className="tagline-wrap" aria-hidden="true">
            <div className="tagline-block">
              <p key={`txt-${tagIndex}`} className="tagline">{promoItems[tagIndex].text}</p>
            </div>
          </div>
        </div>
        {/* end of art-side */}

      {/* Left form panel */}
      <div className="form-side">
        <div className="form-wrap">
          <div className="form-head">
            <h2>{authTab === 'login' ? 'Bem-vindo de volta 👋' : 'Crie sua conta 🚀'}</h2>
            <p>{authTab === 'login' ? 'Por favor, insira suas credenciais para acessar o sistema.' : 'Preencha os dados para começar a usar o PBX Pro Inova.'}</p>
          </div>
          {/* Banner de Plano Expirado (email login) */}
          {authTab === 'login' && loginMode === 'email' && error === 'plan_expired' && (
            <div style={{
              marginBottom: '1rem',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'linear-gradient(135deg, rgba(254, 242, 242, 0.9), rgba(254, 226, 226, 0.9))',
              color: '#991b1b',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle style={{ width: '16px', height: '16px' }} />
              <div>
                <strong>Plano expirado:</strong> seu acesso está temporariamente bloqueado.
                {emailPlanExpiredAt ? (
                  <span> (expirado em {new Date(emailPlanExpiredAt).toLocaleString('pt-BR')})</span>
                ) : null}
                <div style={{ color: '#7f1d1d', marginTop: 4 }}>Entre em contato com o suporte para reativar seu plano.</div>
              </div>
            </div>
          )}
          <div className="tabs" role="tablist" aria-label="Ações de autenticação">
            <button className={`tab ${authTab === 'login' ? 'active' : ''}`} role="tab" aria-selected={authTab==='login'} onClick={() => setAuthTab('login')}>Entrar</button>
            <button
              className={`tab ${authTab === 'signup' ? 'active' : ''}`}
              role="tab"
              aria-selected={authTab==='signup'}
              onClick={() => setAuthTab('signup')}
            >
              Criar conta
            </button>
          </div>

          <form id="authForm" className="login-form" onSubmit={handleSubmit} style={{ paddingBottom: authTab === 'signup' ? 80 : 0 }}>
            {authTab === 'login' && (loginMode === 'email' ? (
              <div className="form-group">
                <div className="form-label-group">
                  <label htmlFor="email" className="form-label">E-mail</label>
                  <button
                    type="button"
                    className="switch-login-btn"
                    onClick={() => { resetAuthUI(); setLoginMode('agent'); }}
                  >
                    Login Agente/Ramal
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="form-input"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                  />
                  <span className="icon-left" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                  </span>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <div className="form-label-group">
                  <label htmlFor="agentId" className="form-label">Ramal/Agente</label>
                  <button
                    type="button"
                    className="switch-login-btn"
                    onClick={() => { resetAuthUI(); setLoginMode('email'); }}
                  >
                    Login por E-mail
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="agentId"
                    type="text"
                    placeholder="Digite o ramal ou agente"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    required
                    disabled={isLoading}
                    className="form-input"
                    name="agentId"
                    autoComplete="off"
                  />
                  <span className="icon-left" aria-hidden="true">
                     <Phone size={20} />
                  </span>
                </div>
                {/* Inline status message for ramal/owner */}
                {loginMode === 'agent' && agentId && (
                  <div style={{ marginTop: 8, fontSize: 12, color: ramalStatus.loading ? '#64748b' : ((ramalStatus?.owner_status === 'suspended' || ramalStatus?.agent_blocked || ramalStatus?.owner_plan_status === false || ramalStatus?.owner_plan_expired) ? '#b91c1c' : (ramalStatus?.owner_status === 'inactive' ? '#92400e' : '#065f46')) }}>
                    {ramalStatus.loading && 'Verificando status do ramal...'}
                    {!ramalStatus.loading && ramalStatus?.owner_status === 'suspended' && '🚫 Conta suspensa do proprietário'}
                    {!ramalStatus.loading && ramalStatus?.owner_status === 'inactive' && '⚠️ Conta do proprietário inativa.'}
                    {!ramalStatus.loading && (ramalStatus?.owner_plan_status === false || ramalStatus?.owner_plan_expired) && '⛔ Plano do proprietário expirado/inativo.'}
                    {!ramalStatus.loading && ramalStatus?.agent_blocked && '🚫 Ramal bloqueado.'}
                    {!ramalStatus.loading && !ramalStatus?.owner_status && !ramalStatus?.agent_blocked && '✅ Ramal apto para login.'}
                  </div>
                )}
              </div>
            ))}

            {authTab === 'login' && (
              <div className="form-group">
                <label htmlFor="password" className="form-label">Senha</label>
                <div className="password-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="form-input password-input"
                    name="password"
                    autoComplete="current-password"
                  />
                  <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="password-toggle">
                    {showPassword ? (
                      <EyeOff style={{ height: '1.1rem', width: '1.1rem' }} />
                    ) : (
                      <Eye style={{ height: '1.1rem', width: '1.1rem' }} />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Login Options Checkboxes */}
            {authTab === 'login' && (
              <div className="login-options">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={saveCredentials}
                      onChange={(e) => setSaveCredentials(e.target.checked)}
                      className="checkbox-input"
                    />
                    <span className="checkbox-custom"></span>
                    <span className="checkbox-text">Salvar Credenciais</span>
                  </label>
                  <p className="checkbox-description">
                    Salva seu email/ramal para não precisar digitar novamente
                  </p>
                </div>
                
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={keepLoggedIn}
                      onChange={(e) => setKeepLoggedIn(e.target.checked)}
                      className="checkbox-input"
                    />
                    <span className="checkbox-custom"></span>
                    <span className="checkbox-text">Manter Conectado</span>
                  </label>
                  <p className="checkbox-description">
                    Estende sua sessão para 5 horas (ao invés de 1 hora)
                  </p>
                </div>
              </div>
            )}

            {authTab === 'signup' && (
              <>
                {/* Card: Dados Pessoais */}
                <div className="card" ref={formTopRef}>
                  <h3>Dados pessoais</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label htmlFor="name" className="form-label">Nome completo</label>
                      <input id="name" type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} className="form-input" name="name" autoComplete="name" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="emailSignup" className="form-label">E-mail</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          id="emailSignup"
                          ref={emailInputRef}
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                          required
                          disabled={isLoading}
                          className="form-input"
                          name="email"
                          autoComplete="email"
                          inputMode="email"
                          spellCheck={false}
                          aria-invalid={!!emailError}
                          aria-describedby={emailError ? 'emailSignup-error' : undefined}
                          style={emailError ? { borderColor: '#ef4444' } : undefined}
                        />
                        <span className="icon-left" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                        </span>
                      </div>
                      {emailError && (
                        <div id="emailSignup-error" style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{emailError}</div>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="phone" className="form-label">Telefone móvel</label>
                      <div className={`phone-input-wrapper ${smsStep === 'code' && !phoneVerified ? 'dimmed' : ''}`}>
                        <input 
                          id="phone" 
                          type="tel" 
                          placeholder="(11) 99999-9999" 
                          value={phone} 
                          onChange={handlePhoneChange} 
                          disabled={isLoading || phoneVerified} 
                          className="form-input" 
                          name="phone" 
                          autoComplete="tel" 
                          inputMode="tel"
                          ref={phoneInputRef}
                          style={{ paddingRight: phoneVerified ? '120px' : '100px' }}
                        />
                        <button
                          type="button"
                          onClick={phoneVerified ? resetSmsValidation : sendSmsCode}
                          disabled={isLoading || smsLoading || !phone || phone.replace(/\D/g, '').length < 10}
                          className={`phone-verify-btn ${phoneVerified ? 'verified' : ''}`}
                        >
                          {smsLoading ? '...' : phoneVerified ? '✓ Verificado' : 'Verificar'}
                        </button>
                      </div>
                      
                      {/* SMS Validation Panel */}
                      {(smsCodeSent || phoneVerified) && (
                        <div className={`sms-validation ${phoneVerified ? 'verified' : ''} ${smsStep === 'code' ? 'enter' : ''}`}>
                          <div className="sms-header">
                            <div className={`icon ${phoneVerified ? 'success' : 'pending'}`}>
                              {phoneVerified ? (
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                </svg>
                              )}
                            </div>
                            <div className="title">
                              {phoneVerified ? 'Telefone verificado' : 'Verificação por SMS'}
                            </div>
                          </div>
                          
                          {smsStep === 'code' && !phoneVerified && (
                            <div className="sms-content">
                              <div className="sms-status">
                                📱 Código enviado para {phone}
                              </div>
                              <div className="sms-input-group">
                                <input
                                  type="text"
                                  placeholder="000000"
                                  value={smsCode}
                                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                  className="sms-code-input"
                                  maxLength={6}
                                  disabled={smsLoading}
                                />
                                <button
                                  type="button"
                                  onClick={verifySmsCode}
                                  disabled={smsLoading || smsCode.length !== 6}
                                  className="sms-button primary"
                                >
                                  {smsLoading ? 'Verificando...' : 'Verificar'}
                                </button>
                              </div>
                              <div className="sms-status">
                                {smsCountdown > 0 ? (
                                  <span className="sms-countdown">Reenviar em {smsCountdown}s</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={sendSmsCode}
                                    disabled={smsLoading}
                                    className="sms-button secondary"
                                    style={{ fontSize: '12px', height: '32px', padding: '0 12px' }}
                                  >
                                    Reenviar código
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={correctPhoneNumber}
                                  disabled={smsLoading}
                                  className="sms-button secondary"
                                  style={{ fontSize: '12px', height: '32px', padding: '0 12px', marginLeft: 8 }}
                                >
                                  Corrigir número
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {phoneVerified && (
                            <div className="sms-status success">
                              ✅ Número móvel confirmado e pronto para uso
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="cpfCnpj" className="form-label">CPF/CNPJ</label>
                      <input
                        id="cpfCnpj"
                        ref={cpfInputRef}
                        type="text"
                        placeholder="CPF ou CNPJ"
                        value={cpfCnpj}
                        onChange={handleCpfCnpjChange}
                        disabled={isLoading}
                        className="form-input"
                        name="cpfCnpj"
                        inputMode="numeric"
                        aria-invalid={!!cpfCnpjError}
                        aria-describedby={cpfCnpjError ? 'cpfCnpj-error' : undefined}
                        style={cpfCnpjError ? { borderColor: '#ef4444' } : undefined}
                      />
                      {cpfCnpjError && (
                        <div id="cpfCnpj-error" style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{cpfCnpjError}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card: Segurança */}
                <div className="card">
                  <h3>Segurança</h3>
                  <div className="grid-2">
                    <div className="form-group">
                      <label htmlFor="passwordSignup" className="form-label">Senha</label>
                      <div className="password-wrapper">
                        <input
                          id="passwordSignup"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mín. 8 caracteres e letras"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          className="form-input password-input"
                          name="new-password"
                          autoComplete="new-password"
                        />
                        <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="password-toggle">
                          {showPassword ? (
                            <EyeOff style={{ height: '1.1rem', width: '1.1rem' }} />
                          ) : (
                            <Eye style={{ height: '1.1rem', width: '1.1rem' }} />
                          )}
                        </button>
                      </div>
                      <div className="strength" aria-hidden="true">
                        <span style={{width: `${Math.min(100, (password.length>=8?25:0) + (/[A-Za-z]/.test(password)?25:0) + (/[0-9]/.test(password)?25:0) + (/[^A-Za-z0-9]/.test(password)?25:0))}%`}} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="confirmPassword" className="form-label">Confirmar senha</label>
                      <div className="password-wrapper">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Repita a senha"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          className="form-input password-input"
                          name="confirm-password"
                          autoComplete="new-password"
                        />
                        <button type="button" aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isLoading} className="password-toggle">
                          {showConfirmPassword ? (
                            <EyeOff style={{ height: '1.1rem', width: '1.1rem' }} />
                          ) : (
                            <Eye style={{ height: '1.1rem', width: '1.1rem' }} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <label className="checkbox">
                        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} disabled={isLoading} />
                        <span>Eu li e aceito os <a className="link" href="#" onClick={(e) => { e.preventDefault(); toast.info('Termos de Serviço', 'Disponíveis mediante solicitação.'); }}>Termos de Serviço</a></span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}



            {error && error !== 'plan_expired' && (
              <div className="error-message" role="alert" aria-live="assertive">
                {error === 'suspended' ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚫</div>
                    <h3 style={{ color: '#dc2626', fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                      Acesso Suspenso
                    </h3>
                    <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                      Sua conta foi suspensa temporariamente.<br />
                      Para reativar, entre em contato com nosso time de vendas.
                    </p>
                    <a 
                      href="https://wa.link/vf32as" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#25d366',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '0.75rem',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#22c55e';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#25d366';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)';
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                      </svg>
                      Falar com Suporte
                    </a>
                  </div>
                ) : (
                  error
                )}
              </div>
            )}

              <button 
                type="submit" 
                disabled={authTab === 'login' ? isLoading : isSignupButtonDisabled} 
                className="login-button" 
                aria-label={authTab === 'login' ? 'Entrar' : 'Criar conta'}
              >
                {isLoading ? (
                  <>
                    <Loader2 style={{ height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                    {authTab === 'login' ? 'Entrar' : 'Criando...'}
                  </>
                ) : (
                  (authTab === 'login' ? 'Entrar' : 'Criar conta')
                )}
              </button>

              {/* Sticky mobile submit bar so user doesn't need to scroll */}
              {authTab === 'signup' && (
                <div className="sticky-actions" aria-hidden={false}>
                  <button 
                    form="authForm" 
                    type="submit" 
                    disabled={isSignupButtonDisabled} 
                    className="login-button" 
                    aria-label="Criar conta (fixo)"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 style={{ height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                        Criando...
                      </>
                    ) : (
                      'Criar conta'
                    )}
                  </button>
                </div>
              )}

              <div className="foot">Chamadas VoIP ilimitadas, com voz cristalina, gestão em nuvem e performance premium para sua empresa. @Uma Empresa do Grupo InovaVoip!.</div>
          </form>
        </div>
      </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <LoginContent />
    </ToastProvider>
  );
}
