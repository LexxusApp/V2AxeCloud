import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.trim().startsWith("#")) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/\r/g, "");
  }
}

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: convs, error } = await sb.from('admin_whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(30);
  console.log('Error:', error);
  console.log('Recent conversations:', convs?.length);
  for (const c of convs || []) {
    console.log(`[${c.last_message_at}] ${c.contact_name} | ${c.phone_e164} | status: ${c.status} | last: ${c.last_message_preview?.slice(0, 80)}`);
  }
}
run();
