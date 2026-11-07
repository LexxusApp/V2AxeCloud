import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('C:/Users/Lucas A/Desktop/AxecloudV2/AxecloudV2/.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
});

const url = env['VITE_SUPABASE_URL'] || 'https://vlaojhfwhqmwudqsumpi.supabase.co';
const key = env['SUPABASE_SERVICE_ROLE_KEY'];
const sb = createClient(url, key);

async function run() {
  const tid = 'fad75b91-d2eb-4805-b5a3-c19e8a073bed';
  const { data: user } = await sb.auth.admin.getUserById(tid);
  console.log('User auth fad75b91:', user?.user?.email, user?.user?.user_metadata);

  const { data: leader } = await sb.from('perfil_lider').select('id, nome, nome_terreiro, whatsapp').or(`id.eq.${tid},tenant_id.eq.${tid}`).maybeSingle();
  console.log('Leader fad75b91:', leader);
}

run().catch(console.error);
