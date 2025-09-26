/**
 * SCRIPT DE TESTE REDIS - Verificar funcionamento do cache
 * Execute: node test-redis.js
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

const cacheService = require('./src/services/cacheService');

async function testRedis() {
  console.log('🧪 ===================================');
  console.log('🧪 TESTE DO REDIS CACHE');
  console.log('🧪 ===================================\n');

  try {
    // 1. Testar conexão
    console.log('1️⃣ Testando conexão com Redis...');
    const connected = await cacheService.connect();
    
    if (!connected) {
      console.error('❌ Falha na conexão com Redis');
      return;
    }
    console.log('✅ Redis conectado com sucesso!\n');

    // 2. Testar operações básicas
    console.log('2️⃣ Testando operações básicas...');
    
    // Set
    const testKey = 'test:basic';
    const testValue = { message: 'Hello Redis!', timestamp: new Date().toISOString() };
    await cacheService.set(testKey, testValue, 60);
    console.log('✅ SET realizado:', testKey);

    // Get
    const retrieved = await cacheService.get(testKey);
    console.log('✅ GET realizado:', retrieved);

    // TTL
    const ttl = await cacheService.getTTL(testKey);
    console.log('✅ TTL:', ttl, 'segundos\n');

    // 3. Testar geração de chaves
    console.log('3️⃣ Testando geração de chaves...');
    const userKey = cacheService.generateKey('users', 'page=1', 'limit=20');
    const planKey = cacheService.generateKey('plans', 'active=true');
    console.log('✅ Chave de usuários:', userKey);
    console.log('✅ Chave de planos:', planKey, '\n');

    // 4. Testar múltiplas chaves
    console.log('4️⃣ Testando múltiplas chaves...');
    await cacheService.set(userKey, { users: ['user1', 'user2'] }, 300);
    await cacheService.set(planKey, { plans: ['plan1', 'plan2'] }, 1800);
    
    const keys = await cacheService.getKeys('pabx:*');
    console.log('✅ Chaves encontradas:', keys.length);
    keys.forEach(key => console.log('   -', key));
    console.log();

    // 5. Testar invalidação por padrão
    console.log('5️⃣ Testando invalidação por padrão...');
    const deleted = await cacheService.invalidate('pabx:test:*');
    console.log('✅ Chaves deletadas:', deleted, '\n');

    // 6. Testar status
    console.log('6️⃣ Testando status do Redis...');
    const status = await cacheService.getStatus();
    console.log('✅ Status:', {
      connected: status.connected,
      uptime: status.uptime,
      memory: status.memory?.used_memory_human || 'N/A',
      keys: status.keyspace?.db0?.keys || 0
    });
    console.log();

    // 7. Limpar dados de teste
    console.log('7️⃣ Limpando dados de teste...');
    await cacheService.clear();
    console.log('✅ Cache limpo\n');

    console.log('🎉 ===================================');
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('🎉 Redis está funcionando corretamente');
    console.log('🎉 ===================================');

  } catch (error) {
    console.error('❌ ===================================');
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error('❌ ===================================');
    console.error(error);
  } finally {
    // Fechar conexão
    await cacheService.disconnect();
    process.exit(0);
  }
}

// Executar teste
testRedis();
