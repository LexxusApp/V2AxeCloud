/**
 * Classifica registros do diretório como terreiro ou loja (nome + categoria_maps futura).
 *
 *   npx tsx scripts/backfill-terreiros-tipo.ts
 *   npx tsx scripts/backfill-terreiros-tipo.ts --dry-run
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { classifyDiretorioEstabelecimento } from "../lib/diretorioTipo.ts";

const TABLE = "terreiros_diretorio";
const PAGE = 1000;
const dryRun = process.argv.includes("--dry-run");

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll() {
  const all: { id: string; nome: string; tipo: string | null }[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from(TABLE)
      .select("id, nome, tipo")
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  const rows = await fetchAll();
  let updated = 0;
  let lojas = 0;
  let terreiros = 0;

  for (const row of rows) {
    const tipo = classifyDiretorioEstabelecimento(row.nome);
    if (tipo === "loja") lojas += 1;
    else terreiros += 1;

    if (row.tipo === tipo) continue;

    if (dryRun) {
      console.log(`[dry-run] ${tipo}: ${row.nome}`);
      updated += 1;
      continue;
    }

    const { error } = await sb.from(TABLE).update({ tipo }).eq("id", row.id);
    if (error) throw error;
    updated += 1;
  }

  console.log(`Total: ${rows.length} — terreiros: ${terreiros}, lojas: ${lojas}`);
  console.log(`${dryRun ? "Simulados" : "Atualizados"}: ${updated} registro(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
