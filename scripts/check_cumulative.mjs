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
  const { data: rows } = await sb.from("perfil_lider").select("id, nome_terreiro, email, is_blocked, created_at").order("created_at", { ascending: true });
  
  let total = 0;
  let active = 0;
  let blocked = 0;

  console.log("Cumulative count by date:");
  const byDate = {};
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    byDate[d] = (byDate[d] || []);
    byDate[d].push(r);
  }

  for (const [date, list] of Object.entries(byDate)) {
    for (const r of list) {
      total++;
      if (r.is_blocked) blocked++;
      else active++;
    }
    console.log(`${date}: +${list.length} new -> Cumulative: ${total} total (${active} active, ${blocked} blocked)`);
    for (const r of list) {
      if (date >= '2026-10-23') {
        console.log(`   - ${r.nome_terreiro} (${r.email}) [blocked: ${r.is_blocked}]`);
      }
    }
  }
}
run();
