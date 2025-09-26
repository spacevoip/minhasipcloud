const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { supabase } = require('../config/database');

// POST /api/classification - Salvar classificação de chamada
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { rating, reason, number, duration } = req.body || {};

    // Validações básicas
    const parsedRating = parseInt(rating, 10);
    const parsedDuration = parseInt(duration, 10) || 0;
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating inválido. Deve ser um número entre 1 e 5.' });
    }
    if (!number || typeof number !== 'string') {
      return res.status(400).json({ success: false, message: 'Número (phone) é obrigatório.' });
    }

    // Determinar agent_id e user_id
    let agentId = null;
    let userId = null;

    if (req.agent && req.agent.id && req.agent.user_id) {
      agentId = req.agent.id;
      userId = req.agent.user_id;
    } else if (req.user && req.user.id) {
      userId = req.user.id;
      // Buscar agente principal do usuário (fallback)
      const { data: agent, error: aErr } = await supabase
        .from('agentes_pabx')
        .select('id')
        .eq('user_id', req.user.id)
        .limit(1)
        .single();
      if (aErr || !agent) {
        return res.status(400).json({ success: false, message: 'Agente não encontrado para o usuário.' });
      }
      agentId = agent.id;
    } else {
      return res.status(401).json({ success: false, message: 'Não autenticado.' });
    }

    // Inserir classificação
    const { data, error } = await supabase
      .from('contact_classification')
      .insert([
        {
          agent_id: agentId,
          user_id: userId,
          rating: parsedRating,
          reason: reason || null,
          number: number,
          duration: parsedDuration
        }
      ])
      .select('id')
      .single();

    if (error) {
      console.error('❌ [Classification] Erro ao salvar classificação:', error);
      return res.status(500).json({ success: false, message: 'Erro ao salvar classificação' });
    }

    return res.json({ success: true, message: 'Classificação salva com sucesso', data: { id: data?.id } });
  } catch (error) {
    console.error('❌ [Classification] Erro inesperado:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

module.exports = router;
