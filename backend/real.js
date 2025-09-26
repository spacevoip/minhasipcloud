// subscriber.js
// Node >=18

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://db.minhasip.cloud';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU2MzMyMDAwLCJleHAiOjE5MTQwOTg0MDB9.vIiIgvpXc1MPG7skoG1w3eYDQbWY-BL6CDJvAzwl6SA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

async function main() {
  console.log('📡 Conectando ao Supabase Realtime...');

  const channel = supabase
  .channel('dtmf-listener')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'dtmf_pabx' }, // * = INSERT + UPDATE + DELETE
    (payload) => {
      if (payload.eventType === 'INSERT') {
        const { ramal, digito, id_call } = payload.new;
        console.log(`➕ INSERT 📞 ${ramal} | 🔢 ${digito} | ID: ${id_call}`);
      }
      if (payload.eventType === 'UPDATE') {
        const { ramal, digito, id_call } = payload.new;
        console.log(`✏️ UPDATE 📞 ${ramal} | 🔢 ${digito} | ID: ${id_call}`);
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✅ Inscrito na tabela dtmf_pabx (INSERT/UPDATE)');
    }
  });

}

main();
