/**
 * Orquestra raspagem completa — executa fase por fase até o fim.
 *
 *   node scripts/run-raspagem-completa.mjs
 *   node scripts/run-raspagem-completa.mjs --from 3    (retoma da fase 3)
 *   node scripts/run-raspagem-completa.mjs --headless false
 *
 * Logs: scripts/logs/raspagem-completa.log + raspagem-fase-NN.log
 */

import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "scripts", "logs");
const SCRAPER = path.join(ROOT, "scripts", "scrape-terreiros-google-maps.mjs");

const PHASES = [
  {
    id: 1,
    label: "Bairros — Zona Leste de São Paulo",
    file: "bairros-sp-zona-leste.json",
    scrollRounds: 50,
  },
  {
    id: 2,
    label: "Municípios — Alto Tietê (base)",
    file: "fase-02-alto-tiete-base.json",
    scrollRounds: 50,
  },
  {
    id: 3,
    label: "Municípios — Anel 1 (vizinhas diretas)",
    file: "fase-03-anel1-vizinhas.json",
    scrollRounds: 50,
  },
  {
    id: 4,
    label: "Municípios — ABC + Guarulhos",
    file: "fase-04-abc-guarulhos.json",
    scrollRounds: 50,
  },
  {
    id: 5,
    label: "Municípios — Grande SP leste + adjacências",
    file: "fase-05-grande-sp-leste.json",
    scrollRounds: 50,
  },
  {
    id: 6,
    label: "Municípios — Vale do Paraíba",
    file: "fase-06-vale-paraiba.json",
    scrollRounds: 45,
  },
  {
    id: 7,
    label: "Municípios — Interior (Campinas)",
    file: "fase-07-interior-campinas.json",
    scrollRounds: 45,
  },
  {
    id: 8,
    label: "Municípios — Interior + Litoral",
    file: "fase-08-interior-litoral.json",
    scrollRounds: 45,
  },
];

function parseArgs(argv) {
  const args = { from: 1, headless: "true" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from" && argv[i + 1]) args.from = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === "--headless" && argv[i + 1]) args.headless = argv[++i];
  }
  return args;
}

function ts() {
  return new Date().toISOString();
}

async function appendLog(mainLog, line) {
  const text = `[${ts()}] ${line}\n`;
  process.stdout.write(text);
  await fs.appendFile(mainLog, text, "utf8");
}

function runScraper(phase, options, phaseLog, dataFileOverride) {
  const dataFile = dataFileOverride || path.join(ROOT, "scripts", "data", phase.file);
  const args = [
    SCRAPER,
    "--cidades-file",
    dataFile,
    "--scroll-rounds",
    String(phase.scrollRounds || 50),
    "--headless",
    options.headless,
  ];
  if (phase.enrich) args.push("--enrich");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const writeChunk = async (chunk) => {
      const s = String(chunk);
      process.stdout.write(s);
      await fs.appendFile(phaseLog, s, "utf8");
    };

    child.stdout.on("data", writeChunk);
    child.stderr.on("data", writeChunk);
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const PAGE_SIZE = 1000;

/** Busca todas as linhas paginando (Supabase limita 1000 por request). */
async function fetchAllTerreirosRows(sb, table, select) {
  const all = [];
  let offset = 0;

  while (true) {
    const from = offset;
    const to = offset + PAGE_SIZE - 1;
    const { data, error } = await sb.from(table).select(select).range(from, to);
    if (error) throw error;

    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

async function enrichAllCities(mainLog, headless) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado no .env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const rows = await fetchAllTerreirosRows(sb, "terreiros_diretorio", "cidade, estado, foto_url");

  const cityMeta = new Map();
  let semFotoTotal = 0;
  for (const r of rows) {
    const cidade = String(r.cidade || "").trim();
    if (!cidade) continue;
    const label = `${cidade} - ${r.estado || "SP"}`;
    if (!cityMeta.has(label)) cityMeta.set(label, { label, semFoto: 0 });
    if (!r.foto_url) {
      cityMeta.get(label).semFoto += 1;
      semFotoTotal += 1;
    }
  }

  const cities = [...cityMeta.values()]
    .filter((m) => m.semFoto > 0)
    .sort((a, b) => b.semFoto - a.semFoto || a.label.localeCompare(b.label, "pt-BR"))
    .map((m) => m.label);

  const tmpFile = path.join(LOG_DIR, "_enrich-all-cities.json");
  await fs.writeFile(tmpFile, JSON.stringify(cities, null, 2), "utf8");
  await appendLog(
    mainLog,
    `Enrich global: ${cities.length} cidade(s) com sem foto (${semFotoTotal} registro(s) de ${rows.length} no banco)`,
  );

  if (cities.length === 0) {
    await appendLog(mainLog, "Enrich global: nada pendente — todas as fichas já têm foto_url.");
    return 0;
  }

  const phaseLog = path.join(LOG_DIR, "raspagem-fase-09-enrich-global.log");
  return runScraper(
    { enrich: true, scrollRounds: 0 },
    { headless },
    phaseLog,
    tmpFile,
  );
}

async function main() {
  const options = parseArgs(process.argv);
  await fs.mkdir(LOG_DIR, { recursive: true });
  const mainLog = path.join(LOG_DIR, "raspagem-completa.log");

  await appendLog(mainLog, `═══ INÍCIO raspagem completa (a partir da fase ${options.from}) ═══`);

  for (const phase of PHASES) {
    if (phase.id < options.from) continue;

    const phaseLog = path.join(LOG_DIR, `raspagem-fase-${String(phase.id).padStart(2, "0")}.log`);
    await appendLog(mainLog, `── Fase ${phase.id}/8: ${phase.label} ──`);

    const started = Date.now();
    const code = await runScraper(phase, options, phaseLog);

    const mins = ((Date.now() - started) / 60000).toFixed(1);
    await appendLog(mainLog, `── Fase ${phase.id} finalizada: exit=${code}, ${mins} min ──`);

    if (code !== 0) {
      await appendLog(mainLog, `⚠ Fase ${phase.id} retornou código ${code} — continuando próxima fase`);
    }
  }

  await appendLog(mainLog, "── Fase 9/9: Enriquecimento global (fotos/telefones) ──");
  const enrichStarted = Date.now();
  const enrichCode = await enrichAllCities(mainLog, options.headless);
  const enrichMins = ((Date.now() - enrichStarted) / 60000).toFixed(1);
  await appendLog(mainLog, `── Fase 9 finalizada: exit=${enrichCode}, ${enrichMins} min ──`);

  await appendLog(mainLog, "═══ RASPAGEM COMPLETA — todas as fases executadas ═══");
}

main().catch(async (err) => {
  const mainLog = path.join(LOG_DIR, "raspagem-completa.log");
  await fs.appendFile(mainLog, `[${ts()}] FATAL: ${err instanceof Error ? err.stack : err}\n`).catch(() => {});
  console.error(err);
  process.exit(1);
});
