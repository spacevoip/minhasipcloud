const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://31.97.84.157:8000';
// Preferir chave de service role no backend
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUyNTQ4NDAwLCJleHAiOjE5MTAzMTQ4MDB9.y8Warh7fcdJrgMO2KMmphRajbF4Cxvz1xH1Ui9HOAyE';

// Cliente Supabase
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Usando ANON KEY no backend para Supabase. Recomenda-se SUPABASE_SERVICE_ROLE_KEY para evitar problemas de permissão.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do pool PostgreSQL direto (para queries SQL customizadas)
// NOTA: Para desenvolvimento, vamos usar apenas o cliente Supabase
// O pool PostgreSQL direto pode causar problemas de conexão
const pool = new Pool({
  host: '31.97.84.157',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'postgres',
  max: 5, // Reduzir número de conexões
  idleTimeoutMillis: 10000, // Reduzir timeout
  connectionTimeoutMillis: 3000, // Reduzir timeout de conexão
  ssl: false // Desabilitar SSL para desenvolvimento local
});

// Teste de conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao Supabase PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro na conexão com Supabase:', err);
  // Não sair do processo, apenas logar o erro
  console.log('⚠️  Tentando usar cliente Supabase como fallback...');
});

// Função para testar a conexão
const testConnection = async () => {
  try {
    // Primeiro, testar conexão com Supabase client
    console.log('🔄 Testando conexão com Supabase...');
    const { data, error } = await supabase
      .from('users_pabx')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = tabela não existe (ok para primeiro teste)
      console.log('⚠️  Supabase client conectado, mas tabela users_pabx não existe ainda');
      console.log('✅ Conexão com Supabase estabelecida!');
      return true;
    }
    
    console.log('✅ Conexão com Supabase testada com sucesso!');
    console.log('📊 Supabase está funcionando corretamente');
    return true;
    
  } catch (err) {
    console.error('❌ Erro ao testar conexão com Supabase:', err);
    
    // Fallback: testar pool PostgreSQL direto
    try {
      console.log('🔄 Tentando conexão direta PostgreSQL...');
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('🕐 Conexão PostgreSQL testada em:', result.rows[0].now);
      client.release();
      return true;
    } catch (poolErr) {
      console.error('❌ Erro na conexão direta PostgreSQL:', poolErr);
      return false;
    }
  }
};

// Função para executar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executada:', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('❌ Erro na query:', err);
    throw err;
  }
};

// Função para transações
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Wrapper para facilitar transações
  const transaction = async (callback) => {
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      release();
    }
  };
  
  return {
    query,
    release,
    transaction
  };
};

module.exports = {
  supabase,
  pool,
  query,
  getClient,
  testConnection
};
