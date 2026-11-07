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

const url = envVars.VITE_SUPABASE_URL || envVars.SUPABASE_URL;
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const sb = createClient(url, key);

async function run() {
  const tenantId = '64d2b1c0-ae53-44f0-9ddb-40b72f6ba8a0';

  console.log("=== 1. DISPAROS DO TERREIRO (WHATSAPP_LOGS) ===");
  const { data: logs, error } = await sb
    .from('whatsapp_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Erro ao buscar logs:", error);
    return;
  }

  console.log(`Total de logs encontrados: ${logs.length}`);
  for (const l of logs) {
    console.log("----------------------------------------------------");
    console.log(`Data (UTC): ${l.created_at}`);
    console.log(`Tipo: ${l.tipo}`);
    console.log(`Destinatário: ${l.telefone}`);
    console.log(`Status Meta: ${l.status}`);
    console.log(`WAMID: ${l.external_id}`);
    console.log(`Mensagem:\n${l.mensagem}`);
  }

  console.log("\n=== 2. MEMBROS / FILHOS DA CASA ===");
  const { data: filhos } = await sb
    .from('filhos_de_santo')
    .select('id, nome, whatsapp_phone, status, matricula, created_at')
    .eq('tenant_id', tenantId);
  console.log(JSON.stringify(filhos, null, 2));

  console.log("\n=== 3. GIRAS AGENDADAS ===");
  const { data: giras } = await sb
    .from('eventos_liturgicos')
    .select('*')
    .eq('tenant_id', tenantId);
  console.log(JSON.stringify(giras, null, 2));
}

run();
