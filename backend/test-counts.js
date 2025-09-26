const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://31.97.84.157:8000';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUyNTQ4NDAwLCJleHAiOjE5MTAzMTQ4MDB9.y8Warh7fcdJrgMO2KMmphRajbF4Cxvz1xH1Ui9HOAyE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCounts() {
  console.log('🔍 Testando contagem de usuários por plano...');
  
  try {
    // 1. Primeiro, verificar todos os usuários
    console.log('\\n1. Buscando todos os usuários...');
    const { data: allUsers, error: allError } = await supabase
      .from('users_pabx')
      .select('id, name, role, status, plan_id, plan_status');
    
    if (allError) {
      console.error('❌ Erro ao buscar todos os usuários:', allError);
      return;
    }
    
    console.log(`✅ Total de usuários encontrados: ${allUsers?.length || 0}`);
    console.log('📋 Usuários:');
    allUsers?.forEach(u => {
      console.log(`  - ${u.name} (${u.role}/${u.status}) - Plan: ${u.plan_id} - Status: ${u.plan_status}`);
    });
    
    // 2. Filtrar usuários com plan_id
    console.log('\\n2. Usuários com plan_id preenchido...');
    const usersWithPlan = allUsers?.filter(u => u.plan_id) || [];
    console.log(`✅ Usuários com plano: ${usersWithPlan.length}`);
    usersWithPlan.forEach(u => {
      console.log(`  - ${u.name} (${u.role}/${u.status}) - Plan: ${u.plan_id}`);
    });
    
    // 3. Aplicar filtros da API
    console.log('\\n3. Aplicando filtros da API (role=user, status=active, plan_id!=null)...');
    const { data: filteredUsers, error: filterError } = await supabase
      .from('users_pabx')
      .select('id, plan_id, role, status, plan_status')
      .not('plan_id', 'is', null)
      .eq('role', 'user')
      .eq('status', 'active');
    
    if (filterError) {
      console.error('❌ Erro ao filtrar usuários:', filterError);
      return;
    }
    
    console.log(`✅ Usuários filtrados: ${filteredUsers?.length || 0}`);
    filteredUsers?.forEach(u => {
      console.log(`  - ID: ${u.id} - Plan: ${u.plan_id} - Status: ${u.plan_status}`);
    });
    
    // 4. Contar por plano
    console.log('\\n4. Contando por plano...');
    const counts = {};
    for (const u of filteredUsers || []) {
      // Se plan_status for boolean: true = ativo, false = inativo
      // Se plan_status for string: 'active'/'trial' = ativo, outros = inativo
      // Se plan_status for null/undefined: considerar ativo (compatibilidade)
      let allowed = true;
      if (u.plan_status !== null && u.plan_status !== undefined) {
        if (typeof u.plan_status === 'boolean') {
          allowed = u.plan_status === true;
        } else {
          allowed = ['active', 'trial'].includes(String(u.plan_status));
        }
      }
      
      if (!allowed) {
        console.log(`  ⏭️  Usuário ${u.id} ignorado (plan_status: ${u.plan_status})`);
        continue;
      }
      
      const key = String(u.plan_id);
      counts[key] = (counts[key] || 0) + 1;
    }
    
    console.log('✅ Contadores finais:', counts);
    
    // 5. Buscar nomes dos planos
    console.log('\\n5. Buscando nomes dos planos...');
    const { data: plans, error: plansError } = await supabase
      .from('planos_pabx')
      .select('id, name');
    
    if (plansError) {
      console.error('❌ Erro ao buscar planos:', plansError);
    } else {
      console.log('📋 Planos disponíveis:');
      plans?.forEach(p => {
        const count = counts[p.id] || 0;
        console.log(`  - ${p.name} (${p.id}): ${count} usuários`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testCounts();
