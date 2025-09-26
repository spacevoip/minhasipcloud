const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para verificar JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log(`🔐 [AUTH] Middleware executado - URL: ${req.url}, Method: ${req.method}`);
    console.log(`🔐 [AUTH] Header authorization:`, authHeader ? 'Presente' : 'Ausente');

    if (!token) { 
      console.log(`❌ [AUTH] Token ausente`);
      return res.status(401).json({
        success: false,
        message: 'Token de acesso requerido'
      });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Determinar o ID do usuário baseado no tipo de token
    let userId;
    if (decoded.type === 'agent') {
      // Para tokens de agente, usar user_id
      userId = decoded.user_id;
      if (!userId) {
        console.error('❌ user_id não encontrado no token de agente');
        return res.status(401).json({
          success: false,
          message: 'Token inválido - user_id não encontrado'
        });
      }
    } else {
      // Para tokens de usuário normal, usar id
      userId = decoded.id;
      if (!userId) {
        console.error('❌ ID do usuário não encontrado no token');
        return res.status(401).json({
          success: false,
          message: 'Token inválido - ID do usuário não encontrado'
        });
      }
    }
    
    console.log(`[AUTH] Verificando usuário - ID: ${userId}, Tipo: ${decoded.type || 'user'}`);
    
    // Buscar usuário no banco
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Regras de status:
    // Verificar se usuário está suspenso
    if (user.status === 'suspended') {
      // Para operações GET, permitir apenas algumas rotas específicas
      const allowedGetRoutes = ['/api/auth-v2/logout', '/api/auth/logout'];
      const isAllowedRoute = allowedGetRoutes.some(route => req.path.includes(route));
      
      if (req.method !== 'GET' || !isAllowedRoute) {
        return res.status(401).json({
          success: false,
          message: 'Usuário suspenso - sessão encerrada',
          forceLogout: true
        });
      }
    }

    // Adicionar usuário ao request
    req.user = user;
    // Normalizar shape: garantir alias userId para compatibilidade
    // Alguns pontos do código usam req.user.userId; manter ambos
    if (req.user && req.user.id && !req.user.userId) {
      req.user.userId = req.user.id;
    }
    
    // Para tokens de agente, adicionar informações do agente também
    if (decoded.type === 'agent') {
      req.agent = {
        id: decoded.id,
        ramal: decoded.ramal,
        agente_name: decoded.agente_name,
        user_id: decoded.user_id
      };
      console.log(`[AUTH] Agente autenticado - Ramal: ${decoded.ramal}, Nome: ${decoded.agente_name}`);
    }
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    console.error('❌ Erro na autenticação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    // Se roles for string, converter para array
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão insuficiente.'
      });
    }

    next();
  };
};

// Middleware para verificar se é admin
const requireAdmin = requireRole('admin');

// Middleware para verificar se é revendedor ou admin
const requireResellerOrAdmin = requireRole(['reseller', 'admin']);

// Middleware para verificar se é colaborador ou admin
const requireCollaboratorOrAdmin = requireRole(['collaborator', 'admin']);

// Middleware para verificar se o usuário pode acessar dados de outro usuário
const canAccessUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.body.userId;
    const currentUser = req.user;

    // Admin pode acessar qualquer usuário
    if (currentUser.role === 'admin') {
      return next();
    }

    // Colaborador pode acessar qualquer usuário
    if (currentUser.role === 'collaborator') {
      return next();
    }

    // Revendedor pode acessar apenas seus clientes
    if (currentUser.role === 'reseller') {
      if (targetUserId === currentUser.id) {
        return next(); // Pode acessar próprios dados
      }

      // Verificar se o usuário alvo é cliente do revendedor
      const targetUser = await User.findById(targetUserId);
      if (targetUser && targetUser.parentResellerId === currentUser.id) {
        return next();
      }
    }

    // Usuário comum pode acessar apenas próprios dados
    if (currentUser.role === 'user') {
      if (targetUserId === currentUser.id) {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Acesso negado a este usuário'
    });
  } catch (error) {
    console.error('❌ Erro na verificação de acesso:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware para verificar se é o próprio usuário ou admin
const requireSelfOrAdmin = (req, res, next) => {
  const targetUserId = req.params.userId || req.body.userId;
  const currentUser = req.user;

  if (currentUser.role === 'admin' || currentUser.id === targetUserId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Acesso negado'
  });
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireResellerOrAdmin,
  requireCollaboratorOrAdmin,
  canAccessUser,
  requireSelfOrAdmin
};
