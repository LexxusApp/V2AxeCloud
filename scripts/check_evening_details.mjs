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

async function checkDetails() {
  const { data: leader } = await sb.from("perfil_lider").select("id, nome_terreiro, zelador, email, whatsapp").eq("id", "85a827b1-9495-4f78-a4b7-9daa694de95a").maybeSingle();
  console.log("Líder dos novos filhos:", leader);

  const { data: conv } = await sb.from("admin_whatsapp_conversations").select("id, contact_name, phone_e164").eq("phone_e164", "5521982528566").maybeSingle();
  if (conv) {
    const { data: messages } = await sb.from("admin_whatsapp_messages")
      .select("created_at, sender, body, status")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(6);
    console.log("\nMensagens recentes de LFC (Pai Nando):");
    for (const m of (messages || []).reverse()) {
      console.log(`[${m.created_at}] ${m.sender}: ${m.body}`);
    }
  }

  const { data: fin } = await sb.from("financeiro").select("id, descricao, valor, tipo, categoria, status, tenant_id, created_at").gte("created_at", "2026-10-26T21:00:00Z");
  console.log("\nTransação financeira:", fin);
}
checkDetails();
