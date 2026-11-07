/**
 * Varredura completa de fotos para terreiros sem foto no banco de dados.
 *
 * Funcionalidades:
 * 1. Fase 1 (Instantânea): Resolve registros que já têm StreetView no link_maps.
 * 2. Fase 2 (Pool Paralelo Playwright):
 *    - Visita Google Maps com múltiplos navegadores simultâneos (concurrency 6-8)
 *    - Captura fotos em alta resolução (googleusercontent, grass-cs, gps-cs-s, StreetView)
 *    - Salva buffer permanente no Supabase Storage (bucket perfil_fotos)
 *    - Atualiza foto_url e owner_photo_url no Supabase
 *    - Checkpoint automático contínuo (permite pausar e retomar a qualquer momento)
 *
 * Uso:
 *   node scripts/sweep-terreiros-photos.mjs
 *   node scripts/sweep-terreiros-photos.mjs --concurrency 8
 *   node scripts/sweep-terreiros-photos.mjs --limit 100
 *   node scripts/sweep-terreiros-photos.mjs --headless false
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROGRESS_FILE = path.join(ROOT, "scripts/data/sweep-photos-progress.json");
const LOG_FILE = path.join(ROOT, "scripts/logs/sweep-photos.log");

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERRO: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLE = "terreiros_diretorio";
const STORAGE_BUCKET = "perfil_fotos";

function parseArgs(argv) {
  const args = {
    concurrency: 4,
    limit: Infinity,
    limitSv: Infinity,
    headless: true,
    skipStreetViewPass: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--concurrency" && argv[i + 1]) {
      args.concurrency = Math.max(1, Math.min(16, parseInt(argv[++i], 10) || 4));
    } else if (a === "--limit" && argv[i + 1]) {
      args.limit = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === "--limit-sv" && argv[i + 1]) {
      args.limitSv = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === "--headless" && argv[i + 1]) {
      args.headless = argv[++i] !== "false";
    } else if (a === "--skip-streetview") {
      args.skipStreetViewPass = true;
    } else if (a === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    await fs.appendFile(LOG_FILE, line + "\n", "utf8");
  } catch {
    // ignore
  }
}

function cleanGooglePhotoUrl(url) {
  if (!url) return null;
  const raw = String(url).trim();
  if (raw.includes("streetviewpixels")) {
    const panoidMatch = raw.match(/panoid=([a-zA-Z0-9_\-]+)/);
    if (panoidMatch) {
      return `https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1200&h=800&pitch=0&panoid=${panoidMatch[1]}`;
    }
    return raw;
  }
  const base = raw.replace(/=(?:w\d+-h\d+(?:-[a-z0-9-]+)?|s\d+(?:-[a-z0-9-]+)?|h\d+(?:-[a-z0-9-]+)?)$/i, "");
  return `${base}=w1200-h900-k-no`;
}

function pickBestPhoto(urls) {
  const clean = urls.filter((u) => {
    if (!u) return false;
    if (u.includes("default-user")) return false;
    if (/\/a[-/]/.test(u)) return false;
    return u.includes("googleusercontent.com") || u.includes("streetviewpixels");
  });
  if (clean.length === 0) return null;

  // 1ª prioridade: fotos reais do local (grass-cs, gps-cs-s, /p/)
  const placePhotos = clean.filter((u) => u.includes("grass-cs") || u.includes("gps-cs-s") || u.includes("/p/"));
  if (placePhotos.length > 0) return cleanGooglePhotoUrl(placePhotos[0]);

  // 2ª prioridade: outras fotos de googleusercontent
  const googlePhotos = clean.filter((u) => u.includes("googleusercontent.com"));
  if (googlePhotos.length > 0) return cleanGooglePhotoUrl(googlePhotos[0]);

  // 3ª prioridade: Street View
  return cleanGooglePhotoUrl(clean[0]);
}

async function uploadToStorage(id, photoUrl) {
  const res = await fetch(photoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://www.google.com/",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao baixar foto de ${photoUrl.slice(0, 80)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4000) {
    throw new Error(`Imagem muito pequena (${buf.length} bytes)`);
  }

  const storagePath = `diretorio/scraped/${id}-${Date.now()}.jpg`;
  const { error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(storagePath, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (upErr) throw upErr;

  const { data: pubData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return pubData.publicUrl;
}

/**
 * Fase 1: Resolve terreiros cujo link_maps já contém um StreetView panoid embutido.
 */
async function resolveStreetViewFastPass(options) {
  log("Iniciando Fase 1: Varredura de links com Street View embutido...");
  let offset = 0;
  const PAGE = 1000;
  let resolved = 0;

  while (true) {
    const { data, error } = await sb
      .from(TABLE)
      .select("id, nome, link_maps")
      .eq("tipo", "terreiro")
      .is("owner_photo_url", null)
      .like("link_maps", "%streetviewpixels%")
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const r of data) {
      if (Number.isFinite(options.limitSv) && resolved >= options.limitSv) break;
      const m = r.link_maps.match(/panoid%3D([a-zA-Z0-9_\-]+)/) || r.link_maps.match(/panoid=([a-zA-Z0-9_\-]+)/);
      if (!m) continue;

      const panoid = m[1];
      const svUrl = `https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1200&h=800&pitch=0&panoid=${panoid}`;

      try {
        let storageUrl = svUrl;
        if (!options.dryRun) {
          storageUrl = await uploadToStorage(r.id, svUrl);
          await sb
            .from(TABLE)
            .update({
              foto_url: svUrl,
              owner_photo_url: storageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", r.id);
        }
        resolved++;
        log(`  [Fase 1 - SV ${resolved}] ${r.nome} -> Foto StreetView vinculada`);
      } catch (err) {
        log(`  [Fase 1 - Erro] ${r.nome}: ${err.message}`);
      }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  log(`Fase 1 concluída: ${resolved} terreiro(s) atualizados com foto Street View.`);
  return resolved;
}

/**
 * Carrega todos os terreiros pendentes sem foto
 * Prioriza os que possuem link_maps direto, depois os sem link_maps.
 */
async function fetchPendingTerreiros(limit = Infinity) {
  const PAGE = 1000;
  const list = [];

  // 1. Terreiros com link_maps
  let offset = 0;
  while (list.length < limit) {
    const pageSize = Math.min(PAGE, limit - list.length);
    const { data, error } = await sb
      .from(TABLE)
      .select("id, nome, cidade, estado, link_maps")
      .eq("tipo", "terreiro")
      .is("owner_photo_url", null)
      .not("link_maps", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    list.push(...data);
    if (data.length < pageSize) break;
    offset += PAGE;
  }

  // 2. Terreiros sem link_maps (busca manual por nome + cidade)
  if (list.length < limit) {
    offset = 0;
    while (list.length < limit) {
      const pageSize = Math.min(PAGE, limit - list.length);
      const { data, error } = await sb
        .from(TABLE)
        .select("id, nome, cidade, estado, link_maps")
        .eq("tipo", "terreiro")
        .is("owner_photo_url", null)
        .is("link_maps", null)
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      list.push(...data);
      if (data.length < pageSize) break;
      offset += PAGE;
    }
  }

  return list;
}

function getBestTargetUrl(item) {
  const link = item.link_maps || "";
  const hasCoordinatesOrData =
    link.includes("data=!") || link.includes("@-") || link.includes("!1s") || link.includes("!3d");

  if (link && hasCoordinatesOrData) {
    return link;
  }

  // Se não tem coordenadas ou data, a busca direta por Nome + Cidade + Estado é garantida
  const query = `${item.nome || ""} ${item.cidade || ""} ${item.estado || ""}`.trim();
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

/**
 * Processa um terreiro via página do Google Maps
 */
async function scrapeTerreiroPhoto(page, item) {
  const targetUrl = getBestTargetUrl(item);

  const collectedUrls = [];
  const onResponse = (res) => {
    const u = res.url();
    if (
      (u.includes("googleusercontent.com") || u.includes("streetviewpixels")) &&
      !u.includes("default-user") &&
      !/\/a[-/]/.test(u)
    ) {
      collectedUrls.push(u);
    }
  };

  page.on("response", onResponse);

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Se houver modal de consentimento (cookies), aceita rapidamente
    const consentBtn = page.getByRole("button", { name: /aceitar tudo|accept all/i });
    if (await consentBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await consentBtn.click().catch(() => undefined);
      await page.waitForTimeout(1000);
    }

    // Se caiu numa lista de resultados de busca (vários cards), clica no 1º resultado
    if (page.url().includes("/maps/search/")) {
      const firstResult = page.locator('a[href*="/maps/place/"]').first();
      if (await firstResult.isVisible({ timeout: 1500 }).catch(() => false)) {
        await firstResult.click().catch(() => undefined);
        await page.waitForTimeout(1500);
      }
    }

    // Aguarda carregar qualquer imagem de destaque por até 2.5s
    await page
      .waitForSelector('img[src*="googleusercontent.com"], img[src*="streetviewpixels"]', { timeout: 2500 })
      .catch(() => null);

    // Coleta imagens do DOM
    const domUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).map((i) => i.src);
    });
    domUrls.forEach((u) => collectedUrls.push(u));

    const best = pickBestPhoto(collectedUrls);
    return best;
  } finally {
    page.off("response", onResponse);
  }
}

/**
 * Worker do pool
 */
async function workerLoop(workerId, queue, results, options, progress) {
  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "pt-BR",
  });

  const page = await context.newPage();

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;

    const idx = progress.totalProcessed + 1;
    progress.totalProcessed++;

    try {
      const bestPhoto = await scrapeTerreiroPhoto(page, item);

      if (bestPhoto) {
        let storageUrl = null;
        if (!options.dryRun) {
          try {
            storageUrl = await uploadToStorage(item.id, bestPhoto);
          } catch (storageErr) {
            log(`    [Storage retry] ID ${item.id}: ${storageErr.message} - mantendo pendente para nova tentativa`);
          }

          const { error: updErr } = await sb
            .from(TABLE)
            .update({
              foto_url: bestPhoto,
              owner_photo_url: storageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          if (updErr) throw updErr;
        }

        results.success++;
        progress.photosAdded++;
        log(
          `[W${workerId}] (${idx}/${progress.totalItems}) ✓ ${item.nome} (${item.cidade}-${item.estado}) -> Foto adicionada!`,
        );
      } else {
        results.noPhotoFound++;
        progress.noPhotoCount++;
        log(
          `[W${workerId}] (${idx}/${progress.totalItems}) · ${item.nome} (${item.cidade}-${item.estado}) -> Sem foto no Maps`,
        );
      }
    } catch (err) {
      results.errors++;
      progress.errorsCount++;
      log(`[W${workerId}] (${idx}/${progress.totalItems}) ✗ Erro em ${item.nome}: ${err.message}`);
      // Reseta a aba para cancelar qualquer navegação pendente
      await page.goto("about:blank").catch(() => undefined);
      if (/rate|quota|captcha|sorry|blocked/i.test(err.message)) {
        log(`[W${workerId}] Alerta de taxa - aguardando 5s de resfriamento...`);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    // Intervalo de segurança com jitter entre requisições para evitar rate limit
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

    // Salva progresso a cada 10 itens
    if (idx % 10 === 0) {
      progress.updatedAt = new Date().toISOString();
      await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8").catch(() => undefined);
    }
  }

  await browser.close().catch(() => undefined);
}

async function main() {
  const args = parseArgs(process.argv);
  await fs.mkdir(path.dirname(PROGRESS_FILE), { recursive: true });
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });

  log("===================================================================");
  log("          INÍCIO DA VARREDURA NACIONAL DE FOTOS DE TERREIROS       ");
  log("===================================================================");
  log(`Configuração: Concorrência=${args.concurrency} | Limite=${args.limit} | Headless=${args.headless}`);

  // 1. Fase 1: Street View rápido
  if (!args.skipStreetViewPass) {
    try {
      await resolveStreetViewFastPass(args);
    } catch (svErr) {
      log(`Aviso Fase 1: ${svErr.message}`);
    }
  }

  // 2. Busca lista dos pendentes
  log("Consultando terreiros sem foto no banco de dados...");
  const pending = await fetchPendingTerreiros(args.limit);
  log(`Total de terreiros pendentes selecionados: ${pending.length}`);

  if (pending.length === 0) {
    log("Nenhum terreiro pendente encontrado. Varredura finalizada!");
    return;
  }

  const progress = {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalItems: pending.length,
    totalProcessed: 0,
    photosAdded: 0,
    noPhotoCount: 0,
    errorsCount: 0,
  };

  const results = {
    success: 0,
    noPhotoFound: 0,
    errors: 0,
  };

  const startTime = Date.now();
  const queue = [...pending];
  const workers = [];

  log(`Disparando pool com ${args.concurrency} navegadores simultâneos...`);
  for (let w = 1; w <= args.concurrency; w++) {
    workers.push(workerLoop(w, queue, results, args, progress));
  }

  await Promise.all(workers);

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  progress.updatedAt = new Date().toISOString();
  progress.durationSec = durationSec;
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8").catch(() => undefined);

  log("===================================================================");
  log("                     VARREDURA CONCLUÍDA                           ");
  log("===================================================================");
  log(`Tempo total: ${durationSec}s (${Math.round(durationSec / 60)} minutos)`);
  log(`Total processado: ${progress.totalProcessed}`);
  log(`Fotos adicionadas com sucesso: ${results.success}`);
  log(`Sem fotos no perfil do Maps: ${results.noPhotoFound}`);
  log(`Erros/Timeout: ${results.errors}`);
  log("===================================================================");
}

main().catch(async (fatalErr) => {
  console.error("FATAL:", fatalErr);
  await log(`ERRO FATAL: ${fatalErr.message}`);
  process.exit(1);
});
