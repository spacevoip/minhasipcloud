// =====================================================
// TESTE: RESELLER PLAN OWNERSHIP
// =====================================================
// Script para testar se os planos estão sendo vinculados
// corretamente ao revendedor que os criou

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://hnfqnxqrwwzlqfvwwfgw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZnFueHFyd3d6bHFmdnd3Zmd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYxMDM5NzIsImV4cCI6MjA1MTY3OTk3Mn0.CnJJAWPdGVMnDJlmYHJJKnCvUkJKvPHJJKnCvUkJKvP';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testResellerPlanOwnership() {
  console.log('🔍 [TEST] Iniciando teste de Reseller Plan Ownership...\n');

  try {
    // 1. Verificar estrutura da tabela planos_pabx
    console.log('📋 [TEST] Verificando estrutura da tabela planos_pabx...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'planos_pabx' });

    if (columnsError) {
      console.log('⚠️  [TEST] Erro ao verificar colunas, continuando...');
    }

    // 2. Buscar todos os planos existentes
    console.log('📋 [TEST] Buscando todos os planos existentes...');
    const { data: allPlans, error: plansError } = await supabase
      .from('planos_pabx')
      .select('id, name, created_by, reseller_id, created_at')
      .order('created_at', { ascending: false });

    if (plansError) {
      console.error('❌ [TEST] Erro ao buscar planos:', plansError);
      return;
    }

    console.log(`✅ [TEST] ${allPlans.length} planos encontrados:\n`);
    
    allPlans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name}`);
      console.log(`   ID: ${plan.id}`);
      console.log(`   Created By: ${plan.created_by || 'NULL'}`);
      console.log(`   Reseller ID: ${plan.reseller_id || 'NULL'}`);
      console.log(`   Criado em: ${plan.created_at}`);
      console.log('');
    });

    // 3. Buscar usuários revendedores
    console.log('👥 [TEST] Buscando usuários revendedores...');
    const { data: resellers, error: resellersError } = await supabase
      .from('users_pabx')
      .select('id, username, name, role')
      .eq('role', 'reseller');

    if (resellersError) {
      console.error('❌ [TEST] Erro ao buscar revendedores:', resellersError);
      return;
    }

    console.log(`✅ [TEST] ${resellers.length} revendedores encontrados:\n`);
    
    resellers.forEach((reseller, index) => {
      console.log(`${index + 1}. ${reseller.name} (@${reseller.username})`);
      console.log(`   ID: ${reseller.id}`);
      console.log('');
    });

    // 4. Verificar planos por revendedor
    for (const reseller of resellers) {
      console.log(`🔍 [TEST] Planos criados por ${reseller.name}:`);
      
      const { data: resellerPlans, error: resellerPlansError } = await supabase
        .from('planos_pabx')
        .select('id, name, created_by, reseller_id')
        .eq('created_by', reseller.id);

      if (resellerPlansError) {
        console.error(`❌ [TEST] Erro ao buscar planos do revendedor ${reseller.name}:`, resellerPlansError);
        continue;
      }

      if (resellerPlans.length === 0) {
        console.log(`   ⚠️  Nenhum plano encontrado para ${reseller.name}`);
      } else {
        resellerPlans.forEach((plan, index) => {
          console.log(`   ${index + 1}. ${plan.name} (ID: ${plan.id})`);
        });
      }
      console.log('');
    }

    // 5. Resumo do teste
    console.log('📊 [TEST] RESUMO DO TESTE:');
    console.log(`   • Total de planos: ${allPlans.length}`);
    console.log(`   • Total de revendedores: ${resellers.length}`);
    
    const plansWithReseller = allPlans.filter(p => p.reseller_id !== null);
    console.log(`   • Planos com reseller_id: ${plansWithReseller.length}`);
    
    const plansWithCreatedBy = allPlans.filter(p => p.created_by !== null);
    console.log(`   • Planos com created_by: ${plansWithCreatedBy.length}`);

  } catch (error) {
    console.error('❌ [TEST] Erro geral no teste:', error);
  }
}

// Executar teste
testResellerPlanOwnership();
