const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Ativar plano de um usuário
router.post('/activate', 
  authenticateToken,
  [
    body('userId').isUUID().withMessage('ID do usuário deve ser um UUID válido'),
    body('planId').isUUID().withMessage('ID do plano deve ser um UUID válido'),
    body('activationDate').optional().isISO8601().withMessage('Data de ativação deve ser uma data válida')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { userId, planId, activationDate } = req.body;
      const activation = activationDate || new Date().toISOString();

      console.log(`🔄 Ativando plano ${planId} para usuário ${userId}`);

      // Usar a função SQL para ativar o plano
      const result = await query(
        'SELECT activate_user_plan($1, $2, $3)',
        [userId, planId, activation]
      );

      console.log('✅ Plano ativado com sucesso');

      res.json({
        success: true,
        message: 'Plano ativado com sucesso',
        data: {
          userId,
          planId,
          activatedAt: activation
        }
      });

    } catch (error) {
      console.error('❌ Erro ao ativar plano:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

// Ativar planos para usuários que ainda não têm ativação
router.post('/activate-missing',
  authenticateToken,
  async (req, res) => {
    try {
      console.log('🔄 Ativando planos para usuários sem data de ativação...');

      // Buscar usuários que têm plano mas não têm data de ativação
      const usersResult = await query(`
        SELECT u.id, u.plan_id, u.created_at
        FROM users_pabx u
        WHERE u.plan_id IS NOT NULL 
        AND u.plan_activated_at IS NULL
      `);

      const users = usersResult.rows;
      console.log(`📊 Encontrados ${users.length} usuários para ativar planos`);

      let activatedCount = 0;

      for (const user of users) {
        try {
          // Usar a data de criação do usuário como data de ativação
          await query(
            'SELECT activate_user_plan($1, $2, $3)',
            [user.id, user.plan_id, user.created_at]
          );
          activatedCount++;
          console.log(`✅ Plano ativado para usuário ${user.id}`);
        } catch (error) {
          console.error(`❌ Erro ao ativar plano para usuário ${user.id}:`, error);
        }
      }

      res.json({
        success: true,
        message: `${activatedCount} planos ativados com sucesso`,
        data: {
          totalFound: users.length,
          activated: activatedCount
        }
      });

    } catch (error) {
      console.error('❌ Erro ao ativar planos em lote:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

// Verificar status do plano de um usuário
router.get('/status/:userId',
  authenticateToken,
  async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await query(
        'SELECT check_plan_status($1) as status',
        [userId]
      );

      const status = result.rows[0]?.status || 'unknown';

      res.json({
        success: true,
        data: {
          userId,
          planStatus: status
        }
      });

    } catch (error) {
      console.error('❌ Erro ao verificar status do plano:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

// Contar usuários por plano (subscriber count)
router.get('/count-by-plan', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Buscando contadores de usuários por plano...');

    // Query simples e eficiente usando plan_id
    const result = await query(`
      SELECT 
        p.id as plan_id,
        p.name as plan_name,
        COUNT(u.id) as subscriber_count
      FROM planos_pabx p
      LEFT JOIN users_pabx u ON u.plan_id = p.id AND u.plan_id IS NOT NULL
      WHERE p.status = true
      GROUP BY p.id, p.name
      ORDER BY p.name
    `);

    console.log(`✅ Encontrados contadores para ${result.rows.length} planos`);

    // Formatar resposta
    const planCounts = result.rows.map(row => ({
      planId: row.plan_id,
      planName: row.plan_name,
      subscriberCount: parseInt(row.subscriber_count) || 0
    }));

    res.json({
      success: true,
      message: 'Contadores de usuários obtidos com sucesso',
      data: planCounts
    });

  } catch (error) {
    console.error('❌ Erro ao buscar contadores de planos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
