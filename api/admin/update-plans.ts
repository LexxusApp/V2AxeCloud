/**
 * Rota isolada na Vercel — POST /api/admin/update-plans
 * (evita depender só do bundle api/index em deploys antigos)
 */
import { applyDiscreteRouteCors } from "../lib/corsOrigins.js";
import { isConsoleGlobalAdmin } from "../lib/consoleAdmin.js";
import { normalizePlansCatalog, savePlansCatalog } from "../lib/plansCatalog.js";
import { getDiscreteSupabaseAdmin, sendJson } from "../lib/discreteSupabase.js";
import { verifyUser } from "../lib/verifyUser.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "POST").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, { error: "Supabase não configurado no servidor." });
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Não autorizado" });

  try {
    const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const { user, error: authError } = await verifyUser(sb, token);
    if (authError || !user) {
      return sendJson(res, 401, { error: "Sessão inválida" });
    }

    if (!(await isConsoleGlobalAdmin(sb, user))) {
      return sendJson(res, 403, { error: "Acesso restrito a administradores globais" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const plans = normalizePlansCatalog(body.plans);
    await savePlansCatalog(sb, plans);

    return sendJson(res, 200, { success: true, plans });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar planos";
    console.error("[admin/update-plans]", msg);
    return sendJson(res, 500, { error: msg });
  }
}
