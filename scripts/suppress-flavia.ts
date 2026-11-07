import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FLAVIA_TENANT_ID = "29baae98-c2eb-4191-99db-1f26e970f285";
const FLAVIA_PHONE = "5527995755589";

async function main() {
  console.log("=== BLOQUEANDO DISPAROS AUTOMÁTICOS PARA FLÁVIA ===");

  // 1. Inserir na tabela prospecting_blacklist
  const { data: blData, error: blErr } = await sb.from("prospecting_blacklist").upsert(
    {
      phone: FLAVIA_PHONE,
      reason: "Pausado manualmente pelo administrador - atendimento humanizado em andamento",
      source: "admin_manual_hold",
      created_at: new Date().toISOString(),
    },
    { onConflict: "phone" }
  );
  if (blErr) console.warn("Aviso ao inserir na blacklist:", blErr.message);
  else console.log("Telefone da Flávia inserido na prospecting_blacklist com sucesso!");

  // 2. Preencher whatsapp_logs com status 'suppressed' para todos os estágios futuros
  const stages = ["dia_7", "dia_20", "dia_27", "dia_29", "dia_30"];
  for (const st of stages) {
    const dedupeType = `trial_nurture_${st}`;
    const { error: insErr } = await sb.from("whatsapp_logs").insert({
      tenant_id: FLAVIA_TENANT_ID,
      tipo: dedupeType,
      telefone: FLAVIA_PHONE,
      mensagem: "Disparo cancelado/suprimido: atendimento sob controle humano.",
      status: "suppressed",
    });
    if (insErr) console.warn(`Aviso para estágio ${st}:`, insErr.message);
    else console.log(`Estágio ${st} suprimido em whatsapp_logs.`);
  }

  // 3. Atualizar lead no CRM se existir
  const { data: leadData } = await sb
    .from("prospecting_leads")
    .select("id")
    .ilike("phone", `%${FLAVIA_PHONE.slice(-8)}%`);

  if (leadData && leadData.length > 0) {
    for (const l of leadData) {
      await sb
        .from("prospecting_leads")
        .update({ status: "do_not_contact", whatsapp_opt_in: false })
        .eq("id", l.id);
      console.log(`Lead CRM ${l.id} marcado como do_not_contact.`);
    }
  }

  console.log("=== FLÁVIA TOTALMENTE PROTEGIDA CONTRA QUALQUER DISPARO AUTOMÁTICO ===");
}

main().catch(console.error);
