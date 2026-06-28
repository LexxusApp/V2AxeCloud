/**
 * Preenche bairro/bairro_slug a partir do endereço (e label de scrape quando aplicável).
 *
 *   npx tsx scripts/backfill-terreiros-bairro.ts
 *   npx tsx scripts/backfill-terreiros-bairro.ts --dry-run
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  extractBairroFromEndereco,
  slugifyBairro,
} from "../lib/diretorioBairro.ts";

const TABLE = "terreiros_diretorio";
const dryRun = process.argv.includes("--dry-run");

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await sb.from(TABLE).select("id, endereco, cidade, bairro, bairro_slug");
  if (error) throw error;

  let updated = 0;
  for (const row of data || []) {
    if (row.bairro && row.bairro_slug) continue;

    const bairro = row.bairro || extractBairroFromEndereco(row.endereco, row.cidade);
    if (!bairro) continue;

    const bairro_slug = slugifyBairro(bairro);
    if (dryRun) {
      console.log(`[dry-run] ${row.id}: ${bairro}`);
      updated += 1;
      continue;
    }

    const { error: upErr } = await sb.from(TABLE).update({ bairro, bairro_slug }).eq("id", row.id);
    if (upErr) throw upErr;
    updated += 1;
  }

  console.log(`${dryRun ? "Simulados" : "Atualizados"}: ${updated} registro(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
