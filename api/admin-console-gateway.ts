/**
 * Rotas leves do console admin (overview, activity, audit-logs) — sem api/index.ts.
 */
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { requireConsoleAdminDiscrete } from "./lib/adminConsoleAuth.js";
import {
  handleAdminActivity,
  handleAdminAuditLogs,
  handleAdminOverview,
} from "./lib/adminConsoleHandlers.js";
import { handleAdminR2Usage } from "./lib/adminConsoleR2.js";
import { getDiscreteR2Client } from "./lib/r2ClientDiscrete.js";
import { getDiscreteSupabaseAdmin, parseQuery, sendJson } from "./lib/discreteSupabase.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
  }

  const ctx = await requireConsoleAdminDiscrete(sb, req, res);
  if (!ctx) return;

  const route = String(req.query?.route || "").trim().toLowerCase();
  const path = String(req.url || "");
  const sub =
    route ||
    (path.includes("/overview")
      ? "overview"
      : path.includes("/activity")
        ? "activity"
        : path.includes("/audit-logs")
          ? "audit-logs"
          : path.includes("/r2-usage")
            ? "r2-usage"
            : "");

  try {
    switch (sub) {
      case "overview":
        return sendJson(res, 200, await handleAdminOverview(sb));
      case "activity":
        return sendJson(res, 200, await handleAdminActivity(sb));
      case "audit-logs":
        return sendJson(res, 200, await handleAdminAuditLogs(sb, parseQuery(req)));
      case "r2-usage": {
        const r2 = getDiscreteR2Client();
        if (!r2) {
          return sendJson(res, 200, {
            configured: false,
            message:
              "R2 não configurado (R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
          });
        }
        const cap = Math.min(50000, Math.max(500, Number(parseQuery(req).get("maxKeys") || 8000)));
        return sendJson(res, 200, await handleAdminR2Usage(r2.client, r2.bucket, cap));
      }
      default:
        return sendJson(res, 404, { error: "Rota admin-console não encontrada", route: sub });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin-console-gateway]", sub, msg);
    return sendJson(res, 500, { error: msg });
  }
}
