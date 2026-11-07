import puppeteer from "@cloudflare/puppeteer";
import { createClient } from "@supabase/supabase-js";
import { WorkflowEntrypoint, type WorkflowStep, type WorkflowEvent } from "cloudflare:workers";

export interface Env {
  MYBROWSER: any;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PHOTO_SWEEP_WORKFLOW?: any;
}

const TABLE = "terreiros_diretorio";
const STORAGE_BUCKET = "perfil_fotos";

interface TerreiroItem {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  link_maps: string | null;
  foto_url?: string | null;
  owner_photo_url?: string | null;
  updated_at?: string;
}

function cleanGooglePhotoUrl(raw: string | null): string | null {
  if (!raw) return null;
  const url = String(raw).trim();
  if (url.includes("streetviewpixels")) {
    const panoidMatch = url.match(/panoid=([a-zA-Z0-9_\-]+)/);
    if (panoidMatch) {
      return `https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=1200&h=800&pitch=0&panoid=${panoidMatch[1]}`;
    }
    return url;
  }
  const base = url.split("=")[0];
  return `${base}=w1200-h900-k-no`;
}

function pickBestPhoto(urls: string[]): string | null {
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

function getBestTargetUrl(item: TerreiroItem): string {
  const link = item.link_maps || "";
  // Só usa link direto se já tiver o Place ID ou data específico do local
  const hasPlaceData = link.includes("data=!") || link.includes("!1s0x") || link.includes("!3d");

  if (link && hasPlaceData) {
    return link;
  }

  // Caso contrário, busca por Nome + Cidade + Estado no Maps para abrir o card
  const query = `${item.nome || ""} ${item.cidade || ""} ${item.estado || ""}`.trim();
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

async function uploadToStorage(sb: any, id: string, photoUrl: string): Promise<string> {
  const res = await fetch(photoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Referer: "https://www.google.com/",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao baixar foto`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength < 3500) {
    throw new Error(`Imagem muito pequena (${buf.byteLength} bytes)`);
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
 * Coleta fotos de um terreiro usando a aba do navegador no Cloudflare
 */
async function scrapeOne(page: any, item: TerreiroItem): Promise<string | null> {
  const targetUrl = getBestTargetUrl(item);
  const collectedUrls: string[] = [];

  const onResponse = (res: any) => {
    try {
      const u = res.url();
      if (
        (u.includes("googleusercontent.com") || u.includes("streetviewpixels")) &&
        !u.includes("default-user") &&
        !/\/a[-/]/.test(u)
      ) {
        collectedUrls.push(u);
      }
    } catch {}
  };

  page.on("response", onResponse);

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Aceita consentimento de cookies se aparecer
    try {
      const consentBtn = await page.$('button[aria-label*="Aceitar"], button[aria-label*="Accept"], form[action*="consent"] button');
      if (consentBtn) {
        await consentBtn.click();
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch {}

    // Se estiver em lista de múltiplos resultados de busca, clica no primeiro card
    if (page.url().includes("/maps/search/")) {
      try {
        const firstCard = await page.$('a[href*="/maps/place/"]');
        if (firstCard) {
          await firstCard.click();
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch {}
    }

    // Aguarda carregar qualquer imagem principal por até 2.5 segundos
    try {
      await page.waitForSelector('img[src*="googleusercontent.com"], img[src*="streetviewpixels"]', { timeout: 2500 });
    } catch {}

    // Coleta imagens presentes no DOM
    const domUrls: string[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).map((i) => i.src);
    }).catch(() => []);

    domUrls.forEach((u) => collectedUrls.push(u));

    return pickBestPhoto(collectedUrls);
  } finally {
    page.off("response", onResponse);
    // Limpa página
    await page.goto("about:blank").catch(() => {});
  }
}

/**
 * Processa um lote de terreiros sem foto
 */
export async function runBatch(env: Env, batchSize = 5, dryRun = false) {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const start = Date.now();

  // 1. Busca pendentes: primeiro com link_maps, depois sem link_maps
  // Ordena por updated_at ascendente para que os terreiros já checados fiquem no fim da fila
  let { data: items, error: pErr } = await sb
    .from(TABLE)
    .select("id, nome, cidade, estado, link_maps, foto_url, owner_photo_url, updated_at")
    .eq("tipo", "terreiro")
    .is("owner_photo_url", null)
    .not("link_maps", "is", null)
    .order("updated_at", { ascending: true })
    .limit(batchSize);

  if (pErr) {
    throw new Error(`Erro buscando pendentes: ${pErr.message}`);
  }

  if (!items || items.length === 0) {
    // Se acabaram os com link_maps, pega os sem link_maps
    const { data: noLinkItems, error: nlErr } = await sb
      .from(TABLE)
      .select("id, nome, cidade, estado, link_maps, foto_url, owner_photo_url, updated_at")
      .eq("tipo", "terreiro")
      .is("owner_photo_url", null)
      .is("link_maps", null)
      .order("updated_at", { ascending: true })
      .limit(batchSize);

    if (nlErr) throw new Error(`Erro buscando sem link: ${nlErr.message}`);
    items = noLinkItems || [];
  }

  if (items.length === 0) {
    return {
      ok: true,
      finished: true,
      message: "Nenhum terreiro pendente encontrado. Varredura 100% concluída!",
      processed: 0,
      added: 0,
      notFound: 0,
      errors: 0,
      durationMs: Date.now() - start,
    };
  }

  let browser: any = null;
  const results: Array<{ id: string; nome: string; status: string; photo?: string | null; error?: string }> = [];
  let added = 0;
  let notFound = 0;
  let errors = 0;

  try {
    browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    for (const item of items) {
      try {
        const bestPhoto = await scrapeOne(page, item);

        if (bestPhoto) {
          let storageUrl: string | null = null;
          if (!dryRun) {
            try {
              storageUrl = await uploadToStorage(sb, item.id, bestPhoto);
            } catch (stErr: any) {
              console.warn(`[storage retry] ${item.nome}: ${stErr.message}`);
            }

            await sb
              .from(TABLE)
              .update({
                foto_url: bestPhoto,
                owner_photo_url: storageUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);
          }

          added++;
          results.push({ id: item.id, nome: item.nome, status: "added", photo: storageUrl || bestPhoto });
        } else {
          // Marca updated_at para mover para o fim da fila
          if (!dryRun) {
            await sb
              .from(TABLE)
              .update({ updated_at: new Date().toISOString() })
              .eq("id", item.id);
          }

          notFound++;
          results.push({ id: item.id, nome: item.nome, status: "not_found" });
        }
      } catch (itemErr: any) {
        errors++;
        results.push({ id: item.id, nome: item.nome, status: "error", error: itemErr.message });
        if (!dryRun) {
          await sb
            .from(TABLE)
            .update({ updated_at: new Date().toISOString() })
            .eq("id", item.id)
            .catch(() => {});
        }
      }
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return {
    ok: true,
    finished: false,
    processed: items.length,
    added,
    notFound,
    errors,
    durationMs: Date.now() - start,
    results,
  };
}

/**
 * Cloudflare Workflow que executa múltiplos lotes autonomamente na nuvem
 */
export class PhotoSweepWorkflow extends WorkflowEntrypoint<Env, { batchSize?: number; maxBatches?: number }> {
  async run(event: WorkflowEvent<{ batchSize?: number; maxBatches?: number }>, step: WorkflowStep) {
    const batchSize = event.payload?.batchSize || 5;
    const maxBatches = event.payload?.maxBatches || 100;

    let totalProcessed = 0;
    let totalAdded = 0;

    for (let i = 1; i <= maxBatches; i++) {
      const res = await step.do(`sweep-batch-${i}`, async () => {
        return await runBatch(this.env, batchSize, false);
      });

      totalProcessed += res.processed || 0;
      totalAdded += res.added || 0;

      if (res.finished || res.processed === 0) {
        console.log(`[Workflow] Varredura finalizada na iteração ${i}.`);
        break;
      }

      await step.sleep(`pause-${i}`, "2 seconds");
    }

    return { ok: true, totalProcessed, totalAdded };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Status geral
    if (url.pathname === "/status") {
      const { count: total } = await sb
        .from(TABLE)
        .select("*", { count: "exact", head: true });
      const { count: withStoragePhoto } = await sb
        .from(TABLE)
        .select("*", { count: "exact", head: true })
        .not("owner_photo_url", "is", null);
      const { count: withFotoUrl } = await sb
        .from(TABLE)
        .select("*", { count: "exact", head: true })
        .not("foto_url", "is", null);
      const { count: pending } = await sb
        .from(TABLE)
        .select("*", { count: "exact", head: true })
        .eq("tipo", "terreiro")
        .is("owner_photo_url", null);

      return Response.json({
        ok: true,
        service: "axecloud-photo-sweep-cloudflare",
        time: new Date().toISOString(),
        stats: {
          totalTerreiros: total,
          comFotoStorage: withStoragePhoto,
          comFotoUrl: withFotoUrl,
          pendentesSemCopiaPermanente: pending,
        },
      });
    }

    // Dispara ou agenda workflow autônomo na Cloudflare
    if (url.pathname === "/start-workflow") {
      if (!env.PHOTO_SWEEP_WORKFLOW) {
        return Response.json({ ok: false, error: "Workflow binding não configurado neste ambiente" }, { status: 400 });
      }

      const instance = await env.PHOTO_SWEEP_WORKFLOW.create({
        params: {
          batchSize: 5,
          maxBatches: 200,
        },
      });

      return Response.json({
        ok: true,
        message: "Workflow de varredura disparado na nuvem da Cloudflare!",
        workflowInstanceId: instance.id,
      });
    }

    // Endpoint de execução de lote avulso
    if (url.pathname === "/sweep-batch") {
      const batchSize = Math.max(1, Math.min(10, parseInt(url.searchParams.get("batchSize") || "5", 10)));
      const dryRun = url.searchParams.get("dryRun") === "true";

      try {
        const batchResult = await runBatch(env, batchSize, dryRun);
        return Response.json(batchResult);
      } catch (err: any) {
        return Response.json({ ok: false, error: err.message, stack: err.stack }, { status: 500 });
      }
    }

    return Response.json({
      ok: true,
      service: "axecloud-photo-sweep",
      status: "running-on-cloudflare",
      browserAvailable: !!env.MYBROWSER,
      routes: ["/status", "/sweep-batch?batchSize=5", "/start-workflow"],
    });
  },

  // Cron disparado a cada 1 minuto pela Cloudflare
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[photo-sweep] Cron Cloudflare disparado em ${new Date().toISOString()}`);
    ctx.waitUntil(
      runBatch(env, 5, false)
        .then((res) => {
          console.log(`[photo-sweep cron] Lote processado: ${res.processed} itens, +${res.added} fotos em ${res.durationMs}ms`);
        })
        .catch((err) => {
          console.error(`[photo-sweep cron] Erro no lote: ${err.message}`);
        })
    );
  },
};
