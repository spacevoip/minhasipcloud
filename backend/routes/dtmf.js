const express = require('express');
const { supabase } = require('../src/config/database');
const router = express.Router();

// GET /api/dtmf/:callId - Buscar dígitos DTMF por ID da chamada
router.get('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    console.log(`[DTMF API] Buscando dígitos para chamada: ${callId}`);
    
    const { data, error } = await supabase
      .from('dtmf_pabx')
      .select('*')
      .eq('id_call', callId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[DTMF API] Erro ao buscar dígitos:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
    
    // Se não encontrou, retornar dígitos vazios
    if (!data) {
      return res.json({
        success: true,
        data: {
          id_call: callId,
          digito: '',
          ramal: null,
          created_at: null
        }
      });
    }
    
    console.log(`[DTMF API] Dígitos encontrados: ${data.digito || 'vazio'}`);
    
    res.json({
      success: true,
      data: {
        id_call: data.id_call,
        digito: data.digito || '',
        ramal: data.ramal,
        created_at: data.created_at
      }
    });
    
  } catch (error) {
    console.error('[DTMF API] Erro na busca:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// DELETE /api/dtmf/:callId - Limpar dígitos DTMF de uma chamada
router.delete('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    console.log(`[DTMF API] Limpando dígitos para chamada: ${callId}`);
    
    const { error } = await supabase
      .from('dtmf_pabx')
      .update({ digito: '' })
      .eq('id_call', callId);
    
    if (error) {
      console.error('[DTMF API] Erro ao limpar dígitos:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao limpar dígitos',
        error: error.message
      });
    }
    
    console.log(`[DTMF API] Dígitos limpos com sucesso para chamada: ${callId}`);
    
    res.json({
      success: true,
      message: 'Dígitos limpos com sucesso'
    });
    
  } catch (error) {
    console.error('[DTMF API] Erro na limpeza:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/dtmf/clear-all - Limpar todos os dígitos DTMF (opcional)
router.post('/clear-all', async (req, res) => {
  try {
    console.log('[DTMF API] Limpando todos os dígitos DTMF');
    
    const { error } = await supabase
      .from('dtmf_pabx')
      .update({ digito: '' })
      .neq('id', 0); // Atualizar todos os registros
    
    if (error) {
      console.error('[DTMF API] Erro ao limpar todos os dígitos:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao limpar dígitos',
        error: error.message
      });
    }
    
    console.log('[DTMF API] Todos os dígitos limpos com sucesso');
    
    res.json({
      success: true,
      message: 'Todos os dígitos limpos com sucesso'
    });
    
  } catch (error) {
    console.error('[DTMF API] Erro na limpeza geral:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
