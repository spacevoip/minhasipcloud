import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Configurações específicas para PABX
  environment: process.env.NODE_ENV || 'development',
  
  // Adiciona headers e IP para usuários
  sendDefaultPii: true,
  
  // Performance Monitoring
  tracesSampleRate: 1.0,
  
  // Session Replay para debug de UI
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Logs habilitados
  enableLogs: true,
  
  integrations: [
    // Session Replay
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    
    // User Feedback
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
    
    // Browser Tracing (automático no Next.js)
    Sentry.browserTracingIntegration(),
  ],
  
  // Configurações específicas do sistema PABX
  beforeSend(event, hint) {
    // Filtrar erros conhecidos do sistema
    if (event.exception) {
      const error = hint.originalException;
      
      // Ignorar erros de rede temporários
      if (error?.message?.includes('NetworkError') || 
          error?.message?.includes('Failed to fetch')) {
        return null;
      }
      
      // Ignorar erros de WebRTC conhecidos
      if (error?.message?.includes('WebRTC') || 
          error?.message?.includes('getUserMedia')) {
        return null;
      }
    }
    
    return event;
  },
  
  // Tags específicas do PABX
  initialScope: {
    tags: {
      component: "frontend",
      system: "pabx"
    }
  },
  
  // Controle de propagação de trace
  tracePropagationTargets: [
    "localhost",
    /^\//, // Rotas locais
    /^https:\/\/host\.minhasip\.cloud\//, // API externa
  ],
});

// Performance - captura transições de rota
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
