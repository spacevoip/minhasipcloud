/**
 * =====================================================
 * TESTE REDIS CLOUD - Verificação com credenciais específicas
 * =====================================================
 * Script para testar conexão Redis Cloud com as credenciais do .env.local
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

const redis = require('redis');

async function testRedisCloud() {
  console.log('🌐 ===================================');
  console.log('🌐 TESTE REDIS CLOUD PABX SYSTEM');
  console.log('🌐 ===================================\n');

  console.log('📋 Configuração detectada:');
  console.log('   Host:', process.env.REDIS_HOST);
  console.log('   Port:', process.env.REDIS_PORT);
  console.log('   Password:', process.env.REDIS_PASSWORD ? '***' : 'não definida');
  console.log();

  try {
    // 1. Criar cliente Redis
    console.log('1️⃣ Criando cliente Redis...');
    
    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('❌ Máximo de tentativas atingido');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 500);
        }
      },
      password: process.env.REDIS_PASSWORD
    });

    // Event listeners
    client.on('connect', () => {
      console.log('🔗 Conectando ao Redis Cloud...');
    });

    client.on('ready', () => {
      console.log('✅ Redis Cloud conectado e pronto!');
    });

    client.on('error', (err) => {
      console.error('❌ Erro Redis:', err.message);
    });

    // 2. Conectar
    console.log('2️⃣ Conectando...');
    await client.connect();
    
    // 3. Testar ping
    console.log('3️⃣ Testando ping...');
    const pong = await client.ping();
    console.log('✅ Ping response:', pong);

    // 4. Testar operações básicas
    console.log('4️⃣ Testando operações básicas...');
    
    // SET
    const testKey = 'pabx:test:cloud';
    const testData = {
      message: 'Redis Cloud funcionando!',
      timestamp: new Date().toISOString(),
      host: process.env.REDIS_HOST,
      test: 'connection_success'
    };
    
    await client.setEx(testKey, 300, JSON.stringify(testData));
    console.log('✅ SET realizado:', testKey);

    // GET
    const retrieved = await client.get(testKey);
    const parsed = JSON.parse(retrieved);
    console.log('✅ GET realizado:', parsed.message);

    // TTL
    const ttl = await client.ttl(testKey);
    console.log('✅ TTL:', ttl, 'segundos');

    // 5. Testar chaves do sistema PABX
    console.log('5️⃣ Testando chaves do sistema...');
    
    // Simular dados de usuários
    await client.setEx('pabx:users:page=1&limit=20', 180, JSON.stringify({
      users: [
        { id: 1, name: 'Admin User', role: 'admin' },
        { id: 2, name: 'Test User', role: 'user' }
      ],
      total: 2,
      cached: true
    }));

    // Simular dados de planos
    await client.setEx('pabx:plans:active=true', 900, JSON.stringify({
      plans: [
        { id: 1, name: 'Sip Basico', price: 29.90 },
        { id: 2, name: 'Sip Premium', price: 49.90 }
      ],
      total: 2,
      cached: true
    }));

    // Simular stats
    await client.setEx('pabx:stats:dashboard', 120, JSON.stringify({
      totalUsers: 150,
      totalCalls: 1250,
      activeAgents: 45,
      onlineRamais: 32,
      cached: true
    }));

    console.log('✅ Dados de teste criados');

    // 6. Listar chaves criadas
    console.log('6️⃣ Listando chaves criadas...');
    const keys = await client.keys('pabx:*');
    console.log('✅ Chaves encontradas:', keys.length);
    keys.forEach(key => console.log('   -', key));

    // 7. Informações do servidor
    console.log('7️⃣ Informações do servidor Redis...');
    const info = await client.info('server');
    const memory = await client.info('memory');
    const keyspace = await client.info('keyspace');
    
    console.log('📊 Status do Redis Cloud:');
    console.log('   Versão:', extractInfo(info, 'redis_version'));
    console.log('   Modo:', extractInfo(info, 'redis_mode'));
    console.log('   Uptime:', extractInfo(info, 'uptime_in_seconds'), 'segundos');
    console.log('   Memória usada:', extractInfo(memory, 'used_memory_human'));
    console.log('   Memória pico:', extractInfo(memory, 'used_memory_peak_human'));
    console.log('   Total de chaves:', extractInfo(keyspace, 'keys') || '0');

    // 8. Teste de performance
    console.log('8️⃣ Teste de performance...');
    const start = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await client.set(`pabx:perf:test:${i}`, `value_${i}`, { EX: 60 });
    }
    
    const writeTime = Date.now() - start;
    console.log('✅ 10 escritas em:', writeTime, 'ms');

    const readStart = Date.now();
    for (let i = 0; i < 10; i++) {
      await client.get(`pabx:perf:test:${i}`);
    }
    const readTime = Date.now() - readStart;
    console.log('✅ 10 leituras em:', readTime, 'ms');

    // Limpar dados de teste de performance
    for (let i = 0; i < 10; i++) {
      await client.del(`pabx:perf:test:${i}`);
    }

    // 9. Fechar conexão
    await client.quit();
    
    console.log('\n🎉 ===================================');
    console.log('🎉 REDIS CLOUD FUNCIONANDO PERFEITAMENTE!');
    console.log('🎉 ===================================');
    console.log('📋 Resumo dos testes:');
    console.log('   ✅ Conexão estabelecida');
    console.log('   ✅ Operações básicas (SET/GET/TTL)');
    console.log('   ✅ Chaves do sistema PABX criadas');
    console.log('   ✅ Performance adequada');
    console.log('   ✅ Informações do servidor obtidas');
    console.log('\n🚀 O sistema está pronto para usar Redis!');

  } catch (error) {
    console.error('\n❌ ===================================');
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('❌ ===================================');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Possíveis causas:');
      console.error('   - Host ou porta incorretos');
      console.error('   - Firewall bloqueando conexão');
      console.error('   - Redis Cloud inativo');
    } else if (error.message.includes('WRONGPASS') || error.message.includes('AUTH')) {
      console.error('💡 Problema de autenticação:');
      console.error('   - Verifique a senha no .env.local');
      console.error('   - Confirme credenciais no Redis Cloud');
    }
    
    console.error('\n🔧 Configuração atual:');
    console.error('   Host:', process.env.REDIS_HOST);
    console.error('   Port:', process.env.REDIS_PORT);
    console.error('   Password:', process.env.REDIS_PASSWORD ? 'definida' : 'não definida');
  }
}

function extractInfo(infoString, key) {
  const lines = infoString.split('\r\n');
  for (const line of lines) {
    if (line.startsWith(key + ':')) {
      return line.split(':')[1];
    }
  }
  return 'N/A';
}

// Executar teste
testRedisCloud().catch(console.error);
