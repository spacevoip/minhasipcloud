import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  environment: process.env.NODE_ENV || 'development',
  
  // Performance Monitoring
  tracesSampleRate: 1.0,
  
  // Logs habilitados
  enableLogs: true,
  
  // Configurações específicas do servidor PABX
  beforeSend(event, hint) {
    // Filtrar logs sensíveis
    if (event.message?.includes('password') || 
        event.message?.includes('token') ||
        event.message?.includes('secret')) {
      return null;
    }
    
    return event;
  },
  
  // Tags específicas do servidor
  initialScope: {
    tags: {
      component: "server",
      system: "pabx"
    }
  },
  
  // Controle de propagação de trace para APIs
  tracePropagationTargets: [
    "localhost",
    /^\/api\//, // APIs locais
    /^https:\/\/host\.minhasip\.cloud\//, // API externa
  ],
});
