/**
 * SCRIPT DE VERIFICAÇÃO DO CACHE REDIS COM AUTENTICAÇÃO
 * Testa cache incluindo rotas que precisam de JWT
 */

require('dotenv').config({ path: '.env.local' });

async function verifyCacheWithAuth() {
  console.log('🔍 ===================================');
  console.log('🔍 VERIFICAÇÃO REDIS COM AUTENTICAÇÃO');
  console.log('🔍 ===================================\n');

  const baseUrl = 'http://localhost:3001';
  let authToken = null;
  
  try {
    // 1. Fazer login para obter token
    console.log('1️⃣ Fazendo login para obter token JWT...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@pabxsystem.com.br',
        password: 'admin123'
      })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      authToken = loginData.data?.token;
      console.log('✅ Login realizado com sucesso');
    } else {
      console.error('❌ Falha no login');
      return;
    }

    // 2. Verificar status do Redis
    console.log('\n2️⃣ Verificando status do Redis...');
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

    // 3. Testar cache de planos (sem auth)
    console.log('\n3️⃣ Testando cache de planos (sem auth)...');
    
    const start1 = Date.now();
    const plans1 = await fetch(`${baseUrl}/api/plans`);
    const plansData1 = await plans1.json();
    const time1 = Date.now() - start1;
    console.log(`   ⏱️  Primeira: ${time1}ms | Cached: ${plansData1.cached || false}`);

    const start2 = Date.now();
    const plans2 = await fetch(`${baseUrl}/api/plans`);
    const plansData2 = await plans2.json();
    const time2 = Date.now() - start2;
    console.log(`   ⏱️  Segunda: ${time2}ms | Cached: ${plansData2.cached || false}`);

    if (plansData2.cached && time2 <= time1) {
      console.log('   ✅ Cache de planos funcionando!');
    } else {
      console.log('   ⚠️  Cache de planos pode ter problemas');
    }

    // 4. Testar cache de usuários (com auth)
    console.log('\n4️⃣ Testando cache de usuários (com auth)...');
    
    const authHeaders = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    const start3 = Date.now();
    const users1 = await fetch(`${baseUrl}/api/users?limit=5`, {
      headers: authHeaders
    });
    const usersData1 = await users1.json();
    const time3 = Date.now() - start3;
    console.log(`   ⏱️  Primeira: ${time3}ms | Cached: ${usersData1.cached || false} | Success: ${usersData1.success}`);

    const start4 = Date.now();
    const users2 = await fetch(`${baseUrl}/api/users?limit=5`, {
      headers: authHeaders
    });
    const usersData2 = await users2.json();
    const time4 = Date.now() - start4;
    console.log(`   ⏱️  Segunda: ${time4}ms | Cached: ${usersData2.cached || false} | Success: ${usersData2.success}`);

    if (usersData2.success && usersData2.cached && time4 <= time3) {
      console.log('   ✅ Cache de usuários funcionando!');
    } else if (!usersData2.success) {
      console.log('   ❌ Erro de autenticação na rota de usuários');
    } else {
      console.log('   ⚠️  Cache de usuários pode ter problemas');
    }

    // 5. Verificar chaves no cache
    console.log('\n5️⃣ Verificando chaves no cache...');
    const keysResponse = await fetch(`${baseUrl}/api/cache/keys`);
    const keysData = await keysResponse.json();
    
    if (keysData.success) {
      console.log(`   📦 Chaves encontradas: ${keysData.data.count}`);
      keysData.data.keys.forEach(keyObj => {
        console.log(`      - ${keyObj.key}`);
      });
    }

    // 6. Testar performance comparativa
    console.log('\n6️⃣ Teste de performance comparativa...');
    
    // Limpar cache primeiro
    await fetch(`${baseUrl}/api/cache/clear`, { method: 'POST' });
    console.log('   🗑️  Cache limpo');

    // Primeira requisição (cache miss)
    const startMiss = Date.now();
    const missResponse = await fetch(`${baseUrl}/api/plans`);
    const missData = await missResponse.json();
    const timeMiss = Date.now() - startMiss;

    // Segunda requisição (cache hit)
    const startHit = Date.now();
    const hitResponse = await fetch(`${baseUrl}/api/plans`);
    const hitData = await hitResponse.json();
    const timeHit = Date.now() - startHit;

    console.log(`   📊 Cache Miss: ${timeMiss}ms | Cache Hit: ${timeHit}ms`);
    console.log(`   🚀 Melhoria: ${((timeMiss - timeHit) / timeMiss * 100).toFixed(1)}%`);

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
verifyCacheWithAuth();
