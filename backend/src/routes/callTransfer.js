/**
 * CALL TRANSFER API - Sistema de Transferência de Chamadas
 * Transferência robusta via AMI com validações completas
 * Baseado no sistema testami.js com busca de canal por ramal
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const AsteriskManager = require('asterisk-manager');
const agentsService = require('../services/agentsService');
const cacheService = require('../services/cacheService');

const router = express.Router();

// Rate limiting para transferências (máximo 10 por minuto por usuário)
const transferLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: {
    success: false,
    message: 'Muitas tentativas de transferência. Tente novamente em 1 minuto.'
  },
  keyGenerator: (req) => `transfer_${req.user?.id || req.ip}`,
  standardHeaders: true,
  legacyHeaders: false
});

// Validações mínimas (igual ao testami.js: apenas presença dos campos)
const validateTransferRequest = [
  body('ramalOrigem').notEmpty().withMessage('Parâmetro obrigatório: ramalOrigem'),
  body('ramalDestino').notEmpty().withMessage('Parâmetro obrigatório: ramalDestino'),
  body('contexto').optional().isString()
];

// ==================== CONFIGURAÇÕES AMI (espelha testami.js) ====================
const AMI_CONFIG = {
  host: process.env.AMI_HOST || '38.51.135.180',
  port: parseInt(process.env.AMI_PORT || '5038'),
  user: process.env.AMI_USER || 'admin',
  password: process.env.AMI_PASSWORD || '35981517'
};

// API Key (igual ao testami.js) – pode ser sobrescrita por env
const VALID_API_KEY = process.env.API_KEY_TRANSFER || '191e8a1e-d313-4e12-b608-d1a759b1a106';

// Permite autenticação por x-api-key OU por JWT
function allowApiKeyOrJWT(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === VALID_API_KEY) {
    // Autenticado via API Key
    req.authBy = 'apiKey';
    return next();
  }
  // Fallback: exigir JWT
  return authenticateToken(req, res, next);
}

// Variável global AMI (como em testami.js)
let ami = null;

function criarConexaoAMI() {
  if (ami && ami.isConnected && ami.isConnected()) {
    console.log('Reutilizando conexão AMI existente.');
    return ami;
  }

  console.log('Criando nova conexão AMI...');
  const conn = new AsteriskManager(
    AMI_CONFIG.port,
    AMI_CONFIG.host,
    AMI_CONFIG.user,
    AMI_CONFIG.password,
    true // Events: true
  );

  conn.on('connect', function () {
    console.log('→ Conexão AMI estabelecida!');
  });

  conn.on('close', function () {
    console.log('Conexão AMI fechada. Reconectando na próxima operação...');
    ami = null;
  });

  conn.on('error', function (err) {
    console.error('Erro na conexão AMI:', err);
    ami = null;
  });

  // Mantém conectado como no testami.js
  conn.keepConnected();
  return conn;
}

async function encontrarCanalDoTronco(ramalOrigem) {
  return new Promise((resolve, reject) => {
    if (!ami || !ami.isConnected || !ami.isConnected()) {
      ami = criarConexaoAMI();
    }

    ami.action({
      action: 'CoreShowChannels'
    }, (err) => {
      if (err) {
        reject(new Error(`Erro ao buscar canais: ${err.message}`));
        return;
      }

      const canais = [];

      function canalListener(evt) {
        if (evt.event === 'CoreShowChannel') {
          canais.push({
            channel: evt.channel,
            calleridnum: evt.calleridnum,
            connectedlinenum: evt.connectedlinenum,
            application: evt.application,
            bridgeId: evt.bridgeid,
            state: evt.channelstatedesc,
            exten: evt.exten
          });
        } else if (evt.event === 'CoreShowChannelsComplete') {
          ami.removeListener('managerevent', canalListener);

          let canalRamal = canais.find(c => c.channel.includes(`/${ramalOrigem}-`));
          if (!canalRamal) {
            canalRamal = canais.find(c =>
              c.calleridnum === ramalOrigem ||
              c.connectedlinenum === ramalOrigem ||
              c.exten === ramalOrigem
            );
          }

          if (!canalRamal) {
            reject(new Error(`Nenhum canal encontrado para o ramal ${ramalOrigem}. Verifique se o ramal está em chamada.`));
            return;
          }

          if (canalRamal.bridgeId) {
            const canalTronco = canais.find(c =>
              c.bridgeId === canalRamal.bridgeId &&
              c.channel !== canalRamal.channel &&
              (c.channel.startsWith('PJSIP/') || c.channel.startsWith('SIP/'))
            );

            if (canalTronco) {
              resolve(canalTronco.channel);
            } else {
              const outroCanalNoBridge = canais.find(c =>
                c.bridgeId === canalRamal.bridgeId &&
                c.channel !== canalRamal.channel
              );
              if (outroCanalNoBridge) resolve(outroCanalNoBridge.channel);
              else reject(new Error(`Nenhum outro canal encontrado em bridge com o ramal ${ramalOrigem}`));
            }
          } else if (canalRamal.state === 'Up' || canalRamal.state === 'Ring') {
            resolve(canalRamal.channel);
          } else {
            reject(new Error(`O ramal ${ramalOrigem} não está em uma chamada ativa (sem bridge)`));
          }
        }
      }

      ami.on('managerevent', canalListener);
    });
  });
}

async function executarTransferencia(canal, contexto, ramalDestino, prioridade) {
  return new Promise((resolve, reject) => {
    if (!ami || !ami.isConnected || !ami.isConnected()) {
      console.log('Reconectando ao AMI antes de transferir...');
      ami = criarConexaoAMI();
    }

    ami.action({
      action: 'Redirect',
      channel: canal,
      context: contexto,
      exten: ramalDestino,
      priority: prioridade
    }, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

/**
 * Obter lista de ramais disponíveis para transferência
 */
router.get('/available-extensions', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    console.log(`🔍 [Transfer] Buscando ramais disponíveis para usuário: ${currentUser.id}`);
    
    // Buscar agentes do usuário
    const userAgents = await agentsService.getAgentsByUser(currentUser.id);
    
    if (!userAgents || userAgents.length === 0) {
      return res.json({
        success: true,
        data: {
          extensions: [],
          message: 'Nenhum ramal encontrado para este usuário'
        }
      });
    }
    
    // Buscar status dos ramais
    const extensionsWithStatus = await Promise.all(
      userAgents.map(async (agent) => {
        try {
          // Verificar se o ramal está online
          const statusKey = `extension-status:${agent.ramal}`;
          const cachedStatus = await cacheService.get(statusKey);
          
          return {
            extension: agent.ramal,
            name: agent.nome || `Ramal ${agent.ramal}`,
            callerid: agent.callerid || agent.ramal,
            status: cachedStatus?.status || 'unknown',
            isOnline: cachedStatus?.status === 'online',
            lastSeen: cachedStatus?.lastSeen || null
          };
        } catch (error) {
          console.warn(`⚠️ Erro ao buscar status do ramal ${agent.ramal}:`, error.message);
          return {
            extension: agent.ramal,
            name: agent.nome || `Ramal ${agent.ramal}`,
            callerid: agent.callerid || agent.ramal,
            status: 'unknown',
            isOnline: false,
            lastSeen: null
          };
        }
      })
    );
    
    // Ordenar por status (online primeiro) e depois por ramal
    const sortedExtensions = extensionsWithStatus.sort((a, b) => {
      if (a.isOnline !== b.isOnline) {
        return b.isOnline - a.isOnline; // Online primeiro
      }
      return a.extension.localeCompare(b.extension);
    });
    
    console.log(`✅ [Transfer] Encontrados ${sortedExtensions.length} ramais disponíveis`);
    
    res.json({
      success: true,
      data: {
        extensions: sortedExtensions,
        total: sortedExtensions.length,
        onlineCount: sortedExtensions.filter(e => e.isOnline).length
      }
    });
    
  } catch (error) {
    console.error('❌ [Transfer] Erro ao buscar ramais disponíveis:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao buscar ramais',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Validar se uma transferência é possível
 */
router.post('/validate', 
  authenticateToken,
  validateTransferRequest,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados de validação inválidos',
          errors: errors.array()
        });
      }
      
      const { channelId, targetExtension } = req.body;
      const currentUser = req.user;
      
      console.log(`🔍 [Transfer] Validando transferência: ${channelId} -> ${targetExtension}`);
      
      // 1. Verificar se o canal ainda existe e pertence ao usuário
      const activeCalls = await amiService.getActiveCallsByAccount(currentUser.id);
      const call = activeCalls.find(c => c.channel === channelId || c.id === channelId);
      
      if (!call) {
        return res.status(404).json({
          success: false,
          message: 'Chamada não encontrada ou já encerrada',
          code: 'CALL_NOT_FOUND'
        });
      }
      
      // 2. Verificar se o ramal de destino pertence ao usuário
      const userAgents = await agentsService.getAgentsByUser(currentUser.id);
      const targetAgent = userAgents.find(agent => agent.ramal === targetExtension);
      
      if (!targetAgent) {
        return res.status(403).json({
          success: false,
          message: 'Ramal de destino não pertence a este usuário',
          code: 'INVALID_TARGET_EXTENSION'
        });
      }
      
      // 3. Verificar se o ramal de destino não é o mesmo da origem
      if (call.extension === targetExtension) {
        return res.status(400).json({
          success: false,
          message: 'Não é possível transferir para o mesmo ramal',
          code: 'SAME_EXTENSION'
        });
      }
      
      // 4. Verificar se AMI está conectado
      if (!amiService.isConnected()) {
        return res.status(503).json({
          success: false,
          message: 'Sistema de transferência temporariamente indisponível',
          code: 'AMI_DISCONNECTED'
        });
      }
      
      console.log(`✅ [Transfer] Validação aprovada: ${channelId} -> ${targetExtension}`);
      
      res.json({
        success: true,
        data: {
          valid: true,
          call: {
            channelId: call.channel || call.id,
            extension: call.extension,
            callerNumber: call.callerNumber,
            state: call.state,
            duration: call.duration
          },
          target: {
            extension: targetAgent.ramal,
            name: targetAgent.nome,
            callerid: targetAgent.callerid
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [Transfer] Erro na validação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno na validação da transferência',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Função para encontrar o canal do tronco com base no ramal (baseada no testami.js)
 */
async function encontrarCanalDoTronco(ramalOrigem) {
  return new Promise((resolve, reject) => {
    if (!amiService.isConnected()) {
      reject(new Error('AMI não conectado'));
      return;
    }

    // Busca todos os canais ativos
    amiService.sendAction({
      Action: 'CoreShowChannels'
    });

    const canais = [];
    const timeout = setTimeout(() => {
      reject(new Error('Timeout ao buscar canais'));
    }, 10000);

    // Listener para os eventos de canais
    function canalListener(evt) {
      if (evt.event === 'CoreShowChannel') {
        canais.push({
          channel: evt.channel,
          calleridnum: evt.calleridnum,
          connectedlinenum: evt.connectedlinenum,
          application: evt.application,
          bridgeId: evt.bridgeid,
          state: evt.channelstatedesc,
          exten: evt.exten
        });
      } else if (evt.event === 'CoreShowChannelsComplete') {
        clearTimeout(timeout);
        amiService.removeListener('managerevent', canalListener);

        // Método 1: Busca por canal que contenha o ramal no nome
        let canalRamal = canais.find(c => c.channel.includes(`/${ramalOrigem}-`));

        if (!canalRamal) {
          // Método 2: Busca por caller ID ou connected line
          canalRamal = canais.find(c => 
            c.calleridnum === ramalOrigem || 
            c.connectedlinenum === ramalOrigem || 
            c.exten === ramalOrigem
          );
        }

        if (!canalRamal) {
          reject(new Error(`Nenhum canal encontrado para o ramal ${ramalOrigem}. Verifique se o ramal está em chamada.`));
          return;
        }

        console.log(`Canal do ramal ${ramalOrigem} encontrado: ${canalRamal.channel}`);

        // Encontra o canal do tronco que está em bridge com o ramal
        if (canalRamal.bridgeId) {
          const canalTronco = canais.find(c => 
            c.bridgeId === canalRamal.bridgeId && 
            c.channel !== canalRamal.channel &&
            (c.channel.startsWith('PJSIP/') || c.channel.startsWith('SIP/'))
          );

          if (canalTronco) {
            console.log(`Canal do tronco encontrado: ${canalTronco.channel}`);
            resolve(canalTronco.channel);
          } else {
            // Se não encontrar um tronco, tenta outro canal do mesmo bridge
            const outroCanalNoBridge = canais.find(c => 
              c.bridgeId === canalRamal.bridgeId && 
              c.channel !== canalRamal.channel
            );

            if (outroCanalNoBridge) {
              console.log(`Outro canal encontrado no mesmo bridge: ${outroCanalNoBridge.channel}`);
              resolve(outroCanalNoBridge.channel);
            } else {
              reject(new Error(`Nenhum outro canal encontrado em bridge com o ramal ${ramalOrigem}`));
            }
          }
        } else {
          // Se não estiver em bridge, verifica se o próprio canal está em chamada
          if (canalRamal.state === 'Up' || canalRamal.state === 'Ring') {
            console.log(`Canal ${canalRamal.channel} está ativo. Usando-o para transferência.`);
            resolve(canalRamal.channel);
          } else {
            reject(new Error(`O ramal ${ramalOrigem} não está em uma chamada ativa (sem bridge)`));
          }
        }
      }
    }

    // Adiciona o listener temporário
    ami.on('managerevent', canalListener);
  });
}

/**
 * Executar transferência de chamada (novo sistema baseado em ramais)
 */
router.post('/execute', transferLimiter, allowApiKeyOrJWT, validateTransferRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Parâmetros inválidos',
        errors: errors.array()
      });
    }

    const { ramalOrigem, ramalDestino, contexto = 'jgs' } = req.body;

    if (!ramalOrigem || !ramalDestino) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Parâmetros obrigatórios: ramalOrigem e ramalDestino'
      });
    }

    console.log(`🔄 [Transfer] Solicitação de transferência: Ramal origem=${ramalOrigem}, Ramal destino=${ramalDestino}, Contexto=${contexto}`);

    // Garante conexão AMI (como no testami.js)
    if (!ami || !ami.isConnected || !ami.isConnected()) {
      ami = criarConexaoAMI();
    }

    // Encontrar o canal do tronco via CoreShowChannels
    const canal = await encontrarCanalDoTronco(ramalOrigem);

    // Executar a transferência
    const prioridade = 1;
    await executarTransferencia(canal, contexto, ramalDestino, prioridade);

    // Opcional: invalidar cache de chamadas ativas do usuário autenticado
    if (req.user?.id) {
      const cacheKey = `ami:active-calls:${req.user.id}`;
      try { await cacheService.delete(cacheKey); } catch (_) {}
    }

    return res.json({
      sucesso: true,
      mensagem: 'Transferência realizada com sucesso',
      detalhes: { canal, ramalOrigem, ramalDestino, contexto, prioridade }
    });

  } catch (error) {
    console.error('❌ [Transfer] Erro ao processar transferência:', error.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: error.message
    });
  }
});

/**
 * Histórico de transferências (opcional)
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    const { limit = 20, offset = 0 } = req.query;
    
    // Por enquanto, retornar array vazio
    // Futuramente pode implementar log de transferências no banco
    res.json({
      success: true,
      data: {
        transfers: [],
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
    
  } catch (error) {
    console.error('❌ [Transfer] Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico de transferências'
    });
  }
});

module.exports = router;
