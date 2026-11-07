import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const env = dotenv.parse(fs.readFileSync('./.env'));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCustomReplies() {
  const { data: convs } = await sb.from('admin_whatsapp_conversations').select('id, contact_name, phone_e164');
  console.log('--- RESPOSTAS DIGITADAS PELOS ZELADORES (NÃO BOTÕES) ---');
  for (const c of convs || []) {
    const { data: msgs } = await sb.from('admin_whatsapp_messages')
      .select('body, created_at')
      .eq('conversation_id', c.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false });

    for (const m of msgs || []) {
      const text = (m.body || '').trim().toLowerCase();
      if (text !== 'quero conhecer' && text !== 'sair' && text !== 'sim' && text.length > 3) {
        console.log(` • ${c.contact_name} (${c.phone_e164}): "${m.body.replace(/\n/g, ' ')}" [${m.created_at.slice(0, 10)}]`);
      }
    }
  }
}
checkCustomReplies();
