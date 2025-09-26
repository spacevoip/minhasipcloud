const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Importar configurações e rotas
const { testConnection } = require('./config/database');
const cacheService = require('./services/cacheService');
const cacheWarmingService = require('./services/cacheWarmingService');
const { cacheMiddlewares } = require('./middleware/cacheMiddleware');
const extensionStatusService = require('./services/extensionStatusService');
const amiService = require('./services/amiService');
const dtmfCaptureService = require('./services/dtmfCaptureService');
const authRoutes = require('./routes/auth');
const authV2Routes = require('./routes/auth-v2');
// const plansRoutes = require('./routes/plans'); // Legacy - unmounted
const plansV2Routes = require('./routes/plans-v2');
const userPlansRoutes = require('./routes/user-plans');
// const usersRoutes = require('./routes/users'); // Legacy - unmounted
const usersV2Routes = require('./routes/users-v2');
const agentsRoutes = require('./routes/agents');
const adminAgentsRoutes = require('./routes/adminAgents');
const resellerAgentsRoutes = require('./routes/resellerAgents');
const cacheRoutes = require('./routes/cache');
const cacheWarmingRoutes = require('./routes/cacheWarming');
const extensionStatusRoutes = require('./routes/extensionStatus');
const cdrRoutes = require('./routes/cdr');
const notificationsRoutes = require('./routes/notifications');
const callLogsRoutes = require('./routes/callLogs');
const financeRoutes = require('./routes/finance');
const activeCallsRoutes = require('./routes/activeCalls');
const dialerRoutes = require('./routes/dialer');
const callTransferRoutes = require('./routes/callTransfer');
const terminationsRoutes = require('./routes/terminations');
const dtmfRoutes = require('../routes/dtmf');
const agentAuthRoutes = require('./routes/agentAuth');
const mailingsRoutes = require('./routes/mailings');
const audiosRoutes = require('./routes/audios');
const callLimitRoutes = require('./routes/call-limit');
const smsRoutes = require('./routes/sms');
const smsSendRoutes = require('./routes/sms-send');
const workSessionsRoutes = require('./routes/workSessions');
const classificationRoutes = require('./routes/classification');

const app = express();
const PORT = process.env.PORT || 3001;

// Respeitar proxies (Nginx/Ingress/Load Balancer) para obter IP real do cliente
// Usa o cabeçalho X-Forwarded-For quando presente
app.set('trust proxy', true);

// =====================================================
// MIDDLEWARES DE SEGURANÇA
// =====================================================

// Helmet para headers de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS - Permitir qualquer origem + headers de cache
app.use(cors({
  origin: true, // Aceita qualquer origem
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Rate limiting global - DESABILITADO PARA TESTE
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por IP
//   message: {
//     success: false,
//     message: 'Muitas requisições. Tente novamente mais tarde.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use(limiter);

// =====================================================
// MIDDLEWARES GERAIS
// =====================================================

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// =====================================================
// ROTAS
// =====================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PABX System API está funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rotas de autenticação
app.use('/api/auth', authRoutes);

// Rotas de autenticação V2 - API moderna
app.use('/api/auth-v2', authV2Routes);

// Legacy plans routes removed. Use only /api/v2/plans

// Rotas de planos V2 (seguras, com paginação, filtros e contadores agregados)
app.use('/api/v2/plans', plansV2Routes);

// Rotas de ativação de planos de usuários (mantidas como estão por enquanto)
app.use('/api/user-plans', cacheMiddlewares.stats, cacheMiddlewares.invalidateUsers, userPlansRoutes);

// Legacy users routes removed. Use only /api/users-v2

// Rotas de usuários V2 - API moderna (0% cache)
app.use('/api/users-v2', usersV2Routes);

// Rotas de ramais/agentes (sem cache para garantir status em tempo real)
app.use('/api/agents', agentsRoutes);

// Rotas de admin para TODOS os agentes (com cache de 30s)
app.use('/api/admin/agents', adminAgentsRoutes);

// Rotas de revendedor para agentes de seus clientes
app.use('/api/reseller/agents', resellerAgentsRoutes);

// Rotas de monitoramento de cache
app.use('/api/cache', cacheRoutes);

// Rotas de cache warming
app.use('/api/cache-warming', cacheWarmingRoutes);

// Rotas de status dos ramais (monitoramento ps_contacts)
app.use('/api/extension-status', extensionStatusRoutes);

// Rotas de status simples de ramal
const ramalStatusRoutes = require('./routes/ramalStatus');
app.use('/api/ramal-status', ramalStatusRoutes);

// Rotas de CDR (detalhes de chamadas) 
app.use('/api/cdr', cdrRoutes);

// Rotas de notificações (admin/reseller)
app.use('/api/notifications', notificationsRoutes);

// Rotas de call logs (salvar status final da chamada)
app.use('/api/call-logs', callLogsRoutes);

// Rotas de finanças (admin/reseller)
app.use('/api/finance', financeRoutes);

// Rotas de chamadas ativas via ARI
app.use('/api/active-calls', activeCallsRoutes);
// Rotas do discador (claim de contatos por agente + fila Redis)
app.use('/api/dialer', dialerRoutes);

// Rotas de transferência de chamadas
app.use('/api/call-transfer', callTransferRoutes);

// Rotas de terminations (troncos)
app.use('/api/terminations', terminationsRoutes);

// Rotas de autenticação de agentes
app.use('/api/agent-auth', agentAuthRoutes);

// Rotas de mailings (campanhas de email)
app.use('/api/mailings', mailingsRoutes);

// Rotas de áudios (gerenciamento de arquivos de áudio)
app.use('/api/audios', audiosRoutes);

// Rotas de controle de limite de chamadas
app.use('/api/call-limit', callLimitRoutes);

// Rotas de DTMF (captura de dígitos)
app.use('/api/dtmf', dtmfRoutes);

// Rotas de SMS (validação de números móveis)
app.use('/api/sms', smsRoutes);

// Rotas de SMS Send (envio personalizado de SMS)
app.use('/api/sms-send', smsSendRoutes);

// Rotas de controle de jornada de agentes (start/pause/resume/stop/active)
app.use('/api/work-sessions', workSessionsRoutes);

// Rotas de classificação de chamadas (pós-chamada)
app.use('/api/classification', classificationRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// =====================================================
// MIDDLEWARE DE ERRO GLOBAL
// =====================================================

app.use((error, req, res, next) => {
  console.error('❌ Erro não tratado:', error);
  
  // Erro de validação do express-validator
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido'
    });
  }
  
  // Erro de payload muito grande
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Payload muito grande'
    });
  }
  
  // Erro genérico
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    ...(process.env.NODE_ENV !== 'production' && { error: error.message })
  });
});

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================

const startServer = async () => {
  try {
    // Testar conexão com banco
    console.log('🔄 Testando conexão com banco de dados...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Falha na conexão com banco de dados');
      process.exit(1);
    }
    
    // Inicializar Redis Cache
    console.log('🔄 Inicializando Redis Cache...');
    const cacheConnected = await cacheService.connect();
    
    if (!cacheConnected) {
      console.warn('⚠️ Redis não disponível - continuando sem cache');
    } else {
      console.log('✅ Redis Cache conectado com sucesso!');
      
      // Executar Cache Warming
      console.log('🔥 Iniciando Cache Warming...');
      setTimeout(async () => {
        await cacheWarmingService.warmCache();
        await cacheWarmingService.scheduleRewarming();
      }, 2000); // Aguardar 2s para servidor estabilizar
    }
    
    // Inicializar monitoramento de ramais
    console.log('🔄 Inicializando monitoramento de ramais...');
    extensionStatusService.startMonitoring();
    console.log('✅ Monitoramento de ramais iniciado (5s)!');
    
    // Inicializar AMI Service para chamadas ativas em tempo real
    console.log('🔄 Inicializando AMI Service...');
    try {
      await amiService.connect();
      console.log('✅ AMI Service conectado e monitorando eventos!');
    } catch (amiError) {
      console.warn('⚠️ AMI Service falhou ao conectar, usando apenas ARI fallback:', amiError.message);
    }
    
    // Inicializar captura de DTMF (AMI + Postgres), configs via backend/.env.local
    console.log('🔄 Iniciando DTMF Capture Service...');
    try {
      const started = await dtmfCaptureService.start();
      if (started) {
        console.log('✅ DTMF Capture Service iniciado e ouvindo eventos DTMF');
      } else {
        console.warn('⚠️ DTMF Capture Service não iniciado (variáveis de ambiente ausentes)');
      }
    } catch (dtmfErr) {
      console.error('❌ Falha ao iniciar DTMF Capture Service:', dtmfErr?.message || dtmfErr);
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('🚀 ===================================');
      console.log(`🚀 PABX System API iniciada!`);
      console.log(`🚀 Porta: ${PORT}`);
      console.log(`🚀 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 URL: http://localhost:${PORT}`);
      console.log('🚀 ===================================');
      console.log('📋 Rotas disponíveis:');
      console.log('   GET  /health - Health check');
      console.log('   POST /api/auth/login - Login');
      console.log('   POST /api/auth/logout - Logout');
      console.log('   GET  /api/auth/me - Dados do usuário');
      console.log('   POST /api/auth/refresh - Renovar token');
      console.log('   POST /api/auth/change-password - Alterar senha');
      console.log('   GET  /api/users-v2 - Lista de usuários (admin/collab)');
      console.log('   GET  /api/users-v2/:id - Usuário por ID');
      console.log('   POST /api/users-v2 - Criar usuário (admin/collab)');
      console.log('   PUT  /api/users-v2/:id - Atualizar usuário');
      console.log('   DELETE /api/users-v2/:id - Excluir usuário (admin)');
      console.log('   GET  /api/v2/plans - Buscar todos os planos (v2)');
      console.log('   GET  /api/v2/plans/:id - Buscar plano por ID (v2)');
      console.log('   POST /api/v2/plans - Criar plano (v2, admin)');
      console.log('   PUT  /api/v2/plans/:id - Atualizar plano (v2, admin)');
      console.log('   DELETE /api/v2/plans/:id - Excluir plano (v2, admin)');
      console.log('   GET  /api/extension-status - Status de todos os ramais');
      console.log('   GET  /api/extension-status/:extension - Status de um ramal');
      console.log('   GET  /api/extension-status/stats/monitoring - Estatísticas do monitoramento');
      console.log('   POST /api/extension-status/start - Iniciar monitoramento');
      console.log('   POST /api/extension-status/stop - Parar monitoramento');
      console.log('   GET  /api/ramal-status/:ramal - Status simples de um ramal');
      console.log('   POST /api/ramal-status/check - Verificar múltiplos ramais');
      console.log('   GET  /api/cdr - Listar CDR do usuário autenticado');
      console.log('   GET  /api/active-calls?accountcode=UUID - Chamadas ativas (com filtro opcional)');
      console.log('   GET  /api/terminations - Listar troncos e taxa de sucesso');
      console.log('   GET  /api/notifications - Listar notificações');
      console.log('   POST /api/notifications - Criar notificação');
      console.log('   PUT  /api/notifications/:id - Atualizar notificação');
      console.log('   DELETE /api/notifications/:id - Excluir notificação');
      console.log('   GET  /api/notifications/:id/recipients - Listar destinatários');
      console.log('   GET  /api/finance - Listar transações (admin/reseller)');
      console.log('🚀 ===================================');
    });
    
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Tratamento de sinais do sistema
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM recebido. Encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT recebido. Encerrando servidor...');
  process.exit(0);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  process.exit(1);
});

// Iniciar servidor
startServer();

module.exports = app;
