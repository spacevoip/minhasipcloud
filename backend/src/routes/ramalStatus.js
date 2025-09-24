/**
 * =====================================================
 * RAMAL STATUS API - STATUS SIMPLES DE RAMAL
 * =====================================================
 * API simples que recebe um ramal e retorna se está online/offline
 * baseado diretamente na tabela ps_contacts
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Normalizar ramal (remover prefixos sip:, etc)
function normalizeRamal(ramal) {
  if (!ramal) return '';
  let normalized = String(ramal).trim();
  normalized = normalized.replace(/^sip:/i, '');
  const parts = normalized.split(/[;@:/]/).filter(Boolean);
  if (parts.length > 0) {
    normalized = parts[parts.length - 1];
  }
  return normalized.trim();
}

// =====================================================
// GET /api/ramal-status/:ramal - STATUS SIMPLES DE UM RAMAL
// =====================================================
router.get('/:ramal', authenticateToken, async (req, res) => {
  try {
    const { ramal } = req.params;
    
    console.log(`🔍 [RamalStatus] Verificando ramal: ${ramal}`);

    // Primeiro, vamos ver todos os registros para debug
    const { data: allContacts } = await supabase
      .from('ps_contacts')
      .select('endpoint, uri');
    
    console.log(`📋 [RamalStatus] Todos os endpoints na ps_contacts:`, allContacts?.map(c => `endpoint: ${c.endpoint}, uri: ${c.uri}`));

    // Buscar se o ramal existe na coluna endpoint da ps_contacts
    const { data: contacts, error } = await supabase
      .from('ps_contacts')
      .select('endpoint, expiration_time, uri, user_agent')
      .like('endpoint', `%${ramal}%`);
    
    console.log(`🔍 [RamalStatus] Contatos encontrados com LIKE %${ramal}%:`, contacts?.map(c => c.endpoint));

    // Se encontrou algum registro com o ramal no endpoint, está online
    const isOnline = contacts && contacts.length > 0;
    let details = null;

    if (isOnline) {
      details = {
        endpoint: contacts[0].endpoint,
        uri: contacts[0].uri,
        userAgent: contacts[0].user_agent,
        expirationTime: contacts[0].expiration_time
      };
    }

    const result = {
      ramal: ramal,
      status: isOnline ? 'online' : 'offline',
      isOnline,
      lastCheck: new Date().toISOString(),
      details
    };

    console.log(`✅ [RamalStatus] Ramal ${ramal}: ${result.status}`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(`❌ Erro ao verificar status do ramal ${req.params.ramal}:`, error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar status do ramal',
      error: error.message
    });
  }
});

// =====================================================
// POST /api/ramal-status/check - VERIFICAR MÚLTIPLOS RAMAIS
// =====================================================
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const { ramais } = req.body;
    
    if (!Array.isArray(ramais) || ramais.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array de ramais é obrigatório'
      });
    }

    console.log(`🔍 [RamalStatus] Verificando ${ramais.length} ramais:`, ramais);

    const normalizedRamais = ramais.map(normalizeRamal);

    // Buscar todos os ramais de uma vez
    const { data: contacts, error } = await supabase
      .from('ps_contacts')
      .select('endpoint, expiration_time, uri, user_agent')
      .in('endpoint', normalizedRamais);

    if (error) {
      throw error;
    }

    // Criar mapa de resultados
    const results = {};
    const now = Date.now();

    // Inicializar todos como offline
    normalizedRamais.forEach(ramal => {
      results[ramal] = {
        ramal,
        status: 'offline',
        isOnline: false,
        lastCheck: new Date().toISOString(),
        details: null
      };
    });

    // Atualizar os que estão online
    if (contacts && contacts.length > 0) {
      contacts.forEach(contact => {
        const ramal = normalizeRamal(contact.endpoint);
        let isOnline = false;

        if (contact.expiration_time) {
          const exp = new Date(contact.expiration_time);
          isOnline = exp.getTime() > now;
        } else {
          isOnline = true;
        }

        if (isOnline && results[ramal]) {
          results[ramal] = {
            ramal,
            status: 'online',
            isOnline: true,
            lastCheck: new Date().toISOString(),
            details: {
              endpoint: contact.endpoint,
              uri: contact.uri,
              userAgent: contact.user_agent,
              expirationTime: contact.expiration_time
            }
          };
        }
      });
    }

    const onlineCount = Object.values(results).filter(r => r.isOnline).length;
    console.log(`✅ [RamalStatus] Verificados ${ramais.length} ramais: ${onlineCount} online`);

    res.json({
      success: true,
      data: results,
      summary: {
        total: ramais.length,
        online: onlineCount,
        offline: ramais.length - onlineCount
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar múltiplos ramais:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar ramais',
      error: error.message
    });
  }
});

module.exports = router;
