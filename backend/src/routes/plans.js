const express = require('express');
const { body, validationResult } = require('express-validator');
const Plan = require('../models/Plan');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/plans - Buscar todos os planos
router.get('/', async (req, res) => {
  try {
    console.log('🔄 API: Buscando todos os planos...');
    
    const filters = {};
    
    // Filtro por status (opcional)
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    const plans = await Plan.findAll(filters);
    
    // Buscar contagem de usuários para cada plano
    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const userCount = await Plan.getUserCountByPlan(plan.id);
        return {
          ...plan.toJSON(),
          userCount
        };
      })
    );
    
    res.json({
      success: true,
      data: plansWithCounts
    });
    
    console.log(`✅ API: ${plans.length} planos retornados`);
  } catch (error) {
    console.error('❌ API: Erro ao buscar planos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/plans/active - Buscar apenas planos ativos
router.get('/active', async (req, res) => {
  try {
    console.log('🔄 API: Buscando planos ativos...');
    
    const plans = await Plan.findActive();
    
    res.json({
      success: true,
      data: plans.map(plan => plan.toJSON())
    });
    
    console.log(`✅ API: ${plans.length} planos ativos retornados`);
  } catch (error) {
    console.error('❌ API: Erro ao buscar planos ativos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/plans/:id - Buscar plano por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 API: Buscando plano por ID:', id);
    
    const plan = await Plan.findById(id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }
    
    // Buscar contagem de usuários
    const userCount = await Plan.getUserCountByPlan(plan.id);
    
    res.json({
      success: true,
      data: {
        ...plan.toJSON(),
        userCount
      }
    });
    
    console.log('✅ API: Plano encontrado:', plan.name);
  } catch (error) {
    console.error('❌ API: Erro ao buscar plano por ID:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/plans - Criar novo plano (sem autenticação JWT por enquanto)
router.post('/', 
  [
    body('name')
      .notEmpty()
      .withMessage('Nome do plano é obrigatório')
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('price')
      .isNumeric()
      .withMessage('Preço deve ser um número')
      .isFloat({ min: 0 })
      .withMessage('Preço deve ser maior ou igual a zero'),
    body('max_agents')
      .isInt({ min: 1 })
      .withMessage('Máximo de agentes deve ser um número inteiro maior que zero'),
    body('period_days')
      .isInt({ min: 1 })
      .withMessage('Período em dias deve ser um número inteiro maior que zero'),
    body('features')
      .isArray()
      .withMessage('Recursos devem ser um array'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Descrição deve ter no máximo 500 caracteres')
  ],
  async (req, res) => {
    try {
      console.log('🔍 POST /api/plans - Criando novo plano');
      console.log('🔍 Payload recebido:', JSON.stringify(req.body, null, 2));

      // Verificar erros de validação
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      const { name, slug, price, max_agents, period_days, features, description } = req.body;
      
      console.log('🔄 API: Criando novo plano:', name);
      console.log('🔍 Campos extraídos:', { name, slug, price, max_agents, period_days, features, description });
      
      const plan = await Plan.create({
        name,
        slug,
        price,
        max_agents,
        period_days,
        features,
        description,
        status: 'active'
      });

      res.status(201).json({
        success: true,
        message: 'Plano criado com sucesso',
        data: plan.toJSON()
      });

      console.log('✅ API: Plano criado:', plan.name);
    } catch (error) {
      console.error('❌ API: Erro ao criar plano:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

// PUT /api/plans/:id - Atualizar plano (sem autenticação JWT por enquanto)
router.put('/:id',
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('price')
      .optional()
      .isNumeric()
      .withMessage('Preço deve ser um número')
      .isFloat({ min: 0 })
      .withMessage('Preço deve ser maior ou igual a zero'),
    body('max_agents')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Máximo de agentes deve ser um número inteiro maior que zero'),
    body('period_days')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Período em dias deve ser um número inteiro maior que zero'),
    body('features')
      .optional()
      .isArray()
      .withMessage('Recursos devem ser um array'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Descrição deve ter no máximo 500 caracteres'),
    body('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status deve ser "active" ou "inactive"')
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

      const { id } = req.params;
      console.log('🔄 API: Atualizando plano:', id);
      
      const plan = await Plan.findById(id);
      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plano não encontrado'
        });
      }

      const updatedPlan = await plan.update(req.body);

      res.json({
        success: true,
        message: 'Plano atualizado com sucesso',
        data: updatedPlan.toJSON()
      });

      console.log('✅ API: Plano atualizado:', updatedPlan.name);
    } catch (error) {
      console.error('❌ API: Erro ao atualizar plano:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

// DELETE /api/plans/:id - Excluir plano (sem autenticação JWT por enquanto)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 API: Excluindo plano:', id);
    
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plano não encontrado'
      });
    }

    // Verificar se há usuários usando este plano
    const userCount = await Plan.getUserCountByPlan(id);
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível excluir o plano. Existem ${userCount} usuário(s) utilizando este plano.`
      });
    }

    await plan.delete();

    res.json({
      success: true,
      message: 'Plano excluído com sucesso'
    });

    console.log('✅ API: Plano excluído:', plan.name);
  } catch (error) {
    console.error('❌ API: Erro ao excluir plano:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
