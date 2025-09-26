const crypto = require('crypto');

// Gerar uma chave JWT segura
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('🔑 JWT Secret gerado:');
console.log(jwtSecret);
console.log('\n📝 Adicione esta linha ao seu arquivo .env.local:');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('\n✅ Esta chave é segura e única para seu projeto!');
