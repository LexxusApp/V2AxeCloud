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

async function checkEvening() {
  const since = "2026-10-26T21:00:00Z"; // 18:00 BRT

  // 1. WhatsApp conversations updated tonight
  const { data: convs } = await sb.from("admin_whatsapp_conversations")
    .select("contact_name, phone_e164, last_message_at, last_message_preview, unread_count, status")
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false });
  console.log("=== CONVERSAS WHATSAPP NA NOITE (desde 18h) ===");
  console.log("Total:", convs?.length || 0);
  for (const c of convs || []) {
    console.log(`- [${c.last_message_at}] ${c.contact_name} (${c.phone_e164}): "${c.last_message_preview}" (unread: ${c.unread_count})`);
  }

  // 2. WhatsApp logs (read receipts, delivery)
  const { data: waLogs } = await sb.from("whatsapp_logs")
    .select("created_at, tipo, destinatario, status, template_name")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  console.log("\n=== WHATSAPP LOGS NA NOITE ===");
  console.log("Total logs:", waLogs?.length || 0);
  const statusCounts = {};
  const tipoCounts = {};
  for (const w of waLogs || []) {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
    tipoCounts[w.tipo] = (tipoCounts[w.tipo] || 0) + 1;
  }
  console.log("Status breakdown:", statusCounts);
  console.log("Tipo breakdown:", tipoCounts);

  // 3. Logins / Auth events
  const { data: audits } = await sb.from("audit_logs")
    .select("created_at, action, user_id, metadata")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  console.log("\n=== AUDIT LOGS / LOGINS NA NOITE ===");
  console.log("Total events:", audits?.length || 0);
  for (const a of audits || []) {
    console.log(`- [${a.created_at}] action: ${a.action} | user: ${a.user_id}`);
  }

  // 4. Filhos criados ou cadastrados na noite
  const { data: filhos } = await sb.from("filhos_de_santo")
    .select("id, nome, created_at, lider_id")
    .gte("created_at", since);
  console.log("\n=== FILHOS CADASTRADOS NA NOITE ===");
  console.log("Total:", filhos?.length || 0);
  for (const f of filhos || []) {
    console.log(`- ${f.nome} (lider_id: ${f.lider_id}) at ${f.created_at}`);
  }

  // 5. Pagamentos / Financeiro na noite
  const { data: fin } = await sb.from("financeiro")
    .select("id, valor, categoria, status, created_at")
    .gte("created_at", since);
  console.log("\n=== TRANSAÇÕES FINANCEIRAS NA NOITE ===");
  console.log("Total:", fin?.length || 0);
  for (const f of fin || []) {
    console.log(`- R$ ${f.valor} | ${f.categoria} | ${f.status} at ${f.created_at}`);
  }

  // 6. Access logs / Portal público
  const { data: access } = await sb.from("access_logs")
    .select("created_at, event_type, metadata")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  console.log("\n=== ACESSOS / SITE PÚBLICO NA NOITE ===");
  console.log("Total:", access?.length || 0);
  const eventCounts = {};
  for (const ac of access || []) {
    eventCounts[ac.event_type] = (eventCounts[ac.event_type] || 0) + 1;
  }
  console.log("Events breakdown:", eventCounts);
  for (const ac of access?.slice(0, 5) || []) {
    console.log(`- [${ac.created_at}] ${ac.event_type} | ${JSON.stringify(ac.metadata || {})}`);
  }
}

checkEvening();
