/**
 * Cron jobs: ping-evolution, audit-tick.
 */
import { pingEvolutionApi } from "../src/services/evolution.service.js";
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { handleAuditTick } from "./lib/audit/cronTick.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./lib/discreteSupabase.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const job = String(req.query?.job || "")
    .trim()
    .toLowerCase();
  const method = String(req.method || "GET").toUpperCase();

  if (job === "ping-evolution" && method === "GET") {
    try {
      await pingEvolutionApi();
    } catch (error) {
      console.error("[CRON] Erro ao pingar Evolution API:", error);
    }
    return sendJson(res, 200, { pinged: true });
  }

  if (job === "audit-tick") {
    const sb = getDiscreteSupabaseAdmin();
    if (!sb) return sendJson(res, 503, { error: "Supabase não configurado." });
    return handleAuditTick(req, res, sb);
  }

  return sendJson(res, 404, { error: "Cron job não encontrado", hint: "job=ping-evolution|audit-tick" });
}
