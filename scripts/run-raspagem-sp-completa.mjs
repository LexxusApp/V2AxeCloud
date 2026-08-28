/**
 * Raspagem completa de SP — municípios IBGE ainda sem terreiro no diretório.
 *
 *   node scripts/run-raspagem-sp-completa.mjs
 *   node scripts/run-raspagem-sp-completa.mjs --from-index 40
 *   node scripts/run-raspagem-sp-completa.mjs --batch-size 15 --headless true
 *
 * Progresso: scripts/data/sp-scrape-progress.json
 * Log: scripts/logs/raspagem-sp-completa.log
 *
 * Lista: scripts/data/sp-municipios-pendentes.json (gerada a partir do IBGE − banco)
 */

import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "scripts", "logs");
const DATA_DIR = path.join(ROOT, "scripts", "data");
const SCRAPER = path.join(ROOT, "scripts", "scrape-terreiros-google-maps.mjs");
const PENDENTES = path.join(DATA_DIR, "sp-municipios-pendentes.json");
const PROGRESS = path.join(DATA_DIR, "sp-scrape-progress.json");
const MAIN_LOG = path.join(LOG_DIR, "raspagem-sp-completa.log");

function parseArgs(argv) {
  const args = { fromIndex: null, batchSize: 20, headless: "true", scrollRounds: 40 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-index" && argv[i + 1]) args.fromIndex = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === "--batch-size" && argv[i + 1]) args.batchSize = Math.max(1, parseInt(argv[++i], 10) || 20);
    else if (a === "--headless" && argv[i + 1]) args.headless = argv[++i];
    else if (a === "--scroll-rounds" && argv[i + 1]) args.scrollRounds = Math.max(10, parseInt(argv[++i], 10) || 40);
  }
  return args;
}

function ts() {
  return new Date().toISOString();
}

async function appendLog(line) {
  const text = `[${ts()}] ${line}\n`;
  process.stdout.write(text);
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.appendFile(MAIN_LOG, text, "utf8");
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runBatch(fromIndex, limit, options) {
  return new Promise((resolve) => {
    const batchLog = path.join(
      LOG_DIR,
      `raspagem-sp-batch-${String(fromIndex).padStart(4, "0")}.log`,
    );
    const args = [
      SCRAPER,
      "--cidades-file",
      PENDENTES,
      "--from-index",
      String(fromIndex),
      "--city-limit",
      String(limit),
      "--scroll-rounds",
      String(options.scrollRounds),
      "--headless",
      options.headless,
    ];
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stream = async (chunk, isErr) => {
      const text = chunk.toString("utf8");
      process.stdout.write(text);
      await fs.appendFile(batchLog, text, "utf8").catch(() => undefined);
      if (isErr) await fs.appendFile(MAIN_LOG, text, "utf8").catch(() => undefined);
    };
    child.stdout.on("data", (c) => void stream(c, false));
    child.stderr.on("data", (c) => void stream(c, true));
    child.on("close", (code) => resolve({ code: code ?? 1, batchLog }));
  });
}

async function main() {
  const options = parseArgs(process.argv);
  const cities = await readJson(PENDENTES, []);
  if (!Array.isArray(cities) || cities.length === 0) {
    throw new Error(`Lista vazia: ${PENDENTES}`);
  }

  const prev = await readJson(PROGRESS, {});
  let fromIndex =
    options.fromIndex != null
      ? options.fromIndex
      : Math.max(0, Number(prev.lastCompletedIndex ?? -1) + 1);

  await appendLog(
    `═══ INÍCIO raspagem SP completa — ${cities.length} pendentes, from-index=${fromIndex}, batch=${options.batchSize} ═══`,
  );

  let inserted = Number(prev.inserted || 0);
  let skipped = Number(prev.skipped || 0);
  let errors = Number(prev.errors || 0);

  while (fromIndex < cities.length) {
    const remaining = cities.length - fromIndex;
    const limit = Math.min(options.batchSize, remaining);
    const slice = cities.slice(fromIndex, fromIndex + limit);
    await appendLog(
      `Lote ${fromIndex}→${fromIndex + limit - 1} (${limit} cidades): ${slice[0]} … ${slice[slice.length - 1]}`,
    );

    const { code } = await runBatch(fromIndex, limit, options);
    if (code !== 0) {
      errors += 1;
      await appendLog(`⚠ Lote from-index=${fromIndex} saiu com código ${code} — PARANDO para não pular cidades`);
      await writeJson(PROGRESS, {
        startedAt: prev.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalPendentes: cities.length,
        fromIndex,
        lastCompletedIndex: fromIndex - 1,
        lastCity: fromIndex > 0 ? cities[fromIndex - 1] : null,
        inserted,
        skipped,
        errors,
        lastExitCode: code,
        stoppedOnError: true,
      });
      process.exit(code);
    }

    const lastCompletedIndex = fromIndex + limit - 1;
    await writeJson(PROGRESS, {
      startedAt: prev.startedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalPendentes: cities.length,
      fromIndex: lastCompletedIndex + 1,
      lastCompletedIndex,
      lastCity: cities[lastCompletedIndex] || null,
      inserted,
      skipped,
      errors,
      lastExitCode: code,
    });

    fromIndex = lastCompletedIndex + 1;
    await appendLog(`Progresso: ${fromIndex}/${cities.length} (~${Math.round((fromIndex / cities.length) * 100)}%)`);
  }

  await appendLog("═══ RASPAGEM SP COMPLETA — todos os lotes executados ═══");
  await writeJson(PROGRESS, {
    ...(await readJson(PROGRESS, {})),
    finishedAt: new Date().toISOString(),
    done: true,
  });
}

main().catch(async (err) => {
  console.error(err);
  try {
    await appendLog(`FATAL: ${err?.stack || err}`);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
