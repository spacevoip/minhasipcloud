const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AsteriskManager = require('asterisk-manager');

const app = express();
const PORT = 3200;

// ==================== CONFIGURAÇÕES AMI ====================
const AMI_CONFIG = {
    host: "38.51.135.180",
    port: 5038,
    user: "admin",
    password: "35981517"
};

// ==================== MIDDLEWARES ====================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Key Authentication Middleware
const VALID_API_KEY = '191e8a1e-d313-4e12-b608-d1a759b1a106';
app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== VALID_API_KEY) {
        return res.status(403).json({ error: 'Acesso negado! API Key inválida ou ausente.' });
    }
    next();
});

// ==================== VARIÁVEL GLOBAL AMI ====================
let ami = null;

// ==================== FUNÇÕES DE TRANSFERÊNCIA ====================

/**
 * Função para criar uma nova conexão AMI
 * @returns {AsteriskManager} Instância da conexão AMI
 */
function criarConexaoAMI() {
    if (ami && ami.isConnected()) {
        console.log('Reutilizando conexão AMI existente.');
        return ami;
    }

    console.log('Criando nova conexão AMI...');
    const amiConnection = new AsteriskManager(
        AMI_CONFIG.port,
        AMI_CONFIG.host,
        AMI_CONFIG.user,
        AMI_CONFIG.password,
        true // Events: true
    );
  
    // Configurar tratamento de eventos
    amiConnection.on('connect', function() {
        console.log('→ Conexão AMI estabelecida!');
    });
  
    amiConnection.on('close', function() {
        console.log('Conexão AMI fechada. Reconectando na próxima operação...');
        ami = null; // Limpa a referência para recriar na próxima chamada
    });
  
    amiConnection.on('error', function(err) {
        console.error('Erro na conexão AMI:', err);
        ami = null; // Limpa a referência para recriar na próxima chamada
    });
  
    // Iniciar a conexão
    amiConnection.keepConnected();
  
    return amiConnection;
}

/**
 * Função para encontrar o canal do tronco com base no ramal
 * @param {string} ramalOrigem - Número do ramal de origem
 * @returns {Promise<string>} Canal do tronco encontrado
 */
async function encontrarCanalDoTronco(ramalOrigem) {
    return new Promise((resolve, reject) => {
        // Garantir que temos uma conexão AMI
        if (!ami || !ami.isConnected()) {
            ami = criarConexaoAMI();
        }
    
        // Busca todos os canais ativos
        ami.action({
            action: 'CoreShowChannels'
        }, (err, res) => {
            if (err) {
                reject(new Error(`Erro ao buscar canais: ${err.message}`));
                return;
            }
      
            // Eventos serão recebidos aqui
            const canais = [];
      
            // Listener para os eventos de canais
            function canalListener(evt) {
                if (evt.event === 'CoreShowChannel') {
                    // Adicionar mais campos para debug
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
                    // Remove o listener quando a lista estiver completa
                    ami.removeListener('managerevent', canalListener);
          
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
                            (c.channel.startsWith('PJSIP/') || c.channel.startsWith('SIP/')) // Troncos podem começar com PJSIP/ ou SIP/
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
                            console.log(`★★ Não há bridge, mas o canal ${canalRamal.channel} está ativo. Usando-o para transferência.`);
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
    });
}

/**
 * Função para executar a transferência
 * @param {string} canal - Canal a ser transferido
 * @param {string} contexto - Contexto do dialplan
 * @param {string} ramalDestino - Ramal de destino
 * @param {number} prioridade - Prioridade da extensão
 * @returns {Promise<Object>} Resultado da transferência
 */
async function executarTransferencia(canal, contexto, ramalDestino, prioridade) {
    return new Promise((resolve, reject) => {
        // Verifica se a conexão AMI está ativa
        if (!ami || !ami.isConnected()) {
            console.log('Reconectando ao AMI antes de transferir...');
            ami = criarConexaoAMI();
        }
    
        console.log(`Enviando comando de transferência: Canal=${canal}, Contexto=${contexto}, Ramal=${ramalDestino}`);
    
        ami.action({
            action: 'Redirect',
            channel: canal,
            context: contexto,
            exten: ramalDestino,
            priority: prioridade
        }, (err, res) => {
            if (err) {
                console.error('✗ Erro ao transferir:', err.message);
                reject(err);
            } else {
                console.log('✓ Transferência solicitada com sucesso!');
                console.log('Resposta do servidor:', JSON.stringify(res, null, 2));
                resolve(res);
            }
        });
    });
}

// ==================== ROTA DE TRANSFERÊNCIA ====================

/**
 * Rota para transferir chamada
 * POST /transferir
 * Body: {
 *   "ramalOrigem": "1001",
 *   "ramalDestino": "1002",
 *   "contexto": "jgs" (opcional, padrão: "jgs")
 * }
 * Headers: {
 *   "x-api-key": "191e8a1e-d313-4e12-b608-d1a759b1a106"
 * }
 */
app.post('/transferir', async (req, res) => {
    try {
        const { ramalOrigem, ramalDestino, contexto = 'jgs' } = req.body;
        
        // Validar parâmetros
        if (!ramalOrigem || !ramalDestino) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Parâmetros obrigatórios: ramalOrigem e ramalDestino'
            });
        }
        
        console.log(`Solicitação de transferência: Ramal origem=${ramalOrigem}, Ramal destino=${ramalDestino}, Contexto=${contexto}`);
        
        // Garantir que temos uma conexão AMI
        if (!ami || !ami.isConnected()) {
            ami = criarConexaoAMI();
        }
        
        // Encontrar o canal do tronco
        const canal = await encontrarCanalDoTronco(ramalOrigem);
        
        // Executar a transferência
        const prioridade = 1;
        
        await executarTransferencia(canal, contexto, ramalDestino, prioridade);
        
        // Retornar sucesso
        return res.json({
            sucesso: true,
            mensagem: 'Transferência realizada com sucesso',
            detalhes: {
                canal,
                ramalOrigem,
                ramalDestino,
                contexto,
                prioridade
            }
        });
    } catch (error) {
        console.error('Erro ao processar transferência:', error.message);
        return res.status(500).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});

// ==================== ROTA DE STATUS ====================

// Route to check server status
app.get('/status', (req, res) => {
    const conexaoAmi = ami && ami.isConnected() ? 'Conectado' : 'Desconectado';
    
    return res.json({
        status: 'online',
        amiStatus: conexaoAmi,
        uptime: process.uptime()
    });
});

// ==================== INICIALIZAÇÃO DO SERVIDOR ====================

// Inicializar conexão AMI na inicialização
function inicializarAMI() {
    ami = criarConexaoAMI();
    console.log('Sistema de transferência inicializado!');
}

// Inicializar servidor HTTP
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Transferência rodando na porta ${PORT}`);
    console.log(`📞 Rota de transferência: POST /transferir`);
    console.log(`📊 Rota de status: GET /status`);
    console.log(`🔐 API Key necessária: ${VALID_API_KEY}`);
    
    // Inicializar conexão AMI
    inicializarAMI();
});

// ==================== TRATAMENTO DE ERROS ====================

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promessa rejeitada não tratada:', reason);
});

// ==================== EXEMPLO DE USO ====================
/*
Para usar o sistema de transferência:

1. Faça uma requisição POST para: http://localhost:3000/transferir

2. Headers:
   x-api-key: 191e8a1e-d313-4e12-b608-d1a759b1a106

3. Body (JSON):
   {
     "ramalOrigem": "1001",
     "ramalDestino": "1002",
     "contexto": "jgs"
   }

4. Resposta de sucesso:
   {
     "sucesso": true,
     "mensagem": "Transferência realizada com sucesso",
     "detalhes": {
       "canal": "PJSIP/1001-00000abc",
       "ramalOrigem": "1001",
       "ramalDestino": "1002",
       "contexto": "jgs",
       "prioridade": 1
     }
   }

5. Resposta de erro:
   {
     "sucesso": false,
     "mensagem": "Nenhum canal encontrado para o ramal 1001. Verifique se o ramal está em chamada."
   }
*/