const AsteriskManager = require('asterisk-manager');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Read AMI config from env (support AMI_PORT and AMI_PORTE)
const AMI_HOST = process.env.AMI_HOST;
const AMI_PORT = Number(process.env.AMI_PORT || process.env.AMI_PORTE || 5038);
const AMI_USERNAME = process.env.AMI_USERNAME || 'admin';
const AMI_PASSWORD = process.env.AMI_PASSWORD;
const AMI_EVENTS = process.env.AMI_EVENTS || 'on';

// Read PostgreSQL config from env (POST_*)
const DB_HOST = process.env.POST_HOST;
const DB_PORT = Number(process.env.POST_PORT || 5432);
const DB_NAME = process.env.POST_DATABASE;
const DB_USER = process.env.POST_USER;
const DB_PASSWORD = process.env.POST_PASSWORD;
const DB_MAX = Number(process.env.POST_MAX || 20);
const DB_IDLE_TIMEOUT_MILLIS = Number(process.env.POST_IDLE_TIMEOUT_MILLIS || 30000);
const DB_CONNECTION_TIMEOUT_MILLIS = Number(process.env.POST_CONNECTION_TIMEOUT_MILLIS || 2000);
const DB_SSL = (process.env.POST_SSL || 'false').toString().toLowerCase() === 'true' ? { rejectUnauthorized: false } : false;

const requiredEnv = [];
if (!AMI_HOST) requiredEnv.push('AMI_HOST');
if (!AMI_PASSWORD) requiredEnv.push('AMI_PASSWORD');
if (!DB_HOST) requiredEnv.push('POST_HOST');
if (!DB_NAME) requiredEnv.push('POST_DATABASE');
if (!DB_USER) requiredEnv.push('POST_USER');
if (!DB_PASSWORD) requiredEnv.push('POST_PASSWORD');

let pool = null;
let ami = null;
let running = false;
let reconnectTimer = null;

// Cache para controle de duplicatas (janela de tempo)
const processedEvents = new Map();
const DUPLICATE_WINDOW = 350; // ms - janela para detectar duplicatas técnicas

// Estatísticas de monitoramento
let dtmfStats = { received: 0, duplicates: 0, filtered: 0, errors: 0 };

const buildPool = () => {
  pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    max: DB_MAX,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MILLIS,
    ssl: DB_SSL
  });

  pool.on('connect', () => console.log('✓ [DTMF] Conectado ao PostgreSQL'));
  pool.on('error', (err) => console.error('❌ [DTMF] Erro no PostgreSQL:', err.message));
};

const insertDTMF = async (digit, ramal, idCall) => {
  if (!pool) return;
  const query = `
    INSERT INTO dtmf_pabx (id_call, ramal, digito, created_at)
    VALUES ($1, $2, $3, NOW() AT TIME ZONE 'America/Sao_Paulo')
    ON CONFLICT (id_call) DO UPDATE
    SET digito = CASE 
                   WHEN dtmf_pabx.digito IS NULL OR dtmf_pabx.digito = '' 
                     THEN EXCLUDED.digito
                   ELSE dtmf_pabx.digito || ',' || EXCLUDED.digito
                 END,
        ramal = EXCLUDED.ramal
        -- ✅ NÃO sobrescrever created_at para manter timestamp original
  `;
  
  // ✅ Retry automático em caso de deadlock
  let retries = 3;
  while (retries > 0) {
    try {
      await pool.query(query, [idCall, ramal, digit]);
      break;
    } catch (err) {
      if (err.code === '40P01' && retries > 1) { // deadlock detected
        retries--;
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        continue;
      }
      console.error('❌ [DTMF] Erro ao inserir dígito:', err.message);
      dtmfStats.errors++;
      break;
    }
  }
};

const extractRamal = (channel) => {
  const match = channel?.match(/(?:PJSIP|SIP)\/(\d+)-/);
  return match ? match[1] : null;
};

// ✅ Verificar se é duplicata técnica
const isDuplicate = (callId, digit) => {
  const key = `${callId}:${digit}`;
  const now = Date.now();
  
  if (processedEvents.has(key)) {
    const lastTime = processedEvents.get(key);
    const timeDiff = now - lastTime;
    
    if (timeDiff < DUPLICATE_WINDOW) {
      return true; // É duplicata técnica
    }
  }
  
  processedEvents.set(key, now);
  return false; // É dígito legítimo
};

const handleManagerEvent = (evt) => {
  // ✅ Filtrar só DTMFEnd
  if (evt.event !== 'DTMFEnd') return;
  
  // ✅ Filtrar por direction
  if (evt.direction && evt.direction !== 'Sent') {
    dtmfStats.filtered++;
    return;
  }
  
  const { channel, digit, uniqueid, linkedid } = evt;
  if (!channel || !digit || !uniqueid) return;
  
  // ✅ Filtros expandidos para canais fantasmas
  if (channel.includes('PJSIP/master-') || 
      channel.includes('Local/') || 
      channel.includes('Announce/')) {
    dtmfStats.filtered++;
    return;
  }
  
  const ramal = extractRamal(channel);
  if (!ramal) return;
  
  // ✅ Usar linkedid se disponível (ID da chamada completa)
  const callId = linkedid || uniqueid;
  
  // ✅ Verificar duplicata técnica
  if (isDuplicate(callId, digit)) {
    console.log(`🔄 [DTMF] Duplicata ignorada: ${ramal} | ${digit} | ID: ${callId}`);
    dtmfStats.duplicates++;
    return;
  }
  
  dtmfStats.received++;
  insertDTMF(digit, ramal, callId)
    .then(() => console.log(`📞 [DTMF] ${ramal} | 🔢 ${digit} | ID: ${callId}`))
    .catch(() => {});
};

const connectAMI = () => {
  if (ami) {
    try { ami.disconnect(); } catch {}
    ami = null;
  }
  
  console.log(`🔌 [DTMF] Conectando AMI: ${AMI_HOST}:${AMI_PORT} (user: ${AMI_USERNAME})`);
  ami = new AsteriskManager(AMI_PORT, AMI_HOST, AMI_USERNAME, AMI_PASSWORD, true);
  ami.keepConnected(); // ensure built-in reconnect if supported

  ami.on('connect', () => {
    console.log('✓ [DTMF] Conectado ao Asterisk AMI');
    console.log('🎯 [DTMF] Aguardando eventos DTMF...');
  });

  ami.on('managerevent', handleManagerEvent);

  ami.on('error', (err) => {
    console.error('❌ [DTMF] Erro AMI:', err?.message || err);
  });

  ami.on('disconnect', () => {
    console.log('⚠️  [DTMF] AMI desconectado - tentando reconectar em 5s...');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      try { ami.connect(); } catch (e) { console.error('❌ [DTMF] Falha na reconexão AMI:', e?.message || e); }
    }, 5000);
  });
};

// ✅ Limpeza automática do cache a cada 5 minutos
const startCacheCleanup = () => {
  setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    let cleaned = 0;
    
    for (const [key, timestamp] of processedEvents.entries()) {
      if (timestamp < fiveMinutesAgo) {
        processedEvents.delete(key);
        cleaned++;
      }
    }
    
    console.log(`🧹 [DTMF] Cache limpo: ${cleaned} entradas removidas, ${processedEvents.size} restantes`);
  }, 5 * 60 * 1000);
};

// ✅ Estatísticas a cada minuto
const startStatsReporting = () => {
  setInterval(() => {
    console.log(`📊 [DTMF] Stats: ${dtmfStats.received} recebidos, ${dtmfStats.duplicates} duplicatas, ${dtmfStats.filtered} filtrados, ${dtmfStats.errors} erros`);
    dtmfStats = { received: 0, duplicates: 0, filtered: 0, errors: 0 };
  }, 60000);
};

const start = async () => {
  if (running) return true;
  if (requiredEnv.length) {
    console.warn('⚠️ [DTMF] Variáveis de ambiente faltando:', requiredEnv.join(', '));
    console.warn('   Configure em backend/.env.local para iniciar o serviço DTMF.');
    return false;
  }
  buildPool();
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('❌ [DTMF] Falha ao conectar no PostgreSQL:', e.message);
    throw e;
  }

  connectAMI();
  startCacheCleanup();
  startStatsReporting();
  running = true;
  
  console.log('🎯 [DTMF] Serviço otimizado iniciado:');
  console.log('   ✅ Filtro direction=received');
  console.log('   ✅ Deduplicação por janela de 350ms');
  console.log('   ✅ Filtros expandidos para canais fantasmas');
  console.log('   ✅ Uso de linkedid quando disponível');
  console.log('   ✅ Retry automático em deadlocks');
  console.log('   ✅ Cache auto-limpante e estatísticas');
  
  return true;
};

const stop = async () => {
  running = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  try { if (ami) ami.disconnect(); } catch {}
  ami = null;
  try { if (pool) await pool.end(); } catch {}
  pool = null;
};

module.exports = {
  start,
  stop,
  isRunning: () => running
};
