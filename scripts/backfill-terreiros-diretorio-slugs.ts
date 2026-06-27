/**
 * Preenche slug e cidade_slug em terreiros_diretorio (após migration).
 * Uso: npx tsx scripts/backfill-terreiros-diretorio-slugs.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  slugifyCidadeOnly,
  uniqueTerreiroSlug,
} from "../api/lib/diretorioSlug.ts";

const url =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const TABLE = "terreiros_diretorio";

async function main() {
  if (!url || !service) {
    console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const sb = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await sb
    .from(TABLE)
    .select("id, nome, cidade, slug, cidade_slug")
    .order("created_at");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const used = new Set<string>();
  for (const row of data || []) {
    if (row.slug) used.add(String(row.slug));
  }

  let updated = 0;
  for (const row of data || []) {
    const patch: Record<string, string> = {};
    if (!row.cidade_slug && row.cidade) {
      patch.cidade_slug = slugifyCidadeOnly(String(row.cidade));
    }
    if (!row.slug && row.nome) {
      patch.slug = uniqueTerreiroSlug(String(row.nome), used);
    }
    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await sb.from(TABLE).update(patch).eq("id", row.id);
    if (upErr) {
      console.error(`[${row.id}]`, upErr.message);
      continue;
    }
    updated += 1;
    console.log(`✓ ${row.nome} → slug=${patch.slug || row.slug}`);
  }

  console.log(`\nBackfill concluído: ${updated} registro(s) atualizado(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
