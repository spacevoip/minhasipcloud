'use client';

import { useEffect, useState } from 'react';
import { logApiUrl } from '@/lib/apiUrlLogger';

/**
 * Componente de debug para mostrar qual URL da API está sendo usada
 * Útil para verificar se a variável de ambiente está funcionando
 */
export function ApiUrlDebug() {
  const [apiInfo, setApiInfo] = useState<{
    url: string;
    source: string;
    envValue: string;
  } | null>(null);

  useEffect(() => {
    const url = logApiUrl('ApiUrlDebug');
    const isUsingEnv = !!process.env.NEXT_PUBLIC_API_URL;
    
    setApiInfo({
      url,
      source: isUsingEnv ? 'NEXT_PUBLIC_API_URL env var' : 'fallback (localhost:3001)',
      envValue: process.env.NEXT_PUBLIC_API_URL || 'undefined'
    });
  }, []);

  // Só mostrar em desenvolvimento
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!apiInfo) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="font-bold mb-1">🔗 API URL Debug</div>
      <div><strong>URL:</strong> {apiInfo.url}</div>
      <div><strong>Source:</strong> {apiInfo.source}</div>
      <div><strong>Env Value:</strong> {apiInfo.envValue}</div>
    </div>
  );
}
