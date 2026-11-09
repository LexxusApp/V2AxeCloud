import { createClient } from "@supabase/supabase-js";
import { previewAdminMensalidadeDispatch } from "../api/lib/adminMensalidadeDispatch.js";
import { buildWhatsAppMessage } from "../api/lib/whatsappSendCore.js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.production" });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: ".env" });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)!;

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const terreiros = [
  { id: "85a827b1-9495-4f78-a4b7-9daa694de95a", name: "Casa de umbanda Zé pilintra" },
  { id: "e63042da-952a-4529-b114-d2f86ee661fd", name: "Ilè Alaketu Omi Àsé Oba Lube" },
  { id: "283d4903-4303-4c99-92f3-24249bde61cb", name: "Ilê Asé Omógìyán" },
];

async function main() {
  for (const t of terreiros) {
    console.log(`\n========================================`);
    console.log(`PREVIEW FOR: ${t.name} (${t.id})`);
    try {
      const prev = await previewAdminMensalidadeDispatch(sb, t.id);
      console.log(`Terreiro: ${prev.nomeTerreiro}`);
      console.log(`Leader ID: ${prev.leaderId}`);
      console.log(`Recipients found: ${prev.recipients.length}`);
      console.log(`Already sent today: ${prev.alreadySentToday}`);
      console.log(`Unpaid total in house: ${prev.unpaidInTerreiro}`);

      if (prev.recipients.length > 0) {
        const first = prev.recipients[0];
        console.log(`Sample recipient:`, {
          nome: first.nome,
          phone: first.phone,
          valorFmt: first.valorFmt,
          vencimento: first.vencimento,
          vencimentoBr: first.vencimentoBr,
          isOverdue: first.isOverdue,
          sentToday: first.sentToday,
        });

        const isOverdue = first.isOverdue;
        const tipo = isOverdue ? "mensalidade_vencida" : "cobranca_mensalidade";
        const variables = {
          nome_filho: first.nome,
          nome_terreiro: prev.nomeTerreiro,
          mes_ano: prev.mesExtenso,
          competencia: prev.competencia,
          valor: first.valorFmt,
          valor_mensalidade: first.valorFmt,
          data_vencimento: first.vencimentoBr,
        };
        const msg = buildWhatsAppMessage(prev.templates, tipo, variables);
        console.log(`\n--- Generated Message for ${first.nome} (tipo=${tipo}) ---`);
        console.log(msg);
        console.log(`------------------------------------------------------------\n`);
      }
    } catch (err) {
      console.error(`Error for ${t.name}:`, err);
    }
  }
}

main().catch(console.error);
