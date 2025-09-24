/**
 * TESTE SMS - Verificar funcionamento da API SMS
 */

const smsService = require('./src/services/smsService');

async function testSMS() {
  console.log('🧪 Iniciando teste da API SMS...\n');

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
      '11987654321',
      '987654321', // sem DDD
      '87654321'   // fixo sem DDD
    ];

    testPhones.forEach(phone => {
      const formatted = smsService.formatPhoneNumber(phone);
      console.log(`📱 ${phone.padEnd(18)} → ${formatted}`);
    });
    console.log('');

    // 1. Testar criação da tabela
    console.log('1️⃣ Testando criação da tabela...');
    await smsService.ensureTable();
    console.log('✅ Tabela criada/verificada com sucesso\n');

    // 2. Testar envio de SMS
    console.log('2️⃣ Testando envio de SMS...');
    const phone = '(19) 99565-2552'; // Número no formato brasileiro
    const sendResult = await smsService.requestCode(phone, '127.0.0.1', 'test-agent');
    
    if (sendResult.success) {
      console.log('✅ SMS enviado com sucesso:', sendResult.message);
      console.log('📱 Telefone formatado:', sendResult.phone);
    } else {
      console.log('❌ Erro ao enviar SMS:', sendResult.error);
    }
    console.log('');

    // 3. Testar verificação com código incorreto
    console.log('3️⃣ Testando código incorreto...');
    const wrongCode = '000000';
    const wrongResult = await smsService.verifyCode(phone, wrongCode, '127.0.0.1');
    
    if (!wrongResult.success) {
      console.log('✅ Código incorreto rejeitado:', wrongResult.error);
    } else {
      console.log('❌ Código incorreto foi aceito (erro!)');
    }
    console.log('');

    // 4. Simular código correto (para teste, vamos buscar o código no banco)
    console.log('4️⃣ Buscando código gerado no banco...');
    const formattedPhone = smsService.formatPhoneNumber(phone);
    const result = await smsService.pool.query(
      `SELECT otp FROM sms_verification_codes_pabx 
       WHERE phone = $1 AND valido = true AND verificado = false 
       ORDER BY send_date DESC LIMIT 1`,
      [formattedPhone]
    );

    if (result.rows.length > 0) {
      const correctCode = result.rows[0].otp;
      console.log('🔍 Código encontrado:', correctCode);

      // 5. Testar verificação com código correto
      console.log('5️⃣ Testando código correto...');
      const correctResult = await smsService.verifyCode(phone, correctCode, '127.0.0.1');
      
      if (correctResult.success) {
        console.log('✅ Código correto aceito:', correctResult.message);
      } else {
        console.log('❌ Código correto rejeitado:', correctResult.error);
      }
    } else {
      console.log('❌ Nenhum código encontrado no banco');
    }
    console.log('');

    // 6. Testar verificação de telefone verificado
    console.log('6️⃣ Testando status de verificação...');
    const isVerified = await smsService.isPhoneVerified(phone);
    console.log('📋 Telefone verificado:', isVerified ? 'SIM' : 'NÃO');
    console.log('');

    // 7. Testar rate limiting
    console.log('7️⃣ Testando rate limiting...');
    const canSend = await smsService.checkRateLimit(phone);
    console.log('🚦 Pode enviar SMS:', canSend ? 'SIM' : 'NÃO');
    console.log('');

    // 8. Testar limpeza de códigos expirados
    console.log('8️⃣ Testando limpeza de códigos expirados...');
    await smsService.cleanExpiredCodes();
    console.log('✅ Limpeza executada');
    console.log('');

    console.log('🎉 Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Fechar conexões
    await smsService.close();
    console.log('👋 Conexões fechadas');
  }
}

// Executar teste
testSMS();
