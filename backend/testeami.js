const express = require("express");
const redis = require("redis");
const AsteriskManager = require("asterisk-manager");

// =====================
// CONFIG (use as suas credenciais)
// =====================
const REDIS_HOST = "38.51.135.181";
const REDIS_PORT = 6379;
const REDIS_PASSWORD = "35981517Biu";

const AMI_HOST = "38.51.135.180";
const AMI_PORT = 5038;
const AMI_USER = "admin";        // <<< usuário do manager.conf
const AMI_PASS = "35981517";

// =====================
// REDIS
// =====================
const CALLS_KEY = "active_calls";
const EVENTS_LOG_KEY = "ami_events_log"; // opcional p/ debug

const redisClient = redis.createClient({
  socket: { host: REDIS_HOST, port: REDIS_PORT },
  password: REDIS_PASSWORD,
});
redisClient.on("error", (e) => console.error("Redis error:", e));
(async () => {
  await redisClient.connect();
  console.log("✅ Connected to Redis");
})();

async function updateCall(uniqueid, data) {
  await redisClient.hSet(CALLS_KEY, uniqueid, JSON.stringify(data));
}
async function removeCall(uniqueid) {
  await redisClient.hDel(CALLS_KEY, uniqueid);
}
async function logEvent(evt) {
  try {
    await redisClient.lPush(EVENTS_LOG_KEY, JSON.stringify({ t: Date.now(), evt }));
    await redisClient.lTrim(EVENTS_LOG_KEY, 0, 500); // guarda últimos 500
  } catch (_) {}
}

// =====================
// AMI
// =====================
// último parâmetro = true para reconectar automaticamente
const ami = new AsteriskManager(AMI_PORT, AMI_HOST, AMI_USER, AMI_PASS, true);
ami.keepConnected();

ami.on("connect", () => console.log("🔌 AMI socket conectado (TCP)"));
ami.on("close", () => console.warn("⚠️ AMI socket fechado"));
ami.on("end", () => console.warn("⚠️ AMI conexão finalizada"));
ami.on("error", (e) => console.error("❌ AMI error:", e));
ami.on("socketerror", (e) => console.error("❌ AMI socketerror:", e));
ami.on("authenticationfailed", () => console.error("❌ AMI auth falhou — confira manager.conf/usuário/senha"));
ami.on("fullybooted", () => console.log("✅ AMI fullybooted"));

/**
 * Nem todas as libs disparam 'Newchannel'/'Newstate' com case exato.
 * 'managerevent' garante que pegamos qualquer evento.
 */
ami.on("managerevent", async (event) => {
  await logEvent(event);

  const type = (event.Event || "").toLowerCase();
  const uniqueid = event.Uniqueid || event.UniqueID || event.Linkedid || event.LinkedID;

  // Normalize dados que nos interessam
  const base = {
    event: event.Event,
    channel: event.Channel || event.Channel1 || event.Channel2,
    callerid: event.CallerIDNum || event.CallerID || event.CallerID1,
    connectedline: event.ConnectedLineNum || event.ConnectedLineID,
    state: event.ChannelStateDesc || event.DialStatus || event.BridgeState || event.State,
    context: event.Context,
    exten: event.Exten,
    uniqueid,
    linkedid: event.Linkedid || event.LinkedID,
    timestamp: Date.now(),
  };

  try {
    if (["newchannel", "newstate", "newcallerid", "dialbegin", "dialend", "bridgeenter", "bridgeleave", "agentlogin", "agentlogoff"].includes(type)) {
      if (uniqueid) await updateCall(uniqueid, base);
    } else if (type === "hangup") {
      if (uniqueid) await removeCall(uniqueid);
    }
  } catch (err) {
    console.error("Erro ao processar evento:", event.Event, err);
  }
});

// Snapshot inicial (opcional mas recomendado)
function snapshot() {
  return new Promise((resolve) => {
    const current = {};
    ami.action(
      { Action: "CoreShowChannels" },
      async (err, res) => {
        if (err) {
          console.error("CoreShowChannels erro:", err);
          return resolve();
        }
        // A lib envia múltiplos eventos 'CoreShowChannel' + 'CoreShowChannelsComplete'
        // Já estamos em 'managerevent', mas aqui consolidamos:
      }
    );
    // Também podemos pedir Status para pegar peers
    ami.action({ Action: "Status" }, (e) => {});
    setTimeout(resolve, 1500); // aguarda eventos chegarem
  });
}

ami.on("fullybooted", async () => {
  console.log("🔄 Fazendo snapshot inicial...");
  await snapshot();
  console.log("✅ Snapshot inicial solicitado.");
});

// Keepalive (evita conexões ociosas)
setInterval(() => {
  ami.action({ Action: "Ping" }, () => {});
}, 30000);

// =====================
// API HTTP
// =====================
const app = express();
const PORT = 3000;

app.get("/calls", async (_req, res) => {
  const calls = await redisClient.hGetAll(CALLS_KEY);
  const parsed = Object.values(calls).map((v) => {
    try { return JSON.parse(v); } catch { return v; }
  });
  res.json(parsed);
});

// Debug: últimos eventos crus
app.get("/debug/events", async (_req, res) => {
  const list = await redisClient.lRange(EVENTS_LOG_KEY, 0, 50);
  res.json(list.map((x) => JSON.parse(x)));
});

// Healthcheck simples
app.get("/health", async (_req, res) => {
  try {
    await redisClient.ping();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});
