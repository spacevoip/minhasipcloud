const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Supabase client - usando as mesmas configurações dos outros arquivos
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas para agentAuth');
  console.error('SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'MISSING');
  console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'OK' : 'MISSING');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Agent login endpoint
router.post('/login', async (req, res) => {
  try {
    const { ramal, senha } = req.body;

    // Validate input
    if (!ramal || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Ramal e senha são obrigatórios'
      });
    }

    console.log(`[AGENT AUTH] Tentativa de login - Ramal: ${ramal}`);

    // Query agent from database
    const { data: agent, error } = await supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        senha,
        callerid,
        webrtc,
        bloqueio,
        status_sip,
        classification,
        user_id,
        users_pabx!inner(
          id,
          name,
          email,
          role,
          status,
          plan_status,
          plan_expires_at
        )
      `)
      .eq('ramal', ramal)
      .eq('senha', senha)
      .single();

    if (error || !agent) {
      console.log(`[AGENT AUTH] Login falhou - Ramal: ${ramal}, Error:`, error?.message);
      return res.status(401).json({
        success: false,
        message: 'Ramal ou senha inválidos'
      });
    }

    // Check if agent is blocked (ramal suspenso/bloqueado)
    if (agent.bloqueio) {
      console.log(`[AGENT AUTH] Ramal bloqueado - Ramal: ${ramal}`);
      return res.status(403).json({
        success: false,
        message: 'Ramal bloqueado. Entre em contato com o administrador.'
      });
    }

    // Check owner (users_pabx) status
    // If the owning account is suspended, do not allow agent login
    const ownerStatus = agent?.users_pabx?.status;
    if (ownerStatus === 'suspended') {
      console.log(`[AGENT AUTH] Conta do dono suspensa - Ramal: ${ramal}`);
      return res.status(403).json({
        success: false,
        message: 'Conta suspensa. Entre em contato com o suporte.'
      });
    }
    if (ownerStatus === 'inactive' || ownerStatus === false) {
      console.log(`[AGENT AUTH] Conta do dono inativa - Ramal: ${ramal}`);
      return res.status(403).json({
        success: false,
        message: 'Conta inativa. Entre em contato com o suporte.'
      });
    }

    // Check owner's plan status and expiration
    const ownerPlanStatus = agent?.users_pabx?.plan_status ?? agent?.users_pabx?.planStatus;
    const ownerPlanExpiresAt = agent?.users_pabx?.plan_expires_at ?? agent?.users_pabx?.planExpiresAt;
    const ownerPlanExpiredByDate = ownerPlanExpiresAt ? (new Date(ownerPlanExpiresAt).getTime() <= Date.now()) : false;
    if (ownerPlanStatus === false || ownerPlanExpiredByDate) {
      console.log(`[AGENT AUTH] Plano do dono expirado/inativo - Ramal: ${ramal}`);
      return res.status(403).json({
        success: false,
        message: 'Plano do proprietário expirado ou inativo. Entre em contato com o suporte.'
      });
    }

    // Generate JWT token for agent
    const tokenPayload = {
      id: agent.id,
      ramal: agent.ramal,
      agente_name: agent.agente_name,
      user_id: agent.user_id,
      user_name: agent.users_pabx.name,
      user_email: agent.users_pabx.email,
      user_role: agent.users_pabx.role,
      type: 'agent' // Distinguish from regular user tokens
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Update agent status to online (optional)
    await supabase
      .from('agentes_pabx')
      .update({ 
        status_sip: 'online',
        updated_at: new Date().toISOString()
      })
      .eq('id', agent.id);

    console.log(`[AGENT AUTH] Login bem-sucedido - Ramal: ${ramal}, Agente: ${agent.agente_name}`);

    // Return success response
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token,
        agent: {
          id: agent.id,
          ramal: agent.ramal,
          agente_name: agent.agente_name,
          callerid: agent.callerid,
          webrtc: agent.webrtc,
          status_sip: 'online',
          classification: agent.classification === true,
          user_id: agent.user_id,
          user_name: agent.users_pabx.name,
          user_role: agent.users_pabx.role
        }
      }
    });

  } catch (error) {
    console.error('[AGENT AUTH] Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Agent logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    if (decoded.type !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Token inválido para agente'
      });
    }

    // Update agent status to offline
    await supabase
      .from('agentes_pabx')
      .update({ 
        status_sip: 'offline',
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.id);

    console.log(`[AGENT AUTH] Logout - Ramal: ${decoded.ramal}, Agente: ${decoded.agente_name}`);

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (error) {
    console.error('[AGENT AUTH] Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Get current agent info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    if (decoded.type !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Token inválido para agente'
      });
    }

    // Get current agent data
    const { data: agent, error } = await supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        agente_name,
        callerid,
        webrtc,
        bloqueio,
        status_sip,
        classification,
        chamadas_total,
        chamadas_hoje,
        auto_discagem,
        user_id,
        users_pabx!inner(
          id,
          name,
          email,
          role,
          status
        )
      `)
      .eq('id', decoded.id)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        message: 'Agente não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          ramal: agent.ramal,
          agente_name: agent.agente_name,
          callerid: agent.callerid,
          webrtc: agent.webrtc,
          status_sip: agent.status_sip,
          classification: agent.classification === true,
          chamadas_total: agent.chamadas_total,
          chamadas_hoje: agent.chamadas_hoje,
          auto_discagem: agent.auto_discagem,
          user_id: agent.user_id,
          user_name: agent.users_pabx.name,
          user_role: agent.users_pabx.role,
          blocked: agent.bloqueio
        }
      }
    });

  } catch (error) {
    console.error('[AGENT AUTH] Erro ao buscar dados do agente:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;

// ============================================================================
// Novo endpoint: GET /agent-auth/ramal-status
// Permite ao frontend verificar status do ramal e da conta do dono antes do login
// ============================================================================
router.get('/ramal-status', async (req, res) => {
  try {
    const { ramal } = req.query;
    if (!ramal || typeof ramal !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Parâmetro "ramal" é obrigatório'
      });
    }

    const { data: agent, error } = await supabase
      .from('agentes_pabx')
      .select(`
        id,
        ramal,
        bloqueio,
        status_sip,
        user_id,
        users_pabx!inner(
          id,
          status,
          name,
          plan_status,
          plan_expires_at
        )
      `)
      .eq('ramal', ramal)
      .single();

    if (error || !agent) {
      return res.status(404).json({
        success: false,
        message: 'Ramal não encontrado'
      });
    }

    return res.json({
      success: true,
      data: {
        ramal: agent.ramal,
        agent_id: agent.id,
        agent_blocked: !!agent.bloqueio,
        agent_status_sip: agent.status_sip,
        owner_user_id: agent.users_pabx.id,
        owner_status: agent.users_pabx.status,
        owner_name: agent.users_pabx.name,
        owner_plan_status: agent.users_pabx.plan_status ?? null,
        owner_plan_expires_at: agent.users_pabx.plan_expires_at ?? null,
        owner_plan_expired: (() => {
          try {
            const v = agent.users_pabx.plan_expires_at;
            if (!v) return false;
            return new Date(v).getTime() <= Date.now();
          } catch (_) {
            return false;
          }
        })()
      }
    });
  } catch (error) {
    console.error('[AGENT AUTH] Erro no ramal-status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});
