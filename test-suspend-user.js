/**
 * =====================================================
 * SCRIPT DE TESTE - SUSPENDER USUÁRIO
 * =====================================================
 * Script para testar o bloqueio de usuário suspenso
 */

const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = 'http://31.97.84.157:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUyNTQ4NDAwLCJleHAiOjE5MTAzMTQ4MDB9.y8Warh7fcdJrgMO2KMmphRajbF4Cxvz1xH1Ui9HOAyE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function suspendUser() {
  try {
    console.log('🔍 Buscando usuário admin para suspender...');

    // Buscar usuário admin
    const { data: users, error: searchError } = await supabase
      .from('users_pabx')
      .select('id, email, name, status')
      .eq('email', 'admin@pabxsystem.com.br')
      .single();

    if (searchError) {
      console.error('❌ Erro ao buscar usuário:', searchError);
      return;
    }

    if (!users) {
      console.log('❌ Usuário admin não encontrado');
      return;
    }

    console.log('✅ Usuário encontrado:', {
      id: users.id,
      email: users.email,
      name: users.name,
      statusAtual: users.status
    });

    // Suspender usuário
    console.log('🚫 Suspendendo usuário...');
    const { data: updateData, error: updateError } = await supabase
      .from('users_pabx')
      .update({ 
        status: 'suspended',
        updated_at: new Date().toISOString()
      })
      .eq('id', users.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao suspender usuário:', updateError);
      return;
    }

    console.log('✅ Usuário suspenso com sucesso!');
    console.log('📊 Dados atualizados:', {
      id: updateData.id,
      email: updateData.email,
      name: updateData.name,
      status: updateData.status,
      updatedAt: updateData.updated_at
    });

    console.log('\n🎯 TESTE PRONTO!');
    console.log('📝 Para testar o bloqueio:');
    console.log('1. Acesse a página de login');
    console.log('2. Tente fazer login com: admin@pabxsystem.com.br');
    console.log('3. Deve aparecer a mensagem de acesso suspenso');
    console.log('\n🔄 Para reativar o usuário, execute:');
    console.log('node reactivate-user.js');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function reactivateUser() {
  try {
    console.log('🔍 Buscando usuário admin para reativar...');

    // Reativar usuário
    const { data: updateData, error: updateError } = await supabase
      .from('users_pabx')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('email', 'admin@pabxsystem.com.br')
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao reativar usuário:', updateError);
      return;
    }

    console.log('✅ Usuário reativado com sucesso!');
    console.log('📊 Dados atualizados:', {
      id: updateData.id,
      email: updateData.email,
      name: updateData.name,
      status: updateData.status,
      updatedAt: updateData.updated_at
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Verificar argumento da linha de comando
const action = process.argv[2];

if (action === 'reactivate') {
  reactivateUser();
} else {
  suspendUser();
}
