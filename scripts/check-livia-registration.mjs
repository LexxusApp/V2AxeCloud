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
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const sb = createClient(url, serviceKey);

async function checkLiviaAndAlert() {
  // 1. Data e hora exata do cadastro da Lívia
  const { data: { users } } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const livia = users.find(u => u.email === 'liviamarques39@gmail.com');
  console.log('Lívia created_at:', livia?.created_at, 'email_confirmed_at:', livia?.email_confirmed_at);

  // 2. Procurar disparos para ops/admin com o template de novo cadastro
  const { data: opsDeliveries } = await sb
    .from('whatsapp_deliveries')
    .select('*')
    .ilike('template_name', '%novo_cadastro%')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nÚltimos whatsapp_deliveries de novo_cadastro_terreiro_ops:');
  console.log(JSON.stringify(opsDeliveries, null, 2));

  // 3. Procurar em whatsapp_logs por novo cadastro ou ops
  const { data: opsLogs } = await sb
    .from('whatsapp_logs')
    .select('*')
    .or('tipo.ilike.%novo_cadastro%,tipo.ilike.%ops%,mensagem.ilike.%novo terreiro%')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nÚltimos whatsapp_logs de novo cadastro:');
  console.log(JSON.stringify(opsLogs, null, 2));
}

checkLiviaAndAlert().catch(console.error);
