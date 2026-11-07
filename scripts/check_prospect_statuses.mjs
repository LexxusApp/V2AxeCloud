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
  const { data: leads, error } = await sb.from('prospecting_leads').select('name, phone, status, updated_at').order('updated_at', { ascending: false });
  console.log('Total leads:', leads.length);
  const byStatus = {};
  for (const l of leads) {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    if (['trial', 'converted', 'interested'].includes(l.status)) {
      console.log(`[${l.updated_at}] ${l.name} | ${l.phone} | status: ${l.status}`);
    }
  }
  console.log('By status:', byStatus);
}
run();
