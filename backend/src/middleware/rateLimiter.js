/**
 * =====================================================
 * RATE LIMITER MIDDLEWARE
 * =====================================================
 * Middleware para limitar taxa de requisições por IP
 */

const rateLimit = require('express-rate-limit');

// Rate limiter para rotas admin (ajustado para polling)
const adminRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto por IP (polling a cada 7s = ~9 req/min)
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em 1 minuto.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Identificar por IP real (considerando proxies)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }
});

// Rate limiter para rotas gerais (menos restritivo)
const generalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto por IP
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em 1 minuto.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }
});

// Rate limiter para login (muito restritivo)
const loginRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // máximo 5 tentativas de login por 5 minutos
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 5 minutos.',
    error: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }
});

module.exports = {
  adminRateLimit,
  generalRateLimit,
  loginRateLimit
};
