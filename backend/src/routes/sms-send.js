/**
 * ROTAS SMS SEND - API para envio de SMS personalizado
 */

const express = require('express');
const router = express.Router();
const smsSendService = require('../services/smsSendService');

/**
 * POST /api/sms-send/validate
 * Validar mensagem contra text_block
 */
router.post('/validate', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Conteúdo da mensagem é obrigatório'
      });
    }

    const result = await smsSendService.validateMessage(content);
    
    if (result.success) {
      res.json({
        success: true,
        valid: true,
        message: 'Mensagem aprovada para envio'
      });
    } else {
      res.json({
        success: true,
        valid: false,
        blockedPhrase: result.blockedPhrase,
        message: `Não é possível enviar conteúdo contendo a palavra/frase: "${result.blockedPhrase}". Ajuste e tente novamente`
      });
    }
  } catch (error) {
    console.error('❌ Erro ao validar mensagem:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao validar mensagem'
    });
  }
});

/**
 * POST /api/sms-send/send
 * Enviar SMS personalizado
 */
router.post('/send', async (req, res) => {
  try {
    const { userid, agent_id, content, destination } = req.body;

    // Validação básica
    if (!userid || !content || !destination) {
      return res.status(400).json({
        success: false,
        error: 'userid, content e destination são obrigatórios'
      });
    }

    // Validar formato do telefone (mínimo 10 dígitos)
    const digits = destination.replace(/\D/g, '');
    if (digits.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Número de telefone inválido'
      });
    }

    // Validar tamanho do conteúdo (máximo 160 caracteres para SMS)
    if (content.length > 160) {
      return res.status(400).json({
        success: false,
        error: 'Conteúdo deve ter no máximo 160 caracteres'
      });
    }

    // Obter IP e User-Agent para auditoria
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    console.log(`📱 [SMS SEND] Solicitação de envio para ${destination} (IP: ${ipAddress})`);

    // Enviar SMS via service
    const result = await smsSendService.sendSMS(userid, agent_id, content, destination, ipAddress, userAgent);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        sms_id: result.sms_id,
        destination: result.destination
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ [SMS SEND] Erro ao enviar SMS:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/sms-send/status/:sms_id
 * Verificar status de um SMS específico
 */
router.get('/status/:sms_id', async (req, res) => {
  try {
    const { sms_id } = req.params;

    if (!sms_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do SMS é obrigatório'
      });
    }

    const smsStatus = await smsSendService.getSMSStatus(sms_id);

    if (smsStatus) {
      res.status(200).json({
        success: true,
        sms: smsStatus
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'SMS não encontrado'
      });
    }

  } catch (error) {
    console.error('❌ [SMS SEND] Erro ao verificar status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/sms-send/history/:userid
 * Histórico de SMS de um usuário
 */
router.get('/history/:userid', async (req, res) => {
  try {
    const { userid } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!userid) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário é obrigatório'
      });
    }

    const history = await smsSendService.getUserSMSHistory(userid, parseInt(limit), parseInt(offset));

    res.status(200).json({
      success: true,
      history: history,
      total: history.length
    });

  } catch (error) {
    console.error('❌ [SMS SEND] Erro ao buscar histórico:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/sms-send/agent-history/:agent_id
 * Histórico de SMS de um agente
 */
router.get('/agent-history/:agent_id', async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        error: 'ID do agente é obrigatório'
      });
    }

    const history = await smsSendService.getAgentSMSHistory(agent_id, parseInt(limit), parseInt(offset));

    res.status(200).json({
      success: true,
      history: history,
      total: history.length
    });

  } catch (error) {
    console.error('❌ [SMS SEND] Erro ao buscar histórico do agente:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/sms-send/health
 * Health check da API SMS Send
 */
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.SEVEN_API_KEY;
    
    res.status(200).json({
      success: true,
      service: 'SMS Send API',
      status: 'online',
      provider: 'seven.io',
      apiKeyConfigured: hasApiKey,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SMS SEND] Erro no health check:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
