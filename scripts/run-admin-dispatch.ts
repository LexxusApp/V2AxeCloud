import { createClient } from "@supabase/supabase-js";
import { sendAdminMensalidadeDispatch, previewAdminMensalidadeDispatch } from "../api/lib/adminMensalidadeDispatch.js";
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
  { id: "85a827b1-9495-4f78-a4b7-9daa694de95a", label: "Casa de umbanda Zé pilintra" },
  { id: "e63042da-952a-4529-b114-d2f86ee661fd", label: "Ilè Alaketu Omi Àsé Oba Lube" },
  { id: "283d4903-4303-4c99-92f3-24249bde61cb", label: "Ilê Asé Omógìyán" },
];

async function main() {
  console.log(`Starting real dispatch for ${terreiros.length} houses...`);

  for (const t of terreiros) {
    console.log(`\n======================================================`);
    console.log(`DISPATCHING FOR: ${t.label} (${t.id})`);

    const prev = await previewAdminMensalidadeDispatch(sb, t.id);
    console.log(`Terreiro confirmation string: "${prev.nomeTerreiro}"`);
    console.log(`Eligible recipients: ${prev.recipients.length}`);

    if (prev.recipients.length === 0) {
      console.log(`No pending recipients to dispatch.`);
      continue;
    }

    try {
      const result = await sendAdminMensalidadeDispatch(sb, {
        tenantId: t.id,
        confirmation: prev.nomeTerreiro,
      });

      console.log(`Result: Sent=${result.sent}, Failed=${result.failed}, Skipped=${result.skipped}`);
      if (result.results && result.results.length > 0) {
        console.log(`Summary of first 5 results:`);
        result.results.slice(0, 5).forEach((r) => {
          console.log(` - ${r.nome}: ${r.ok ? 'OK' : 'FAIL (' + r.error + ')'}`);
        });
      }
    } catch (err) {
      console.error(`Dispatch failed for ${t.label}:`, err);
    }
  }

  console.log(`\nDispatch batch completed.`);
}

main().catch(console.error);
