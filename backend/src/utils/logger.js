/**
 * Sistema de Logger Profissional para Produção
 * Substitui console.log por logging estruturado
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    // Em produção, só mostra ERROR e WARN
    // Em desenvolvimento, mostra tudo
    this.level = process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    if (this.isProduction) {
      // Em produção, log estruturado (JSON)
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

  error(message, data = null) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this._formatMessage('ERROR', message, data));
    }
  }

  warn(message, data = null) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this._formatMessage('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.info(this._formatMessage('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this._formatMessage('DEBUG', message, data));
    }
  }

  // Métodos específicos para diferentes contextos
  auth(message, data = null) {
    this.info(`[AUTH] ${message}`, data);
  }

  api(message, data = null) {
    this.info(`[API] ${message}`, data);
  }

  db(message, data = null) {
    this.debug(`[DB] ${message}`, data);
  }

  cache(message, data = null) {
    this.debug(`[CACHE] ${message}`, data);
  }

  ami(message, data = null) {
    this.debug(`[AMI] ${message}`, data);
  }

  // Método para logs de sistema críticos (sempre aparecem)
  system(message, data = null) {
    console.log(this._formatMessage('SYSTEM', message, data));
  }
}

// Singleton
const logger = new Logger();

module.exports = logger;
