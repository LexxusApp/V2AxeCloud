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
  const tables = [
    'perfil_lider', 'terreiros_publicos', 'diretorio_terreiros', 'reivindicacoes_terreiros', 
    'cadastros_pendentes', 'leads', 'prospects', 'onboarding', 'subscriptions',
    'deleted_tenants', 'audit_logs', 'access_logs', 'solicitacoes_acesso',
    'auth_users', 'usuarios', 'tenants'
  ];
  for (const t of tables) {
    try {
      const { count, error: err } = await sb.from(t).select('*', { count: 'exact', head: true });
      if (!err) {
        console.log(`Table ${t}: ${count} rows`);
      }
    } catch(e) {}
  }
}
run();
