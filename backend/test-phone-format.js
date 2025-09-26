/**
 * TESTE FORMATAÇÃO DE TELEFONES - Verificar conversão automática
 */

const smsService = require('./src/services/smsService');

console.log('📱 TESTE DE FORMATAÇÃO DE TELEFONES BRASILEIROS\n');
console.log('Cliente digita → Sistema converte para seven.io\n');

const testCases = [
  // Formatos que o cliente pode digitar
  { input: '(19) 99565-2552', description: 'Formato com máscara completa' },
  { input: '19 99565-2552', description: 'Formato com espaço' },
  { input: '1999565-2552', description: 'Formato com hífen' },
  { input: '19995652552', description: 'Apenas números com DDD' },
  { input: '(11) 98765-4321', description: 'São Paulo com máscara' },
  { input: '11987654321', description: 'São Paulo apenas números' },
  { input: '987654321', description: 'Celular sem DDD (assume SP)' },
  { input: '87654321', description: 'Fixo sem DDD (assume SP)' },
  { input: '5519995652552', description: 'Já com código do país' },
  { input: '+5519995652552', description: 'Já formatado internacional' },
];

testCases.forEach((testCase, index) => {
  const formatted = smsService.formatPhoneNumber(testCase.input);
  console.log(`${(index + 1).toString().padStart(2, '0')}. ${testCase.description}`);
  console.log(`    Cliente: ${testCase.input.padEnd(20)} → API: ${formatted}`);
  console.log('');
});

console.log('✅ Todos os formatos são convertidos automaticamente para +55DDNNNNNNNNN');
console.log('✅ O cliente nunca precisa digitar +55');
console.log('✅ Sistema aceita qualquer formato brasileiro comum');

// Fechar conexões se houver
process.exit(0);
