import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  environment: process.env.NODE_ENV || 'development',
  
  // Performance Monitoring para Edge Runtime
  tracesSampleRate: 1.0,
  
  // Tags específicas do Edge
  initialScope: {
    tags: {
      component: "edge",
      system: "pabx"
    }
  },
  
  // Controle de propagação de trace para Edge
  tracePropagationTargets: [
    "localhost",
    /^\/api\//, // APIs locais
  ],
});
