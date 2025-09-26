const { setTimeout: delay } = require('timers/promises');

// Fetch ARI channels with Basic Auth and timeout
// Uses environment variables with sensible defaults for development
// ARI_BASE_URL example: http://69.62.103.45:8088
const ARI_BASE_URL = process.env.ARI_BASE_URL || 'http://69.62.103.45:8088';
const ARI_USER = process.env.ARI_USER || 'admin';
const ARI_PASSWORD = process.env.ARI_PASSWORD || '35981517';

// Cache para reduzir requisições desnecessárias
const channelsCache = {
  data: null,
  timestamp: 0,
  ttl: 2000 // 2 segundos de cache
};

async function fetchAri(path, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${ARI_BASE_URL}${path}`;
    console.log(`🔄 [ARI] Fazendo requisição para: ${url}`);
    console.log(`🔄 [ARI] Timeout configurado: ${timeoutMs}ms`);
    
    const auth = Buffer.from(`${ARI_USER}:${ARI_PASSWORD}`).toString('base64');
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      signal: controller.signal,
    });
    
    console.log(`📡 [ARI] Resposta recebida - Status: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      let text = '';
      try { 
        text = await res.text(); 
        console.error(`❌ [ARI] Erro HTTP ${res.status} - Resposta: ${text}`);
      } catch (textError) {
        console.error(`❌ [ARI] Erro ao ler resposta de erro: ${textError.message}`);
      }
      const err = new Error(`ARI HTTP ${res.status}${text ? ` - ${text}` : ''}`);
      err.status = res.status;
      throw err;
    }
    
    const json = await res.json();
    console.log(`✅ [ARI] JSON recebido com sucesso - ${Array.isArray(json) ? json.length : 'objeto'} item(s)`);
    return json;
  } catch (error) {
    console.error(`❌ [ARI] Erro na requisição para ${path}:`, {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get active channels from ARI and optionally filter by accountcode
 * @param {{ accountcode?: string, timeoutMs?: number }} opts
 * @returns {Promise<Array<any>>}
 */
async function getActiveChannels(opts = {}) {
  const { accountcode, timeoutMs = 10000 } = opts; // Aumentar timeout padrão para 10s
  
  // Verificar cache primeiro
  const now = Date.now();
  if (channelsCache.data && (now - channelsCache.timestamp) < channelsCache.ttl) {
    console.log('📋 [ARI] Usando dados do cache');
    const channels = channelsCache.data;
    if (accountcode && typeof accountcode === 'string' && accountcode.trim() !== '') {
      const acc = accountcode.trim();
      return Array.isArray(channels) ? channels.filter(ch => String(ch.accountcode || '') === acc) : [];
    }
    return Array.isArray(channels) ? channels : [];
  }
  
  try {
    const channels = await fetchAri('/ari/channels', { timeoutMs });
    
    // Atualizar cache
    channelsCache.data = channels;
    channelsCache.timestamp = now;
    
    if (accountcode && typeof accountcode === 'string' && accountcode.trim() !== '') {
      const acc = accountcode.trim();
      return Array.isArray(channels) ? channels.filter(ch => String(ch.accountcode || '') === acc) : [];
    }
    return Array.isArray(channels) ? channels : [];
  } catch (error) {
    console.error('❌ [ARI] Erro ao buscar canais, retornando array vazio:', error.message);
    // Em caso de erro, retornar array vazio em vez de propagar o erro
    return [];
  }
}

/**
 * Get a single channel by id
 * @param {string} channelId
 * @param {{ timeoutMs?: number }} opts
 */
async function getChannel(channelId, opts = {}) {
  if (!channelId) throw new Error('channelId is required');
  const { timeoutMs = 5000 } = opts;
  return await fetchAri(`/ari/channels/${encodeURIComponent(channelId)}`, { timeoutMs });
}

/**
 * Hangup a channel via ARI
 * @param {string} channelId
 * @param {{ timeoutMs?: number }} opts
 */
async function hangupChannel(channelId, { timeoutMs = 5000 } = {}) {
  if (!channelId) throw new Error('channelId is required');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${ARI_BASE_URL}/ari/channels/${encodeURIComponent(channelId)}`;
    const auth = Buffer.from(`${ARI_USER}:${ARI_PASSWORD}`).toString('base64');
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 204) {
      let text = '';
      try { text = await res.text(); } catch {}
      const err = new Error(`ARI hangup HTTP ${res.status}${text ? ` - ${text}` : ''}`);
      err.status = res.status;
      throw err;
    }
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getActiveChannels,
  getChannel,
  hangupChannel,
};
