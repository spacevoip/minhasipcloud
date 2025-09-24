const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
  try {
    const { data: users, error: userError } = await supabase
      .from('users_pabx')
      .select('*')
      .ilike('name', '%Wilson%')
      .limit(5);
    
    if (userError) {
      console.error('Erro ao buscar usuário:', userError);
      return;
    }
    
    if (users && users.length > 0) {
      const user = users[0];
      console.log('=== DADOS DO USUÁRIO ===');
      console.log('ID:', user.id);
      console.log('Nome:', user.name);
      console.log('Plan ID:', user.plan_id);
      console.log('Plan Activated At:', user.plan_activated_at);
      console.log('Plan Expires At:', user.plan_expires_at);
      console.log('Plan Status:', user.plan_status);
      
      if (user.plan_id) {
        const { data: plan, error: planError } = await supabase
          .from('planos_pabx')
          .select('*')
          .eq('id', user.plan_id)
          .single();
        
        if (!planError && plan) {
          console.log('\n=== DADOS DO PLANO ===');
          console.log('Nome:', plan.name);
          console.log('Period Days:', plan.period_days);
          console.log('Preço:', plan.price);
        }
      }
      
      if (user.plan_expires_at) {
        const today = new Date();
        const expiresAt = new Date(user.plan_expires_at);
        const diffTime = expiresAt.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log('\n=== CÁLCULO DE DIAS ===');
        console.log('Data atual:', today.toISOString().split('T')[0]);
        console.log('Data vencimento:', expiresAt.toISOString().split('T')[0]);
        console.log('Dias restantes:', Math.max(0, diffDays));
      }
    } else {
      console.log('Usuário Wilson não encontrado');
    }
  } catch (error) {
    console.error('Erro:', error);
  }
}

checkUser();
