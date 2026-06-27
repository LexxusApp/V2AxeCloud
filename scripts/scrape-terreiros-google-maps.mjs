/**
 * Scraping de terreiros no Google Maps → Supabase (terreiros_diretorio)
 *
 * Uso (uma cidade):
 *   node scripts/scrape-terreiros-google-maps.mjs --cidade "Suzano - SP"
 *
 * Uso (lista de cidades):
 *   node scripts/scrape-terreiros-google-maps.mjs --cidades-file scripts/data/cidades-terreiros-exemplo.json
 *
 * Opções:
 *   --headless false     Navegador visível (útil se aparecer captcha)
 *   --dry-run            Não grava no Supabase
 *   --max N              Limita quantos terreiros processar por cidade (debug)
 *   --enrich             Atualiza foto/telefone dos registros já existentes (sem inserir novos)
 *
 * Variáveis (.env):
 *   VITE_SUPABASE_URL ou SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const TABLE = "terreiros_diretorio";

function slugifyText(raw, maxLen = 80) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function uniqueSlug(base, used) {
  let slug = slugifyText(base) || "terreiro";
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${slug}-${n}`)) n += 1;
  const finalSlug = `${slug}-${n}`;
  used.add(finalSlug);
  return finalSlug;
}

function parseArgs(argv) {
  const args = {
    cidade: null,
    cidadesFile: null,
    headless: true,
    dryRun: false,
    max: Infinity,
    enrich: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cidade" && argv[i + 1]) {
      args.cidade = argv[++i];
    } else if (a === "--cidades-file" && argv[i + 1]) {
      args.cidadesFile = argv[++i];
    } else if (a === "--headless" && argv[i + 1]) {
      args.headless = argv[++i] !== "false";
    } else if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--enrich") {
      args.enrich = true;
    } else if (a === "--max" && argv[i + 1]) {
      args.max = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Scraping Google Maps → Supabase (${TABLE})

  node scripts/scrape-terreiros-google-maps.mjs --cidade "Suzano - SP"
  node scripts/scrape-terreiros-google-maps.mjs --cidades-file scripts/data/cidades-terreiros-exemplo.json
  node scripts/scrape-terreiros-google-maps.mjs --cidade "Suzano - SP" --enrich
`);
}

function isTinyGooglePhotoUrl(url) {
  const u = String(url || "");
  if (/=s(32|48|64|96)(-|$)/.test(u)) return true;
  if (/=w(1?\d{1,2}|2[0-4]\d)(-h|-p|$)/.test(u)) return true;
  return false;
}

function pickBestGooglePhotoUrl(urls) {
  const unique = [...new Set(urls.map((u) => String(u || "").trim()).filter(Boolean))];
  const valid = unique.filter((u) => {
    if (!u.includes("googleusercontent.com")) return false;
    if (isTinyGooglePhotoUrl(u)) return false;
    if (/\/a[-/]/.test(u)) return false;
    return true;
  });
  if (valid.length === 0) return null;

  const score = (url) => {
    let s = url.length;
    if (url.includes("gps-cs-s") || url.includes("/p/")) s += 500;
    const dim = url.match(/=w(\d+)-h(\d+)/);
    if (dim) s += (parseInt(dim[1], 10) * parseInt(dim[2], 10)) / 50;
    if (isTinyGooglePhotoUrl(url)) s -= 1000;
    return s;
  };

  return valid.sort((a, b) => score(b) - score(a))[0];
}

async function extractPlacePhoto(page) {
  await page.waitForTimeout(1200);

  const photoOpeners = [
    'button[aria-label*="Foto"], button[aria-label*="Photo"]',
    "button[data-photo-id]",
    '[data-section-id="photos"] button',
    'div[role="img"][aria-label*="Foto"]',
    'div[role="img"][aria-label*="Photo"]',
  ];

  for (const sel of photoOpeners) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await btn.click({ timeout: 4000 }).catch(() => undefined);
      await randomDelay(1200, 2000);
      break;
    }
  }

  await page
    .waitForSelector('img[src*="googleusercontent.com"], img[srcset*="googleusercontent.com"]', {
      timeout: 6000,
    })
    .catch(() => undefined);

  await page.waitForTimeout(800);

  const src = await page.evaluate(() => {
    const urls = [];

    const push = (raw) => {
      if (!raw) return;
      for (const part of String(raw).split(",")) {
        const url = part.trim().split(/\s+/)[0];
        if (url) urls.push(url);
      }
    };

    for (const img of document.querySelectorAll("img")) {
      push(img.src);
      push(img.currentSrc);
      push(img.getAttribute("data-src"));
      push(img.srcset);
    }

    for (const el of document.querySelectorAll('[style*="googleusercontent"]')) {
      const style = el.getAttribute("style") || "";
      const match = style.match(/url\(["']?(https:\/\/[^"')]+googleusercontent[^"')]+)/i);
      if (match) push(match[1]);
    }

    const html = document.documentElement.innerHTML;
    const re = /https:\/\/lh\d+\.googleusercontent\.com\/[a-zA-Z0-9_\-./=%]+/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      push(m[0]);
    }

    return urls;
  });

  const best = pickBestGooglePhotoUrl(src);
  return best ? highResGooglePhotoUrl(best) : null;
}

function stripGooglePhotoSizeSuffix(url) {
  return String(url || "")
    .trim()
    .replace(/=(?:w\d+-h\d+(?:-[a-z0-9-]+)?|s\d+(?:-[a-z0-9-]+)?|h\d+(?:-[a-z0-9-]+)?)$/i, "");
}

function highResGooglePhotoUrl(url, width = 1200) {
  const base = stripGooglePhotoSizeSuffix(url);
  if (!base) return url;
  const height = Math.round(width * 0.75);
  return `${base}=w${width}-h${height}-k-no`;
}

/** @returns {{ label: string, cidade: string, estado: string | null }} */
function parseCidadeInput(raw) {
  const label = String(raw || "").trim();
  if (!label) throw new Error("Cidade vazia");

  const match = label.match(/^(.+?)\s*[-–—]\s*([A-Za-z]{2})$/);
  if (match) {
    return {
      label,
      cidade: match[1].trim(),
      estado: match[2].trim().toUpperCase(),
    };
  }

  return { label, cidade: label, estado: null };
}

function randomDelay(minMs = 2000, maxMs = 4000) {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Normaliza URL do place para deduplicação estável */
function normalizeMapsUrl(href) {
  try {
    const raw = String(href || "").trim();
    const u = new URL(raw);
    const path = u.pathname.match(/\/maps\/place\/[^/]+/)?.[0];
    if (!path) return `${u.origin}${u.pathname}`;

    let out = `https://www.google.com${path}`;
    const dataMatch = raw.match(/(data=!4m[^?&]+)/);
    if (dataMatch) {
      out += `/${dataMatch[1]}`;
    } else {
      const coord = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+z)/);
      if (coord) out += `/@${coord[1]},${coord[2]},${coord[3]}`;
    }
    return out;
  } catch {
    return String(href || "").trim();
  }
}

function buildSearchUrl(cidadeLabel) {
  const q = encodeURIComponent(`Terreiros em ${cidadeLabel}`);
  return `https://www.google.com/maps/search/${q}`;
}

function isStreetViewMapsUrl(url) {
  return /,3a,|,3a\./.test(String(url || ""));
}

function buildPlaceSearchUrl(nome, cidade) {
  const q = `${String(nome || "").trim()} ${String(cidade || "").trim()}`.trim();
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

async function openPlacePage(page, { placeUrl, nome, cidade }) {
  const tryDirect = placeUrl && !isStreetViewMapsUrl(placeUrl);

  if (tryDirect) {
    await page.goto(placeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await randomDelay(1500, 2500);
    await dismissConsentIfPresent(page);
    const hasH1 = await page.locator("h1").first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasH1) return;
  }

  await page.goto(buildPlaceSearchUrl(nome, cidade), { waitUntil: "domcontentloaded", timeout: 60000 });
  await randomDelay(1500, 2500);
  await dismissConsentIfPresent(page);

  if (await detectBlock(page)) {
    throw new Error("Google bloqueou a navegação (captcha/consent). Tente --headless false.");
  }

  const links = page.locator('a[href*="/maps/place/"]');
  const count = await links.count();
  if (count === 0) {
    await page.waitForSelector("h1", { timeout: 8000 }).catch(() => undefined);
    return;
  }

  const needle = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .slice(0, 14);

  let clicked = false;
  for (let i = 0; i < Math.min(count, 8); i++) {
    const a = links.nth(i);
    const label = String((await a.getAttribute("aria-label")) || (await a.textContent()) || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (needle && label.includes(needle)) {
      await a.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) await links.first().click();
  await randomDelay(2000, 3500);
  await page.waitForSelector("h1", { timeout: 10000 }).catch(() => undefined);
}

async function loadCidades(args) {
  if (args.cidade) return [args.cidade.trim()];

  if (args.cidadesFile) {
    const filePath = path.isAbsolute(args.cidadesFile)
      ? args.cidadesFile
      : path.join(ROOT, args.cidadesFile);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`Arquivo de cidades inválido ou vazio: ${filePath}`);
    }
    return parsed.map(String);
  }

  throw new Error('Informe --cidade "Nome - UF" ou --cidades-file caminho.json');
}

async function dismissConsentIfPresent(page) {
  const candidates = [
    page.getByRole("button", { name: /aceitar tudo/i }),
    page.getByRole("button", { name: /accept all/i }),
    page.locator('button[aria-label*="Accept"]'),
    page.locator('form[action*="consent"] button').first(),
  ];

  for (const loc of candidates) {
    if (await loc.isVisible({ timeout: 2500 }).catch(() => false)) {
      await loc.click();
      await randomDelay();
      return;
    }
  }
}

async function detectBlock(page) {
  const url = page.url();
  if (/\/sorry\/|\/recaptcha|consent\.google/i.test(url)) return true;
  const captcha = page.locator('#captcha, iframe[src*="recaptcha"], form#captcha-form');
  return captcha.first().isVisible().catch(() => false);
}

/** Rolagem gradual na barra lateral até estabilizar a contagem de resultados */
async function scrollResultsFeed(page) {
  const feed = page.locator('div[role="feed"]');
  const visible = await feed.waitFor({ state: "visible", timeout: 45000 }).catch(() => null);
  if (!visible) {
    console.warn("    ⚠ Lista de resultados não encontrada — cidade pode não ter terreiros no Maps");
    return 0;
  }

  let previousCount = 0;
  let stableRounds = 0;

  while (stableRounds < 4) {
    await feed.evaluate((el) => {
      el.scrollBy({ top: 800, behavior: "smooth" });
    });
    await randomDelay();

    const count = await page.locator('a[href*="/maps/place/"]').count();
    if (count <= previousCount) {
      stableRounds += 1;
    } else {
      stableRounds = 0;
      previousCount = count;
    }
  }

  return previousCount;
}

async function collectPlaceLinks(page) {
  const hrefs = await page.locator('a[href*="/maps/place/"]').evaluateAll((anchors) =>
    anchors.map((a) => a.href).filter(Boolean),
  );
  return [...new Set(hrefs.map(normalizeMapsUrl).filter((u) => !isStreetViewMapsUrl(u)))];
}

async function extractPlaceDetails(page, placeUrl, hints = {}) {
  await openPlacePage(page, {
    placeUrl,
    nome: hints.nome,
    cidade: hints.cidade,
  });

  if (await detectBlock(page)) {
    throw new Error("Google bloqueou a navegação (captcha/consent). Tente --headless false.");
  }

  const nome =
    (await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => null)) || null;

  let endereco = null;
  const addressLoc = page.locator('[data-item-id="address"], button[aria-label*="Endereço"], button[aria-label*="Address"]');
  if ((await addressLoc.count()) > 0) {
    const aria = await addressLoc.first().getAttribute("aria-label");
    endereco =
      aria?.replace(/^(Endereço|Address):\s*/i, "").trim() ||
      (await addressLoc.first().textContent())?.trim() ||
      null;
  }

  let telefone = null;
  const phoneLoc = page.locator('[data-item-id^="phone:"], button[aria-label*="Telefone"], button[aria-label*="Phone"]');
  if ((await phoneLoc.count()) > 0) {
    const itemId = await phoneLoc.first().getAttribute("data-item-id");
    const telFromId = itemId?.match(/phone:tel:([^;]+)/)?.[1];
    const aria = await phoneLoc.first().getAttribute("aria-label");
    telefone =
      telFromId ||
      aria?.replace(/^(Telefone|Phone):\s*/i, "").trim() ||
      (await phoneLoc.first().textContent())?.trim() ||
      null;
  }

  const foto_url = await extractPlacePhoto(page);

  return {
    nome: nome?.trim() || null,
    endereco: endereco?.trim() || null,
    telefone: telefone?.trim() || null,
    foto_url,
    link_maps: normalizeMapsUrl(page.url()),
  };
}

async function upsertTerreiro(supabase, row, usedSlugs) {
  const { data: existing, error: selectErr } = await supabase
    .from(TABLE)
    .select("id")
    .eq("link_maps", row.link_maps)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (existing) return { action: "skipped", id: existing.id };

  const payload = {
    ...row,
    slug: uniqueSlug(row.nome, usedSlugs),
    cidade_slug: slugifyText(row.cidade, 60),
  };

  const { data: inserted, error: insertErr } = await supabase.from(TABLE).insert(payload).select("id").single();
  if (insertErr) throw insertErr;
  return { action: "inserted", id: inserted.id };
}

async function enrichExisting(page, supabase, row, options, meta) {
  const link = row.link_maps;
  if (!link && !row.nome) return { action: "skipped" };

  console.log(`  [enrich] ${row.nome}`);
  const details = await extractPlaceDetails(page, link, {
    nome: row.nome,
    cidade: row.cidade || meta.cidade,
  });
  const patch = {};
  if (details.foto_url && !row.foto_url) patch.foto_url = details.foto_url;
  if (details.telefone && !row.telefone) patch.telefone = details.telefone;
  if (details.endereco && !row.endereco) patch.endereco = details.endereco;
  if (details.link_maps && isStreetViewMapsUrl(link)) patch.link_maps = details.link_maps;

  if (Object.keys(patch).length === 0) {
    console.log("    · nada novo");
    return { action: "skipped" };
  }

  if (options.dryRun) {
    console.log("    (dry-run)", patch);
    return { action: "updated" };
  }

  const { error } = await supabase.from(TABLE).update(patch).eq("id", row.id);
  if (error) throw error;
  console.log(`    ✓ atualizado`, Object.keys(patch).join(", "));
  return { action: "updated" };
}

async function enrichCidade(page, supabase, meta, options) {
  let query = supabase
    .from(TABLE)
    .select("id, nome, link_maps, foto_url, telefone, endereco, cidade")
    .eq("cidade", meta.cidade)
    .is("foto_url", null);
  if (meta.estado) query = query.eq("estado", meta.estado);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).slice(0, options.max);
  console.log(`\n[${meta.label}] Enriquecendo ${rows.length} registro(s) sem foto…`);

  const stats = { updated: 0, skipped: 0, errors: 0 };
  for (const row of rows) {
    try {
      const result = await enrichExisting(page, supabase, row, options, meta);
      if (result.action === "updated") stats.updated += 1;
      else stats.skipped += 1;
    } catch (err) {
      console.error(`    ✗ ${err instanceof Error ? err.message : err}`);
      stats.errors += 1;
    }
    await randomDelay();
  }
  return stats;
}

async function scrapeCidade(page, supabase, meta, options, usedSlugs) {
  const { label, cidade, estado } = meta;
  const searchUrl = buildSearchUrl(label);

  console.log(`\n[${label}] Abrindo busca: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await randomDelay();
  await dismissConsentIfPresent(page);

  if (await detectBlock(page)) {
    throw new Error(`[${label}] Bloqueio do Google detectado. Execute com --headless false e resolva manualmente.`);
  }

  const totalListed = await scrollResultsFeed(page);
  const links = await collectPlaceLinks(page);
  const limited = links.slice(0, options.max);

  console.log(`[${label}] ${links.length} link(s) na lista (${totalListed} cards visíveis). Processando ${limited.length}.`);

  const stats = { inserted: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < limited.length; i++) {
    const link = limited[i];
    console.log(`  [${i + 1}/${limited.length}] ${link}`);

    try {
      const details = await extractPlaceDetails(page, link);
      if (!details.nome) {
        console.warn("    ⚠ Nome não encontrado — ignorando");
        stats.errors += 1;
        continue;
      }

      const row = {
        nome: details.nome,
        endereco: details.endereco,
        telefone: details.telefone,
        foto_url: details.foto_url,
        link_maps: details.link_maps,
        cidade,
        estado,
      };

      if (options.dryRun) {
        console.log("    (dry-run)", row);
        stats.inserted += 1;
        continue;
      }

      const result = await upsertTerreiro(supabase, row, usedSlugs);
      if (result.action === "inserted") {
        console.log(`    ✓ inserido (${result.id})`);
        stats.inserted += 1;
      } else {
        console.log("    · já existia — ignorado");
        stats.skipped += 1;
      }
    } catch (err) {
      console.error(`    ✗ ${err instanceof Error ? err.message : err}`);
      stats.errors += 1;
    }

    await randomDelay();
  }

  return stats;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const cidadesRaw = await loadCidades(args);
  const cidades = cidadesRaw.map(parseCidadeInput);

  if (!args.dryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
    console.error("Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
    process.exit(1);
  }

  const supabase =
    !args.dryRun &&
    createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

  const browser = await chromium.launch({
    headless: args.headless,
    args: ["--lang=pt-BR", "--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();
  const usedSlugs = new Set();

  if (supabase) {
    const { data: slugRows } = await supabase.from(TABLE).select("slug").not("slug", "is", null);
    for (const r of slugRows || []) {
      if (r.slug) usedSlugs.add(String(r.slug));
    }
  }

  const totals = { inserted: 0, skipped: 0, errors: 0, updated: 0 };

  try {
    for (const meta of cidades) {
      try {
        if (args.enrich) {
          const stats = await enrichCidade(page, supabase, meta, args);
          totals.updated += stats.updated;
          totals.skipped += stats.skipped;
          totals.errors += stats.errors;
        } else {
          const stats = await scrapeCidade(page, supabase, meta, args, usedSlugs);
          totals.inserted += stats.inserted;
          totals.skipped += stats.skipped;
          totals.errors += stats.errors;
        }
      } catch (err) {
        console.error(`\n✗ [${meta.label}]`, err instanceof Error ? err.message : err);
        totals.errors += 1;
      }
      await randomDelay(3000, 5000);
    }
  } finally {
    await browser.close();
  }

  console.log("\n--- Resumo ---");
  if (args.enrich) {
    console.log(`Atualizados: ${totals.updated}`);
  } else {
    console.log(`Inseridos: ${totals.inserted}`);
  }
  console.log(`Ignorados: ${totals.skipped}`);
  console.log(`Erros: ${totals.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
