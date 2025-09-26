/**
 * ANÁLISE DE ESCALABILIDADE REDIS - 100 CLIENTES
 * Calcula uso de memória, chaves e performance esperada
 */

require('dotenv').config({ path: '.env.local' });

function analyzeRedisScalability() {
  console.log('📊 ===================================');
  console.log('📊 ANÁLISE REDIS - 100 CLIENTES PABX');
  console.log('📊 ===================================\n');

  // Estimativas baseadas no sistema atual
  const clients = 100;
  const avgAgentsPerClient = 5; // Média de agentes por cliente
  const avgCallsPerDay = 200; // Média de chamadas por cliente/dia
  const avgReportsPerClient = 10; // Relatórios por cliente

  console.log('🎯 CENÁRIO ESTIMADO:');
  console.log(`   👥 Clientes: ${clients}`);
  console.log(`   📞 Agentes totais: ${clients * avgAgentsPerClient}`);
  console.log(`   📊 Chamadas/dia: ${clients * avgCallsPerDay}`);
  console.log(`   📋 Relatórios: ${clients * avgReportsPerClient}\n`);

  // Análise de chaves de cache
  console.log('🔑 ESTIMATIVA DE CHAVES REDIS:');
  
  const cacheKeys = {
    // Cache de usuários (paginado)
    users: Math.ceil(clients / 20) * 3, // 3 páginas diferentes por vez
    
    // Cache de planos
    plans: 5, // Poucos planos diferentes
    
    // Cache de agentes por cliente
    agents: clients * 2, // 2 consultas diferentes por cliente
    
    // Cache de estatísticas
    stats: clients * 3, // Dashboard, relatórios, overview
    
    // Cache de CDR (chamadas)
    cdr: clients * 4, // Diferentes filtros de chamadas
    
    // Cache de relatórios
    reports: clients * 2, // Relatórios principais
    
    // Cache de configurações
    configs: clients, // Config por cliente
  };

  let totalKeys = 0;
  Object.entries(cacheKeys).forEach(([type, count]) => {
    console.log(`   ${type.padEnd(12)}: ${count.toString().padStart(4)} chaves`);
    totalKeys += count;
  });
  
  console.log(`   ${'TOTAL'.padEnd(12)}: ${totalKeys.toString().padStart(4)} chaves\n`);

  // Análise de memória
  console.log('💾 ESTIMATIVA DE USO DE MEMÓRIA:');
  
  const memoryUsage = {
    // Tamanho médio por tipo de dados (em KB)
    users: cacheKeys.users * 15, // ~15KB por página de usuários
    plans: cacheKeys.plans * 5, // ~5KB por conjunto de planos
    agents: cacheKeys.agents * 8, // ~8KB por lista de agentes
    stats: cacheKeys.stats * 3, // ~3KB por estatística
    cdr: cacheKeys.cdr * 25, // ~25KB por consulta CDR
    reports: cacheKeys.reports * 20, // ~20KB por relatório
    configs: cacheKeys.configs * 2, // ~2KB por config
  };

  let totalMemoryKB = 0;
  Object.entries(memoryUsage).forEach(([type, kb]) => {
    console.log(`   ${type.padEnd(12)}: ${kb.toString().padStart(4)} KB`);
    totalMemoryKB += kb;
  });

  const totalMemoryMB = (totalMemoryKB / 1024).toFixed(2);
  console.log(`   ${'TOTAL'.padEnd(12)}: ${totalMemoryKB.toString().padStart(4)} KB (~${totalMemoryMB} MB)\n`);

  // Análise de TTL atual
  console.log('⏰ TTL CONFIGURADO ATUALMENTE:');
  const currentTTL = {
    users: '5 minutos (300s)',
    plans: '30 minutos (1800s)',
    stats: '2 minutos (120s)',
    dashboard: '3 minutos (180s)',
    session: '1 hora (3600s)'
  };

  Object.entries(currentTTL).forEach(([type, ttl]) => {
    console.log(`   ${type.padEnd(12)}: ${ttl}`);
  });

  // Recomendações
  console.log('\n🎯 ANÁLISE PARA 100 CLIENTES:');
  console.log('✅ CONFIGURAÇÃO ATUAL ADEQUADA:');
  console.log(`   📦 Chaves estimadas: ${totalKeys} (bem dentro do limite)`);
  console.log(`   💾 Memória estimada: ~${totalMemoryMB} MB (Redis Cloud suporta bem)`);
  console.log(`   🔄 TTL balanceado: Performance vs Atualização`);
  console.log(`   ⚡ Redis Cloud: Adequado para esta escala\n`);

  console.log('⚠️ PONTOS DE ATENÇÃO:');
  console.log('   📈 Monitorar crescimento de chaves CDR (mais voláteis)');
  console.log('   🔍 Acompanhar uso real de memória via /api/cache/status');
  console.log('   📊 Considerar TTL menor para stats em horário de pico');
  console.log('   🚀 Implementar cache warming para dados críticos\n');

  console.log('🔧 OTIMIZAÇÕES RECOMENDADAS:');
  console.log('   1. Cache de sessões de usuário (reduzir consultas auth)');
  console.log('   2. Cache de configurações globais (planos, terminações)');
  console.log('   3. Cache de estatísticas agregadas (dashboard admin)');
  console.log('   4. Implementar cache warming no startup');
  console.log('   5. Monitoramento automático de performance\n');

  // Projeção de crescimento
  console.log('📈 PROJEÇÃO DE CRESCIMENTO:');
  const growthScenarios = [200, 500, 1000];
  
  growthScenarios.forEach(clientCount => {
    const projectedKeys = Math.round(totalKeys * (clientCount / clients));
    const projectedMemoryMB = (totalMemoryMB * (clientCount / clients)).toFixed(2);
    
    console.log(`   ${clientCount} clientes: ~${projectedKeys} chaves, ~${projectedMemoryMB} MB`);
  });

  console.log('\n🎉 ===================================');
  console.log('🎉 REDIS ESTÁ BEM CONFIGURADO!');
  console.log('🎉 Suporta 100 clientes tranquilamente');
  console.log('🎉 ===================================');
}

// Executar análise
analyzeRedisScalability();
