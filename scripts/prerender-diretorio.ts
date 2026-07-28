/**
 * Pré-renderiza páginas do diretório (cidades + terreiros) em landing-dist/.
 * Usa Supabase no ambiente de servidor ou, sem credenciais, a API pública já publicada.
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
import { isPlausibleDiretorioCoordinate, parseGoogleMapsCoordinates } from "../lib/diretorioCoordinates.ts";
import {
  isDiretorioListingIndexable,
  isDiretorioListingPublishable,
} from "../lib/diretorioQuality.ts";
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

const KNOWN_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  // Sede municipal; usada somente para representar o agrupamento, nunca como endereço de uma casa.
  "sp:biritiba-mirim": { lat: -23.575278, lng: -46.043611 },
};

type SnapshotRow = DiretorioSeoTerreiro & {
  bairro: string | null;
  bairroSlug: string | null;
  tipo: DiretorioEstabelecimentoTipo;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: string | null;
};

type PublicCity = {
  cidade: string;
  estado: string | null;
  cidadeSlug: string;
};

function optionalCoordinate(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : null;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, label: string, attempts = 6): Promise<Response> {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url);
    lastStatus = response.status;
    if (response.ok) return response;
    const retriable = response.status === 429 || response.status >= 500;
    if (!retriable || attempt === attempts) {
      throw new Error(`[prerender:diretorio] API pública de ${label} respondeu ${response.status}.`);
    }
    const retryAfter = Number(response.headers.get("retry-after") || "");
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30_000, 800 * 2 ** (attempt - 1));
    console.warn(`[prerender:diretorio] ${label} → ${response.status}; nova tentativa em ${waitMs}ms (${attempt}/${attempts})`);
    await sleep(waitMs);
  }
  throw new Error(`[prerender:diretorio] API pública de ${label} respondeu ${lastStatus}.`);
}

async function fetchPublicDirectoryRows(): Promise<SnapshotRow[]> {
  const origin = String(process.env.PUBLIC_APP_URL || 'https://axecloud.com.br').replace(/\/$/, '');
  const citiesResponse = await fetchWithRetry(`${origin}/api/v1/public/diretorio/cidades`, "cidades");
  const citiesJson = (await citiesResponse.json()) as { cidades?: PublicCity[] };
  const cities = Array.isArray(citiesJson.cidades) ? citiesJson.cidades : [];
  const rows: SnapshotRow[] = [];

  for (const city of cities) {
    const estado = String(city.estado || '').toLowerCase();
    const cidadeSlug = String(city.cidadeSlug || '');
    if (!estado || !cidadeSlug) continue;
    const label = `${estado}/${cidadeSlug}`;
    const detailResponse = await fetchWithRetry(
      `${origin}/api/v1/public/diretorio/${encodeURIComponent(estado)}/${encodeURIComponent(cidadeSlug)}`,
      label,
    );
    const detail = (await detailResponse.json()) as { items?: Array<Record<string, unknown>> };
    for (const item of detail.items || []) {
      const nome = String(item.nome || 'Terreiro').trim();
      const tipo = resolveDiretorioTipo(item.tipo, nome);
      if (tipo !== 'terreiro') continue;
      rows.push({
        slug: String(item.slug || '').trim(),
        nome,
        endereco: item.endereco ? String(item.endereco).trim() : null,
        telefone: item.telefone ? String(item.telefone).trim() : null,
        fotoUrl: item.fotoUrl ? String(item.fotoUrl) : null,
        linkMaps: item.linkMaps ? String(item.linkMaps) : null,
        cidade: item.cidade ? String(item.cidade) : city.cidade,
        estado: item.estado ? String(item.estado).toUpperCase() : String(city.estado || '').toUpperCase(),
        cidadeSlug: item.cidadeSlug ? String(item.cidadeSlug) : cidadeSlug,
        bairro: item.bairro ? String(item.bairro) : null,
        bairroSlug: item.bairroSlug ? String(item.bairroSlug) : null,
        tipo,
        latitude: optionalCoordinate(item.latitude, 90),
        longitude: optionalCoordinate(item.longitude, 180),
        coordinateSource: item.coordinateSource ? String(item.coordinateSource) : null,
        cidadeUrl: item.cidadeUrl ? String(item.cidadeUrl) : null,
      });
    }
    await sleep(120);
  }

  return rows;
}

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
  const latitude = optionalCoordinate(row.latitude, 90);
  const longitude = optionalCoordinate(row.longitude, 180);
  const hasCoordinates =
    latitude !== null &&
    longitude !== null &&
    isPlausibleDiretorioCoordinate(latitude, longitude);
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
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
    coordinateSource: hasCoordinates ? String(row.coordinate_source || "google_maps_url") : null,
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
    latitude: row.latitude,
    longitude: row.longitude,
    coordinateSource: row.coordinateSource,
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
    .slice(0, 9)
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
    '      <section class="mt-10 rounded-3xl border border-[#e8dfd0] bg-white p-8">',
    '        <strong class="text-xl">Mapa interativo dos terreiros</strong>',
    '        <span class="mt-2 block text-sm">Explore no mapa ou encontre uma casa próxima de você.</span>',
    '      </section>',
    `      <div class="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`,
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

function writeDirectoryMap(rows: SnapshotRow[]) {
  const seen = new Set<string>();
  const points = rows.flatMap((row) => {
    if (!row.slug || seen.has(row.slug)) return [];
    const coordinates =
      row.latitude !== null &&
      row.longitude !== null &&
      isPlausibleDiretorioCoordinate(row.latitude, row.longitude)
        ? { lat: row.latitude, lng: row.longitude }
        : parseGoogleMapsCoordinates(row.linkMaps);
    if (!coordinates) return [];
    seen.add(row.slug);
    return [{
      slug: row.slug,
      nome: row.nome,
      cidade: row.cidade || '',
      estado: row.estado || 'SP',
      perfilUrl: `/terreiro/${encodeURIComponent(row.slug)}`,
      accuracy: "exact",
      ...coordinates,
    }];
  });
  const exactByCity = new Map<string, typeof points>();
  for (const point of points) {
    const key = `${point.estado}:${point.cidade}`.toLocaleLowerCase("pt-BR");
    const list = exactByCity.get(key) || [];
    list.push(point);
    exactByCity.set(key, list);
  }
  const rowsByCity = new Map<string, SnapshotRow[]>();
  for (const row of rows) {
    if (!row.cidade || !row.estado) continue;
    const key = `${row.estado}:${row.cidade}`.toLocaleLowerCase("pt-BR");
    const list = rowsByCity.get(key) || [];
    list.push(row);
    rowsByCity.set(key, list);
  }
  const cityCoverage = [...rowsByCity.entries()].flatMap(([key, cityRows]) => {
    const exact = exactByCity.get(key) || [];
    const missing = cityRows.length - exact.length;
    if (missing <= 0) return [];
    const fallbackCenter = KNOWN_CITY_CENTERS[key];
    if (exact.length === 0 && !fallbackCenter) return [];
    return [{
      cidade: cityRows[0].cidade || "",
      estado: cityRows[0].estado || "",
      total: cityRows.length,
      exact: exact.length,
      missing,
      lat: exact.length
        ? exact.reduce((sum, point) => sum + point.lat, 0) / exact.length
        : fallbackCenter.lat,
      lng: exact.length
        ? exact.reduce((sum, point) => sum + point.lng, 0) / exact.length
        : fallbackCenter.lng,
    }];
  });
  const outDir = path.join(OUT_DIR, 'terreiros');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'mapa.json'),
    JSON.stringify({
      points,
      cityCoverage,
      totals: { listed: rows.length, exact: points.length, grouped: rows.length - points.length },
    }),
    'utf8',
  );
  return { exact: points.length, listed: rows.length };
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

  const template = fs.readFileSync(indexPath, "utf8");
  let rows: SnapshotRow[];
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const data = await fetchAllTerreirosRows(sb, TABLE, "nome, endereco, telefone, foto_url, link_maps, cidade, estado, slug, cidade_slug, bairro, bairro_slug, tipo, latitude, longitude, coordinate_source", (query, { from, to }) =>
      query.order("cidade", { ascending: true }).order("nome", { ascending: true }).range(from, to),
    );
    rows = (data || [])
      .filter((r) => isDiretorioListingPublishable(r as Record<string, unknown>))
      .map((r) => mapRow(r as Record<string, unknown>))
      .filter((row) => row.tipo === 'terreiro');
  } else {
    console.warn('[prerender:diretorio] Sem chave administrativa; usando API pública segura.');
    rows = await fetchPublicDirectoryRows();
  }

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
  const mapCoverage = writeDirectoryMap(rows);

  let terreiroPages = 0;
  for (const row of rows) {
    if (!row.slug) continue;
    writePrerenderPage(
      template,
      buildTerreiroPrerenderPage(row, { indexable: isDiretorioListingIndexable(row) }),
    );
    terreiroPages += 1;
  }

  console.log(
    `[prerender:diretorio] ${cityPages} cidade(s), ${terreiroPages} terreiro(s), ${mapCoverage.exact} exatos de ${mapCoverage.listed} representados no mapa em ${path.relative(ROOT, OUT_DIR)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
