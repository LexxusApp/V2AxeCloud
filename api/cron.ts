/**
 * Cron jobs: ping-evolution, audit-tick.
 *
 * ping-evolution usa apenas fetch nativo (sem evolution.service nem audit/whois)
 * para evitar FUNCTION_INVOCATION_FAILED por módulos ES problemáticos no bundle.
 */
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./lib/discreteSupabase.js";
import { secureCompare } from "./lib/secureCompare.js";
import { safeErrorMessage } from "./lib/safeError.js";

const EVOLUTION_PING_TIMEOUT_MS = 15_000;

function evolutionPingUrl(): string {
  const raw = String(process.env.EVOLUTION_API_BASE_URL || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.endsWith("/") ? withProtocol : `${withProtocol}/`;
}

function evolutionPingApiKey(): string {
  return String(process.env.EVOLUTION_API_KEY || "").trim();
}

async function pingEvolutionCron(): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EVOLUTION_PING_TIMEOUT_MS);
  try {
    const response = await fetch(evolutionPingUrl(), {
      method: "GET",
      headers: { apikey: evolutionPingApiKey() },
      signal: controller.signal,
    });
    return { ok: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CRON] Erro ao pingar Evolution API:", message);
    return { ok: false, error: "Falha no ping" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const job = String(req.query?.job || "")
    .trim()
    .toLowerCase();
  const method = String(req.method || "GET").toUpperCase();

  if (job === "ping-evolution" && method === "GET") {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    if (!cronSecret || !secureCompare(authHeader, cronSecret)) {
      return sendJson(res, 401, { error: "Não autorizado" });
    }
    try {
      const evolution = await pingEvolutionCron();
      return sendJson(res, 200, { pinged: true, evolution });
    } catch (error) {
      console.error("[CRON] Falha inesperada no ping-evolution:", error);
      return sendJson(res, 200, { pinged: true, evolution: { ok: false, error: "Falha no ping" } });
    }
  }

  if (job === "audit-tick") {
    const sb = getDiscreteSupabaseAdmin();
    if (!sb) return sendJson(res, 503, { error: "Supabase não configurado." });
    const { handleAuditTick } = await import("./lib/audit/cronTick.js");
    return handleAuditTick(req, res, sb);
  }

  if (job === "whatsapp-jobs" && method === "GET") {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    if (!cronSecret || !secureCompare(authHeader, cronSecret)) {
      return sendJson(res, 401, { error: "Não autorizado" });
    }
    const sb = getDiscreteSupabaseAdmin();
    if (!sb) return sendJson(res, 503, { error: "Supabase não configurado." });
    try {
      const { runWhatsAppCronJobs } = await import("./lib/cronWhatsAppJobs.js");
      const result = await runWhatsAppCronJobs(sb);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      console.error("[CRON] whatsapp-jobs:", error);
      return sendJson(res, 500, { error: safeErrorMessage(error, "Erro ao executar jobs WhatsApp") });
    }
  }

  return sendJson(res, 404, { error: "Cron job não encontrado", hint: "job=ping-evolution|whatsapp-jobs|audit-tick" });
}
