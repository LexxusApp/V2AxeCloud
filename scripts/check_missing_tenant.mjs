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
  const { data: leaders } = await sb.from("perfil_lider").select("id");
  const knownIds = new Set(leaders.map(l => l.id));

  // Let's check distinct tenant_id in access_logs, audit_logs, filhos_de_santo, financeiro, etc.
  const tables = ['filhos_de_santo', 'financeiro', 'eventos', 'mensagens_mural', 'audit_logs'];
  for (const t of tables) {
    const { data } = await sb.from(t).select('tenant_id').limit(1000);
    const unknown = new Set();
    for (const r of data || []) {
      if (r.tenant_id && !knownIds.has(r.tenant_id)) {
        unknown.add(r.tenant_id);
      }
    }
    if (unknown.size > 0) {
      console.log(`Table ${t} has unknown tenant_ids:`, Array.from(unknown));
    }
  }

  // Also check if any subscriptions have an id not in perfil_lider
  const { data: subs } = await sb.from('subscriptions').select('id');
  const unknownSubs = (subs || []).filter(s => !knownIds.has(s.id));
  console.log('Subscriptions with id not in perfil_lider:', unknownSubs);
}
run();
