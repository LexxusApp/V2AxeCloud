/**
 * Completa coordenadas individuais do diretório abrindo os links públicos já
 * cadastrados. É retomável: registros atualizados deixam automaticamente a fila.
 *
 * Exemplos:
 *   node scripts/backfill-terreiros-coordinates.mjs --limit 100
 *   node scripts/backfill-terreiros-coordinates.mjs --cidade "São Paulo" --estado SP --all
 *   node scripts/backfill-terreiros-coordinates.mjs --dry-run --limit 10 --headless false
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TABLE = "terreiros_diretorio";
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function parseArgs(argv) {
  const args = {
    limit: 100,
    all: false,
    dryRun: false,
    headless: true,
    cidade: "",
    estado: "",
    delayMs: 1800,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--limit" && argv[index + 1]) args.limit = Math.max(1, Number(argv[++index]) || 100);
    else if (value === "--all") args.all = true;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--headless" && argv[index + 1]) args.headless = argv[++index] !== "false";
    else if (value === "--cidade" && argv[index + 1]) args.cidade = String(argv[++index]).trim();
    else if (value === "--estado" && argv[index + 1]) args.estado = String(argv[++index]).trim().toUpperCase();
    else if (value === "--delay-ms" && argv[index + 1]) {
      args.delayMs = Math.max(1200, Number(argv[++index]) || 1800);
    }
  }
  return args;
}

function parseMapsCoordinates(link) {
  let decoded = String(link || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Mantém o link original quando houver '%' literal.
  }
  for (const pattern of [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ]) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ) {
      return { latitude, longitude };
    }
  }
  return null;
}

async function loadQueue(supabase, args) {
  const rows = [];
  const pageSize = 500;
  let offset = 0;
  const target = args.all ? Number.POSITIVE_INFINITY : args.limit;

  while (rows.length < target) {
    let query = supabase
      .from(TABLE)
      .select("id, nome, endereco, cidade, estado, link_maps")
      .eq("tipo", "terreiro")
      .is("latitude", null)
      .not("link_maps", "is", null)
      .order("cidade", { ascending: true })
      .order("nome", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (args.cidade) query = query.ilike("cidade", args.cidade);
    if (args.estado) query = query.ilike("estado", args.estado);
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows.slice(0, target);
}

async function navigateAndExtract(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 14_000 });
  } catch {
    // A URL costuma receber as coordenadas antes de todos os scripts do Maps terminarem.
  }
  const currentUrl = page.url();
  const fromUrl =
    /\/maps\/place\//i.test(currentUrl) || /[?&]query_place_id=/i.test(currentUrl)
      ? parseMapsCoordinates(currentUrl)
      : null;
  if (fromUrl) return fromUrl;
  const hrefs = await page
    .locator('a[href*="/maps/place/"]')
    .evaluateAll((anchors) => anchors.slice(0, 8).map((anchor) => anchor.href))
    .catch(() => []);
  for (const href of hrefs) {
    const coordinates = parseMapsCoordinates(href);
    if (coordinates) return coordinates;
  }
  return null;
}

async function resolveCoordinates(page, row) {
  const link = String(row.link_maps || "");
  const fromStoredLink = parseMapsCoordinates(link);
  if (fromStoredLink) return fromStoredLink;
  return navigateAndExtract(page, link);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Faltam SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const queue = await loadQueue(supabase, args);
  console.log(`[coordinates] ${queue.length} registro(s) nesta execução.`);
  if (queue.length === 0) return;

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 800 },
  });
  await context.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "media" || type === "font") {
      await route.abort();
    } else {
      await route.continue();
    }
  });
  const page = await context.newPage();
  const stats = { updated: 0, unresolved: 0, errors: 0 };

  try {
    for (let index = 0; index < queue.length; index += 1) {
      const row = queue[index];
      try {
        const coordinates = await resolveCoordinates(page, row);
        if (!coordinates) {
          stats.unresolved += 1;
          console.log(`[${index + 1}/${queue.length}] sem coordenada: ${row.nome}`);
        } else if (args.dryRun) {
          stats.updated += 1;
          console.log(`[${index + 1}/${queue.length}] dry-run: ${row.nome}`, coordinates);
        } else {
          const { error } = await supabase
            .from(TABLE)
            .update({
              ...coordinates,
              coordinate_source: "google_maps_url",
              coordinates_updated_at: new Date().toISOString(),
            })
            .eq("id", row.id)
            .is("latitude", null);
          if (error) throw error;
          stats.updated += 1;
          console.log(`[${index + 1}/${queue.length}] atualizado: ${row.nome}`);
        }
      } catch (error) {
        stats.errors += 1;
        console.warn(
          `[${index + 1}/${queue.length}] erro em ${row.nome}:`,
          error instanceof Error ? error.message : error,
        );
      }
      await page.waitForTimeout(args.delayMs + Math.floor(Math.random() * 900));
    }
  } finally {
    await browser.close();
  }

  console.log("[coordinates] resumo", stats);
}

main().catch((error) => {
  console.error("[coordinates]", error instanceof Error ? error.message : error);
  process.exit(1);
});
