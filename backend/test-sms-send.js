/**
 * TESTE SMS SEND - Verificar funcionamento da API SMS Send
 */

const smsSendService = require('./src/services/smsSendService');

async function testSMSSend() {
  console.log('🧪 Iniciando teste da API SMS Send...\n');

  try {
    // 0. Testar formatação de telefones
    console.log('0️⃣ Testando formatação de telefones...');
    const testPhones = [
      '(19) 99565-2552',
      '19 99565-2552',
      '1999565-2552',
      '19995652552',
      '5519995652552',
      '+5519995652552',
      '(11) 98765-4321',
      '11987654321'
    ];

    testPhones.forEach(phone => {
      const formatted = smsSendService.formatPhoneNumber(phone);
      console.log(`📱 ${phone.padEnd(18)} → ${formatted}`);
    });
    console.log('');

    // 1. Testar verificação da tabela
    console.log('1️⃣ Testando verificação da tabela...');
    await smsSendService.ensureTable();
    console.log('✅ Tabela verificada com sucesso\n');

    // 2. Testar envio de SMS
    console.log('2️⃣ Testando envio de SMS...');
    const userid = '123e4567-e89b-12d3-a456-426614174000'; // UUID exemplo
    const agent_id = '987fcdeb-51a2-43d7-8f9e-123456789abc'; // UUID exemplo
    const content = 'Olá! Esta é uma mensagem de teste do sistema MinhaSIP.';
    const destination = '(19) 99565-2552';
    
    const sendResult = await smsSendService.sendSMS(userid, agent_id, content, destination, '127.0.0.1', 'test-agent');
    
    if (sendResult.success) {
      console.log('✅ SMS enviado com sucesso:', sendResult.message);
      console.log('📱 Destino formatado:', sendResult.destination);
      console.log('🆔 SMS ID:', sendResult.sms_id);
      
      // 3. Testar busca de status
      console.log('\n3️⃣ Testando busca de status...');
      const status = await smsSendService.getSMSStatus(sendResult.sms_id);
      if (status) {
        console.log('✅ Status encontrado:', {
          id: status.id,
          destination: status.destination,
          status: status.status,
          created_at: status.created_at
        });
      } else {
        console.log('❌ Status não encontrado');
      }
      
    } else {
      console.log('❌ Erro ao enviar SMS:', sendResult.error);
    }
    console.log('');

    // 4. Testar histórico do usuário
    console.log('4️⃣ Testando histórico do usuário...');
    const userHistory = await smsSendService.getUserSMSHistory(userid, 10, 0);
    console.log(`📋 Encontrados ${userHistory.length} SMS no histórico do usuário`);
    userHistory.forEach((sms, index) => {
      console.log(`   ${index + 1}. ${sms.destination} - ${sms.status} - ${sms.created_at}`);
    });
    console.log('');

    // 5. Testar histórico do agente
    console.log('5️⃣ Testando histórico do agente...');
    const agentHistory = await smsSendService.getAgentSMSHistory(agent_id, 10, 0);
    console.log(`📋 Encontrados ${agentHistory.length} SMS no histórico do agente`);
    agentHistory.forEach((sms, index) => {
      console.log(`   ${index + 1}. ${sms.destination} - ${sms.status} - ${sms.created_at}`);
    });
    console.log('');

    console.log('🎉 Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Fechar conexões
    await smsSendService.close();
    console.log('👋 Conexões fechadas');
  }
}

// Executar teste
testSMSSend();
