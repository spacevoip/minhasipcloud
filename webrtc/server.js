const fs = require("fs");
const https = require("https");
const express = require("express");
const path = require("path");

const app = express();

// Usar variáveis de ambiente para certificados SSL
const sslOptions = {
  key: fs.readFileSync(process.env.SSL_PRIVATE_KEY_PATH || "/etc/letsencrypt/live/minhasip.cloud/privkey.pem"),
  cert: fs.readFileSync(process.env.SSL_CERTIFICATE_PATH || "/etc/letsencrypt/live/minhasip.cloud/fullchain.pem")
};

// Servir a página estática
app.use(express.static(__dirname));

https.createServer(sslOptions, app).listen(3010, () => {
  console.log("🚀 Servidor HTTPS ativo em https://minhasip.cloud:3010");
});
