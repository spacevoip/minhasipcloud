/**
 * =====================================================
 * AUTH API V2 - AUTENTICAÇÃO MODERNA E CENTRALIZADA
 * =====================================================
 * API completa de autenticação com Redis e JWT
 * Integração direta com tabela users_pabx
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const User = require('../models/User');
const cacheService = require('../services/cacheService');
const { sanitizeUserOutput } = require('../utils/sanitize');
const { supabase } = require('../config/database');

const router = express.Router();

// Util: normaliza CPF/CNPJ (mantém apenas dígitos)
function normalizeCpfCnpj(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\D+/g, '');
}

// =====================================================
// RATE LIMITING PARA AUTENTICAÇÃO
// =====================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit para registro público
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // máximo 20 cadastros por IP/h
  message: {
    success: false,
    message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// =====================================================
// VALIDAÇÕES
// =====================================================
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isLength({ min: 1 })
    .withMessage('Senha não pode estar vazia')
];

// Validação para registro público
const registerValidation = [
  body('name').notEmpty().withMessage('Nome é obrigatório').isLength({ min: 2 }).withMessage('Nome muito curto'),
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('phone').optional().isString().isLength({ max: 20 }).withMessage('Telefone inválido'),
  body('cpfCnpj').optional().isString().isLength({ min: 11, max: 18 }).withMessage('CPF/CNPJ inválido'),
  body('referral').optional().isString().isLength({ max: 100 }).withMessage('Código de referência inválido'),
  body('termsAccepted').equals('true').withMessage('É necessário aceitar os termos para se cadastrar').bail()
];

// =====================================================
// POST /api/auth-v2/login - LOGIN MODERNO
// =====================================================
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    console.log('🔐 [Auth V2] Tentativa de login...');
    const clientIp = (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() || req.ip;

    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { email, password, turnstileToken } = req.body;

    // ================================
    // Cloudflare Turnstile validation
    // ================================
    try {
      const secret = process.env.TURNSTILE_SECRET_KEY;
      if (!secret) {
        console.warn('⚠️ TURNSTILE_SECRET_KEY não configurada. Pulando verificação (ambiente de dev?).');
      } else {
        if (!turnstileToken) {
          return res.status(400).json({ success: false, message: 'Verificação humana obrigatória (captcha ausente).', code: 'TURNSTILE_MISSING' });
        }

        const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        const remoteip = (req.headers['x-forwarded-for']?.split(',')[0] || '').trim() || req.ip;
        const form = new URLSearchParams();
        form.append('secret', secret);
        form.append('response', turnstileToken);
        if (remoteip) form.append('remoteip', remoteip);

        const { data: verify } = await axios.post(verifyUrl, form.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!verify?.success) {
          return res.status(400).json({
            success: false,
            message: 'Falha na verificação humana. Tente novamente.',
            code: 'TURNSTILE_FAILED',
            errors: verify?.['error-codes'] || []
          });
        }
      }
    } catch (tsErr) {
      console.error('❌ Erro ao validar Turnstile (login):', tsErr?.message || tsErr);
      return res.status(400).json({ success: false, message: 'Falha na validação do captcha.', code: 'TURNSTILE_ERROR' });
    }

    console.log(`🔍 Buscando usuário: ${email}`);

    // Buscar usuário na base
    const user = await User.findByEmail(email);
    
    if (!user) {
      console.log('❌ Usuário não encontrado');
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }

    // Verificar se usuário está ativo
    if (user.status !== 'active') {
      console.log(`❌ Usuário com status: ${user.status}`);
      
      // Mensagem específica para usuários suspensos
      if (user.status === 'suspended') {
        return res.status(401).json({
          success: false,
          message: 'Acesso suspenso. Para reativar sua conta, entre em contato com o time de vendas.',
          statusCode: 'ACCOUNT_SUSPENDED'
        });
      }
      
      // Mensagem genérica para outros status
      return res.status(401).json({
        success: false,
        message: 'Conta inativa. Entre em contato com o suporte.',
        statusCode: 'ACCOUNT_INACTIVE'
      });
    }

    // Debug: Verificar dados do usuário
    console.log('🔍 Dados do usuário encontrado:', {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash ? 'EXISTS' : 'UNDEFINED',
      password_hash_length: user.password_hash ? user.password_hash.length : 0
    });

    // Verificar se password_hash existe
    if (!user.password_hash) {
      console.log('❌ Password hash não encontrado para usuário:', user.email);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: 'Password hash não encontrado'
      });
    }

    // Verificar senha
    console.log('🔐 Comparando senha...');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log('❌ Senha incorreta');
      return res.status(401).json({
        success: false,
        message: 'Email ou senha incorretos'
      });
    }

    // Gerar JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: 'pabx-system',
        audience: 'pabx-users'
      }
    );

    // Atualizar último login e IP
    await User.updateLastLogin(user.id);
    try { await User.updateLastIp(user.id, clientIp); } catch (e) { console.warn('⚠️  Falha ao atualizar last_ip:', e?.message || e); }

    // Dados do usuário para resposta (sem senha)
    const daysRemaining = (() => {
      try {
        if (!user.planExpiresAt) return null;
        const end = new Date(user.planExpiresAt);
        if (isNaN(end.getTime())) return null;
        const now = new Date();
        const startUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
        const diff = Math.floor((endUTC - startUTC) / 86400000);
        return Math.max(0, diff);
      } catch (_) { return null; }
    })();
    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      credits: user.credits || 0,
      company: user.company,
      phone: user.phone,
      parentResellerId: user.parentResellerId,
      maxConcurrentCalls: user.maxConcurrentCalls,
      planActivatedAt: user.planActivatedAt,
      planExpiresAt: user.planExpiresAt,
      planStatus: user.planStatus,
      // adicionais
      createdBy: user.createdBy,
      webrtc: user.webrtc,
      autoDiscagem: user.autoDiscagem,
      upAudio: user.upAudio,
      smsEnvio: user.smsEnvio,
      maillingUp: user.maillingUp,
      planFree: user.planFree,
      totalCall: user.totalCall,
      lastIp: user.lastIp || clientIp || null,
      // aliases snake_case para compatibilidade
      plan_id: user.planId,
      parent_reseller_id: user.parentResellerId,
      max_concurrent_calls: user.maxConcurrentCalls,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login_at: new Date().toISOString(),
      created_by: user.createdBy,
      plan_activated_at: user.planActivatedAt,
      plan_expires_at: user.planExpiresAt,
      plan_status: user.planStatus,
      auto_discagem: user.autoDiscagem,
      up_audio: user.upAudio,
      sms_send: user.smsEnvio,
      mailling_up: user.maillingUp,
      plan_free: user.planFree,
      total_call: user.totalCall,
      last_ip: user.lastIp || clientIp || null,
      daysRemaining,
      days_remaining: daysRemaining
    };

    // Salvar sessão no cache Redis
    const sessionKey = `session:${user.id}`;
    await cacheService.set(sessionKey, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
      ip: clientIp,
      userAgent: req.get('User-Agent')
    }, 24 * 60 * 60); // 24 horas

    console.log(`✅ Login realizado com sucesso: ${user.name} (${user.role})`);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: sanitizeUserOutput(userData),
        token: token,
        expiresIn: '24h'
      },
      meta: {
        timestamp: new Date().toISOString(),
        sessionId: sessionKey
      }
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// =====================================================
// POST /api/auth-v2/logout - LOGOUT MODERNO
// =====================================================
router.post('/logout', async (req, res) => {
  try {
    console.log('🚪 [Auth V2] Logout...');

    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Remover sessão do cache
        const sessionKey = `session:${decoded.id}`;
        await cacheService.delete(sessionKey);
        
        // Adicionar token à blacklist
        const blacklistKey = `blacklist:${token}`;
        await cacheService.set(blacklistKey, true, 24 * 60 * 60); // 24 horas
        
        console.log(`✅ Logout realizado: ${decoded.email}`);
      } catch (jwtError) {
        console.log('⚠️ Token inválido no logout, continuando...');
      }
    }

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// GET /api/auth-v2/me - DADOS DO USUÁRIO ATUAL
// =====================================================
router.get('/me', async (req, res) => {
  try {
    console.log('👤 [Auth V2] Buscando dados do usuário atual...');

    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Verificar se token está na blacklist
    const blacklistKey = `blacklist:${token}`;
    const isBlacklisted = await cacheService.get(blacklistKey);
    
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Verificar e decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar dados atualizados do usuário
    const user = await User.findById(decoded.id);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo'
      });
    }

    // Dados do usuário (sem senha)
    const daysRemaining = (() => {
      try {
        if (!user.planExpiresAt) return null;
        const end = new Date(user.planExpiresAt);
        if (isNaN(end.getTime())) return null;
        const now = new Date();
        const startUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
        const diff = Math.floor((endUTC - startUTC) / 86400000);
        return Math.max(0, diff);
      } catch (_) { return null; }
    })();
    const userData = {
      // básicos
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
      role: user.role,
      status: user.status,
      credits: user.credits || 0,
      // relacionamento / limites
      planId: user.planId,
      parentResellerId: user.parentResellerId,
      maxConcurrentCalls: user.maxConcurrentCalls,
      // datas
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      lastIp: user.lastIp || null,
      // Dias restantes do plano
      daysRemaining,
      days_remaining: daysRemaining,
      // preferências
      timezone: user.timezone,
      language: user.language,
      settings: user.settings,
      metadata: user.metadata,
      // plano
      planActivatedAt: user.planActivatedAt,
      planExpiresAt: user.planExpiresAt,
      planStatus: user.planStatus,
      // adicionais
      createdBy: user.createdBy,
      webrtc: user.webrtc,
      autoDiscagem: user.autoDiscagem,
      upAudio: user.upAudio,
      smsEnvio: user.smsEnvio,
      maillingUp: user.maillingUp,
      planFree: user.planFree,
      totalCall: user.totalCall,
      // aliases snake_case
      plan_id: user.planId,
      parent_reseller_id: user.parentResellerId,
      max_concurrent_calls: user.maxConcurrentCalls,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login_at: user.lastLoginAt,
      last_ip: user.lastIp || null,
      created_by: user.createdBy,
      plan_activated_at: user.planActivatedAt,
      plan_expires_at: user.planExpiresAt,
      plan_status: user.planStatus,
      auto_discagem: user.autoDiscagem,
      up_audio: user.upAudio,
      sms_send: user.smsEnvio,
      mailling_up: user.maillingUp,
      plan_free: user.planFree,
      total_call: user.totalCall
    };

    res.json({
      success: true,
      data: sanitizeUserOutput(userData),
      meta: {
        timestamp: new Date().toISOString(),
        tokenValid: true
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar usuário atual:', error);
    
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

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// POST /api/auth-v2/refresh - RENOVAR TOKEN
// =====================================================
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 [Auth V2] Renovando token...');

    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Verificar token (mesmo que expirado, para pegar os dados)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Verificar se usuário ainda existe e está ativo
    const user = await User.findById(decoded.id);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado ou inativo'
      });
    }

    // Gerar novo token
    const newToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: 'pabx-system',
        audience: 'pabx-users'
      }
    );

    // Adicionar token antigo à blacklist
    const blacklistKey = `blacklist:${token}`;
    await cacheService.set(blacklistKey, true, 24 * 60 * 60);

    console.log(`✅ Token renovado para: ${user.email}`);

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        token: newToken,
        expiresIn: '24h'
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

// =====================================================
// GET /api/auth-v2/sessions - SESSÕES ATIVAS
// =====================================================
router.get('/sessions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar sessão no cache
    const sessionKey = `session:${decoded.id}`;
    const sessionData = await cacheService.get(sessionKey);

    res.json({
      success: true,
      data: {
        currentSession: sessionData || null,
        activeSessions: sessionData ? 1 : 0
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar sessões:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// =====================================================
// POST /api/auth-v2/register - CADASTRO PÚBLICO
// =====================================================
router.post('/register', registerLimiter, registerValidation, async (req, res) => {
  try {
    console.log('🆕 [Auth V2] Tentativa de cadastro público...');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const { name, email, password, phone, cpfCnpj, referral, turnstileToken } = req.body;

    // ================================
    // Cloudflare Turnstile validation - TEMPORARIAMENTE DESABILITADO
    // ================================
    console.log('⚠️ Turnstile temporariamente desabilitado para testes de cadastro');

    // Normalizar CPF/CNPJ (apenas dígitos)
    const normalizedCpfCnpj = normalizeCpfCnpj(cpfCnpj);

    // Email único
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Este e-mail já está em uso' });
    }

    // CPF/CNPJ único (quando informado)
    if (normalizedCpfCnpj) {
      const { data: cpfHit, error: cpfErr } = await supabase
        .from('users_pabx')
        .select('id')
        .filter('metadata->>cpf_cnpj', 'eq', normalizedCpfCnpj)
        .limit(1)
        .maybeSingle();
      if (cpfErr) {
        console.error('⚠️  Erro ao checar CPF/CNPJ existente:', cpfErr);
      }
      if (cpfHit) {
        return res.status(409).json({ success: false, message: 'Este CPF/CNPJ já está em uso' });
      }
    }

    // Gerar username único
    const baseFromEmail = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    const baseFromName = (name || 'user')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '') || 'user';
    let usernameCandidate = baseFromEmail || baseFromName || `user${Math.floor(Math.random()*1000)}`;
    for (let i = 0; i < 5; i++) {
      const { data: uCheck } = await supabase
        .from('users_pabx')
        .select('id')
        .eq('username', usernameCandidate)
        .maybeSingle();
      if (!uCheck) break;
      usernameCandidate = `${baseFromEmail || baseFromName}.${Math.floor(Math.random()*10000)}`;
    }

    // Hash senha
    const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Metadata
    const metadata = {
      ...(normalizedCpfCnpj ? { cpf_cnpj: normalizedCpfCnpj } : {}),
      ...(referral ? { referral } : {}),
      signup_source: 'public',
      signup_at: new Date().toISOString()
    };

    // Criar usuário
    const { data: created, error: insErr } = await supabase
      .from('users_pabx')
      .insert({
        username: usernameCandidate,
        email,
        password_hash,
        name,
        phone: phone || null,
        role: 'user',
        status: 'active',
        credits: 0,
        max_concurrent_calls: 0,
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR',
        metadata
      })
      .select('*')
      .single();

    if (insErr) {
      console.error('❌ Erro ao criar usuário:', insErr);
      return res.status(400).json({ success: false, message: 'Não foi possível criar o usuário', error: insErr.message });
    }

    const user = new User(created);

    // Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h', issuer: 'pabx-system', audience: 'pabx-users' }
    );

    // Sessão Redis
    const sessionKey = `session:${user.id}`;
    await cacheService.set(sessionKey, {
      userId: user.id,
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }, 24 * 60 * 60);

    const daysRemaining = (() => {
      try {
        if (!user.planExpiresAt) return null;
        const end = new Date(user.planExpiresAt);
        if (isNaN(end.getTime())) return null;
        const now = new Date();
        const startUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
        const diff = Math.floor((endUTC - startUTC) / 86400000);
        return Math.max(0, diff);
      } catch (_) { return null; }
    })();
    const userData = {
      // básicos
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
      role: user.role,
      status: user.status,
      credits: user.credits || 0,
      // relacionamento / limites
      planId: user.planId,
      parentResellerId: user.parentResellerId,
      maxConcurrentCalls: user.maxConcurrentCalls,
      // datas
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: null,
      // Dias restantes do plano
      daysRemaining,
      days_remaining: daysRemaining,
      // preferências
      timezone: user.timezone,
      language: user.language,
      settings: user.settings,
      metadata: user.metadata,
      // plano
      planActivatedAt: user.planActivatedAt,
      planExpiresAt: user.planExpiresAt,
      planStatus: user.planStatus,
      // adicionais
      createdBy: user.createdBy,
      webrtc: user.webrtc,
      autoDiscagem: user.autoDiscagem,
      upAudio: user.upAudio,
      smsEnvio: user.smsEnvio,
      maillingUp: user.maillingUp,
      planFree: user.planFree,
      totalCall: user.totalCall,
      // aliases snake_case
      plan_id: user.planId,
      parent_reseller_id: user.parentResellerId,
      max_concurrent_calls: user.maxConcurrentCalls,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login_at: null,
      created_by: user.createdBy,
      plan_activated_at: user.planActivatedAt,
      plan_expires_at: user.planExpiresAt,
      plan_status: user.planStatus,
      auto_discagem: user.autoDiscagem,
      up_audio: user.upAudio,
      sms_send: user.smsEnvio,
      mailling_up: user.maillingUp,
      plan_free: user.planFree,
      total_call: user.totalCall
    };

    console.log(`✅ Cadastro realizado: ${user.email}`);
    return res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso',
      data: { user: sanitizeUserOutput(userData), token, expiresIn: '24h' }
    });
  } catch (error) {
    console.error('❌ Erro no cadastro público:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor', error: error.message });
  }
});

module.exports = router;
