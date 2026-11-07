import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const envVars = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    envVars[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  }
}
const sb = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: filho } = await sb
    .from('filhos_de_santo')
    .select('id, nome, cpf, email, whatsapp_phone, tenant_id, data_entrada')
    .eq('id', '3666b777-1066-4eb7-a0c3-f63c2e01ae90')
    .single();

  console.log('Filho autenticado:', filho);

  const { data: terreiro } = await sb
    .from('terreiros')
    .select('id, nome, slug, cidade, estado')
    .eq('id', filho.tenant_id)
    .maybeSingle();

  console.log('Terreiro:', terreiro);
}

check().catch(console.error);
