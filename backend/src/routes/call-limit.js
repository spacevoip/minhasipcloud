const express = require('express');
const router = express.Router();
const callLimitService = require('../services/callLimitService');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/call-limit/check/:userId
 * Verifica e aplica limite de chamadas para um usuário específico
 */
router.post('/check/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }

    const wasSuspended = await callLimitService.checkAndApplyCallLimit(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        wasSuspended,
        message: wasSuspended 
          ? 'Usuário suspenso por atingir limite de chamadas' 
          : 'Usuário dentro do limite permitido'
      }
    });
    
  } catch (error) {
    console.error('❌ [API CallLimit] Erro ao verificar limite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/call-limit/check-all
 * Verifica todos os usuários com planos de teste (execução em lote)
 */
router.post('/check-all', authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem executar verificação em lote'
      });
    }

    const result = await callLimitService.checkAllTestPlanUsers();
    
    res.json({
      success: true,
      data: result,
      message: `Verificação concluída. ${result.suspended} usuários suspensos de ${result.totalChecked} verificados`
    });
    
  } catch (error) {
    console.error('❌ [API CallLimit] Erro na verificação em lote:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/call-limit/stats
 * Obtém estatísticas de planos de teste
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem ver estatísticas'
      });
    }

    const stats = await callLimitService.getTestPlanStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ [API CallLimit] Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/call-limit/user/:userId/calls
 * Obtém contagem de chamadas de um usuário específico
 */
router.get('/user/:userId/calls', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID do usuário é obrigatório'
      });
    }

    const callCount = await callLimitService.getUserCallCount(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        callCount
      }
    });
    
  } catch (error) {
    console.error('❌ [API CallLimit] Erro ao obter contagem de chamadas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
