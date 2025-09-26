// Standalone Transfer Service (mirrors testami.js) - Port 3209
// Requires x-api-key and performs AMI Redirect based on ramalOrigem -> ramalDestino

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const AsteriskManager = require('asterisk-manager');

// Config
const PORT = process.env.TRANSFER_PORT || 3209;
const API_KEY = process.env.API_KEY_TRANSFER || '191e8a1e-d313-4e12-b608-d1a759b1a106';

const AMI_CONFIG = {
  host: process.env.AMI_HOST || '38.51.135.180',
  port: parseInt(process.env.AMI_PORT || '5038'),
  user: process.env.AMI_USER || 'admin',
  password: process.env.AMI_PASSWORD || '35981517',
};

let ami = null;

function criarConexaoAMI() {
  if (ami && ami.isConnected && ami.isConnected()) {
    return ami;
  }
  ami = new AsteriskManager(
    AMI_CONFIG.port,
    AMI_CONFIG.host,
    AMI_CONFIG.user,
    AMI_CONFIG.password,
    true
  );
  ami.keepConnected();
  ami.on('ready', () => console.log('[TransferSvc] AMI ready'));
  ami.on('error', (err) => console.error('[TransferSvc] AMI error:', err?.message || err));
  return ami;
}

function promiscAmiAction(action, params) {
  return new Promise((resolve, reject) => {
    try {
      criarConexaoAMI().action({ Action: action, ...params }, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    } catch (e) { reject(e); }
  });
}

async function executarTransferencia(channel, context, exten, priority = 1) {
  await promiscAmiAction('Redirect', {
    Channel: channel,
    Context: context,
    Exten: exten,
    Priority: priority,
  });
}

function encontrarCanalDoTronco(ramalOrigem) {
  return new Promise((resolve, reject) => {
    const am = criarConexaoAMI();

    let timeoutId;
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      am.removeListener('managerevent', listener);
    };

    const listener = (event) => {
      if (event?.event?.toLowerCase() !== 'coreshowchannel') return;
      if (!event.channel) return;

      const canal = event.channel;
      const state = event.channelstate && event.channelstate.toString();

      // Se o evento está relacionado ao ramal de origem ou está bridged com ele
      const isRamal = canal.includes(`/${ramalOrigem}-`);

      if (isRamal && (state === '6' || state === '5')) { // Up=6 Ring=5
        // Tentar pegar o outro lado pelo BridgeId
        if (event.bridgeid) {
          am.action({ Action: 'CoreShowChannels' }, (err) => {
            if (err) return; // segue esperando
          });
        }
      }
    };

    am.on('managerevent', listener);

    // Dispara o dump de canais
    am.action({ Action: 'CoreShowChannels' }, (err) => {
      if (err) console.error('[TransferSvc] Erro CoreShowChannels:', err);
    });

    // Abordagem simplificada: após listar todos, procurar pelo par no buffer
    const canais = [];
    const bufferListener = (event) => {
      if (event?.event?.toLowerCase() !== 'coreshowchannel') return;
      canais.push(event);
    };

    am.on('managerevent', bufferListener);

    timeoutId = setTimeout(() => {
      am.removeListener('managerevent', bufferListener);
      // Encontrar canal do ramal origem
      const canalRamal = canais.find(c => c.channel && (c.channel.includes(`PJSIP/${ramalOrigem}-`) || c.channel.includes(`SIP/${ramalOrigem}-`)));
      if (!canalRamal) {
        cleanup();
        return reject(new Error(`Nenhum canal encontrado para o ramal ${ramalOrigem}. Verifique se o ramal está em chamada.`));
      }
      // Tentar achar o outro canal no mesmo bridge
      if (canalRamal.bridgeid) {
        const canalTronco = canais.find(c => c.bridgeid === canalRamal.bridgeid && c.channel !== canalRamal.channel);
        if (canalTronco) {
          cleanup();
          return resolve(canalTronco.channel);
        }
      }
      // Se não achar, usar o próprio canal se estiver ativo
      if (canalRamal.channelstate === '6' || canalRamal.channelstate === '5') {
        cleanup();
        return resolve(canalRamal.channel);
      }
      cleanup();
      return reject(new Error(`O ramal ${ramalOrigem} não está em uma chamada ativa`));
    }, 800);
  });
}

// Express App
const app = express();
app.use(cors());
app.use(bodyParser.json());

// API key middleware
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ sucesso: false, mensagem: 'Unauthorized: invalid x-api-key' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'transfer', port: PORT });
});

app.post('/execute', async (req, res) => {
  try {
    const { ramalOrigem, ramalDestino, contexto = 'default' } = req.body || {};
    if (!ramalOrigem || !ramalDestino) {
      return res.status(400).json({ sucesso: false, mensagem: 'Parâmetros obrigatórios: ramalOrigem e ramalDestino' });
    }

    const canal = await encontrarCanalDoTronco(ramalOrigem);
    await executarTransferencia(canal, contexto, ramalDestino, 1);

    return res.json({
      sucesso: true,
      mensagem: 'Transferência realizada com sucesso',
      detalhes: {
        canal,
        ramalOrigem,
        ramalDestino,
        contexto,
        prioridade: 1,
      }
    });
  } catch (error) {
    console.error('[TransferSvc] Erro:', error?.message || error);
    return res.status(500).json({ sucesso: false, mensagem: error?.message || 'Erro interno' });
  }
});

app.listen(PORT, () => {
  console.log(`🔁 Transfer service listening on http://localhost:${PORT}`);
});
