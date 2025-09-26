/**
 * Utilitário para logar o uso da NEXT_PUBLIC_API_URL
 * Mostra se está usando a variável de ambiente ou o fallback
 */

export function logApiUrl(context: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const isUsingEnv = !!process.env.NEXT_PUBLIC_API_URL;
  
  // Log apenas em desenvolvimento ou se explicitamente habilitado
  const shouldLog = process.env.NODE_ENV === 'development' || 
                   process.env.NEXT_PUBLIC_DEBUG_API_URL === 'true';
  
  if (shouldLog) {
    console.log(`🔗 [${context}] API URL:`, {
      url: apiUrl,
      source: isUsingEnv ? '✅ NEXT_PUBLIC_API_URL env var' : '⚠️  fallback (localhost:3001)',
      env_value: process.env.NEXT_PUBLIC_API_URL || 'undefined'
    });
  }
  
  return apiUrl;
}

// Versão simplificada para uso rápido
export const getApiUrl = (context?: string) => {
  if (context) {
    return logApiUrl(context);
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};
