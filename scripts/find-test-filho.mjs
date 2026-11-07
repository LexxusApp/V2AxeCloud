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

async function find() {
  const { data } = await sb
    .from('filhos_de_santo')
    .select('id, nome, cpf, whatsapp_phone, email, data_entrada')
    .not('cpf', 'is', null)
    .neq('nome', 'Marta Gomes da Silva')
    .limit(3);

  console.log(data);
}

find();
