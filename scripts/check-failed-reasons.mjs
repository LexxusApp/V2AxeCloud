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

async function checkFailed() {
  const { data: failedMsgs } = await sb
    .from('admin_whatsapp_messages')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Mensagens recentes com status=failed: ${failedMsgs?.length || 0}`);
  for (const m of failedMsgs || []) {
    console.log(`\nID: ${m.id} | Conv: ${m.conversation_id} | At: ${m.created_at}`);
    console.log(`Body: ${m.body?.slice(0, 100)}`);
    console.log(`Raw:`, JSON.stringify(m.raw_payload || m.metadata || m.error || {}));
  }
}

checkFailed().catch(console.error);
