const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkPlanStatusValues() {
  try {
    console.log('🔍 Verificando valores da coluna plan_status...\n');
    
    // Buscar todos os usuários e seus status
    const { data: users, error } = await supabase
      .from('users_pabx')
      .select('id, name, email, plan_status, plan_id, created_at')
      .order('created_at');

    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      return;
    }

    console.log('📊 Usuários encontrados:');
    console.log('='.repeat(80));
    
    users.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Nome: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Plan Status: "${user.plan_status}" (tipo: ${typeof user.plan_status})`);
      console.log(`Plan ID: ${user.plan_id}`);
      console.log(`Criado em: ${user.created_at}`);
      console.log('-'.repeat(40));
    });

    // Contar valores únicos
    const statusCounts = {};
    users.forEach(user => {
      const status = user.plan_status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('\n📈 Resumo dos valores plan_status:');
    console.log('='.repeat(50));
    Object.entries(statusCounts).forEach(([status, count]) => {
      const willBecome = getConversionValue(status);
      console.log(`"${status}" -> ${count} usuário(s) -> será convertido para: ${willBecome}`);
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

function getConversionValue(status) {
  if (!status) return 'FALSE (NULL)';
  
  const lowerStatus = status.toLowerCase();
  switch (lowerStatus) {
    case 'active': return 'TRUE';
    case 'inactive': return 'FALSE';
    case 'expired': return 'FALSE';
    case 'suspended': return 'FALSE';
    default: return 'FALSE (OUTRO)';
  }
}

checkPlanStatusValues();
