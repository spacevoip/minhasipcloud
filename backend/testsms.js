const axios = require('axios');
const readline = require('readline-sync');

// ⚠️ COLE AQUI sua API key REAL da seven.io (Developer → API Keys)
const API_KEY = 'hfXptHj7wxhTyqPiK2d0TYo5rp8wH0c70drkvOMURXi8Ie0V0SDoeXrOPuEEIQsO';

// Lê destino no terminal (formato E.164, ex.: +5511999999999)
const to = readline.question('Destino (ex: +5511999999999): ').trim();

// Mensagem padrão
const text = `[MinhaSIP] Seu código de autenticação é: 482913
Ele expira em 5 minutos. Não compartilhe com ninguém.`;

// Opcional: remetente (remova se suspeitar de bloqueio por Sender ID)
const from = 'MinhaSIP';

(async () => {
  // Monta o corpo exato que será enviado
  const form = new URLSearchParams({ to, text, from });
  const bodyToSend = form.toString();

  console.log('--- REQUEST -----------------------');
  console.log('POST https://gateway.seven.io/api/sms');
  console.log('Headers:');
  console.log({
    'X-Api-Key': API_KEY ? '[REDACTED]' : '(vazio)',
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
  });
  console.log('Body (x-www-form-urlencoded):');
  console.log(bodyToSend);
  console.log('-----------------------------------');

  try {
    const res = await axios.post(
      'https://gateway.seven.io/api/sms',
      bodyToSend,
      {
        headers: {
          'X-Api-Key': API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        // <- pega o corpo "cru" como texto (sem parse)
        responseType: 'text',
        transformResponse: [d => d], // não transformar nada
        validateStatus: () => true,  // não jogar exception em 4xx/5xx
        timeout: 20000
      }
    );

    console.log('--- RESPONSE ----------------------');
    console.log('Status:', res.status, res.statusText);
    console.log('Headers:', res.headers);
    console.log('Body (raw):');
    console.log(res.data); // aqui vem exatamente o que a API retornou
    console.log('-----------------------------------');

    // Se vier JSON de sucesso (exemplo da doc), você pode tentar parsear:
    try {
      const maybeJson = JSON.parse(res.data);
      console.log('Body (parsed JSON):');
      console.dir(maybeJson, { depth: null });
    } catch {}
  } catch (err) {
    console.error('❌ Falha de rede/execução:', err.message);
    if (err.response) {
      console.log('--- RESPONSE ----------------------');
      console.log('Status:', err.response.status, err.response.statusText);
      console.log('Headers:', err.response.headers);
      console.log('Body (raw):');
      console.log(err.response.data);
      console.log('-----------------------------------');
    }
  }
})();
