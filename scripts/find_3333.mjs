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
  const target = "33333333-3333-4333-8333-333333333333";
  const tables = [
    'perfil_lider', 'filhos_de_santo', 'subscriptions', 'audit_logs',
    'access_logs', 'tenant_feature_failures', 'financeiro'
  ];
  for (const t of tables) {
    try {
      const { data } = await sb.from(t).select('*').eq('tenant_id', target).limit(5);
      if (data && data.length) {
        console.log(`Found in table ${t} (tenant_id):`, data.length);
      }
    } catch(e) {}
  }
}
run();
