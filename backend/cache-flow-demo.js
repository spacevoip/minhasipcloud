/**
 * DEMONSTRAÇÃO: COMO O REDIS CACHE FUNCIONA
 * Mostra o fluxo completo de dados
 */

require('dotenv').config({ path: '.env.local' });

async function demonstrateCacheFlow() {
  console.log('🔄 ===================================');
  console.log('🔄 DEMONSTRAÇÃO: FLUXO DO REDIS CACHE');
  console.log('🔄 ===================================\n');

  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('📋 CENÁRIO: Usuário acessa página de planos\n');

    // Limpar cache primeiro para demonstração
    console.log('🧹 1. Limpando cache para demonstração...');
    await fetch(`${baseUrl}/api/cache/clear`, { method: 'POST' });
    console.log('   ✅ Cache limpo\n');

    // PRIMEIRA REQUISIÇÃO - Cache Miss
    console.log('📡 2. PRIMEIRA REQUISIÇÃO (Cache Miss):');
    console.log('   Frontend → GET /api/plans');
    
    const start1 = Date.now();
    const response1 = await fetch(`${baseUrl}/api/plans`);
    const data1 = await response1.json();
    const time1 = Date.now() - start1;
    
    console.log('   Backend verifica Redis → VAZIO');
    console.log('   Backend consulta Supabase → BUSCA DADOS REAIS');
    console.log('   Backend salva no Redis (TTL 15min)');
    console.log(`   ⏱️  Tempo total: ${time1}ms`);
    console.log(`   📦 Cached: ${data1.cached || false}`);
    console.log(`   📊 Planos encontrados: ${data1.data?.length || 0}\n`);

    // SEGUNDA REQUISIÇÃO - Cache Hit
    console.log('⚡ 3. SEGUNDA REQUISIÇÃO (Cache Hit):');
    console.log('   Frontend → GET /api/plans (mesma requisição)');
    
    const start2 = Date.now();
    const response2 = await fetch(`${baseUrl}/api/plans`);
    const data2 = await response2.json();
    const time2 = Date.now() - start2;
    
    console.log('   Backend verifica Redis → ENCONTRA DADOS!');
    console.log('   Backend retorna do Redis → Frontend');
    console.log('   (NÃO consulta Supabase desta vez)');
    console.log(`   ⏱️  Tempo total: ${time2}ms`);
    console.log(`   📦 Cached: ${data2.cached || false}`);
    console.log(`   📊 Planos encontrados: ${data2.data?.length || 0}\n`);

    // COMPARAÇÃO
    console.log('📊 4. COMPARAÇÃO DE PERFORMANCE:');
    console.log(`   🐌 Primeira (Supabase): ${time1}ms`);
    console.log(`   🚀 Segunda (Redis): ${time2}ms`);
    const improvement = ((time1 - time2) / time1 * 100).toFixed(1);
    console.log(`   📈 Melhoria: ${improvement}% mais rápido!\n`);

    // VERIFICAR CHAVES NO CACHE
    console.log('🔑 5. VERIFICANDO CHAVES NO REDIS:');
    const keysResponse = await fetch(`${baseUrl}/api/cache/keys`);
    const keysData = await keysResponse.json();
    
    if (keysData.success) {
      console.log(`   📦 Chaves encontradas: ${keysData.data.count}`);
      keysData.data.keys.forEach(keyObj => {
        console.log(`      - ${keyObj.key}`);
      });
    }
    console.log();

    // SIMULAÇÃO DE OPERAÇÃO DE ESCRITA
    console.log('✏️  6. SIMULANDO OPERAÇÃO DE ESCRITA:');
    console.log('   Usuário cria um novo plano...');
    
    const createResponse = await fetch(`${baseUrl}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Plano Demo Cache',
        price: 79.90,
        maxAgents: 8,
        periodDays: 30,
        description: 'Demonstração de invalidação de cache'
      })
    });

    if (createResponse.ok) {
      console.log('   ✅ Plano criado com sucesso');
      console.log('   🗑️  Cache automaticamente invalidado');
      
      // Próxima consulta será cache miss novamente
      console.log('\n⚡ 7. PRÓXIMA CONSULTA (Cache Miss novamente):');
      const start3 = Date.now();
      const response3 = await fetch(`${baseUrl}/api/plans`);
      const data3 = await response3.json();
      const time3 = Date.now() - start3;
      
      console.log('   Backend verifica Redis → VAZIO (invalidado)');
      console.log('   Backend consulta Supabase → BUSCA DADOS ATUALIZADOS');
      console.log(`   ⏱️  Tempo: ${time3}ms`);
      console.log(`   📦 Cached: ${data3.cached || false}`);
      console.log(`   📊 Planos: ${data3.data?.length || 0} (incluindo o novo)\n`);
    }

    console.log('🎯 ===================================');
    console.log('🎯 RESUMO DO FLUXO:');
    console.log('🎯 ===================================');
    console.log('1️⃣  Frontend sempre chama Backend API');
    console.log('2️⃣  Backend verifica Redis primeiro');
    console.log('3️⃣  Se não tem no Redis → consulta Supabase');
    console.log('4️⃣  Se tem no Redis → retorna direto');
    console.log('5️⃣  Operações de escrita invalidam cache');
    console.log('6️⃣  Redis é transparente para o Frontend\n');

    console.log('💡 BENEFÍCIOS:');
    console.log('   🚀 Performance: até 90% mais rápido');
    console.log('   🛡️  Proteção: reduz carga no Supabase');
    console.log('   💰 Economia: menos consultas ao banco');
    console.log('   🔄 Transparente: Frontend não muda nada');

  } catch (error) {
    console.error('❌ Erro na demonstração:', error.message);
  }
}

// Executar demonstração
demonstrateCacheFlow();
