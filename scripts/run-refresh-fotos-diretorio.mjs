/**
 * Refresh de fotos do diretório (Brasil inteiro).
 * Rebaixa imagens do Google Maps via Playwright, grava no Storage (owner_photo_url)
 * e atualiza foto_url — assim as páginas de cidade param de depender de links mortos.
 *
 * Uso local ou em job administrativo:
 *   node scripts/run-refresh-fotos-diretorio.mjs
 *   node scripts/run-refresh-fotos-diretorio.mjs --from-index 10 --city-limit 5
 *   node scripts/run-refresh-fotos-diretorio.mjs --max-per-city 30
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROGRESS_FILE = path.join(ROOT, "scripts/data/refresh-fotos-progress.json");
const CITIES_FILE = path.join(ROOT, "scripts/data/_refresh-fotos-cities.json");
const LOG_FILE = "/var/log/axecloud-scrape-fotos.log";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const args = { fromIndex: 0, cityLimit: Infinity, maxPerCity: Infinity, headless: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-index" && argv[i + 1]) args.fromIndex = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--city-limit" && argv[i + 1]) args.cityLimit = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--max-per-city" && argv[i + 1]) args.maxPerCity = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--headless" && argv[i + 1]) args.headless = argv[++i] !== "false";
  }
  return args;
}

async function appendLog(line) {
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}\n`;
  try {
    await fs.appendFile(LOG_FILE, text, "utf8");
  } catch {
    // fallback local
    await fs.appendFile(path.join(ROOT, "scripts/data/refresh-fotos.log"), text, "utf8").catch(() => undefined);
  }
  console.log(line);
}

async function fetchAllPendingCities(sb) {
  const PAGE = 1000;
  const cityMap = new Map();
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from("terreiros_diretorio")
      .select("cidade,estado,link_maps,owner_photo_url")
      .not("link_maps", "is", null)
      .is("owner_photo_url", null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const batch = data || [];
    for (const row of batch) {
      const cidade = String(row.cidade || "").trim();
      const estado = String(row.estado || "").trim().toUpperCase() || "SP";
      if (!cidade || !row.link_maps) continue;
      const label = `${cidade} - ${estado}`;
      cityMap.set(label, (cityMap.get(label) || 0) + 1);
    }
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return [...cityMap.entries()]
    .map(([label, pending]) => ({ label, pending }))
    .sort((a, b) => b.pending - a.pending || a.label.localeCompare(b.label, "pt-BR"));
}

function runScraperForCities(citiesFile, args) {
  return new Promise((resolve) => {
    const scraperArgs = [
      path.join(ROOT, "scripts/scrape-terreiros-google-maps.mjs"),
      "--cidades-file",
      citiesFile,
      "--refresh-photos",
      "--scroll-rounds",
      "0",
      "--headless",
      args.headless ? "true" : "false",
    ];
    if (Number.isFinite(args.maxPerCity)) {
      scraperArgs.push("--max", String(args.maxPerCity));
    }

    const child = spawn(process.execPath, scraperArgs, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (buf) => {
      const text = buf.toString("utf8");
      process.stdout.write(text);
      fs.appendFile(LOG_FILE, text).catch(() => undefined);
    });
    child.stderr.on("data", (buf) => {
      const text = buf.toString("utf8");
      process.stderr.write(text);
      fs.appendFile(LOG_FILE, text).catch(() => undefined);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env");
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  await fs.mkdir(path.dirname(PROGRESS_FILE), { recursive: true });

  let progress = {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fromIndex: args.fromIndex,
    lastCompletedIndex: args.fromIndex - 1,
    lastCity: null,
    citiesTotal: 0,
    pendingTotal: 0,
    updatedBatches: 0,
    errors: 0,
  };
  try {
    const prev = JSON.parse(await fs.readFile(PROGRESS_FILE, "utf8"));
    if (prev && typeof prev === "object" && args.fromIndex === 0 && Number.isFinite(prev.lastCompletedIndex)) {
      progress = { ...progress, ...prev, fromIndex: Math.max(0, Number(prev.lastCompletedIndex) + 1) };
    }
  } catch {
    // first run
  }

  await appendLog("═══ INÍCIO refresh fotos diretório (Brasil) ═══");
  const cities = await fetchAllPendingCities(sb);
  progress.citiesTotal = cities.length;
  progress.pendingTotal = cities.reduce((sum, c) => sum + c.pending, 0);
  await appendLog(
    `Cidades pendentes: ${cities.length} | fichas sem owner_photo_url: ${progress.pendingTotal} | fromIndex=${progress.fromIndex}`,
  );

  const slice = cities.slice(progress.fromIndex, progress.fromIndex + (Number.isFinite(args.cityLimit) ? args.cityLimit : cities.length));
  if (slice.length === 0) {
    await appendLog("Nada pendente — todas as fichas com link_maps já têm owner_photo_url.");
    progress.updatedAt = new Date().toISOString();
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8");
    return;
  }

  // Processa cidade a cidade para retomar sem refazer o lote inteiro.
  for (let i = 0; i < slice.length; i++) {
    const absoluteIndex = progress.fromIndex + i;
    const city = slice[i];
    await appendLog(`── Cidade ${absoluteIndex + 1}/${cities.length}: ${city.label} (${city.pending} pendentes) ──`);
    await fs.writeFile(CITIES_FILE, JSON.stringify([city.label], null, 2), "utf8");

    const code = await runScraperForCities(CITIES_FILE, args);
    progress.lastCompletedIndex = absoluteIndex;
    progress.lastCity = city.label;
    progress.updatedAt = new Date().toISOString();
    if (code === 0) progress.updatedBatches += 1;
    else progress.errors += 1;
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf8");
    await appendLog(`── Fim ${city.label}: exit=${code} ──`);
  }

  await appendLog("═══ FIM lote refresh fotos ═══");
}

main().catch(async (err) => {
  console.error(err);
  try {
    await appendLog(`FATAL: ${err?.message || err}`);
  } catch {
    // ignore
  }
  process.exit(1);
});
