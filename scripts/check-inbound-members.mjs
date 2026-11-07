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
  const phones = ['5547999991860', '5547988107094', '554791476015'];
  const { data: convs } = await sb
    .from('admin_whatsapp_conversations')
    .select('*')
    .in('phone_e164', phones);

  console.log('Conversas encontradas:', convs ? convs.length : 0);
  if (convs && convs.length > 0) {
    const { data: msgs } = await sb
      .from('admin_whatsapp_messages')
      .select('*')
      .in('conversation_id', convs.map(c => c.id))
      .order('created_at', { ascending: true });
    console.log('Mensagens do inbox:', msgs);
  }
}

run();
