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
  const { data: children } = await sb
    .from('filhos_de_santo')
    .select('id, nome, tenant_id, lider_id, user_id, email, data_entrada')
    .ilike('nome', '%Lucas%');

  console.log('Filhos com Lucas:');
  console.log(JSON.stringify(children, null, 2));

  for (const c of children || []) {
    const { data: fin } = await sb
      .from('financeiro')
      .select('*')
      .or(`filho_id.eq.${c.id},descricao.ilike.%ID:${c.id}%`);
    console.log(`\nFinanceiro para ${c.nome} (${c.id}):`, fin?.length || 0, 'registros');
    if (fin?.length) console.log(JSON.stringify(fin, null, 2));

    const { data: pix } = await sb
      .from('configuracoes_pix')
      .select('*')
      .or(`terreiro_id.eq.${c.tenant_id},terreiro_id.eq.${c.lider_id}`);
    console.log(`Configuracoes PIX para tenant ${c.tenant_id}:`, JSON.stringify(pix, null, 2));
  }
}

run();
