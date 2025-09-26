/**
 * AMI STATUS ROUTES - Monitoramento do pool de conexões AMI
 */

const express = require('express');
const amiService = require('../services/amiService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/ami-status - Status do pool de conexões AMI
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const poolStatus = amiService.getPoolStatus();
    
    res.json({
      success: true,
      data: {
        ...poolStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter status AMI:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter status do AMI',
      error: error.message
    });
  }
});

/**
 * POST /api/ami-status/reconnect - Forçar reconexão do pool AMI
 */
router.post('/reconnect', authenticateToken, async (req, res) => {
  try {
    await amiService.reconnect();
    
    res.json({
      success: true,
      message: 'Pool AMI reconectado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao reconectar AMI:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao reconectar pool AMI',
      error: error.message
    });
  }
});

module.exports = router;
