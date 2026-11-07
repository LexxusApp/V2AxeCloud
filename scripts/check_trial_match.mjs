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
  const { data: leads } = await sb.from('prospecting_leads').select('name, phone, status, updated_at, ai_summary').eq('status', 'trial');
  const { data: leaders } = await sb.from('perfil_lider').select('nome_terreiro, email, whatsapp, created_at');

  console.log(`Checking ${leads.length} trial leads against ${leaders.length} leaders:`);
  for (const lead of leads) {
    const match = leaders.find(l => {
      const lName = (l.nome_terreiro || '').toLowerCase();
      const leadName = (lead.name || '').toLowerCase();
      return lName.includes(leadName) || leadName.includes(lName) || (l.whatsapp && lead.phone && (l.whatsapp.includes(lead.phone.slice(-8)) || lead.phone.includes(l.whatsapp.slice(-8))));
    });
    if (match) {
      console.log(`[FOUND IN PERFIL_LIDER] ${lead.name} -> ${match.nome_terreiro} (${match.email})`);
    } else {
      console.log(`[MISSING FROM PERFIL_LIDER!!!] ${lead.name} | phone: ${lead.phone} | updated_at: ${lead.updated_at} | summary: ${lead.ai_summary}`);
    }
  }
}
run();
