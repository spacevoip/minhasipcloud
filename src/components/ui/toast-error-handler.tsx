'use client';

import { useEffect } from 'react';
import { errorHandler, AppError } from '@/lib/errorHandler';
import { useToast } from '@/components/ui/toast';

/**
 * Componente para integrar ErrorHandler com Toast notifications
 */
export function ToastErrorHandler() {
  const toast = useToast();

  useEffect(() => {
    const removeListener = errorHandler.addListener((error: AppError) => {
      // Não mostrar toast para erros de baixa severidade em desenvolvimento
      if (error.severity === 'low' && process.env.NODE_ENV === 'development') {
        return;
      }

      // Escolher tipo de toast baseado na severidade
      switch (error.severity) {
        case 'critical':
        case 'high':
          toast.error('Erro', error.userMessage);
          break;
        case 'medium':
          toast.warning('Atenção', error.userMessage);
          break;
        case 'low':
          toast.info('Aviso', error.userMessage);
          break;
      }
    });

    return removeListener;
  }, [toast]);

  return null; // Componente invisível
}
