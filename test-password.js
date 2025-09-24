const { createClient } = require('@supabase/supabase-js');

// Credenciais diretamente no código
const SUPABASE_URL = 'https://db.minhasip.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU2MzMyMDAwLCJleHAiOjE5MTQwOTg0MDB9.vIiIgvpXc1MPG7skoG1w3eYDQbWY-BL6CDJvAzwl6SA';

// Inicializa o Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('📡 Conectando ao Supabase Realtime...');

(async () => {
  const channel = supabase
    .channel('agentes-status-channel')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'agentes_pabx'
      },
      (payload) => {
        const { old, new: novo } = payload;

        const statusAlterado = old.status_sip !== novo.status_sip;
        const lastSeenAlterado = old.last_seen !== novo.last_seen;

        if (statusAlterado || lastSeenAlterado) {
          console.log(`🔔 Atualização no ramal ID ${novo.id}:`);

          if (statusAlterado) {
            console.log(`🟢 status_sip: ${old.status_sip} ➜ ${novo.status_sip}`);
          }

          if (lastSeenAlterado) {
            console.log(`⏱️ last_seen: ${old.last_seen} ➜ ${novo.last_seen}`);
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Inscrito com sucesso no canal realtime!');
      }
    });
})();
