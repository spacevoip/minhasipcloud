/**
 * =====================================================
 * SCRIPT PARA VERIFICAR TABELA PS_CONTACTS
 * =====================================================
 * Verifica estrutura e dados da tabela ps_contacts
 */

const { createClient } = require('@supabase/supabase-js');

// Configurações do Supabase
const supabaseUrl = 'http://31.97.84.157:8000';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUyNTQ4NDAwLCJleHAiOjE5MTAzMTQ4MDB9.y8Warh7fcdJrgMO2KMmphRajbF4Cxvz1xH1Ui9HOAyE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPsContactsTable() {
  try {
    console.log('🔍 Verificando tabela ps_contacts...');

    // Verificar se a tabela existe e buscar alguns registros
    const { data, error } = await supabase
      .from('ps_contacts')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ Erro ao acessar tabela ps_contacts:', error);
      
      // Se a tabela não existe, vamos criar uma versão mock para desenvolvimento
      console.log('🛠️ Tabela ps_contacts não encontrada. Criando estrutura mock...');
      await createMockPsContactsTable();
      return;
    }

    console.log('✅ Tabela ps_contacts encontrada!');
    console.log('📊 Registros encontrados:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('📋 Estrutura da tabela (primeiro registro):');
      console.log(JSON.stringify(data[0], null, 2));
      
      // Verificar se existe coluna endpoint
      const firstRecord = data[0];
      if (firstRecord.endpoint) {
        console.log('✅ Coluna "endpoint" encontrada!');
        console.log('🔌 Endpoints encontrados:', data.map(r => r.endpoint).filter(Boolean));
      } else {
        console.log('❌ Coluna "endpoint" não encontrada nos registros');
        console.log('📋 Colunas disponíveis:', Object.keys(firstRecord));
      }
    } else {
      console.log('⚠️ Tabela existe mas está vazia');
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function createMockPsContactsTable() {
  try {
    console.log('🛠️ Criando tabela ps_contacts mock...');
    
    // Criar tabela ps_contacts se não existir
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ps_contacts (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(50) NOT NULL,
        contact_uri VARCHAR(255),
        status VARCHAR(20) DEFAULT 'online',
        user_agent VARCHAR(255),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql: createTableQuery 
    });

    if (createError) {
      console.error('❌ Erro ao criar tabela:', createError);
      return;
    }

    console.log('✅ Tabela ps_contacts criada!');

    // Inserir dados mock para teste
    const mockContacts = [
      { endpoint: '1001', contact_uri: 'sip:1001@192.168.1.100', status: 'online' },
      { endpoint: '1002', contact_uri: 'sip:1002@192.168.1.100', status: 'online' },
      { endpoint: '1003', contact_uri: 'sip:1003@192.168.1.100', status: 'online' },
    ];

    const { error: insertError } = await supabase
      .from('ps_contacts')
      .insert(mockContacts);

    if (insertError) {
      console.error('❌ Erro ao inserir dados mock:', insertError);
      return;
    }

    console.log('✅ Dados mock inseridos na tabela ps_contacts!');
    console.log('📊 Ramais online mock:', mockContacts.map(c => c.endpoint));

  } catch (error) {
    console.error('❌ Erro ao criar tabela mock:', error);
  }
}

// Executar verificação
checkPsContactsTable();
