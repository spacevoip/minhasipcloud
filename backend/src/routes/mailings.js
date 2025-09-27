/**
 * =====================================================
 * MAILINGS API - GERENCIAMENTO DE CAMPANHAS DE EMAIL
 * =====================================================
 * API completa para gerenciamento de campanhas de mailing
 * Operações: GET, POST, DELETE (sem PUT/PATCH seguindo padrão)
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const validator = require('validator');
const { authenticateToken } = require('../middleware/auth');
const { supabase, query: dbQuery } = require('../config/database');
const campaignCacheService = require('../services/campaignCacheService');

const router = express.Router();

// =====================================================
// Middleware: Headers de cache
// =====================================================
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// =====================================================
// Validações reutilizáveis
// =====================================================
const idValidation = [param('id').isUUID().withMessage('ID inválido (UUID esperado)')];

const mailingValidation = [
  body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Nome é obrigatório (máx 255 caracteres)'),
  body('agent_id').optional().custom((value) => {
    if (value !== null && value !== undefined && !validator.isUUID(value)) {
      throw new Error('Agent ID inválido (UUID esperado)');
    }
    return true;
  }),
  body('total').optional().isInt({ min: 0 }).withMessage('Total deve ser um número inteiro positivo'),
  body('content').optional().isObject().withMessage('Content deve ser um objeto JSON'),
  body('status').optional().isIn(['active', 'disabled', 'working']).withMessage('Status inválido')
];

// =====================================================
// GET /api/mailings - LISTAR CAMPANHAS DO USUÁRIO
// =====================================================
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
  query('status').optional().isIn(['active', 'disabled', 'working']).withMessage('Status inválido'),
  query('search').optional().isString().isLength({ max: 255 }).withMessage('Busca muito longa')
], async (req, res) => {
  try {
    console.log(`📧 [MAILINGS] Listando campanhas para usuário: ${req.user.id}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    // Query base - usar LEFT JOIN para incluir campanhas com múltiplos agentes (agent_id = null)
    let query = supabase
      .from('mailings_pabx')
      .select(`
        id,
        name,
        total,
        status,
        created_at,
        updated_at,
        agent_id,
        vinculo_all,
        agentes_pabx(
          id,
          agente_name,
          ramal
        )
      `)
      .eq('user_id', req.user.id);

    // Filtros opcionais
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Paginação e ordenação
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: mailings, error, count } = await query;

    if (error) {
      console.error('❌ [MAILINGS] Erro ao buscar campanhas:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar campanhas' 
      });
    }

    // Contar total para paginação
    const { count: totalCount } = await supabase
      .from('mailings_pabx')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    console.log(`✅ [MAILINGS] ${mailings?.length || 0} campanhas encontradas`);

    res.json({
      success: true,
      data: mailings || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// GET /api/mailings/:campaignId/contacts/resolve - RESOLVER CONTATO POR TELEFONE
// =====================================================
router.get('/:campaignId/contacts/resolve', authenticateToken, [
  param('campaignId').isUUID().withMessage('Campaign ID inválido (UUID esperado)'),
  query('phone').isString().notEmpty().withMessage('Parâmetro phone é obrigatório'),
  query('agentId').optional().isUUID().withMessage('Agent ID inválido (UUID esperado)')
], async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { phone } = req.query;
    const agentId = req.query.agentId || (req.agent && req.agent.id) || null;

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const digits = String(phone).replace(/\D/g, '');
    const candidates = [digits];
    if (digits.startsWith('55') && digits.length > 11) candidates.push(digits.slice(2));
    if (digits.startsWith('0')) candidates.push(digits.replace(/^0+/, ''));

    let q = supabase
      .from('mailings_contacts')
      .select('id, name, phone, dados_extras')
      .eq('mailing_id', campaignId)
      .eq('user_id', req.user.id)
      .in('phone', Array.from(new Set(candidates)))
      .limit(1);

    if (agentId) q = q.eq('agent_id', agentId);

    const { data, error } = await q;
    if (error) {
      console.error('❌ [MAILINGS] Erro ao resolver contato:', error);
      return res.status(500).json({ success: false, error: 'Erro ao resolver contato' });
    }

    return res.json({ success: true, data: data && data[0] ? data[0] : null });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno (resolve):', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});


// =====================================================
// GET /api/mailings/:id - BUSCAR CAMPANHA POR ID
// =====================================================
router.get('/:id', authenticateToken, idValidation, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📧 [MAILINGS] Buscando campanha: ${id}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { data: mailing, error } = await supabase
      .from('mailings_pabx')
      .select(`
        id,
        name,
        total,
        content,
        status,
        created_at,
        updated_at,
        agent_id,
        agentes_pabx!inner(
          id,
          agente_name,
          ramal
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !mailing) {
      console.log(`⚠️ [MAILINGS] Campanha não encontrada: ${id}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Campanha não encontrada' 
      });
    }

    console.log(`✅ [MAILINGS] Campanha encontrada: ${mailing.name}`);

    res.json({
      success: true,
      data: mailing
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// POST /api/mailings - CRIAR NOVA CAMPANHA
// =====================================================
router.post('/', authenticateToken, mailingValidation, async (req, res) => {
  try {
    console.log(`📧 [MAILINGS] Criando nova campanha para usuário: ${req.user.id}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    const { name, agent_id, content = {} } = req.body;
    
    console.log(`🔧 [DEBUG] Dados recebidos na rota:`);
    console.log(`   NAME: ${name}`);
    console.log(`   AGENT_ID: ${agent_id}`);
    console.log(`   CONTENT KEYS: ${Object.keys(content)}`);
    console.log(`   CONTENT.distributionMode: ${content.distributionMode}`);
    console.log(`   CONTENT.selectedAgents: ${JSON.stringify(content.selectedAgents)}`);
    console.log(`   CONTENT.agentDistribution: ${content.agentDistribution}`);
    
    // Extrair contatos e dados de distribuição do objeto content
    const contacts = content.contacts || [];
    const distributionMode = content.distributionMode || 'single';
    const selectedAgents = content.selectedAgents || [];
    const agentDistribution = content.agentDistribution || 'automatic';
    
    console.log(`   CONTACTS: ${contacts.length} contatos`);
    console.log(`   DISTRIBUTION_MODE: ${distributionMode}`);
    console.log(`   SELECTED_AGENTS: ${selectedAgents.length} agentes`);
    console.log(`   AGENT_DISTRIBUTION: ${agentDistribution}`);

    // Verificar se o agente pertence ao usuário (apenas para campanhas com agente único)
    let agent = null;
    if (agent_id) {
      console.log(`🔍 [DEBUG] Verificando agente: ${agent_id} para usuário: ${req.user.id}`);
      
      const { data: agentData, error: agentError } = await supabase
        .from('agentes_pabx')
        .select('id, agente_name')
        .eq('id', agent_id)
        .eq('user_id', req.user.id)
        .single();

      if (agentError || !agentData) {
        console.log(`❌ [DEBUG] Agente não encontrado. Error:`, agentError);
        return res.status(400).json({ 
          success: false, 
          error: 'Agente não encontrado ou não pertence ao usuário' 
        });
      }
      agent = agentData;
    } else if (distributionMode === 'multiple' && selectedAgents.length > 0) {
      console.log(`🔍 [DEBUG] Campanha com múltiplos agentes - validando ramais selecionados`);
      
      // Verificar se todos os agentes selecionados pertencem ao usuário
      const agentIds = selectedAgents.map(a => a.id);
      const { data: agentsData, error: agentsError } = await supabase
        .from('agentes_pabx')
        .select('id, agente_name, ramal')
        .in('id', agentIds)
        .eq('user_id', req.user.id);

      if (agentsError || !agentsData || agentsData.length !== selectedAgents.length) {
        console.log(`❌ [DEBUG] Alguns agentes não encontrados. Error:`, agentsError);
        return res.status(400).json({ 
          success: false, 
          error: 'Alguns agentes selecionados não foram encontrados ou não pertencem ao usuário' 
        });
      }
      
      // Atualizar selectedAgents com dados completos do banco
      selectedAgents.forEach(selectedAgent => {
        const dbAgent = agentsData.find(a => a.id === selectedAgent.id);
        if (dbAgent) {
          selectedAgent.agente_name = dbAgent.agente_name;
          selectedAgent.ramal = dbAgent.ramal;
        }
      });
    } else {
      console.log(`🔍 [DEBUG] Campanha com múltiplos agentes - agent_id é null`);
    }

    // Verificar limite de campanhas por usuário (máximo 3)
    const { data: existingCampaigns, error: countError } = await supabase
      .from('mailings_pabx')
      .select('id', { count: 'exact' })
      .eq('user_id', req.user.id);

    if (countError) {
      console.log(`❌ [DEBUG] Erro ao contar campanhas existentes:`, countError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro interno ao verificar campanhas existentes' 
      });
    }

    const campaignCount = existingCampaigns?.length || 0;
    console.log(`📊 [DEBUG] Usuário ${req.user.id} possui ${campaignCount} campanhas`);

    if (campaignCount >= 3) {
      console.log(`🚫 [DEBUG] Limite de campanhas atingido para usuário ${req.user.id}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Limite máximo de 3 campanhas atingido',
        details: {
          current: campaignCount,
          maximum: 3,
          message: 'Você pode ter no máximo 3 campanhas. Exclua uma campanha existente para criar uma nova.'
        }
      });
    }

    // Usar o serviço otimizado para criar campanha + contatos
    const contactImportService = require('../services/contactImportService');
    
    const campaignData = {
      name,
      agentId: agent_id,
      userId: req.user.id,
      selectedAgents: distributionMode === 'multiple' ? selectedAgents : undefined,
      distributionMode: agentDistribution
    };
    
    const result = await contactImportService.createCampaignWithContacts(campaignData, contacts);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao criar campanha com contatos' 
      });
    }

    console.log(`✅ [MAILINGS] Campanha criada: ${name} (${result.campaignId}) com ${result.imported} contatos`);

    res.status(201).json({
      success: true,
      data: {
        id: result.campaignId,
        name,
        total: result.imported,
        agent_id,
        created_at: new Date().toISOString()
      },
      message: `Campanha criada com ${result.imported} contatos`
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// GET /api/mailings/agent/:agentId - BUSCAR CAMPANHAS POR AGENTE
// =====================================================
router.get('/agent/:agentId', authenticateToken, [
  param('agentId').isUUID().withMessage('Agent ID inválido (UUID esperado)')
], async (req, res) => {
  try {
    const { agentId } = req.params;
    console.log(`📧 [MAILINGS] Buscando campanhas para agente: ${agentId}`);
    console.log(`[MAILINGS] Context: user.id=${req?.user?.id} role=${req?.user?.role} agentTokenUserId=${req?.agent?.user_id || 'n/a'} tokenAgentId=${req?.agent?.id || 'n/a'} ramal=${req?.agent?.ramal || 'n/a'}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    // 1) Tentar agregação via SQL direta (evita RLS e é mais rápida)
    let mailings = [];
    let links = [];
    let usedSql = false;
    try {
      console.log(`🔎 [MAILINGS] SQL agregando campanhas por agent_id=${agentId}`);
      const sql = `
        SELECT
          mc.mailing_id AS id,
          mp.name,
          mp.status,
          COUNT(*)::int AS total
        FROM public.mailings_contacts mc
        JOIN public.mailings_pabx mp ON mp.id = mc.mailing_id
        WHERE mc.agent_id = $1::uuid
        GROUP BY mc.mailing_id, mp.name, mp.status
        ORDER BY mp.name ASC;
      `;
      const result = await dbQuery(sql, [agentId]);
      mailings = result?.rows || [];
      usedSql = true;
      console.log(`📦 [MAILINGS] (SQL) ${mailings.length} campanhas`);
    } catch (sqlErr) {
      console.warn('⚠️ [MAILINGS] SQL falhou, usando Supabase fallback:', sqlErr?.message || sqlErr);
      // 2) Fallback: buscar vínculos e campanhas via Supabase
      try {
        console.log(`🔎 [MAILINGS] Fallback: vínculos mailings_contacts para agent_id=${agentId}`);
        const mcResp = await supabase
          .from('mailings_contacts')
          .select('mailing_id')
          .eq('agent_id', agentId);
        if (mcResp.error) throw mcResp.error;
        links = mcResp.data || [];

        const mailingIds = Array.from(new Set(links.map(r => r.mailing_id).filter(Boolean)));
        console.log(`📊 [MAILINGS] Fallback: ${links.length} links | únicos=${mailingIds.length}`);
        if (mailingIds.length === 0) {
          return res.json({ success: true, data: [] });
        }

        const cResp = await supabase
          .from('mailings_pabx')
          .select('id, name, status')
          .in('id', mailingIds)
          .order('name', { ascending: true });
        if (cResp.error) throw cResp.error;
        mailings = cResp.data || [];
        usedSql = false;
        console.log(`📦 [MAILINGS] Fallback: ${mailings.length} campanhas`);
      } catch (fbErr) {
        console.error('❌ [MAILINGS] Fallback também falhou:', fbErr);
        return res.status(500).json({ success: false, error: 'Erro ao buscar campanhas' });
      }
    }

    // 3) Normalizar saída
    // Se veio pelo SQL, já temos total por campanha para esse agente.
    // Se veio pelo fallback, computar totals a partir dos vínculos carregados.
    let countsMap = {};
    if (!usedSql) {
      countsMap = links.reduce((acc, row) => {
        const id = row.mailing_id;
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});
    }

    const normalized = (mailings || []).map((m) => ({
      ...m,
      total: typeof m.total === 'number' ? m.total : (countsMap[m.id] || 0),
      total_discados: (m.total_discados ?? m.discados ?? 0)
    }));
    console.log(`✅ [MAILINGS] ${normalized.length} campanhas encontradas para agente ${agentId}`);

    res.json({
      success: true,
      data: normalized
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// GET /api/mailings/:campaignId/contacts - BUSCAR CONTATOS DA CAMPANHA
// =====================================================
router.get('/:campaignId/contacts', authenticateToken, [
  param('campaignId').isUUID().withMessage('Campaign ID inválido (UUID esperado)'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limite deve ser entre 1 e 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset deve ser >= 0'),
  query('agentId').optional().isUUID().withMessage('Agent ID inválido (UUID esperado)')
], async (req, res) => {
  try {
    const { campaignId } = req.params;
    const pageParam = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 1000);
    const offset = typeof req.query.offset !== 'undefined' ? Math.max(parseInt(req.query.offset) || 0, 0) : (pageParam - 1) * limit;
    const agentId = req.query.agentId || (req.agent && req.agent.id) || null;
    
    console.log(`📧 [MAILINGS] Buscando contatos da campanha: ${campaignId}, página: ${pageParam}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    // Se houver agentId (ou token de agente), buscar diretamente em mailings_contacts filtrando por agent
    if (agentId) {
      console.log(`📇 [MAILINGS] Buscando contatos por agente: campaignId=${campaignId} agentId=${agentId} userId=${req.user.id} limit=${limit} offset=${offset}`);

      // Buscar contatos paginados + count exato (incluir dados_extras)
      const { data: contacts, error, count } = await supabase
        .from('mailings_contacts')
        .select('id, name, phone, dados_extras', { count: 'exact' })
        .eq('mailing_id', campaignId)
        .eq('user_id', req.user.id)
        .eq('agent_id', agentId)
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('❌ [MAILINGS] Erro ao buscar contatos (agent):', error);
        return res.status(500).json({ success: false, error: 'Erro ao buscar contatos' });
      }

      console.log(`🗄️ [MAILINGS] Contatos (agent) carregados: ${contacts?.length || 0}/${count || 0}`);

      return res.json({
        success: true,
        data: contacts || [],
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      });
    }

    // Sem agentId: usar serviço com cache (compatibilidade legado)
    const result = await campaignCacheService.getContacts(campaignId, req.user.id, pageParam, limit);
    const { contacts, total: totalCount, discados, fromCache } = result;

    console.log(`${fromCache ? '📋' : '🗄️'} [MAILINGS] Contatos ${fromCache ? 'do cache' : 'do banco'}: ${contacts.length}/${totalCount} (${discados} discados)`);

    return res.json({
      success: true,
      data: contacts || [],
      pagination: {
        page: pageParam,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// POST /api/mailings/:campaignId/dial - CONTABILIZAR DISCAGEM
// =====================================================
router.post('/:campaignId/dial', authenticateToken, [
  param('campaignId').isUUID().withMessage('Campaign ID inválido (UUID esperado)'),
  body('contactIndex').isInt({ min: 0 }).withMessage('Contact index deve ser um número inteiro positivo')
], async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { contactIndex } = req.body;
    
    console.log(`📞 [MAILINGS] Contabilizando discagem - Campanha: ${campaignId}, Contato: ${contactIndex}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    // Verificar se a campanha existe e pertence ao usuário
    const { data: campaign, error: campaignError } = await supabase
      .from('mailings_pabx')
      .select('id, name, total_discados')
      .eq('id', campaignId)
      .eq('user_id', req.user.id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campanha não encontrada' 
      });
    }

    // Incrementar contador total de discagens
    const newDiscados = (campaign.total_discados || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('mailings_pabx')
      .update({ 
        total_discados: newDiscados,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('user_id', req.user.id);

    if (updateError) {
      console.error('❌ [MAILINGS] Erro ao atualizar contador de discados:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao contabilizar discagem' 
      });
    }

    // Invalidar cache após discagem
    await campaignCacheService.updateDiscados(campaignId, req.user.id);

    console.log(`✅ [MAILINGS] Discagem contabilizada: ${campaign.name} → ${newDiscados} total_discados`);

    res.json({
      success: true,
      data: {
        total_discados: newDiscados
      },
      message: 'Discagem contabilizada com sucesso'
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// PATCH /api/mailings/:id/status - ALTERAR STATUS DA CAMPANHA
// =====================================================
router.patch('/:id/status', authenticateToken, [
  ...idValidation,
  body('status').isIn(['active', 'disabled', 'working']).withMessage('Status inválido')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    console.log(`📧 [MAILINGS] Alterando status da campanha ${id} para: ${status}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    // Verificar se a campanha existe e pertence ao usuário
    const { data: mailing, error: findError } = await supabase
      .from('mailings_pabx')
      .select('id, name, status')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError || !mailing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campanha não encontrada' 
      });
    }

    // Atualizar status
    const { error: updateError } = await supabase
      .from('mailings_pabx')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (updateError) {
      console.error('❌ [MAILINGS] Erro ao alterar status:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao alterar status da campanha' 
      });
    }

    console.log(`✅ [MAILINGS] Status alterado: ${mailing.name} → ${status}`);

    res.json({
      success: true,
      message: 'Status alterado com sucesso'
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// PATCH /api/mailings/:id/agent - ALTERAR AGENTE DA CAMPANHA
// =====================================================
router.patch('/:id/agent', authenticateToken, [
  ...idValidation,
  body('agent_id').isUUID().withMessage('Agent ID inválido (UUID esperado)')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;
    console.log(`📧 [MAILINGS] Alterando agente da campanha ${id} para: ${agent_id}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    // Verificar se a campanha existe e pertence ao usuário
    const { data: mailing, error: findError } = await supabase
      .from('mailings_pabx')
      .select('id, name, agent_id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError || !mailing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campanha não encontrada' 
      });
    }

    // Verificar se o novo agente pertence ao usuário
    const { data: agent, error: agentError } = await supabase
      .from('agentes_pabx')
      .select('id, agente_name, ramal')
      .eq('id', agent_id)
      .eq('user_id', req.user.id)
      .single();

    if (agentError || !agent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Agente não encontrado ou não pertence ao usuário' 
      });
    }

    // Atualizar agente da campanha
    const { error: updateError } = await supabase
      .from('mailings_pabx')
      .update({ 
        agent_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (updateError) {
      console.error('❌ [MAILINGS] Erro ao alterar agente:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao alterar agente da campanha' 
      });
    }

    console.log(`✅ [MAILINGS] Agente alterado: ${mailing.name} → ${agent.agente_name} (${agent.ramal})`);

    res.json({
      success: true,
      message: 'Agente alterado com sucesso',
      data: {
        agent_id,
        agente_name: agent.agente_name,
        ramal: agent.ramal
      }
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// PATCH /api/mailings/:id/agents - ALTERAR MÚLTIPLOS AGENTES
// =====================================================
router.patch('/:id/agents', authenticateToken, [
  ...idValidation,
  body('agent_ids').isArray().withMessage('agent_ids deve ser um array'),
  body('agent_ids.*').isUUID().withMessage('Todos os agent_ids devem ser UUIDs válidos'),
  body('redistribution_strategy').optional().isIn(['from_end', 'balanced']).withMessage('Estratégia de redistribuição inválida'),
  body('total_contacts').optional().isInt({ min: 0 }).withMessage('Total de contatos deve ser um número positivo')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_ids, redistribution_strategy = 'from_end', total_contacts } = req.body;
    console.log(`📧 [MAILINGS] Alterando agentes da campanha ${id} - ${agent_ids.length} agentes`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    if (agent_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Pelo menos um agente deve ser selecionado' 
      });
    }

    // Verificar se a campanha existe e pertence ao usuário
    const { data: mailing, error: findError } = await supabase
      .from('mailings_pabx')
      .select('id, name, agent_id, vinculo_all, total')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError || !mailing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campanha não encontrada' 
      });
    }

    // Verificar se todos os agentes pertencem ao usuário
    const { data: agents, error: agentsError } = await supabase
      .from('agentes_pabx')
      .select('id, agente_name, ramal')
      .in('id', agent_ids)
      .eq('user_id', req.user.id);

    if (agentsError || !agents || agents.length !== agent_ids.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'Alguns agentes não foram encontrados ou não pertencem ao usuário' 
      });
    }

    // Implementar lógica de redistribuição 'from_end'
    if (redistribution_strategy === 'from_end') {
      console.log(`🔄 [MAILINGS] Redistribuindo contatos usando estratégia 'from_end'`);
      
      // 1. Verificar se existem contatos para esta campanha
      const { data: existingContacts, error: checkError } = await supabase
        .from('contacts_pabx')
        .select('id', { count: 'exact' })
        .eq('mailing_id', id)
        .limit(1);
      
      if (checkError) {
        console.error('❌ [MAILINGS] Erro ao verificar contatos:', checkError);
        return res.status(500).json({ 
          success: false, 
          error: 'Erro ao verificar contatos da campanha' 
        });
      }
      
      if (!existingContacts || existingContacts.length === 0) {
        console.log('⚠️ [MAILINGS] Nenhum contato encontrado para redistribuir');
        // Continuar mesmo sem contatos - apenas atualizar vinculo_all
      } else {
        // 2. Definir agent_id como null para todos os contatos da campanha
        console.log(`🔄 [MAILINGS] Nullificando agent_ids para campanha ${id}`);
        const { error: nullifyError } = await supabase
          .from('contacts_pabx')
          .update({ agent_id: null })
          .eq('mailing_id', id);
        
        console.log(`📊 [MAILINGS] Resultado nullify - Error:`, nullifyError);

        if (nullifyError) {
          console.error('❌ [MAILINGS] Erro ao nullificar agent_ids:', nullifyError);
          return res.status(500).json({ 
            success: false, 
            error: 'Erro ao redistribuir contatos',
            details: nullifyError
          });
        }
      }

      // 3. Redistribuir contatos entre os novos agentes (pegando do final)
      if (existingContacts && existingContacts.length > 0) {
        const contactsPerAgent = Math.floor((total_contacts || mailing.total) / agent_ids.length);
        const remainder = (total_contacts || mailing.total) % agent_ids.length;
        
        console.log(`📊 [MAILINGS] Redistribuição: ${contactsPerAgent} contatos por agente, ${remainder} restantes`);

        for (let i = 0; i < agent_ids.length; i++) {
          const agentId = agent_ids[i];
          const contactsForThisAgent = contactsPerAgent + (i < remainder ? 1 : 0);
          const offset = i * contactsPerAgent + Math.min(i, remainder);

          // Atualizar contatos para este agente (pegando do final da lista)
          // Usar query direta já que RPC ainda não existe
          const { data: contactsToUpdate, error: selectError } = await supabase
            .from('contacts_pabx')
            .select('id')
            .eq('mailing_id', id)
            .is('agent_id', null)
            .order('id', { ascending: false }) // Pegar do final (IDs maiores)
            .limit(contactsForThisAgent);

          if (selectError) {
            console.error(`❌ [MAILINGS] Erro ao buscar contatos para agente ${agentId}:`, selectError);
            continue;
          }

          if (contactsToUpdate && contactsToUpdate.length > 0) {
            const contactIds = contactsToUpdate.map(c => c.id);
            const { error: updateError } = await supabase
              .from('contacts_pabx')
              .update({ agent_id: agentId })
              .in('id', contactIds);

            if (updateError) {
              console.error(`❌ [MAILINGS] Erro ao atualizar contatos para agente ${agentId}:`, updateError);
            } else {
              console.log(`✅ [MAILINGS] ${contactIds.length} contatos atribuídos ao agente ${agentId}`);
            }
          }
        }
      }
    }

    // Atualizar vinculo_all na campanha
    const vinculo_all = agent_ids.join(',');
    const { error: updateError } = await supabase
      .from('mailings_pabx')
      .update({ 
        vinculo_all,
        agent_id: null, // Para campanhas com múltiplos agentes
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (updateError) {
      console.error('❌ [MAILINGS] Erro ao atualizar campanha:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao atualizar campanha' 
      });
    }

    console.log(`✅ [MAILINGS] Agentes alterados: ${mailing.name} → ${agents.length} agentes`);

    res.json({
      success: true,
      message: 'Agentes alterados com sucesso',
      data: {
        agent_ids,
        agents: agents.map(a => ({
          id: a.id,
          name: a.agente_name,
          ramal: a.ramal
        })),
        redistribution_strategy
      }
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

// =====================================================
// DELETE /api/mailings/:id - EXCLUIR CAMPANHA
// =====================================================
router.delete('/:id', authenticateToken, idValidation, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📧 [MAILINGS] Excluindo campanha: ${id}`);

    // Validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dados inválidos', 
        details: errors.array() 
      });
    }

    // Verificar se a campanha existe e pertence ao usuário
    const { data: mailing, error: findError } = await supabase
      .from('mailings_pabx')
      .select('id, name, status')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (findError || !mailing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campanha não encontrada' 
      });
    }

    // Verificar se a campanha não está em execução
    if (mailing.status === 'working') {
      return res.status(400).json({ 
        success: false, 
        error: 'Não é possível excluir campanha em execução' 
      });
    }

    // Excluir campanha
    const { error: deleteError } = await supabase
      .from('mailings_pabx')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      console.error('❌ [MAILINGS] Erro ao excluir campanha:', deleteError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao excluir campanha' 
      });
    }

    console.log(`✅ [MAILINGS] Campanha excluída: ${mailing.name} (${id})`);

    res.json({
      success: true,
      message: 'Campanha excluída com sucesso'
    });

  } catch (error) {
    console.error('❌ [MAILINGS] Erro interno:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    });
  }
});

module.exports = router;
