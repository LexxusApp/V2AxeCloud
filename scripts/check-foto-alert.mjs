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
  console.log("=== 1. ÚLTIMAS 100 MENSAGENS EM WHATSAPP_LOGS ===");
  const { data: logs, error } = await sb.from('whatsapp_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error("Erro ao buscar whatsapp_logs:", error);
    return;
  }

  for (const r of logs) {
    const tel = r.telefone || r.recipient_phone || r.phone || '';
    const msg = r.mensagem || r.template_name || r.body || '';
    const created = r.created_at;
    const tipo = r.tipo || r.status;
    const isTarget = String(tel).includes('11920033501') || 
                     String(msg).toLowerCase().includes('foto') || 
                     String(msg).toLowerCase().includes('falha') || 
                     String(msg).toLowerCase().includes('none');

    if (isTarget) {
      console.log(`\n[${created}] TEL: ${tel} | TIPO: ${tipo}`);
      console.log(`MSG/TPL: ${msg}`);
      console.log(`DADOS COMPLETOS:`, JSON.stringify(r, null, 2));
    }
  }

  console.log("\n=== 2. VERIFICANDO TABELA DE FALHAS / ALERTAS / NOTIFICAÇÕES ===");
  // Check tables like tenant_failures, system_alerts, errors, etc.
  const tables = ['tenant_failures', 'system_alerts', 'audit_logs', 'failed_jobs', 'feature_failures', 'cron_logs'];
  for (const t of tables) {
    try {
      const { data, error } = await sb.from(t).select('*').order('created_at', { ascending: false }).limit(10);
      if (!error && data && data.length > 0) {
        console.log(`\nTabela [${t}] encontrou ${data.length} registros recentes:`);
        console.log(JSON.stringify(data.slice(0, 3), null, 2));
      }
    } catch (e) {
      // table might not exist
    }
  }
}

run();
