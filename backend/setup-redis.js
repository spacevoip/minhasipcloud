/**
 * =====================================================
 * SETUP REDIS - Configuração e Teste Completo
 * =====================================================
 * Script para configurar Redis do zero e testar funcionamento
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupRedis() {
  console.log('🔧 ===================================');
  console.log('🔧 CONFIGURAÇÃO REDIS PABX SYSTEM');
  console.log('🔧 ===================================\n');

  try {
    // 1. Escolher tipo de Redis
    console.log('1️⃣ Escolha o tipo de Redis:');
    console.log('   1 - Redis Local (localhost:6379)');
    console.log('   2 - Redis Cloud (recomendado para produção)');
    console.log('   3 - Redis Docker');
    
    const redisType = await question('\n👉 Digite sua escolha (1-3): ');
    
    let redisConfig = {};
    
    switch(redisType) {
      case '1':
        // Redis Local
        redisConfig = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: '',
          REDIS_USERNAME: '',
          REDIS_URL: 'redis://localhost:6379'
        };
        console.log('\n✅ Configuração Redis Local selecionada');
        break;
        
      case '2':
        // Redis Cloud
        console.log('\n🌐 Configuração Redis Cloud:');
        const host = await question('   Host (ex: redis-12345.c1.us-east-1.ec2.cloud.redislabs.com): ');
        const port = await question('   Port (ex: 12345): ');
        const password = await question('   Password: ');
        const username = await question('   Username (opcional, pressione Enter para pular): ');
        
        redisConfig = {
          REDIS_HOST: host,
          REDIS_PORT: port,
          REDIS_PASSWORD: password,
          REDIS_USERNAME: username || '',
          REDIS_URL: `redis://${username ? username + ':' : ''}${password}@${host}:${port}`
        };
        console.log('\n✅ Configuração Redis Cloud definida');
        break;
        
      case '3':
        // Redis Docker
        redisConfig = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'pabx123',
          REDIS_USERNAME: '',
          REDIS_URL: 'redis://:pabx123@localhost:6379'
        };
        console.log('\n🐳 Configuração Redis Docker selecionada');
        console.log('   Execute: docker run -d --name redis-pabx -p 6379:6379 redis:alpine redis-server --requirepass pabx123');
        break;
        
      default:
        throw new Error('Opção inválida');
    }

    // 2. Atualizar .env.local
    console.log('\n2️⃣ Atualizando arquivo .env.local...');
    
    const envPath = path.join(__dirname, '.env.local');
    let envContent = '';
    
    // Ler .env.local existente se houver
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Remover configurações Redis antigas
    envContent = envContent.replace(/^REDIS_.*$/gm, '');
    
    // Adicionar novas configurações Redis
    const redisEnvVars = `
# =====================================================
# REDIS CONFIGURATION
# =====================================================
REDIS_HOST=${redisConfig.REDIS_HOST}
REDIS_PORT=${redisConfig.REDIS_PORT}
REDIS_PASSWORD=${redisConfig.REDIS_PASSWORD}
REDIS_USERNAME=${redisConfig.REDIS_USERNAME}
REDIS_URL=${redisConfig.REDIS_URL}
`;
    
    envContent = envContent.trim() + '\n' + redisEnvVars;
    
    // Salvar arquivo
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Arquivo .env.local atualizado');

    // 3. Testar conexão
    console.log('\n3️⃣ Testando conexão Redis...');
    
    // Carregar variáveis de ambiente
    require('dotenv').config({ path: envPath });
    
    const redis = require('redis');
    
    const client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        connectTimeout: 10000
      },
      password: process.env.REDIS_PASSWORD || undefined,
      username: process.env.REDIS_USERNAME || undefined
    });

    client.on('error', (err) => {
      console.error('❌ Erro Redis:', err.message);
    });

    client.on('connect', () => {
      console.log('🔗 Conectando ao Redis...');
    });

    client.on('ready', () => {
      console.log('✅ Redis conectado e pronto!');
    });

    // Conectar e testar
    await client.connect();
    
    // Teste básico
    await client.set('pabx:test:setup', JSON.stringify({
      message: 'Redis configurado com sucesso!',
      timestamp: new Date().toISOString(),
      config: redisType === '2' ? 'Redis Cloud' : redisType === '3' ? 'Redis Docker' : 'Redis Local'
    }), { EX: 60 });
    
    const testData = await client.get('pabx:test:setup');
    const parsed = JSON.parse(testData);
    
    console.log('✅ Teste de escrita/leitura bem-sucedido:');
    console.log('   Mensagem:', parsed.message);
    console.log('   Configuração:', parsed.config);
    console.log('   Timestamp:', parsed.timestamp);
    
    // Limpar teste
    await client.del('pabx:test:setup');
    
    // Informações do servidor
    const info = await client.info('server');
    const memory = await client.info('memory');
    
    console.log('\n📊 Informações do Redis:');
    console.log('   Versão:', extractInfo(info, 'redis_version'));
    console.log('   Modo:', extractInfo(info, 'redis_mode'));
    console.log('   Memória usada:', extractInfo(memory, 'used_memory_human'));
    console.log('   Uptime:', extractInfo(info, 'uptime_in_seconds'), 'segundos');
    
    await client.quit();
    
    console.log('\n🎉 ===================================');
    console.log('🎉 REDIS CONFIGURADO COM SUCESSO!');
    console.log('🎉 ===================================');
    console.log('📋 Próximos passos:');
    console.log('   1. Execute: npm start (para iniciar o backend)');
    console.log('   2. O cache Redis será usado automaticamente');
    console.log('   3. Monitore logs para verificar funcionamento');
    
  } catch (error) {
    console.error('\n❌ ===================================');
    console.error('❌ ERRO NA CONFIGURAÇÃO:', error.message);
    console.error('❌ ===================================');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Dicas:');
      console.error('   - Verifique se o Redis está rodando');
      console.error('   - Confirme host e porta');
      console.error('   - Para Redis local: redis-server');
      console.error('   - Para Docker: docker run -d --name redis-pabx -p 6379:6379 redis:alpine');
    }
  } finally {
    rl.close();
  }
}

function extractInfo(infoString, key) {
  const lines = infoString.split('\r\n');
  for (const line of lines) {
    if (line.startsWith(key + ':')) {
      return line.split(':')[1];
    }
  }
  return 'N/A';
}

// Executar setup
setupRedis().catch(console.error);
