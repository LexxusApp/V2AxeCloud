/**
 * Backfill contínuo de coordenadas — roda em paralelo com a raspagem Brasil.
 * Processa lotes até a fila esvaziar; aguarda e recomeça (novos terreiros podem entrar).
 *
 *   node scripts/run-backfill-coordinates-loop.mjs
 *   node scripts/run-backfill-coordinates-loop.mjs --batch-size 40 --delay-ms 2000
 *
 * Log: scripts/logs/backfill-coordinates-loop.log
 */

import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "scripts", "logs");
const BACKFILL = path.join(ROOT, "scripts", "backfill-terreiros-coordinates.mjs");
const MAIN_LOG = path.join(LOG_DIR, "backfill-coordinates-loop.log");

function parseArgs(argv) {
  const args = { batchSize: 40, delayMs: 2000, headless: "true", idleWaitMin: 30 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--batch-size" && argv[i + 1]) args.batchSize = Math.max(5, parseInt(argv[++i], 10) || 40);
    else if (a === "--delay-ms" && argv[i + 1]) args.delayMs = Math.max(1200, parseInt(argv[++i], 10) || 2000);
    else if (a === "--headless" && argv[i + 1]) args.headless = argv[++i];
    else if (a === "--idle-wait-min" && argv[i + 1]) args.idleWaitMin = Math.max(5, parseInt(argv[++i], 10) || 30);
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

function runBatch(batchSize, options) {
  return new Promise((resolve) => {
    const args = [
      BACKFILL,
      "--limit",
      String(batchSize),
      "--delay-ms",
      String(options.delayMs),
      "--headless",
      options.headless,
    ];
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      const t = c.toString("utf8");
      stdout += t;
      process.stdout.write(t);
    });
    child.stderr.on("data", (c) => {
      const t = c.toString("utf8");
      stderr += t;
      process.stderr.write(t);
    });
    child.on("close", (code) => {
      const updated = (stdout.match(/atualizado(?: \([^)]+\))?:/g) || []).length;
      const unresolved = (stdout.match(/sem coordenada/g) || []).length;
      const queueMatch = stdout.match(/\[coordinates\] (\d+) registro\(s\)/);
      const queueSize = queueMatch ? parseInt(queueMatch[1], 10) : 0;
      resolve({ code: code ?? 1, updated, unresolved, queueSize, stdout, stderr });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const options = parseArgs(process.argv);
  await appendLog(`═══ INÍCIO backfill coordenadas — lote=${options.batchSize} ═══`);

  let totalUpdated = 0;
  let totalUnresolved = 0;
  let idleRounds = 0;

  for (;;) {
    const { code, updated, unresolved, queueSize } = await runBatch(options.batchSize, options);
    totalUpdated += updated;
    totalUnresolved += unresolved;

    if (code !== 0) {
      await appendLog(`⚠ lote saiu com código ${code} — aguardando 5 min antes de retomar`);
      await sleep(5 * 60 * 1000);
      continue;
    }

    if (queueSize === 0) {
      idleRounds += 1;
      await appendLog(
        `fila vazia — aguardando ${options.idleWaitMin} min (rodada ociosa ${idleRounds}) | total atualizado=${totalUpdated}`,
      );
      await sleep(options.idleWaitMin * 60 * 1000);
      continue;
    }

    idleRounds = 0;
    await appendLog(
      `lote ok: +${updated} coords, ${unresolved} sem resolver | acumulado=${totalUpdated}`,
    );

    if (updated === 0 && unresolved > 0) {
      await appendLog(`nenhum sucesso neste lote — pausa 10 min`);
      await sleep(10 * 60 * 1000);
    } else {
      await sleep(3000);
    }
  }
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
