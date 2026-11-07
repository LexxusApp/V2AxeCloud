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

async function inspectNando() {
  const { data: leader } = await sb.from("perfil_lider").select("id, email, nome_terreiro, zelador, whatsapp").eq("email", "fernandodosogiyan@gmail.com").maybeSingle();
  console.log("Leader:", leader);

  if (leader) {
    const { data: pix } = await sb.from("configuracoes_pix").select("*").eq("tenant_id", leader.id).maybeSingle();
    console.log("Pix config:", pix);

    const { data: children } = await sb.from("filhos_de_santo").select("id, nome, telefone, email, created_at").eq("lider_id", leader.id).order("created_at", { ascending: false });
    console.log("Children count:", children?.length);
    for (const c of children || []) {
      console.log(`- Child: ${c.nome} | phone: ${c.telefone} | created_at: ${c.created_at} | email: ${c.email}`);
    }

    const childPhones = (children || []).map(c => c.telefone).filter(Boolean);
    const { data: logs } = await sb.from("whatsapp_logs")
      .select("created_at, destinatario, tipo, status, error_message, template_name")
      .order("created_at", { ascending: false })
      .limit(100);
    console.log("\nRelevant logs:");
    for (const l of logs || []) {
      if (l.destinatario?.includes("982528566") || childPhones.some(p => p && l.destinatario?.includes(p.replace(/\D/g, "").slice(-8)))) {
        console.log(`- [${l.created_at}] to: ${l.destinatario} | tipo: ${l.tipo} | status: ${l.status} | template: ${l.template_name}`);
      }
    }
  }
}
inspectNando();
