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
  const { data: rows } = await sb.from("perfil_lider").select("id, email, nome_terreiro, zelador, whatsapp, created_at, is_blocked").order("created_at", { ascending: false });
  console.log("Total rows:", rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    console.log(`${i+1}. [${r.created_at}] - ${r.nome_terreiro} | ${r.email} | ${r.zelador} | blocked: ${r.is_blocked}`);
  }
}
run();
