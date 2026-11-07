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
  const { data: leads, error } = await sb.from('prospecting_leads')
    .select('id, name, phone_raw, status, updated_at, created_at')
    .in('status', ['trial', 'converted'])
    .order('updated_at', { ascending: false });
  console.log('Total trial or converted leads:', leads?.length);
  for (const l of leads || []) {
    console.log(`[${l.updated_at}] ${l.name} | ${l.phone_raw} | status: ${l.status}`);
  }
}
run();
