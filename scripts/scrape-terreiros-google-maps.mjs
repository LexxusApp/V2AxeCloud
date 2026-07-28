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
 *   --max N              Limita quantos terreiros processar por local (debug)
 *   --enrich             Atualiza foto/telefone dos registros já existentes (sem inserir novos)
 *   --single-query       Uma busca só ("Terreiros em …") — modo antigo, poucos resultados
 *   --scroll-rounds N    Rolagens na lista lateral (padrão: 35)
 *   --terms "a,b,c"      Termos de busca (padrão: terreiro umbanda, casa de umbanda, …)
 *
 * Variáveis (.env):
 *   VITE_SUPABASE_URL ou SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import "dotenv/config";
import fs from "node:fs/promises";
import { classifyDiretorioEstabelecimento } from "../lib/diretorioTipo.mjs";
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

/** Termos padrão — uma busca por termo × local (deduplica por link_maps) */
const DEFAULT_SEARCH_TERMS = [
  "terreiro",
  "terreiro umbanda",
  "terreiro de umbanda",
  "casa de umbanda",
  "centro de umbanda",
  "templo de umbanda",
  "terreiro candomblé",
  "casa de candomblé",
  "ilê axé",
  "centro espírita umbanda",
];

const FEED_SELECTORS = ['div[role="feed"]', 'div.m6QErb[role="feed"]'];
const AXE_CONTEXT_RE =
  /\b(umband(?:a|ista)|catobandista|candomble|quimbanda|terreiro|tenda|jurema|afro|orixa|babalorixa|ialorixa|caboclo|exu|vodun|nago|axe|ase|ile|ilesin|inzo|abassa|barracao|egbe|kwe|hunkpame|pai|mae|ogum|oxossi|oxum|xango|iemanja|iansa|oya|oxala|omolu|obaluae|nan[ãa]|pombagira|preto\s+velho|vovo|boiadeiro|ze\s+pelintra|maria\s+(?:mulambo|padilha)|sete\s+flechas|tupinamba|aruanda|angola|congo|guine|falangeiros?|eres?)\b/i;
const CLEARLY_OUT_OF_SCOPE_RE =
  /\b(racionalismo\s+cristao|allan?\s+kardec|kardecista|paroquia|catolic|evangelic|adventista|igreja\s+sant[ao]|igreja\s+universal|testemunhas?\s+de\s+jeova|ministerio\s+extrema|projeto\s+refugio)\b/i;
const COMMERCIAL_SERVICE_RE =
  /\b(especialista\s+em\s+uniao\s+de\s+casais|consultas?\s+com|jogo\s+de\s+buzios\s*[-–—]|amarracao\s+amorosa|trabalhos?\s+amorosos?|cartomante|tarolog[oa]|tar[oô]|baralho\s+cigano|vidente)\b/i;
const INVALID_PLACE_NAME_RE =
  /^(proximo\s+a)\b|^(casa|centro|sitio|templo|terreiro)$|\b(prefeitura|camara\s+municipal|secretaria\s+municipal|escola\s+de\s+atabaque)\b|\bterreiro\s+cultural\b|\bterreiro\s+de\s+ideias\b|\bconfraria\s+do\s+impossivel\b|^centro\s+espirita\s+de\s+valenca\b/i;
const CLEARLY_COMMERCIAL_PLACE_RE =
  /\b(casa\s+de\s+velas|loja\s+do\s+axe|artigos?\s+religiosos?|bazar|distribuidora|tabacaria|adega|restaurante|buffet|museu|museumbanda|cia\.?\s+cultural)\b/i;
const CLEARLY_OUT_OF_SCOPE_CATEGORY_RE =
  /\b(restaurante|restaurant|loja|store|shop|bazar|museu|museum|centro\s+cultural|cultural\s+center|prefeitura|city\s+hall|reparticao|government\s+office|escola|school|bar|hotel|pousada)\b/i;
const OBVIOUSLY_IRRELEVANT_LINK_NAME_RE =
  /\b(igreja|rodoviaria|defensoria|estadio|academia|otica|prefeitura|camara\s+municipal|secretaria|supermercado|farmacia|hotel|pousada|restaurante|lanchonete|chaveiro|faculdade|universidade|clinica|hospital)\b/i;
const GENERIC_SPIRITIST_RE =
  /^(centro(?:\s+de\s+estudos)?|grupo|casa|sociedade|fraternidade)\s+espiritas?\b/i;

function normalizeForQuality(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isValidScrapedName(value) {
  return String(value || "").trim().replace(/[^\p{L}\p{N}]/gu, "").length >= 3;
}

function isClearlyOutsideScrapeScope(value, categoryValue = "") {
  const normalized = normalizeForQuality(value);
  const normalizedCategory = normalizeForQuality(categoryValue);
  if (
    COMMERCIAL_SERVICE_RE.test(normalized) ||
    CLEARLY_COMMERCIAL_PLACE_RE.test(normalized) ||
    INVALID_PLACE_NAME_RE.test(normalized) ||
    CLEARLY_OUT_OF_SCOPE_CATEGORY_RE.test(normalizedCategory)
  ) {
    return true;
  }
  if (
    GENERIC_SPIRITIST_RE.test(normalized) &&
    !AXE_CONTEXT_RE.test(normalized) &&
    !AXE_CONTEXT_RE.test(normalizedCategory)
  ) {
    return true;
  }
  // A categoria do local é isolada do restante da página. O texto geral do
  // Maps contém sugestões e o termo pesquisado, por isso não serve como prova.
  if (!AXE_CONTEXT_RE.test(normalized) && !AXE_CONTEXT_RE.test(normalizedCategory)) return true;
  return CLEARLY_OUT_OF_SCOPE_RE.test(normalized) && !AXE_CONTEXT_RE.test(normalized);
}

function placeNameFromMapsUrl(value) {
  try {
    const path = new URL(String(value || "")).pathname;
    const encodedName = path.match(/\/maps\/place\/([^/]+)/)?.[1];
    return encodedName ? decodeURIComponent(encodedName.replace(/\+/g, " ")) : "";
  } catch {
    return "";
  }
}

function isObviouslyIrrelevantMapsLink(value) {
  const name = normalizeForQuality(placeNameFromMapsUrl(value));
  if (!name) return false;
  if (
    COMMERCIAL_SERVICE_RE.test(name) ||
    CLEARLY_COMMERCIAL_PLACE_RE.test(name) ||
    INVALID_PLACE_NAME_RE.test(name)
  ) {
    return true;
  }
  if (AXE_CONTEXT_RE.test(name)) return false;
  return OBVIOUSLY_IRRELEVANT_LINK_NAME_RE.test(name) || CLEARLY_OUT_OF_SCOPE_RE.test(name);
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const details = [error.message, error.details, error.hint, error.code].filter(Boolean);
    return details.join(" | ") || JSON.stringify(error);
  }
  return String(error);
}

function isAddressWithinLocation(address, cidade, estado) {
  // Sem endereço não há como provar que uma sugestão do Maps pertence ao
  // município pesquisado. Em cidades pequenas o Google mistura resultados de
  // todo o país, portanto a ausência deve falhar de forma segura.
  if (!address || !cidade) return false;
  const raw = String(address);
  const escapedState = String(estado || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (escapedState) {
    const standard = raw.match(new RegExp(`,\\s*([^,]+?)\\s*-\\s*${escapedState}(?=,|$)`, "i"));
    const alternate = raw.match(new RegExp(`-\\s*([^,]+?),\\s*${escapedState}(?=,|$)`, "i"));
    const municipality = standard?.[1] || alternate?.[1];
    if (municipality) {
      return normalizeForQuality(municipality) === normalizeForQuality(cidade);
    }
    const stateConfirmed = new RegExp(`(?:-|,)\\s*${escapedState}(?=,|$)`, "i").test(raw);
    return stateConfirmed && normalizeForQuality(raw).includes(normalizeForQuality(cidade));
  }
  return false;
}

function identityTokens(value) {
  return new Set(
    normalizeForQuality(value)
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => (token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token)),
  );
}

function identitySimilarity(a, b) {
  const left = identityTokens(a);
  const right = identityTokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / new Set([...left, ...right]).size;
}

function coordinateDistanceMeters(a, b) {
  const latitude = ((Number(a.latitude) + Number(b.latitude)) / 2) * (Math.PI / 180);
  const dy = (Number(a.latitude) - Number(b.latitude)) * 111_320;
  const dx = (Number(a.longitude) - Number(b.longitude)) * 111_320 * Math.cos(latitude);
  return Math.hypot(dx, dy);
}

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
    singleQuery: false,
    scrollRounds: 35,
    terms: null,
    fromIndex: 0,
    cityLimit: Infinity,
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
    } else if (a === "--single-query") {
      args.singleQuery = true;
    } else if (a === "--scroll-rounds" && argv[i + 1]) {
      args.scrollRounds = Math.max(5, parseInt(argv[++i], 10) || 35);
    } else if (a === "--terms" && argv[i + 1]) {
      args.terms = argv[++i]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (a === "--max" && argv[i + 1]) {
      args.max = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === "--from-index" && argv[i + 1]) {
      args.fromIndex = Math.max(0, parseInt(argv[++i], 10) || 0);
    } else if (a === "--city-limit" && argv[i + 1]) {
      args.cityLimit = Math.max(1, parseInt(argv[++i], 10) || 1);
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
  node scripts/scrape-terreiros-google-maps.mjs --cidades-file scripts/data/bairros-sp-zona-leste.json
  node scripts/scrape-terreiros-google-maps.mjs --cidade "Suzano - SP" --scroll-rounds 50
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

function cleanGoogleAddress(value) {
  const address = String(value || "").trim();
  const embeddedStreet = address.match(
    /\s-\s((?:R\.|Rua|Av\.|Avenida|Estrada|Travessa|Tv\.|Praça|Rodovia|Alameda)\s.+)$/i,
  );
  return (embeddedStreet?.[1] || address).trim() || null;
}

/** @returns {{ label: string, cidade: string, estado: string | null, busca?: string, terms?: string[] }} */
function parseCidadeInput(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const label = String(raw.label || raw.busca || raw.cidade || "").trim();
    const cidade = String(raw.cidade || label).trim();
    const estado = raw.estado ? String(raw.estado).trim().toUpperCase() : null;
    if (!label && !cidade) throw new Error("Entrada de local inválida (objeto sem label/cidade)");
    return {
      label: label || `${cidade}${estado ? ` - ${estado}` : ""}`,
      cidade,
      estado,
      busca: raw.busca ? String(raw.busca).trim() : undefined,
      terms: Array.isArray(raw.terms) ? raw.terms.map(String) : undefined,
    };
  }

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

function mapsPlaceKey(url) {
  const value = String(url || "");
  const googlePlaceId = value.match(/!1s([^!/?#]+)/i)?.[1];
  if (googlePlaceId) return `id:${googlePlaceId.toLowerCase()}`;

  const placePath = value.match(/\/maps\/place\/([^/@?#]+)/i)?.[1];
  const coordinates = parseMapsCoordinates(value);
  if (placePath && coordinates) {
    return `place:${placePath.toLowerCase()}@${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
  }
  return null;
}

function parseMapsCoordinates(link) {
  const value = String(link || "");
  for (const pattern of [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  ]) {
    const match = value.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180 &&
      !(Math.abs(latitude) < 0.2 && Math.abs(longitude) < 0.2) &&
      latitude >= -34.5 &&
      latitude <= 5.5 &&
      longitude >= -74.5 &&
      longitude <= -32.0
    ) {
      return { latitude, longitude };
    }
  }
  return null;
}

function buildSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function slugifyBairro(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function resolveBairroForScrape(meta, endereco, cidade) {
  const label = String(meta.label || "").trim();
  const city = String(meta.cidade || "").trim();
  if (meta.busca && label && city && label.toLowerCase() !== city.toLowerCase()) {
    return label;
  }
  const addr = String(endereco || "").trim();
  if (!addr) return null;
  const dashMatch = addr.match(/-\s*([^,]+),\s*S[aã]o Paulo/i);
  if (dashMatch) {
    const candidate = dashMatch[1].trim();
    if (candidate.length >= 3 && candidate.length <= 80 && !/^\d/.test(candidate)) return candidate;
  }
  return null;
}

/** @returns {string[]} */
function buildQueriesForLocation(meta, options) {
  if (options.singleQuery) {
    return [`Terreiros em ${meta.label}`];
  }

  const target = meta.busca || meta.label;
  const terms = meta.terms?.length ? meta.terms : options.terms?.length ? options.terms : DEFAULT_SEARCH_TERMS;
  return terms.map((term) => `${term} em ${target}`);
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
    return parsed;
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

/** Rolagem profunda na barra lateral até estabilizar ou atingir o fim da lista */
async function scrollResultsFeed(page, scrollRounds = 35) {
  let feed = null;
  for (const sel of FEED_SELECTORS) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 12000 }).catch(() => false)) {
      feed = loc;
      break;
    }
  }

  if (!feed) {
    const count = await page.locator('a[href*="/maps/place/"]').count();
    console.warn(
      `    ⚠ Painel lateral (role=feed) não encontrado — só ${count} link(s) visíveis (sem scroll profundo)`,
    );
    return count;
  }

  let lastCount = 0;
  let lastHeight = 0;
  let noProgressRounds = 0;

  for (let round = 0; round < scrollRounds; round++) {
    const countBefore = await page.locator('a[href*="/maps/place/"]').count();

    await feed.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(2200);

    const endMarker = page.locator(
      "text=/chegou ao final|reached the end|Não há mais resultados|No more results/i",
    );
    if (await endMarker.isVisible({ timeout: 400 }).catch(() => false)) {
      lastCount = await page.locator('a[href*="/maps/place/"]').count();
      break;
    }

    const countAfter = await page.locator('a[href*="/maps/place/"]').count();
    const height = await feed.evaluate((el) => el.scrollHeight).catch(() => 0);

    if (countAfter <= countBefore && height <= lastHeight) {
      noProgressRounds += 1;
      if (noProgressRounds >= 4) break;
    } else {
      noProgressRounds = 0;
    }

    lastCount = countAfter;
    lastHeight = height;
  }

  return lastCount;
}

async function collectPlaceLinksFromSearch(page, searchQuery, scrollRounds) {
  const searchUrl = buildSearchUrl(searchQuery);
  console.log(`    → busca: ${searchQuery}`);
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await randomDelay(1800, 3200);
  await dismissConsentIfPresent(page);

  if (await detectBlock(page)) {
    throw new Error("Google bloqueou a navegação (captcha/consent). Tente --headless false.");
  }

  const listed = await scrollResultsFeed(page, scrollRounds);
  const links = await collectPlaceLinks(page);
  console.log(`    → ${links.length} link(s) únicos (${listed} na lista após scroll)`);
  return links;
}

async function collectPlaceLinks(page) {
  const hrefs = await page.locator('a[href*="/maps/place/"]').evaluateAll((anchors) =>
    anchors.map((a) => a.href).filter(Boolean),
  );
  const currentUrl = page.url();
  if (/\/maps\/place\//i.test(currentUrl)) hrefs.push(currentUrl);
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

  // Guarde a URL canônica antes de abrir a galeria: algumas fotos levam o
  // navegador ao Street View e não podem substituir o link público da casa.
  const placePageUrl = page.url();
  const link_maps = normalizeMapsUrl(placePageUrl);
  const coordinates = parseMapsCoordinates(link_maps) || parseMapsCoordinates(placePageUrl);
  const category = await page
    .locator(
      'button[jsaction*="pane.rating.category"], button.DkEaL, [data-item-id="authority"]',
    )
    .first()
    .innerText()
    .then((text) => String(text || "").trim())
    .catch(() => "");
  const foto_url = await extractPlacePhoto(page);

  return {
    nome: nome?.trim() || null,
    endereco: cleanGoogleAddress(endereco),
    telefone: telefone?.trim() || null,
    foto_url,
    category,
    link_maps,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
  };
}

async function upsertTerreiro(supabase, row, usedSlugs) {
  const { data: existing, error: selectErr } = await supabase
    .from(TABLE)
    .select("id, bairro")
    .eq("link_maps", row.link_maps)
    .limit(1)
    .maybeSingle();

  if (selectErr) throw selectErr;
  if (existing) {
    if (!existing.bairro && row.bairro) {
      await supabase
        .from(TABLE)
        .update({ bairro: row.bairro, bairro_slug: row.bairro_slug })
        .eq("id", existing.id);
    }
    return { action: "skipped", id: existing.id };
  }

  if (row.nome && row.endereco) {
    const { data: samePlace, error: identityError } = await supabase
      .from(TABLE)
      .select("id, link_maps")
      .eq("cidade", row.cidade)
      .ilike("nome", row.nome)
      .ilike("endereco", row.endereco)
      .limit(1)
      .maybeSingle();
    if (identityError) throw identityError;
    if (samePlace) {
      if (isStreetViewMapsUrl(samePlace.link_maps) && !isStreetViewMapsUrl(row.link_maps)) {
        await supabase
          .from(TABLE)
          .update({ link_maps: row.link_maps })
          .eq("id", samePlace.id);
      }
      return { action: "skipped", id: samePlace.id };
    }
  }

  if (row.nome && row.latitude != null && row.longitude != null) {
    const { data: nearbyPlaces, error: nearbyError } = await supabase
      .from(TABLE)
      .select("id, nome, endereco, latitude, longitude")
      .eq("cidade", row.cidade)
      .gte("latitude", row.latitude - 0.0004)
      .lte("latitude", row.latitude + 0.0004)
      .gte("longitude", row.longitude - 0.0005)
      .lte("longitude", row.longitude + 0.0005);
    if (nearbyError) throw nearbyError;

    const likelyDuplicate = (nearbyPlaces || []).find((candidate) => {
      const sameAddress =
        row.endereco &&
        candidate.endereco &&
        normalizeForQuality(row.endereco) === normalizeForQuality(candidate.endereco);
      const similarName = identitySimilarity(row.nome, candidate.nome) >= 0.8;
      return similarName && (sameAddress || coordinateDistanceMeters(row, candidate) <= 35);
    });
    if (likelyDuplicate) return { action: "skipped", id: likelyDuplicate.id };
  }

  const payload = {
    ...row,
    slug: uniqueSlug(row.nome, usedSlugs),
    cidade_slug: slugifyText(row.cidade, 60),
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: inserted, error: insertErr } = await supabase
      .from(TABLE)
      .insert(payload)
      .select("id")
      .single();
    if (!insertErr) return { action: "inserted", id: inserted.id };

    const errorText = formatError(insertErr);
    const isUniqueViolation = insertErr.code === "23505";
    if (isUniqueViolation && /link_maps/i.test(errorText)) {
      const { data: racedPlace } = await supabase
        .from(TABLE)
        .select("id")
        .eq("link_maps", row.link_maps)
        .limit(1)
        .maybeSingle();
      if (racedPlace) return { action: "skipped", id: racedPlace.id };
    }
    if (isUniqueViolation && /slug/i.test(errorText)) {
      const retryBase =
        attempt === 0
          ? `${row.nome}-${row.cidade}`
          : `${row.nome}-${row.cidade}-${Date.now().toString(36)}`;
      payload.slug = uniqueSlug(retryBase, usedSlugs);
      continue;
    }
    throw insertErr;
  }

  throw new Error(`Não foi possível gerar slug único para ${row.nome}`);
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
  if (details.latitude != null && details.longitude != null) {
    patch.latitude = details.latitude;
    patch.longitude = details.longitude;
    patch.coordinate_source = "google_maps_url";
    patch.coordinates_updated_at = new Date().toISOString();
  }
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

async function fetchRowsForEnrich(supabase, meta) {
  const PAGE = 1000;
  const all = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(TABLE)
      .select("id, nome, link_maps, foto_url, telefone, endereco, cidade, latitude, longitude")
      .eq("cidade", meta.cidade)
      .order("nome", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (meta.estado) query = query.eq("estado", meta.estado);

    const { data, error } = await query;
    if (error) throw error;

    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  // Prioriza quem está sem coordenada; também preenche foto/telefone faltantes.
  return all.filter(
    (row) =>
      row.latitude == null ||
      row.longitude == null ||
      !row.foto_url ||
      !row.telefone ||
      !row.endereco,
  );
}

async function enrichCidade(page, supabase, meta, options) {
  const rows = (await fetchRowsForEnrich(supabase, meta)).slice(0, options.max);
  console.log(`\n[${meta.label}] Enriquecendo ${rows.length} registro(s) (coords/foto/telefone)…`);

  const stats = { updated: 0, skipped: 0, errors: 0 };
  for (const row of rows) {
    try {
      const result = await enrichExisting(page, supabase, row, options, meta);
      if (result.action === "updated") stats.updated += 1;
      else stats.skipped += 1;
    } catch (err) {
      console.error(`    ✗ ${formatError(err)}`);
      stats.errors += 1;
    }
    await randomDelay();
  }
  return stats;
}

async function scrapeCidade(page, supabase, meta, options, usedSlugs, existingLinks, existingPlaceKeys) {
  const { label, cidade, estado } = meta;
  const queries = buildQueriesForLocation(meta, options);

  console.log(`\n[${label}] ${queries.length} busca(s) planejada(s)`);

  const allLinks = new Set();
  for (const query of queries) {
    try {
      const links = await collectPlaceLinksFromSearch(page, query, options.scrollRounds);
      for (const link of links) allLinks.add(link);
    } catch (err) {
      console.error(`    ✗ busca falhou: ${formatError(err)}`);
    }
    await randomDelay(2500, 4000);
  }

  const links = [...allLinks];
  const limited = links.slice(0, options.max);

  console.log(
    `[${label}] ${links.length} link(s) únicos no total (após ${queries.length} buscas). Processando ${limited.length}.`,
  );

  const stats = { inserted: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < limited.length; i++) {
    const link = limited[i];
    console.log(`  [${i + 1}/${limited.length}] ${link}`);

    try {
      if (isObviouslyIrrelevantMapsLink(link)) {
        console.log("    · resultado obviamente fora do nicho — ignorado pelo link");
        stats.skipped += 1;
        continue;
      }
      const normalizedLink = normalizeMapsUrl(link);
      const placeKey = mapsPlaceKey(normalizedLink);
      if (
        !options.dryRun &&
        (existingLinks.has(normalizedLink) || (placeKey && existingPlaceKeys.has(placeKey)))
      ) {
        console.log("    · link já cadastrado — ignorado antes de abrir");
        stats.skipped += 1;
        continue;
      }

      const details = await extractPlaceDetails(page, link);
      if (!details.nome) {
        console.warn("    ⚠ Nome não encontrado — ignorando");
        stats.errors += 1;
        continue;
      }
      if (
        !isValidScrapedName(details.nome) ||
        isClearlyOutsideScrapeScope(details.nome, details.category)
      ) {
        console.warn("    ⚠ Resultado inválido ou fora do nicho — ignorando");
        stats.skipped += 1;
        continue;
      }
      if (normalizeForQuality(details.nome) === normalizeForQuality(cidade)) {
        console.warn("    ⚠ Resultado representa o município, não uma casa — ignorando");
        stats.skipped += 1;
        continue;
      }
      if (!isAddressWithinLocation(details.endereco, cidade, estado)) {
        console.warn("    ⚠ Endereço pertence a outro município — ignorando");
        stats.skipped += 1;
        continue;
      }

      const bairro = resolveBairroForScrape(meta, details.endereco, cidade);
      const row = {
        nome: details.nome,
        endereco: details.endereco,
        telefone: details.telefone,
        foto_url: details.foto_url,
        link_maps: details.link_maps,
        latitude: details.latitude,
        longitude: details.longitude,
        coordinate_source:
          details.latitude != null && details.longitude != null ? "google_maps_url" : null,
        coordinates_updated_at:
          details.latitude != null && details.longitude != null ? new Date().toISOString() : null,
        cidade,
        estado,
        bairro,
        bairro_slug: bairro ? slugifyBairro(bairro) : null,
        tipo: classifyDiretorioEstabelecimento(details.nome),
      };

      if (options.dryRun) {
        console.log("    (dry-run)", row);
        stats.inserted += 1;
        continue;
      }

      const result = await upsertTerreiro(supabase, row, usedSlugs);
      existingLinks.add(normalizeMapsUrl(details.link_maps));
      const insertedPlaceKey = mapsPlaceKey(details.link_maps);
      if (insertedPlaceKey) existingPlaceKeys.add(insertedPlaceKey);
      if (result.action === "inserted") {
        console.log(`    ✓ inserido (${result.id})`);
        stats.inserted += 1;
      } else {
        console.log("    · já existia — ignorado");
        stats.skipped += 1;
      }
    } catch (err) {
      console.error(`    ✗ ${formatError(err)}`);
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
  const cidades = cidadesRaw
    .map(parseCidadeInput)
    .slice(args.fromIndex, args.fromIndex + args.cityLimit);

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
  const existingLinks = new Set();
  const existingPlaceKeys = new Set();

  if (supabase) {
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data: existingRows, error } = await supabase
        .from(TABLE)
        .select("slug, link_maps")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const row of existingRows || []) {
        if (row.slug) usedSlugs.add(String(row.slug));
        if (row.link_maps) {
          const normalizedLink = normalizeMapsUrl(String(row.link_maps));
          existingLinks.add(normalizedLink);
          const placeKey = mapsPlaceKey(normalizedLink);
          if (placeKey) existingPlaceKeys.add(placeKey);
        }
      }
      if ((existingRows || []).length < pageSize) break;
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
          const stats = await scrapeCidade(
            page,
            supabase,
            meta,
            args,
            usedSlugs,
            existingLinks,
            existingPlaceKeys,
          );
          totals.inserted += stats.inserted;
          totals.skipped += stats.skipped;
          totals.errors += stats.errors;
        }
      } catch (err) {
        console.error(`\n✗ [${meta.label}]`, formatError(err));
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
