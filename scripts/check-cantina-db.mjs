import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('AxecloudV2/.env', 'utf8');
const map = {};
env.split('\n').forEach(l => {
  const trimmed = l.trim();
  const idx = trimmed.indexOf('=');
  if (idx !== -1) map[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
});

const sb = createClient(map['VITE_SUPABASE_URL'], map['SUPABASE_SERVICE_ROLE_KEY']);

async function check() {
  const { data: d1, error: e1 } = await sb.from('cantina_itens').select('*').limit(1);
  console.log('cantina_itens:', e1 ? e1.message : 'exists! rows: ' + (d1?.length || 0));

  const { data: d2, error: e2 } = await sb.from('terreiro_configuracoes').select('*').limit(1);
  console.log('terreiro_configuracoes:', e2 ? e2.message : 'exists! rows: ' + (d2?.length || 0));

  const { data: d3, error: e3 } = await sb.from('tenants').select('id, configuracoes').limit(1);
  console.log('tenants:', e3 ? e3.message : 'exists! rows: ' + (d3?.length || 0));
}

check();
