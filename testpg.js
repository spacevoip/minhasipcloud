const AsteriskManager = require('asterisk-manager');
const { Pool } = require('pg');

// Configurações AMI
const amiConfig = {
  port: 5038,
  host: '38.51.135.180',
  username: 'admin',
  password: '35981517',
  events: 'on'
};

// Configurações PostgreSQL
const dbConfig = {
  host: '38.51.135.181',
  port: 6543,
  database: 'postgres',
  user: 'postgres.supabase',
  password: '35981517Biu',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: false
};

// Pool de conexões PostgreSQL
const db = new Pool(dbConfig);

// Cache para controlar duplicatas por uniqueid
const processedEvents = new Map();

// Inicializar conexão AMI
const ami = new AsteriskManager(amiConfig.port, amiConfig.host, amiConfig.username, amiConfig.password, true);

// Função para inserir DTMF no banco (acumula por id_call)
const insertDTMF = async (digito, ramal, idCall) => {
  const query = `
    INSERT INTO dtmf_pabx (id_call, ramal, digito, created_at)
    VALUES ($1, $2, $3, NOW() AT TIME ZONE 'America/Sao_Paulo')
    ON CONFLICT (id_call) DO UPDATE
    SET digito = CASE 
                   WHEN dtmf_pabx.digito IS NULL OR dtmf_pabx.digito = '' 
                     THEN EXCLUDED.digito
                   ELSE dtmf_pabx.digito || ',' || EXCLUDED.digito
                 END,
        ramal = EXCLUDED.ramal,
        created_at = NOW() AT TIME ZONE 'America/Sao_Paulo';
  `;
  
  try {
    await db.query(query, [idCall, ramal, digito]);
  } catch (error) {
    console.error('❌ Erro ao inserir no banco:', error.message);
  }
};
// Função para extrair ramal do canal
const extractRamal = (channel) => {
  // PJSIP/1000-xxxxx ou SIP/1000-xxxxx
  const match = channel.match(/(?:PJSIP|SIP)\/(\d+)-/);
  return match ? match[1] : null;
};

// Função para processar DTMF
const processDTMF = async (evt) => {
  const { channel, digit, uniqueid } = evt;
  
  if (!channel || !digit || !uniqueid) return;
  
  // Se é PJSIP/master, NÃO salvar (apenas ignorar)
  if (channel.includes('PJSIP/master-')) {
    return;
  }
  
  // Extrair ramal
  const ramal = extractRamal(channel);
  if (!ramal) return;
  
  // Salvar SEMPRE no banco (sem controle de duplicatas)
  await insertDTMF(digit, ramal, uniqueid);
  
  // Log limpo
  console.log(`📞 ${ramal} | 🔢 ${digit} | ID: ${uniqueid}`);
};

// Eventos AMI
ami.on('connect', () => {
  console.log('✓ Conectado ao Asterisk AMI');
  console.log('🎯 Aguardando eventos DTMF...\n');
});

ami.on('managerevent', (evt) => {
  if (evt.event === 'DTMFEnd') {
    processDTMF(evt);
  }
});

ami.on('error', (error) => {
  console.error('❌ Erro AMI:', error.message);
});

ami.on('disconnect', () => {
  console.log('⚠️  AMI desconectado - Reconectando em 5s...');
  setTimeout(() => {
    try {
      ami.connect();
    } catch (error) {
      console.error('❌ Erro na reconexão AMI:', error.message);
    }
  }, 5000);
});

// Eventos PostgreSQL
db.on('connect', () => {
  console.log('✓ Conectado ao PostgreSQL');
});

db.on('error', (error) => {
  console.error('❌ Erro PostgreSQL:', error.message);
});

// Teste inicial do banco
const testConnection = async () => {
  try {
    const result = await db.query('SELECT NOW()');
    console.log('✓ PostgreSQL testado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao testar PostgreSQL:', error.message);
    process.exit(1);
  }
};

// Encerramento gracioso
const gracefulShutdown = async () => {
  console.log('\n🛑 Encerrando aplicação...');
  
  try {
    ami.disconnect();
    await db.end();
    console.log('✓ Conexões fechadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao fechar conexões:', error.message);
  }
  
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Monitoramento de saúde das conexões
setInterval(async () => {
  try {
    await db.query('SELECT 1');
  } catch (error) {
    console.error('❌ PostgreSQL perdeu conexão');
  }
}, 30000);

// Inicialização
const init = async () => {
  try {
    await testConnection();
    ami.connect();
  } catch (error) {
    console.error('❌ Erro na inicialização:', error.message);
    process.exit(1);
  }
};

init();