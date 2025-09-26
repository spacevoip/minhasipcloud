const { createClient } = require('redis');

// Configurações
const REDIS_HOST = '38.51.135.181';
const REDIS_PORT = 6379;
const REDIS_PASSWORD = '35981517Biu';

// Criação do cliente Redis
const client = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
  },
  password: REDIS_PASSWORD
});

async function testarConexao() {
  try {
    await client.connect();
    console.log('✅ Conectado ao Redis com sucesso!');

    // Teste simples: SET e GET
    await client.set('teste_conexao', 'ok');
    const valor = await client.get('teste_conexao');

    if (valor === 'ok') {
      console.log('✅ Teste de leitura/gravação no Redis passou.');
    } else {
      console.log('⚠️ Conexão feita, mas valor inesperado.');
    }

    await client.quit();
  } catch (err) {
    console.error('❌ Erro ao conectar no Redis:', err.message);
  }
}

testarConexao();
