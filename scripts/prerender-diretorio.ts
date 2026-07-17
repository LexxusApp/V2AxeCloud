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
import { fetchAllTerreirosRows } from "../lib/diretorioQuery.ts";
import { isDiretorioListingPublishable } from "../lib/diretorioQuality.ts";
import { resolveTerreiroBairro, slugifyBairro } from "../lib/diretorioBairro.ts";
import {
  resolveDiretorioTipo,
  type DiretorioEstabelecimentoTipo,
} from "../lib/diretorioTipo.ts";

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

type SnapshotRow = DiretorioSeoTerreiro & {
  bairro: string | null;
  bairroSlug: string | null;
  tipo: DiretorioEstabelecimentoTipo;
};

function mapRow(row: Record<string, unknown>): SnapshotRow {
  const slug = String(row.slug || "").trim();
  const cidade = String(row.cidade || "").trim();
  const estado = row.estado ? String(row.estado).trim().toUpperCase() : null;
  const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
  const bairroRaw = row.bairro ? String(row.bairro).trim() : null;
  const bairro = bairroRaw || resolveTerreiroBairro({
    endereco: row.endereco ? String(row.endereco) : null,
    cidade,
  });
  const nome = String(row.nome || "Terreiro").trim();
  return {
    slug,
    nome,
    endereco: row.endereco ? String(row.endereco).trim() : null,
    telefone: row.telefone ? String(row.telefone).trim() : null,
    fotoUrl: row.foto_url && slug ? `/api/v1/public/diretorio/foto/${encodeURIComponent(slug)}` : null,
    linkMaps: row.link_maps ? String(row.link_maps).trim() : null,
    cidade: cidade || null,
    estado,
    cidadeSlug,
    bairro: bairro || null,
    bairroSlug: bairro ? String(row.bairro_slug || slugifyBairro(bairro)).trim() : null,
    tipo: resolveDiretorioTipo(row.tipo, nome),
    cidadeUrl: estado && cidadeSlug ? `/terreiros/${estado.toLowerCase()}/${cidadeSlug}` : null,
  };
}

function publicSnapshotItem(row: SnapshotRow) {
  return {
    slug: row.slug,
    nome: row.nome,
    endereco: row.endereco,
    telefone: row.telefone,
    fotoUrl: row.fotoUrl,
    linkMaps: row.linkMaps,
    cidade: row.cidade,
    estado: row.estado,
    cidadeSlug: row.cidadeSlug,
    bairro: row.bairro,
    bairroSlug: row.bairroSlug,
    tipo: row.tipo,
    perfilUrl: row.slug ? `/terreiro/${row.slug}` : null,
    cidadeUrl: row.cidadeUrl,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeDirectorySnapshots(cityMap: Map<string, SnapshotRow[]>) {
  const cidades = [...cityMap.values()].map((items) => {
    const first = items[0];
    const bairroMap = new Map<string, { nome: string; slug: string; items: ReturnType<typeof publicSnapshotItem>[] }>();

    for (const row of items) {
      const nome = row.bairro || 'Outros bairros';
      const slug = row.bairroSlug || 'outros';
      const group = bairroMap.get(slug) || { nome, slug, items: [] };
      group.items.push(publicSnapshotItem(row));
      bairroMap.set(slug, group);
    }

    const bairros = [...bairroMap.values()]
      .sort((a, b) => b.items.length - a.items.length || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((bairro) => ({ ...bairro, total: bairro.items.length }));
    const totalTerreiros = items.filter((row) => row.tipo === 'terreiro').length;

    return {
      cidade: first.cidade || '',
      estado: first.estado,
      cidadeSlug: first.cidadeSlug || '',
      count: items.length,
      total: items.length,
      totalTerreiros,
      totalBairros: bairros.filter((bairro) => bairro.slug !== 'outros').length,
      bairros,
    };
  }).sort((a, b) => b.totalTerreiros - a.totalTerreiros || a.cidade.localeCompare(b.cidade, 'pt-BR'));

  fs.writeFileSync(
    path.join(OUT_DIR, 'diretorio-cidades.json'),
    JSON.stringify({ cidades: cidades.map(({ bairros: _bairros, ...cidade }) => cidade) }),
    'utf8',
  );
  fs.writeFileSync(path.join(OUT_DIR, 'diretorio-snapshot.json'), JSON.stringify({ cidades }), 'utf8');
  return cidades;
}

function writeDirectoryRootPage(
  template: string,
  cidades: ReturnType<typeof writeDirectorySnapshots>,
) {
  const summary = cidades.map(({ bairros: _bairros, ...cidade }) => cidade);
  const totalTerreiros = summary.reduce((sum, cidade) => sum + cidade.totalTerreiros, 0);
  const totalBairros = summary.reduce((sum, cidade) => sum + cidade.totalBairros, 0);
  const cards = summary
    .map((cidade) => {
      const href = `/terreiros/${String(cidade.estado || 'sp').toLowerCase()}/${cidade.cidadeSlug}`;
      return [
        `          <a href="${escapeHtml(href)}" class="block rounded-2xl border border-[#e8dfd0] bg-white p-5">`,
        `            <strong>${escapeHtml(cidade.cidade)}${cidade.estado ? `, ${escapeHtml(cidade.estado)}` : ''}</strong>`,
        `            <span class="mt-2 block text-sm">${cidade.totalTerreiros} terreiros em ${cidade.totalBairros} bairros</span>`,
        '          </a>',
      ].join('\n');
    })
    .join('\n');
  const initialRoot = [
    '<div id="root">',
    '  <main class="mx-auto w-full max-w-7xl px-5 pb-24 pt-32 md:px-8">',
    '    <section>',
    '      <p class="text-xs font-black uppercase tracking-widest text-[#a87400]">Diretório de terreiros</p>',
    '      <h1 class="mt-5 text-4xl font-black text-[#1b1813] md:text-6xl">Primeiro escolha uma cidade</h1>',
    `      <p class="mt-4 text-lg text-[#1b1813]/70">${summary.length} cidades, ${totalBairros} bairros e ${totalTerreiros.toLocaleString('pt-BR')} terreiros mapeados.</p>`,
    '      <div class="mt-8 grid grid-cols-3 gap-3 text-center">',
    `        <div><strong class="text-2xl">${summary.length}</strong><span class="block text-xs">Cidades</span></div>`,
    `        <div><strong class="text-2xl">${totalBairros}</strong><span class="block text-xs">Bairros</span></div>`,
    `        <div><strong class="text-2xl">${totalTerreiros.toLocaleString('pt-BR')}</strong><span class="block text-xs">Terreiros</span></div>`,
    '      </div>',
    `      <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`,
    '    </section>',
    '  </main>',
    '</div>',
    `<script>window.__AXECLOUD_DIRECTORY_SUMMARY__=${JSON.stringify(summary).replace(/</g, '\\u003c')};</script>`,
  ].join('\n');
  const head = [
    '<!-- SEO_HEAD_INJECT -->',
    '    <title>Diretório de terreiros por cidade e bairro | AxéCloud</title>',
    '    <meta name="description" content="Encontre terreiros por cidade e bairro no diretório público do AxéCloud." />',
    '    <link rel="canonical" href="https://axecloud.com.br/terreiros" />',
    '    <meta name="robots" content="index, follow" />',
    '    <!-- /SEO_HEAD_INJECT -->',
  ].join('\n');
  const body = [
    '<!-- SEO_BODY_INJECT -->',
    '    <article id="axecloud-seo-static" aria-label="Diretório de terreiros">',
    '      <h1>Diretório de terreiros por cidade e bairro</h1>',
    `      <p>${summary.length} cidades, ${totalBairros} bairros e ${totalTerreiros} terreiros mapeados.</p>`,
    '    </article>',
    '    <!-- /SEO_BODY_INJECT -->',
  ].join('\n');
  const html = template
    .replace(HEAD_MARKER, head)
    .replace(BODY_MARKER, body)
    .replace('<div id="root"></div>', initialRoot);
  const outDir = path.join(OUT_DIR, 'terreiros');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
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

  const data = await fetchAllTerreirosRows(sb, TABLE, "nome, endereco, telefone, foto_url, link_maps, cidade, estado, slug, cidade_slug, bairro, bairro_slug, tipo", (query, { from, to }) =>
    query.order("cidade", { ascending: true }).order("nome", { ascending: true }).range(from, to),
  );

  const template = fs.readFileSync(indexPath, "utf8");
  const rows = (data || [])
    .filter((r) => isDiretorioListingPublishable(r as Record<string, unknown>))
    .map((r) => mapRow(r as Record<string, unknown>))
    .filter((row) => row.tipo === 'terreiro');

  const cityMap = new Map<string, SnapshotRow[]>();
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

  const cidades = writeDirectorySnapshots(cityMap);
  writeDirectoryRootPage(template, cidades);

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
