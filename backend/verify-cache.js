/**
 * SCRIPT DE VERIFICAÇÃO DO CACHE REDIS
 * Testa se o cache está funcionando nas APIs
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

async function verifyCacheIntegration() {
  console.log('🔍 ===================================');
  console.log('🔍 VERIFICAÇÃO DE INTEGRAÇÃO REDIS');
  console.log('🔍 ===================================\n');

  const baseUrl = 'http://localhost:3001';
  
  try {
    // 1. Verificar status do Redis
    console.log('1️⃣ Verificando status do Redis...');
    const statusResponse = await fetch(`${baseUrl}/api/cache/status`);
    const status = await statusResponse.json();
    
    if (status.success && status.data.connected) {
      console.log('✅ Redis conectado:', {
        uptime: status.data.uptime + 's',
        memory: status.data.memory?.used_memory_human || 'N/A',
        keys: status.data.keyspace?.db0?.keys || 0
      });
    } else {
      console.error('❌ Redis não conectado');
      return;
    }

    // 2. Testar cache de planos
    console.log('\n2️⃣ Testando cache de planos...');
    
    // Primeira requisição (deve ir ao banco)
    console.log('   📡 Primeira requisição (cache miss)...');
    const start1 = Date.now();
    const plans1 = await fetch(`${baseUrl}/api/plans`);
    const plansData1 = await plans1.json();
    const time1 = Date.now() - start1;
    console.log(`   ⏱️  Tempo: ${time1}ms | Cached: ${plansData1.cached || false}`);

    // Segunda requisição (deve vir do cache)
    console.log('   ⚡ Segunda requisição (cache hit)...');
    const start2 = Date.now();
    const plans2 = await fetch(`${baseUrl}/api/plans`);
    const plansData2 = await plans2.json();
    const time2 = Date.now() - start2;
    console.log(`   ⏱️  Tempo: ${time2}ms | Cached: ${plansData2.cached || false}`);

    if (time2 < time1 && plansData2.cached) {
      console.log('   ✅ Cache de planos funcionando!');
    } else {
      console.log('   ⚠️  Cache de planos pode não estar funcionando');
    }

    // 3. Testar cache de usuários
    console.log('\n3️⃣ Testando cache de usuários...');
    
    // Primeira requisição
    console.log('   📡 Primeira requisição (cache miss)...');
    const start3 = Date.now();
    const users1 = await fetch(`${baseUrl}/api/users?limit=5`);
    const usersData1 = await users1.json();
    const time3 = Date.now() - start3;
    console.log(`   ⏱️  Tempo: ${time3}ms | Cached: ${usersData1.cached || false}`);

    // Segunda requisição
    console.log('   ⚡ Segunda requisição (cache hit)...');
    const start4 = Date.now();
    const users2 = await fetch(`${baseUrl}/api/users?limit=5`);
    const usersData2 = await users2.json();
    const time4 = Date.now() - start4;
    console.log(`   ⏱️  Tempo: ${time4}ms | Cached: ${usersData2.cached || false}`);

    if (time4 < time3 && usersData2.cached) {
      console.log('   ✅ Cache de usuários funcionando!');
    } else {
      console.log('   ⚠️  Cache de usuários pode não estar funcionando');
    }

    // 4. Verificar chaves no cache
    console.log('\n4️⃣ Verificando chaves no cache...');
    const keysResponse = await fetch(`${baseUrl}/api/cache/keys`);
    const keysData = await keysResponse.json();
    
    if (keysData.success) {
      console.log(`   📦 Chaves encontradas: ${keysData.data.count}`);
      keysData.data.keys.forEach(keyObj => {
        console.log(`      - ${keyObj.key}`);
      });
    }

    // 5. Testar invalidação
    console.log('\n5️⃣ Testando invalidação de cache...');
    
    // Criar um plano (deve invalidar cache)
    console.log('   🗑️  Simulando operação de escrita...');
    const createResponse = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Plano Teste Cache',
        price: 99.99,
        maxAgents: 5,
        periodDays: 30,
        description: 'Teste de invalidação de cache'
      })
    });

    if (createResponse.ok) {
      console.log('   ✅ Operação de escrita realizada');
      
      // Verificar se cache foi invalidado
      const plansAfter = await fetch(`${baseUrl}/api/plans`);
      const plansDataAfter = await plansAfter.json();
      
      if (!plansDataAfter.cached) {
        console.log('   ✅ Cache invalidado corretamente!');
      } else {
        console.log('   ⚠️  Cache pode não ter sido invalidado');
      }
    }

    console.log('\n🎉 ===================================');
    console.log('🎉 VERIFICAÇÃO COMPLETA!');
    console.log('🎉 ===================================');

  } catch (error) {
    console.error('❌ ===================================');
    console.error('❌ ERRO NA VERIFICAÇÃO:', error.message);
    console.error('❌ ===================================');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Dica: Certifique-se de que o backend está rodando na porta 3001');
    }
  }
}

// Executar verificação
verifyCacheIntegration();
