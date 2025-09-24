'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AgentWelcomeLoaderProps {
  agentName: string;
  onPageLoaded: () => void;
}

export default function AgentWelcomeLoader({ agentName, onPageLoaded }: AgentWelcomeLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(7);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDashboardReady, setIsDashboardReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Prefetch da rota do dashboard
    router.prefetch('/agent/dashboard');
    
    // Iniciar preload de dados em paralelo ao contador
    preloadDashboardData();
    
    // Contador de 7 segundos
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Iniciar verificação imediatamente mantendo overlay visível
          checkDashboardReady();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onPageLoaded, router]);

  const preloadDashboardData = async () => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) return;

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 1. Buscar dados do agente (já ocorre indiretamente, mas garantimos aqui)
      const agentResponse = await fetch(`${baseUrl}/api/agent-auth/me`, { headers });
      if (agentResponse.ok) {
        const agentData = await agentResponse.json();
        if (agentData.success && agentData.data?.agent) {
          const agent = agentData.data.agent;
          localStorage.setItem('agent_data', JSON.stringify(agent));

          // 2. Pré-carregar campanhas do agente
          if (agent.id) {
            try {
              const campaignsResponse = await fetch(`${baseUrl}/api/mailings/agent/${agent.id}`, { headers });
              if (campaignsResponse.ok) {
                const campaignsData = await campaignsResponse.json();
                if (campaignsData.success) {
                  localStorage.setItem('agent_campaigns_preloaded', JSON.stringify(campaignsData.data || []));
                }
              }
            } catch (error) {
              console.warn('Erro ao pré-carregar campanhas:', error);
            }
          }

          // 3. Pré-carregar chamadas ativas
          if (agent.user_id) {
            try {
              const callsResponse = await fetch(`${baseUrl}/api/active-calls?accountcode=${agent.user_id}`, { headers });
              if (callsResponse.ok) {
                const callsData = await callsResponse.json();
                if (callsData.success) {
                  localStorage.setItem('agent_active_calls_preloaded', JSON.stringify(callsData.data || []));
                }
              }
            } catch (error) {
              console.warn('Erro ao pré-carregar chamadas ativas:', error);
            }
          }

          // 4. Pré-carregar configuração do dashboard (opcional)
          try {
            const configResponse = await fetch(`${baseUrl}/api/agent-dashboard/config`, { headers });
            if (configResponse.ok) {
              const configData = await configResponse.json();
              if (configData.success) {
                localStorage.setItem('agent_dashboard_config', JSON.stringify(configData.data || {}));
              }
            }
          } catch (error) {
            // Config é opcional, não logamos erro
            console.debug('Config do dashboard não disponível:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Erro no preload de dados do dashboard:', error);
    }
  };

  const checkDashboardReady = async () => {
    try {
      // Aguardar um pouco para garantir que o DOM esteja pronto
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verificar se o dashboard está pronto fazendo uma requisição de teste
      const token = localStorage.getItem('agent_token');
      if (token) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/agent-auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setIsDashboardReady(true);
          // Navegar mantendo overlay até a troca de página para evitar flicker
          window.location.href = '/agent/dashboard';
        } else {
          // Fallback: redirecionar mesmo se a verificação falhar
          window.location.href = '/agent/dashboard';
        }
      } else {
        // Fallback: redirecionar mesmo sem token
        window.location.href = '/agent/dashboard';
      }
    } catch (error) {
      console.error('Erro ao verificar dashboard:', error);
      // Fallback: redirecionar em caso de erro
      window.location.href = '/agent/dashboard';
    }
  };

  if (!isLoading) return null;

  return (
    <div className={`agent-welcome-overlay`}>
      <div className="agent-welcome-content">
        <div className="soundwave-container">
          <div className="soundwave-line">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="wave-segment" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
        <div className="welcome-text">
          <h2 className="agent-welcome-title">
            👋 Olá, {agentName}! Seja muito bem-vindo ao Melhor PABX 🎉
          </h2>
          <p className="agent-welcome-subtitle">
            ⏳ Aguarde um instante, estamos preparando o seu ambiente de trabalho...
          </p>
          <div className="countdown">{countdown}</div>
        </div>
      </div>

      <style jsx>{`
        .agent-welcome-overlay {
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

        .agent-welcome-overlay.fade-out {
          opacity: 0;
          transform: scale(0.95);
        }

        .agent-welcome-content {
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
          font-weight: 700;
          color: #3b82f6;
          margin-top: 1rem;
          text-align: center;
          text-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
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

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .welcome-text h1 {
            font-size: 1.75rem;
          }
          .welcome-text p {
            font-size: 1rem;
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
          * { 
            animation-duration: 0.001ms !important; 
            animation-iteration-count: 1 !important; 
            transition-duration: 0.001ms !important; 
          }
          .agent-welcome-overlay { animation: none !important; }
          .agent-welcome-content { animation: none !important; }
          .wave-segment { animation: none !important; opacity: 0.5 !important; }
        }
      `}</style>
    </div>
  );
}
