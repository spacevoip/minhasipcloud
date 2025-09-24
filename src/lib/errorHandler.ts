/**
 * =====================================================
 * ERROR HANDLER - SISTEMA PADRONIZADO DE ERROS
 * =====================================================
 * Centraliza o tratamento de erros em todo o sistema
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'network' | 'validation' | 'auth' | 'business' | 'system';
}

export class AppError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly severity: ErrorDetails['severity'];
  public readonly category: ErrorDetails['category'];
  public readonly context?: ErrorContext;

  constructor(details: ErrorDetails, context?: ErrorContext) {
    super(details.message);
    this.name = 'AppError';
    this.code = details.code;
    this.userMessage = details.userMessage;
    this.severity = details.severity;
    this.category = details.category;
    this.context = context;
  }
}

/**
 * Classe principal para tratamento de erros
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: Set<(error: AppError) => void> = new Set();

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Tratar erro de forma padronizada
   */
  public handle(error: unknown, context?: ErrorContext): AppError {
    const appError = this.normalizeError(error, context);
    
    // Log estruturado
    this.logError(appError);
    
    // Notificar listeners (toast, analytics, etc.)
    this.notifyListeners(appError);
    
    return appError;
  }

  /**
   * Normalizar erro para AppError
   */
  private normalizeError(error: unknown, context?: ErrorContext): AppError {
    // Se já é AppError, apenas adicionar contexto
    if (error instanceof AppError) {
      return new AppError({
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
        severity: error.severity,
        category: error.category
      }, { ...error.context, ...context });
    }

    // Erro de rede/fetch
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new AppError({
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'Erro de conexão. Verifique sua internet.',
        severity: 'medium',
        category: 'network'
      }, context);
    }

    // Erro HTTP
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const httpError = error as { status: number; message?: string };
      return this.createHttpError(httpError.status, httpError.message, context);
    }

    // Erro genérico
    const message = error instanceof Error ? error.message : String(error);
    return new AppError({
      code: 'UNKNOWN_ERROR',
      message,
      userMessage: 'Ocorreu um erro inesperado. Tente novamente.',
      severity: 'medium',
      category: 'system'
    }, context);
  }

  /**
   * Criar erro HTTP específico
   */
  private createHttpError(status: number, message?: string, context?: ErrorContext): AppError {
    const errorMap: Record<number, Omit<ErrorDetails, 'message'>> = {
      400: {
        code: 'BAD_REQUEST',
        userMessage: 'Dados inválidos. Verifique as informações.',
        severity: 'low',
        category: 'validation'
      },
      401: {
        code: 'UNAUTHORIZED',
        userMessage: 'Sessão expirada. Faça login novamente.',
        severity: 'medium',
        category: 'auth'
      },
      403: {
        code: 'FORBIDDEN',
        userMessage: 'Você não tem permissão para esta ação.',
        severity: 'medium',
        category: 'auth'
      },
      404: {
        code: 'NOT_FOUND',
        userMessage: 'Recurso não encontrado.',
        severity: 'low',
        category: 'business'
      },
      429: {
        code: 'RATE_LIMIT',
        userMessage: 'Muitas tentativas. Aguarde um momento.',
        severity: 'medium',
        category: 'network'
      },
      500: {
        code: 'INTERNAL_ERROR',
        userMessage: 'Erro interno do servidor. Tente novamente.',
        severity: 'high',
        category: 'system'
      }
    };

    const errorDetails = errorMap[status] || errorMap[500];
    
    return new AppError({
      ...errorDetails,
      message: message || `HTTP ${status} Error`
    }, context);
  }

  /**
   * Log estruturado do erro
   */
  private logError(error: AppError): void {
    const logData = {
      timestamp: new Date().toISOString(),
      code: error.code,
      message: error.message,
      severity: error.severity,
      category: error.category,
      context: error.context,
      stack: error.stack
    };

    // Log baseado na severidade
    switch (error.severity) {
      case 'critical':
        console.error('🚨 [CRITICAL]', logData);
        break;
      case 'high':
        console.error('🔴 [HIGH]', logData);
        break;
      case 'medium':
        console.warn('🟡 [MEDIUM]', logData);
        break;
      case 'low':
        console.info('🔵 [LOW]', logData);
        break;
    }
  }

  /**
   * Adicionar listener para erros
   */
  public addListener(listener: (error: AppError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Notificar todos os listeners
   */
  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('❌ Erro no listener de erro:', listenerError);
      }
    });
  }

  /**
   * Criar erros específicos do domínio
   */
  public static createAuthError(message: string, context?: ErrorContext): AppError {
    return new AppError({
      code: 'AUTH_ERROR',
      message,
      userMessage: 'Erro de autenticação. Verifique suas credenciais.',
      severity: 'medium',
      category: 'auth'
    }, context);
  }

  public static createValidationError(message: string, context?: ErrorContext): AppError {
    return new AppError({
      code: 'VALIDATION_ERROR',
      message,
      userMessage: 'Dados inválidos. Verifique as informações.',
      severity: 'low',
      category: 'validation'
    }, context);
  }

  public static createNetworkError(message: string, context?: ErrorContext): AppError {
    return new AppError({
      code: 'NETWORK_ERROR',
      message,
      userMessage: 'Erro de conexão. Verifique sua internet.',
      severity: 'medium',
      category: 'network'
    }, context);
  }

  public static createBusinessError(message: string, userMessage: string, context?: ErrorContext): AppError {
    return new AppError({
      code: 'BUSINESS_ERROR',
      message,
      userMessage,
      severity: 'medium',
      category: 'business'
    }, context);
  }
}

/**
 * Instância singleton do ErrorHandler
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * Hook para tratamento de erros em componentes React
 */
export function useErrorHandler() {
  return {
    handleError: (error: unknown, context?: ErrorContext) => {
      return errorHandler.handle(error, context);
    },
    createAuthError: ErrorHandler.createAuthError,
    createValidationError: ErrorHandler.createValidationError,
    createNetworkError: ErrorHandler.createNetworkError,
    createBusinessError: ErrorHandler.createBusinessError
  };
}

/**
 * Decorator para tratamento automático de erros em métodos
 */
export function handleErrors(context?: Partial<ErrorContext>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const fullContext: ErrorContext = {
          component: target.constructor.name,
          action: propertyName,
          ...context
        };
        
        throw errorHandler.handle(error, fullContext);
      }
    };
  };
}
