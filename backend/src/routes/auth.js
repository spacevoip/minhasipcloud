const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { checkCallLimitOnLogin } = require('../middleware/callLimitMiddleware');
const { query } = require('../config/database');
const { sanitizeUserOutput } = require('../utils/sanitize');

// Centralized bcrypt cost factor (align with users-v2)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

const router = express.Router();

// Rate limiting para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validações para login
const loginValidation = [
  body('login')
    .notEmpty()
    .withMessage('Login é obrigatório')
    .isLength({ min: 3 })
    .withMessage('Login deve ter pelo menos 3 caracteres'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
];

// POST /api/auth/login
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { login, password } = req.body;

    // Verificar credenciais (buscar usuário e validar senha)
    const user = await User.verifyPassword(login, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar se usuário está ativo
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Conta inativa. Entre em contato com o suporte.'
      });
    }

    // TODO: Atualizar último login (temporariamente removido)
    // const userInstance = new User(user);
    // await userInstance.updateLastLogin();

    // Gerar JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        role: user.role,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Criar objeto de usuário para middleware
    req.user = user;

    // Verificar limite de chamadas para planos de teste
    try {
      await new Promise((resolve, reject) => {
        checkCallLimitOnLogin(req, res, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } catch (middlewareError) {
      // Se o middleware retornou uma resposta (usuário suspenso), não continuar
      if (res.headersSent) {
        return;
      }
      throw middlewareError;
    }

    // Resposta de sucesso
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token,
        user: sanitizeUserOutput({
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          company: user.company,
          phone: user.phone,
          role: user.role,
          status: user.status,
          credits: user.credits,
          plan_id: user.plan_id,
          parent_reseller_id: user.parent_reseller_id,
          max_concurrent_calls: user.max_concurrent_calls,
          timezone: user.timezone,
          language: user.language,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login_at: user.last_login_at,
          plan_activated_at: user.plan_activated_at,
          plan_expires_at: user.plan_expires_at,
          plan_status: user.plan_status,
          webrtc: user.webrtc,
          auto_discagem: user.autoDiscagem,
          up_audio: user.upAudio,
          sms_send: user.smsEnvio
        })
      }
    });

    console.log(`✅ Login realizado: ${user.email} (${user.role})`);
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Em uma implementação real, você poderia invalidar o token
    // Por enquanto, apenas retornamos sucesso
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

    console.log(`✅ Logout realizado: ${req.user.email}`);
  } catch (error) {
    console.error('❌ Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /api/auth/me - Obter dados do usuário atual
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: sanitizeUserOutput(req.user)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter dados do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/auth/refresh - Renovar token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Gerar novo token
    const token = jwt.sign(
      { 
        userId: req.user.id,
        role: req.user.role,
        email: req.user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        token
      }
    });
  } catch (error) {
    console.error('❌ Erro ao renovar token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// POST /api/auth/change-password - Alterar senha
router.post('/change-password', 
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Senha atual é obrigatória'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Nova senha deve ter pelo menos 6 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Nova senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula e 1 número')
  ],
  async (req, res) => {
    try {
      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Verificar senha atual
      const isValidPassword = await req.user.verifyPassword(currentPassword);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Hash da nova senha
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Atualizar senha no banco
      await query(
        'UPDATE users_pabx SET password_hash = $1, updated_at = CURRENT_TIMESTAMP AT TIME ZONE \'America/Sao_Paulo\' WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });

      console.log(`✅ Senha alterada: ${req.user.email}`);
    } catch (error) {
      console.error('❌ Erro ao alterar senha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;
