import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log("=== ANÁLISE PROFUNDA DAS CONVERSAS DO WHATSAPP DE PROSPECÇÃO ===\n");

  const { data: convs, error: convsErr } = await sb
    .from("admin_whatsapp_conversations")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(15);

  if (convsErr) {
    console.error("Erro convs:", convsErr);
    return;
  }

  for (const c of convs || []) {
    console.log("================================================================================");
    console.log(`CONVERSA: ${c.contact_name || "Sem Nome"} | Tel: ${c.phone_number || c.phone || "N/A"}`);
    console.log(`ID: ${c.id} | Status: ${c.status} | Última Msg: ${c.last_message_at}`);
    console.log("--------------------------------------------------------------------------------");

    const { data: msgs, error: msgsErr } = await sb
      .from("admin_whatsapp_messages")
      .select("*")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true });

    if (msgsErr) {
      console.error("Erro msgs:", msgsErr);
      continue;
    }

    if (!msgs || msgs.length === 0) {
      console.log("Nenhuma mensagem nesta conversa.");
    } else {
      for (const m of msgs) {
        const autor = m.direction === "outbound" ? "🤖 IA AXÉCLOUD" : `👤 ${c.contact_name || "LEAD"}`;
        const time = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        console.log(`\n[${time}] ${autor}:`);
        console.log(m.content || m.text || m.body || JSON.stringify(m));
      }
    }
    console.log("\n");
  }
}

main().catch(console.error);
