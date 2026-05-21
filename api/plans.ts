/**
 * GET /api/plans — catálogo em global_settings (id = plans), sem carregar api/index.ts.
 */
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./lib/discreteSupabase.js";
import { loadPlansCatalog } from "./lib/plansCatalog.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
  }

  try {
    const plans = await loadPlansCatalog(sb);
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, must-revalidate");
    return sendJson(res, 200, { success: true, plans });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar planos";
    console.error("[api/plans]", msg);
    return sendJson(res, 500, { error: msg });
  }
}
