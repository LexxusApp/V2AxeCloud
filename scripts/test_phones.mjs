import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.trim().startsWith('#')) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await sb.from('filhos_de_santo')
    .select('id, nome, whatsapp_phone')
    .not('whatsapp_phone', 'is', null);

  console.log('Total com whatsapp:', (data || []).length);
  for (const c of data || []) {
    const raw = String(c.whatsapp_phone || '');
    const digits = raw.replace(/\D/g, '');
    if (raw !== digits || digits.length !== 11) {
      console.log(`Divergência: nome="${c.nome}" raw="${raw}" digits="${digits}"`);
    }
  }
}

run();
