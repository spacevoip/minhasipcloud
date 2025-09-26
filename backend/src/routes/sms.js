/**
 * ROTAS SMS - API para validação de números móveis
 */

const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');

/**
 * POST /api/sms/send
 * Enviar código SMS para validação
 */
router.post('/send', async (req, res) => {
  try {
    const { phone } = req.body;

    // Validação básica
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone é obrigatório'
      });
    }

    // Validar formato do telefone (mínimo 10 dígitos)
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone inválido'
      });
    }

    // Obter IP e User-Agent para auditoria
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    console.log(`📱 [SMS API] Solicitação de código para ${phone} (IP: ${ipAddress})`);

    // Solicitar código via SMS service
    const result = await smsService.requestCode(phone, ipAddress, userAgent);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        phone: result.phone
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ [SMS API] Erro ao enviar código:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/sms/verify
 * Verificar código SMS
 */
router.post('/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;

    // Validação básica
    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Telefone e código são obrigatórios'
      });
    }

    // Validar formato do código (6 dígitos)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código deve ter 6 dígitos'
      });
    }

    // Obter IP para auditoria
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    console.log(`🔍 [SMS API] Verificação de código para ${phone} (IP: ${ipAddress})`);

    // Verificar código via SMS service
    const result = await smsService.verifyCode(phone, code, ipAddress);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        phone: result.phone
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ [SMS API] Erro ao verificar código:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/sms/status/:phone
 * Verificar se um telefone foi verificado recentemente
 */
router.get('/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone é obrigatório'
      });
    }

    const isVerified = await smsService.isPhoneVerified(phone);

    res.status(200).json({
      success: true,
      phone: phone,
      verified: isVerified
    });

  } catch (error) {
    console.error('❌ [SMS API] Erro ao verificar status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/sms/health
 * Health check da API SMS
 */
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.SEVEN_API_KEY;
    
    res.status(200).json({
      success: true,
      service: 'SMS API',
      status: 'online',
      provider: 'seven.io',
      apiKeyConfigured: hasApiKey,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SMS API] Erro no health check:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
