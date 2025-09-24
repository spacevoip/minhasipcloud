const callLimitService = require('../services/callLimitService');

/**
 * Middleware para verificar limite de chamadas no login
 * Bloqueia login se usuário atingiu limite de plano de teste
 */
const checkCallLimitOnLogin = async (req, res, next) => {
  try {
    // Só aplicar após login bem-sucedido (quando req.user existe)
    if (!req.user || !req.user.id) {
      return next();
    }

    console.log(`🔍 [CallLimitMiddleware] Verificando limite para usuário ${req.user.id}`);

    // Verificar e aplicar limite de chamadas
    const wasSuspended = await callLimitService.checkAndApplyCallLimit(req.user.id);
    
    if (wasSuspended) {
      console.log(`🚫 [CallLimitMiddleware] Usuário ${req.user.id} foi suspenso por limite de chamadas`);
      
      return res.status(403).json({
        success: false,
        message: 'Sua conta foi suspensa por atingir o limite de chamadas do plano de teste',
        code: 'CALL_LIMIT_EXCEEDED',
        suspended: true
      });
    }

    // Usuário dentro do limite, continuar
    next();
    
  } catch (error) {
    console.error(`❌ [CallLimitMiddleware] Erro ao verificar limite:`, error);
    
    // Em caso de erro, permitir login (fail-safe)
    // Mas logar o erro para investigação
    console.warn(`⚠️ [CallLimitMiddleware] Permitindo login devido a erro no middleware`);
    next();
  }
};

/**
 * Middleware para verificar limite após nova chamada (webhook CDR)
 * Para ser usado em endpoints que registram novas chamadas
 */
const checkCallLimitAfterCall = async (req, res, next) => {
  try {
    const { accountcode } = req.body || req.query || {};
    
    if (!accountcode) {
      return next();
    }

    console.log(`📞 [CallLimitMiddleware] Nova chamada detectada para usuário ${accountcode}`);

    // Verificar limite após a chamada
    const wasSuspended = await callLimitService.checkAndApplyCallLimit(accountcode);
    
    if (wasSuspended) {
      console.log(`🚫 [CallLimitMiddleware] Usuário ${accountcode} suspenso após nova chamada`);
    }

    // Continuar processamento independente da suspensão
    // A suspensão afetará próximos logins, não a chamada atual
    next();
    
  } catch (error) {
    console.error(`❌ [CallLimitMiddleware] Erro ao verificar limite após chamada:`, error);
    next();
  }
};

/**
 * Middleware para verificar se usuário está suspenso
 * Usado em rotas protegidas para bloquear acesso de usuários suspensos
 */
const blockSuspendedUsers = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next();
    }

    // Verificar status atual do usuário no banco
    const { query } = require('../config/database');
    const result = await query(`
      SELECT status FROM users_pabx WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length && result.rows[0].status === 'suspended') {
      console.log(`🚫 [CallLimitMiddleware] Bloqueando acesso de usuário suspenso ${req.user.id}`);
      
      return res.status(403).json({
        success: false,
        message: 'Sua conta está suspensa por atingir o limite de chamadas do plano de teste',
        code: 'ACCOUNT_SUSPENDED',
        suspended: true
      });
    }

    next();
    
  } catch (error) {
    console.error(`❌ [CallLimitMiddleware] Erro ao verificar status de suspensão:`, error);
    next();
  }
};

module.exports = {
  checkCallLimitOnLogin,
  checkCallLimitAfterCall,
  blockSuspendedUsers
};
