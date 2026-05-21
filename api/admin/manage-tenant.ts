import { applyDiscreteRouteCors } from "../lib/corsOrigins.js";
import { isConsoleGlobalAdmin } from "../lib/consoleAdmin.js";
import { runManageTenant } from "../lib/adminManageTenant.js";
import { getDiscreteR2Client } from "../lib/r2ClientDiscrete.js";
import { getDiscreteSupabaseAdmin, sendJson } from "../lib/discreteSupabase.js";
import { verifyUser } from "../lib/verifyUser.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "POST").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Não autorizado" });

  try {
    const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const { user, error: authError } = await verifyUser(sb, token);
    if (authError || !user) return sendJson(res, 401, { error: "Sessão inválida" });
    if (!(await isConsoleGlobalAdmin(sb, user))) {
      return sendJson(res, 403, { error: "Acesso restrito a administradores globais" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}) || {};
    const r2 = getDiscreteR2Client();
    const out = await runManageTenant(sb, user, req, body, r2 ?? undefined);
    return sendJson(res, out.status, out.body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin/manage-tenant]", msg);
    return sendJson(res, 500, { error: msg });
  }
}
