const { Pool } = require('pg');
require('dotenv').config();

// Dedicated CDR database pool (separate from Supabase app DB)
// Configure via env vars in backend/.env.local
// Required: CDR_DB_HOST, CDR_DB_PORT, CDR_DB_NAME, CDR_DB_USER, CDR_DB_PASSWORD

const missing = [];
if (!process.env.CDR_DB_HOST) missing.push('CDR_DB_HOST');
if (!process.env.CDR_DB_PORT) missing.push('CDR_DB_PORT');
if (!process.env.CDR_DB_NAME) missing.push('CDR_DB_NAME');
if (!process.env.CDR_DB_USER) missing.push('CDR_DB_USER');
if (!process.env.CDR_DB_PASSWORD) missing.push('CDR_DB_PASSWORD');

let cdrPool = null;

if (missing.length) {
  console.warn('⚠️ CDR DB not fully configured. Missing env:', missing.join(', '));
  console.warn('   Set these in backend/.env.local to enable /api/cdr.');
} else {
  cdrPool = new Pool({
    host: process.env.CDR_DB_HOST,
    port: Number(process.env.CDR_DB_PORT),
    database: process.env.CDR_DB_NAME,
    user: process.env.CDR_DB_USER,
    password: process.env.CDR_DB_PASSWORD,
    ssl: process.env.CDR_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.CDR_DB_MAX || 5),
    idleTimeoutMillis: Number(process.env.CDR_DB_IDLE_TIMEOUT || 10000),
    connectionTimeoutMillis: Number(process.env.CDR_DB_CONN_TIMEOUT || 5000)
  });

  cdrPool.on('connect', () => console.log('✅ Conectado ao banco de CDR'));
  cdrPool.on('error', (err) => console.error('❌ Erro no pool CDR:', err));
}

const queryCdr = async (text, params) => {
  if (!cdrPool) {
    const err = new Error('CDR database not configured. Set CDR_DB_* in backend/.env.local');
    err.code = 'CDR_DB_NOT_CONFIGURED';
    throw err;
  }
  const start = Date.now();
  try {
    const res = await cdrPool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 [CDR] Query:', { duration, rows: res.rowCount });
    return res;
  } catch (e) {
    console.error('❌ [CDR] Query error:', e);
    throw e;
  }
};

module.exports = { queryCdr };
