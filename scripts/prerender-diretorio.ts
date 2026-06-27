/**
 * Pré-renderiza páginas do diretório (cidades + terreiros) em landing-dist/.
 * Requer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no ambiente (build VPS ou local).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildCityPrerenderPage,
  buildDiretorioBodyInject,
  buildDiretorioHeadInject,
  buildTerreiroPrerenderPage,
  type DiretorioSeoTerreiro,
} from "../lib/diretorioSeoShared.ts";
import { slugifyCidadeOnly } from "../api/lib/diretorioSlug.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = process.env.PRERENDER_OUT_DIR || path.join(ROOT, "landing-dist");
const TABLE = "terreiros_diretorio";

const HEAD_MARKER = /<!-- SEO_HEAD_INJECT -->[\s\S]*?<!-- \/SEO_HEAD_INJECT -->/;
const BODY_MARKER = /<!-- SEO_BODY_INJECT -->[\s\S]*?<!-- \/SEO_BODY_INJECT -->/;

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function mapRow(row: Record<string, unknown>): DiretorioSeoTerreiro {
  const slug = String(row.slug || "").trim();
  const cidade = String(row.cidade || "").trim();
  const estado = row.estado ? String(row.estado).trim().toUpperCase() : null;
  const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
  return {
    slug,
    nome: String(row.nome || "Terreiro").trim(),
    endereco: row.endereco ? String(row.endereco).trim() : null,
    telefone: row.telefone ? String(row.telefone).trim() : null,
    fotoUrl: row.foto_url && slug ? `/api/v1/public/diretorio/foto/${encodeURIComponent(slug)}` : null,
    linkMaps: row.link_maps ? String(row.link_maps).trim() : null,
    cidade: cidade || null,
    estado,
    cidadeSlug,
    cidadeUrl: estado && cidadeSlug ? `/terreiros/${estado.toLowerCase()}/${cidadeSlug}` : null,
  };
}

function writePrerenderPage(template: string, page: ReturnType<typeof buildTerreiroPrerenderPage>) {
  const segment = page.path.replace(/^\//, "");
  const outDir = path.join(OUT_DIR, segment);
  const html = template
    .replace(
      HEAD_MARKER,
      `<!-- SEO_HEAD_INJECT -->\n    ${buildDiretorioHeadInject(page)}\n    <!-- /SEO_HEAD_INJECT -->`,
    )
    .replace(
      BODY_MARKER,
      `<!-- SEO_BODY_INJECT -->\n${buildDiretorioBodyInject(page)}\n    <!-- /SEO_BODY_INJECT -->`,
    );

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
}

async function main() {
  const indexPath = path.join(OUT_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.warn(`[prerender:diretorio] ${indexPath} ausente — rode build:landing antes.`);
    process.exit(0);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[prerender:diretorio] Sem credenciais Supabase — pulando pré-render do diretório.");
    process.exit(0);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await sb
    .from(TABLE)
    .select("nome, endereco, telefone, foto_url, link_maps, cidade, estado, slug, cidade_slug")
    .order("cidade", { ascending: true });

  if (error) throw error;

  const template = fs.readFileSync(indexPath, "utf8");
  const rows = (data || []).map((r) => mapRow(r as Record<string, unknown>));

  const cityMap = new Map<string, DiretorioSeoTerreiro[]>();
  for (const row of rows) {
    if (!row.cidade || !row.estado || !row.cidadeSlug) continue;
    const key = `${row.estado.toLowerCase()}:${row.cidadeSlug}`;
    const list = cityMap.get(key) || [];
    list.push(row);
    cityMap.set(key, list);
  }

  let cityPages = 0;
  for (const [, items] of cityMap) {
    const first = items[0];
    if (!first?.cidade || !first.cidadeSlug) continue;
    const page = buildCityPrerenderPage(
      {
        cidade: first.cidade,
        estado: first.estado,
        cidadeSlug: first.cidadeSlug,
        total: items.length,
      },
      items,
    );
    writePrerenderPage(template, page);
    cityPages += 1;
  }

  let terreiroPages = 0;
  for (const row of rows) {
    if (!row.slug) continue;
    writePrerenderPage(template, buildTerreiroPrerenderPage(row));
    terreiroPages += 1;
  }

  console.log(
    `[prerender:diretorio] ${cityPages} cidade(s), ${terreiroPages} terreiro(s) em ${path.relative(ROOT, OUT_DIR)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
