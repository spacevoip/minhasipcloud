/**
 * Sistema de Logger Profissional para Frontend
 * Substitui console.log por logging estruturado
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

class FrontendLogger {
  private level: number;
  private isProduction: boolean;

  constructor() {
    // Em produção, só mostra ERROR e WARN
    // Em desenvolvimento, mostra tudo
    this.isProduction = process.env.NODE_ENV === 'production';
    this.level = this.isProduction ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    
    if (this.isProduction) {
      // Em produção, log estruturado (JSON)
      const logEntry = {
        timestamp,
        level,
        message,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        ...(data && { data })
      };
      return JSON.stringify(logEntry);
    } else {
      // Em desenvolvimento, log legível
      const emoji = {
        ERROR: '❌',
        WARN: '⚠️',
        INFO: 'ℹ️',
        DEBUG: '🔍'
      }[level] || '';
      
      return `${emoji} [${timestamp.split('T')[1].split('.')[0]}] ${message}${data ? ` | ${JSON.stringify(data)}` : ''}`;
    }
  }

  error(message: string, data?: any): void {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level >= LOG_LEVELS.INFO) {
      console.info(this.formatMessage('INFO', message, data));
    }
  }

  debug(message: string, data?: any): void {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  // Métodos específicos para diferentes contextos
  auth(message: string, data?: any): void {
    this.info(`[AUTH] ${message}`, data);
  }

  api(message: string, data?: any): void {
    this.info(`[API] ${message}`, data);
  }

  ui(message: string, data?: any): void {
    this.debug(`[UI] ${message}`, data);
  }

  component(componentName: string, message: string, data?: any): void {
    this.debug(`[${componentName}] ${message}`, data);
  }

  // Método para logs críticos (sempre aparecem)
  critical(message: string, data?: any): void {
    console.error(this.formatMessage('ERROR', `[CRITICAL] ${message}`, data));
  }

  // Método para performance
  performance(action: string, duration: number): void {
    this.debug(`[PERF] ${action} took ${duration}ms`);
  }
}

// Singleton
const logger = new FrontendLogger();

export default logger;
