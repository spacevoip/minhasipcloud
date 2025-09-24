const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const Joi = require('joi');
const winston = require('winston');
const bcrypt = require('bcrypt');

// ================================
// CONFIGURAÇÕES
// ================================
const app = express();
const PORT = process.env.PORT || 3000;

// Logger configurado
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'api.log' })
  ]
});

// Pool de conexão PostgreSQL com tratamento de erro
const pool = new Pool({
  host: '31.97.84.157',
  port: 5432,
  database: 'postgres',
  user: 'postgres.meuapp',
  password: '35981517Biu',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Tratar erros de conexão para não crashar o servidor
pool.on('error', (err) => {
  logger.error('Erro inesperado no pool de conexão:', err);
});

// Teste inicial de conexão
pool.connect((err, client, release) => {
  if (err) {
    logger.error('Erro ao conectar com PostgreSQL:', err);
  } else {
    logger.info('✅ Conectado ao PostgreSQL');
    release();
  }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de log
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ================================
// VALIDAÇÕES SCHEMAS
// ================================
const userCreateSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(6).optional(),
  name: Joi.string().max(100).required(),
  company: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  role: Joi.string().valid('admin', 'user', 'collaborator').default('user'),
  status: Joi.string().valid('active', 'pending', 'suspended').default('pending'),
  credits: Joi.number().min(0).optional(),
  plan_id: Joi.string().uuid().optional(),
  max_concurrent_calls: Joi.number().integer().min(0).optional(),
  timezone: Joi.string().max(50).optional(),
  language: Joi.string().max(5).optional(),
  settings: Joi.object().optional(),
  metadata: Joi.object().optional()
});

const planoCreateSchema = Joi.object({
  name: Joi.string().max(100).required(),
  slug: Joi.string().max(50).required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('BRL'),
  max_agents: Joi.number().integer().min(1).required(),
  period_days: Joi.number().integer().min(1).required(),
  calls_unlimited: Joi.boolean().default(true),
  description: Joi.string().required(),
  short_description: Joi.string().max(255).optional(),
  is_popular: Joi.boolean().default(false),
  is_featured: Joi.boolean().default(false),
  color: Joi.string().max(7).default('#64748b'),
  icon: Joi.string().max(50).default('package'),
  display_order: Joi.number().integer().optional(),
  status: Joi.string().valid('active', 'inactive').default('active'),
  visibility: Joi.string().valid('public', 'private').default('public'),
  trial_days: Joi.number().integer().min(0).optional(),
  setup_fee: Joi.number().min(0).optional(),
  max_storage_gb: Joi.number().integer().min(1).default(10),
  max_concurrent_calls: Joi.number().integer().min(1).optional(),
  recording_enabled: Joi.boolean().default(true),
  api_access: Joi.boolean().default(false),
  priority_support: Joi.boolean().default(false),
  features: Joi.array().optional(),
  metadata: Joi.object().optional()
});

const agenteCreateSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  ramal: Joi.string().max(10).required(),
  agente_name: Joi.string().max(100).required(),
  senha: Joi.string().max(50).required(),
  callerid: Joi.string().max(50).optional(),
  webrtc: Joi.boolean().default(false),
  bloqueio: Joi.boolean().default(false),
  status_sip: Joi.string().valid('online', 'offline', 'busy').default('offline')
});

// ================================
// HELPER FUNCTIONS
// ================================
const handleError = (res, error, message = 'Erro interno do servidor') => {
  logger.error(`${message}: ${error.message}`);
  res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

const handleNotFound = (res, message = 'Recurso não encontrado') => {
  res.status(404).json({
    success: false,
    message
  });
};

// ================================
// ROUTES - USUÁRIOS
// ================================

// GET /api/users - Listar todos os usuários com planos
app.get('/api/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, role } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [limit, offset];
    let paramCount = 2;
    
    if (status) {
      paramCount++;
      whereClause += ` AND u.status = $${paramCount}`;
      params.push(status);
    }
    
    if (role) {
      paramCount++;
      whereClause += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    const query = `
      SELECT 
        u.*,
        p.name as plano_nome,
        p.price as plano_preco,
        p.max_agents as plano_max_agentes,
        p.period_days as plano_periodo_dias,
        p.status as plano_status,
        COUNT(a.id) as total_agentes
      FROM users_pabx u
      LEFT JOIN planos_pabx p ON u.plan_id = p.id
      LEFT JOIN agentes_pabx a ON u.id = a.user_id
      WHERE 1=1 ${whereClause}
      GROUP BY u.id, p.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM users_pabx u 
      WHERE 1=1 ${whereClause}
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar usuários');
  }
});

// GET /api/users/:id - Buscar usuário por ID com dados completos
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar dados do usuário + plano
    const userQuery = `
      SELECT 
        u.*,
        p.name as plano_nome,
        p.slug as plano_slug,
        p.price as plano_preco,
        p.currency as plano_moeda,
        p.max_agents as plano_max_agentes,
        p.period_days as plano_periodo_dias,
        p.max_concurrent_calls as plano_max_chamadas,
        p.recording_enabled as plano_gravacao,
        p.api_access as plano_api,
        p.features as plano_features,
        p.status as plano_status,
        p.description as plano_descricao
      FROM users_pabx u
      LEFT JOIN planos_pabx p ON u.plan_id = p.id
      WHERE u.id = $1
    `;

    // Buscar TODOS os agentes/ramais do usuário + status online COMPLETO
    const agentesQuery = `
      SELECT 
        a.id as agente_id,
        a.user_id,
        a.ramal,
        a.agente_name,
        a.senha,
        a.callerid,
        a.webrtc,
        a.bloqueio,
        a.status_sip,
        a.created_at as agente_criado_em,
        a.updated_at as agente_atualizado_em,
        a.chamadas_total,
        a.chamadas_hoje,
        CASE 
          WHEN pc.endpoint IS NOT NULL THEN 'online'
          ELSE 'offline'
        END as status_real,
        pc.status as ps_status,
        pc.user_agent,
        pc.expiration_time,
        pc.via_addr,
        pc.call_id,
        pc.chamada as em_chamada
      FROM agentes_pabx a
      LEFT JOIN ps_contacts pc ON a.ramal = pc.endpoint
      WHERE a.user_id = $1
      ORDER BY a.ramal ASC
    `;

    const [userResult, agentesResult] = await Promise.all([
      pool.query(userQuery, [id]),
      pool.query(agentesQuery, [id])
    ]);

    if (userResult.rows.length === 0) {
      return handleNotFound(res, 'Usuário não encontrado');
    }

    const userData = userResult.rows[0];
    const agentesData = agentesResult.rows;

    logger.info(`Consultando usuário ${id} - Encontrados ${agentesData.length} agentes`);

    // Separar dados do usuário e do plano
    const user = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      name: userData.name,
      company: userData.company,
      phone: userData.phone,
      role: userData.role,
      status: userData.status,
      credits: userData.credits,
      plan_id: userData.plan_id,
      max_concurrent_calls: userData.max_concurrent_calls,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
      last_login_at: userData.last_login_at,
      timezone: userData.timezone,
      language: userData.language,
      settings: userData.settings,
      metadata: userData.metadata,
      plan_activated_at: userData.plan_activated_at,
      plan_expires_at: userData.plan_expires_at,
      plan_status: userData.plan_status
    };

    const plano = userData.plan_id ? {
      id: userData.plan_id,
      nome: userData.plano_nome,
      slug: userData.plano_slug,
      preco: userData.plano_preco,
      moeda: userData.plano_moeda,
      max_agentes: userData.plano_max_agentes,
      periodo_dias: userData.plano_periodo_dias,
      max_chamadas: userData.plano_max_chamadas,
      gravacao: userData.plano_gravacao,
      api_access: userData.plano_api,
      features: userData.plano_features,
      status: userData.plano_status,
      descricao: userData.plano_descricao
    } : null;

    // Formatar dados dos agentes com TODAS as informações
    const agentesFormatados = agentesData.map(agente => ({
      id: agente.agente_id,
      user_id: agente.user_id,
      ramal: agente.ramal,
      nome: agente.agente_name,
      senha: agente.senha,
      callerid: agente.callerid,
      webrtc: agente.webrtc,
      bloqueio: agente.bloqueio,
      status_sip: agente.status_sip,
      status_real: agente.status_real,
      em_chamada: agente.em_chamada,
      chamadas_total: agente.chamadas_total || 0,
      chamadas_hoje: agente.chamadas_hoje || 0,
      criado_em: agente.agente_criado_em,
      atualizado_em: agente.agente_atualizado_em,
      // Dados do ps_contacts (status online)
      ps_status: agente.ps_status,
      user_agent: agente.user_agent,
      expiration_time: agente.expiration_time,
      via_addr: agente.via_addr,
      call_id: agente.call_id
    }));

    const agentesOnline = agentesFormatados.filter(a => a.status_real === 'online');
    const agentesOffline = agentesFormatados.filter(a => a.status_real === 'offline');

    res.json({
      success: true,
      data: {
        user,
        plano,
        agentes: agentesFormatados,
        resumo: {
          total_agentes: agentesFormatados.length,
          agentes_online: agentesOnline.length,
          agentes_offline: agentesOffline.length,
          limite_plano: plano ? plano.max_agentes : null,
          agentes_disponiveis: plano ? (plano.max_agentes - agentesFormatados.length) : null
        },
        agentes_detalhados: {
          online: agentesOnline,
          offline: agentesOffline
        }
      }
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar usuário');
  }
});

// POST /api/users - Criar novo usuário
app.post('/api/users', async (req, res) => {
  try {
    const { error, value } = userCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(d => d.message)
      });
    }

    // Verificar se username e email são únicos
    const checkQuery = `
      SELECT id FROM users_pabx 
      WHERE username = $1 OR email = $2
    `;
    const checkResult = await pool.query(checkQuery, [value.username, value.email]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username ou email já existe'
      });
    }

    // Se plan_id fornecido, verificar se existe
    if (value.plan_id) {
      const planQuery = 'SELECT id FROM planos_pabx WHERE id = $1 AND status = $2';
      const planResult = await pool.query(planQuery, [value.plan_id, 'active']);
      
      if (planResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Plano não encontrado ou inativo'
        });
      }
    }

    // Hash da senha se fornecida (bcrypt para USUÁRIOS)
    let passwordHash = null;
    if (value.password) {
      passwordHash = await bcrypt.hash(value.password, 10);
    }

    const insertQuery = `
      INSERT INTO users_pabx (
        username, email, password_hash, name, company, phone, role, status,
        credits, plan_id, max_concurrent_calls, timezone, language, settings, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *
    `;

    const insertValues = [
      value.username, value.email, passwordHash, value.name, value.company,
      value.phone, value.role, value.status, value.credits, value.plan_id,
      value.max_concurrent_calls, value.timezone, value.language,
      value.settings || {}, value.metadata || {}
    ];

    const result = await pool.query(insertQuery, insertValues);

    // Remove password_hash da resposta por segurança
    const responseData = { ...result.rows[0] };
    delete responseData.password_hash;

    logger.info(`Usuário criado: ${result.rows[0].id} - ${result.rows[0].username}`);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: responseData
    });

  } catch (error) {
    handleError(res, error, 'Erro ao criar usuário');
  }
});

// DELETE /api/users/:id - Deletar usuário
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se usuário existe
    const checkUser = await pool.query('SELECT username FROM users_pabx WHERE id = $1', [id]);
    if (checkUser.rows.length === 0) {
      return handleNotFound(res, 'Usuário não encontrado');
    }

    // Verificar se há agentes associados
    const agentesCheck = await pool.query('SELECT COUNT(*) as count FROM agentes_pabx WHERE user_id = $1', [id]);
    const totalAgentes = parseInt(agentesCheck.rows[0].count);

    if (totalAgentes > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível deletar usuário. Existem ${totalAgentes} agente(s) associado(s).`
      });
    }

    await pool.query('DELETE FROM users_pabx WHERE id = $1', [id]);

    logger.info(`Usuário deletado: ${id} - ${checkUser.rows[0].username}`);

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });

  } catch (error) {
    handleError(res, error, 'Erro ao deletar usuário');
  }
});

// ================================
// ROUTES - PLANOS
// ================================

// GET /api/planos - Listar todos os planos
app.get('/api/planos', async (req, res) => {
  try {
    const { status, visibility } = req.query;
    
    let whereClause = '';
    let params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (visibility) {
      paramCount++;
      whereClause += ` AND visibility = $${paramCount}`;
      params.push(visibility);
    }

    const query = `
      SELECT 
        p.*,
        COUNT(u.id) as total_usuarios,
        COUNT(CASE WHEN u.status = 'active' THEN 1 END) as usuarios_ativos
      FROM planos_pabx p
      LEFT JOIN users_pabx u ON p.id = u.plan_id
      WHERE 1=1 ${whereClause}
      GROUP BY p.id
      ORDER BY p.display_order ASC, p.price ASC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar planos');
  }
});

// GET /api/planos/:id - Buscar plano por ID
app.get('/api/planos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const planoQuery = `
      SELECT 
        p.*,
        COUNT(u.id) as total_usuarios,
        COUNT(CASE WHEN u.status = 'active' THEN 1 END) as usuarios_ativos
      FROM planos_pabx p
      LEFT JOIN users_pabx u ON p.id = u.plan_id
      WHERE p.id = $1
      GROUP BY p.id
    `;

    const usuariosQuery = `
      SELECT id, username, email, name, status, created_at
      FROM users_pabx 
      WHERE plan_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const [planoResult, usuariosResult] = await Promise.all([
      pool.query(planoQuery, [id]),
      pool.query(usuariosQuery, [id])
    ]);

    if (planoResult.rows.length === 0) {
      return handleNotFound(res, 'Plano não encontrado');
    }

    res.json({
      success: true,
      data: {
        plano: planoResult.rows[0],
        usuarios_recentes: usuariosResult.rows
      }
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar plano');
  }
});

// POST /api/planos - Criar novo plano
app.post('/api/planos', async (req, res) => {
  try {
    const { error, value } = planoCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(d => d.message)
      });
    }

    // Verificar se slug é único
    const checkSlug = await pool.query('SELECT id FROM planos_pabx WHERE slug = $1', [value.slug]);
    if (checkSlug.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Slug já existe'
      });
    }

    const insertQuery = `
      INSERT INTO planos_pabx (
        name, slug, price, currency, max_agents, period_days, calls_unlimited,
        description, short_description, is_popular, is_featured, color, icon,
        display_order, status, visibility, trial_days, setup_fee, max_storage_gb,
        max_concurrent_calls, recording_enabled, api_access, priority_support,
        features, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING *
    `;

    const insertValues = [
      value.name, value.slug, value.price, value.currency, value.max_agents,
      value.period_days, value.calls_unlimited, value.description, value.short_description,
      value.is_popular, value.is_featured, value.color, value.icon, value.display_order,
      value.status, value.visibility, value.trial_days, value.setup_fee,
      value.max_storage_gb, value.max_concurrent_calls, value.recording_enabled,
      value.api_access, value.priority_support, value.features || [], value.metadata || {}
    ];

    const result = await pool.query(insertQuery, insertValues);

    logger.info(`Plano criado: ${result.rows[0].id} - ${result.rows[0].name}`);

    res.status(201).json({
      success: true,
      message: 'Plano criado com sucesso',
      data: result.rows[0]
    });

  } catch (error) {
    handleError(res, error, 'Erro ao criar plano');
  }
});

// DELETE /api/planos/:id - Deletar plano
app.delete('/api/planos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se plano existe
    const checkPlano = await pool.query('SELECT name FROM planos_pabx WHERE id = $1', [id]);
    if (checkPlano.rows.length === 0) {
      return handleNotFound(res, 'Plano não encontrado');
    }

    // Verificar se há usuários associados
    const usuariosCheck = await pool.query('SELECT COUNT(*) as count FROM users_pabx WHERE plan_id = $1', [id]);
    const totalUsuarios = parseInt(usuariosCheck.rows[0].count);

    if (totalUsuarios > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível deletar plano. Existem ${totalUsuarios} usuário(s) associado(s).`
      });
    }

    await pool.query('DELETE FROM planos_pabx WHERE id = $1', [id]);

    logger.info(`Plano deletado: ${id} - ${checkPlano.rows[0].name}`);

    res.json({
      success: true,
      message: 'Plano deletado com sucesso'
    });

  } catch (error) {
    handleError(res, error, 'Erro ao deletar plano');
  }
});

// ================================
// ROUTES - AGENTES
// ================================

// GET /api/agentes - Listar todos os agentes
app.get('/api/agentes', async (req, res) => {
  try {
    const { user_id, status_online } = req.query;
    
    let whereClause = '';
    let params = [];
    let paramCount = 0;
    
    if (user_id) {
      paramCount++;
      whereClause += ` AND a.user_id = $${paramCount}`;
      params.push(user_id);
    }

    const query = `
      SELECT 
        a.*,
        u.username,
        u.name as user_name,
        u.email as user_email,
        CASE 
          WHEN pc.endpoint IS NOT NULL THEN 'online'
          ELSE 'offline'
        END as status_real,
        pc.status as ps_status,
        pc.user_agent,
        pc.expiration_time
      FROM agentes_pabx a
      INNER JOIN users_pabx u ON a.user_id = u.id
      LEFT JOIN ps_contacts pc ON a.ramal = pc.endpoint
      WHERE 1=1 ${whereClause}
      ${status_online === 'true' ? 'AND pc.endpoint IS NOT NULL' : ''}
      ORDER BY a.ramal
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      resumo: {
        total: result.rows.length,
        online: result.rows.filter(a => a.status_real === 'online').length,
        offline: result.rows.filter(a => a.status_real === 'offline').length
      }
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar agentes');
  }
});

// GET /api/agentes/online - Agentes online
app.get('/api/agentes/online', async (req, res) => {
  try {
    const query = `
      SELECT 
        a.*,
        u.username,
        u.name as user_name,
        pc.status as ps_status,
        pc.user_agent,
        pc.expiration_time
      FROM agentes_pabx a
      INNER JOIN users_pabx u ON a.user_id = u.id
      INNER JOIN ps_contacts pc ON a.ramal = pc.endpoint
      ORDER BY a.ramal
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows,
      total_online: result.rows.length
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar agentes online');
  }
});

// GET /api/agentes/:id - Buscar agente por ID
app.get('/api/agentes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        a.*,
        u.username,
        u.name as user_name,
        u.email as user_email,
        u.company,
        CASE 
          WHEN pc.endpoint IS NOT NULL THEN 'online'
          ELSE 'offline'
        END as status_real,
        pc.status as ps_status,
        pc.user_agent,
        pc.expiration_time
      FROM agentes_pabx a
      INNER JOIN users_pabx u ON a.user_id = u.id
      LEFT JOIN ps_contacts pc ON a.ramal = pc.endpoint
      WHERE a.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return handleNotFound(res, 'Agente não encontrado');
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar agente');
  }
});

// POST /api/agentes - Criar novo agente
app.post('/api/agentes', async (req, res) => {
  try {
    const { error, value } = agenteCreateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(d => d.message)
      });
    }

    // Verificar se user_id existe
    const userCheck = await pool.query('SELECT id FROM users_pabx WHERE id = $1', [value.user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Verificar se ramal é único
    const ramalCheck = await pool.query('SELECT id FROM agentes_pabx WHERE ramal = $1', [value.ramal]);
    if (ramalCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ramal já existe'
      });
    }

    const insertQuery = `
      INSERT INTO agentes_pabx (
        user_id, ramal, agente_name, senha, callerid, webrtc, bloqueio, status_sip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const insertValues = [
      value.user_id, value.ramal, value.agente_name, value.senha,
      value.callerid, value.webrtc, value.bloqueio, value.status_sip
    ];

    const result = await pool.query(insertQuery, insertValues);

    logger.info(`Agente criado: ${result.rows[0].id} - Ramal ${result.rows[0].ramal}`);

    res.status(201).json({
      success: true,
      message: 'Agente criado com sucesso',
      data: result.rows[0]
    });

  } catch (error) {
    handleError(res, error, 'Erro ao criar agente');
  }
});

// DELETE /api/agentes/:id - Deletar agente
app.delete('/api/agentes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se agente existe
    const checkAgente = await pool.query('SELECT ramal FROM agentes_pabx WHERE id = $1', [id]);
    if (checkAgente.rows.length === 0) {
      return handleNotFound(res, 'Agente não encontrado');
    }

    await pool.query('DELETE FROM agentes_pabx WHERE id = $1', [id]);

    logger.info(`Agente deletado: ${id} - Ramal ${checkAgente.rows[0].ramal}`);

    res.json({
      success: true,
      message: 'Agente deletado com sucesso'
    });

  } catch (error) {
    handleError(res, error, 'Erro ao deletar agente');
  }
});

// ================================
// ROUTES - DASHBOARD & ESTATÍSTICAS
// ================================

// GET /api/dashboard/stats - Estatísticas gerais
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users_pabx) as total_usuarios,
        (SELECT COUNT(*) FROM users_pabx WHERE status = 'active') as usuarios_ativos,
        (SELECT COUNT(*) FROM planos_pabx WHERE status = 'active') as planos_ativos,
        (SELECT COUNT(*) FROM agentes_pabx) as total_agentes,
        (SELECT COUNT(*) FROM ps_contacts) as agentes_online,
        (SELECT COALESCE(SUM(credits), 0) FROM users_pabx) as total_credits
    `;

    const planosStatsQuery = `
      SELECT 
        p.name,
        COUNT(u.id) as usuarios_count,
        COALESCE(SUM(u.credits), 0) as total_credits
      FROM planos_pabx p
      LEFT JOIN users_pabx u ON p.id = u.plan_id
      GROUP BY p.id, p.name
      ORDER BY usuarios_count DESC
    `;

    const [statsResult, planosStatsResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(planosStatsQuery)
    ]);

    res.json({
      success: true,
      data: {
        geral: statsResult.rows[0],
        planos_stats: planosStatsResult.rows
      }
    });

  } catch (error) {
    handleError(res, error, 'Erro ao buscar estatísticas');
  }
});

// ================================
// MIDDLEWARE DE ERRO & INICIALIZAÇÃO
// ================================

// Middleware de erro global
app.use((err, req, res, next) => {
  logger.error(`Erro não tratado: ${err.message}`);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor'
  });
});

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Inicializar servidor
app.listen(PORT, () => {
  logger.info(`🚀 API PABX rodando na porta ${PORT}`);
  logger.info(`📊 Dashboard: http://localhost:${PORT}/api/dashboard/stats`);
  logger.info(`👥 Usuários: http://localhost:${PORT}/api/users`);
  logger.info(`📦 Planos: http://localhost:${PORT}/api/planos`);
  logger.info(`📞 Agentes: http://localhost:${PORT}/api/agentes`);
  logger.info(`⚠️  Edição desabilitada - Apenas GET, POST e DELETE`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Desligando servidor...');
  await pool.end();
  process.exit(0);
});

module.exports = app;