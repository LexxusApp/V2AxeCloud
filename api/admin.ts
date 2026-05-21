/**
 * Admin global: tenants, manage-tenant, create-tenant, update-plans.
 */
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { isConsoleGlobalAdmin } from "./lib/consoleAdmin.js";
import { runCreateTenant } from "./lib/adminCreateTenant.js";
import { runManageTenant } from "./lib/adminManageTenant.js";
import { handleAdminTenants } from "./lib/adminConsoleHandlers.js";
import { normalizePlansCatalog, savePlansCatalog } from "./lib/plansCatalog.js";
import { getDiscreteR2Client } from "./lib/r2ClientDiscrete.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./lib/discreteSupabase.js";
import { verifyUser } from "./lib/verifyUser.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const action = String(req.query?.action || "")
    .trim()
    .toLowerCase();
  const method = String(req.method || "GET").toUpperCase();

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });

  if (action === "tenants" && method === "GET") {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader) return sendJson(res, 401, { error: "Não autorizado" });
    try {
      const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
      const { user, error: authError } = await verifyUser(sb, token);
      if (authError || !user) return sendJson(res, 401, { error: "Sessão inválida" });
      if (!(await isConsoleGlobalAdmin(sb, user))) {
        return sendJson(res, 403, { error: "Acesso restrito a administradores globais" });
      }
      return sendJson(res, 200, await handleAdminTenants(sb));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro interno";
      console.error("[admin/tenants]", msg);
      return sendJson(res, 500, { error: msg });
    }
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) return sendJson(res, 401, { error: "Não autorizado" });

  try {
    const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const { user, error: authError } = await verifyUser(sb, token);
    if (authError || !user) return sendJson(res, 401, { error: "Sessão inválida" });
    if (!(await isConsoleGlobalAdmin(sb, user))) {
      return sendJson(res, 403, { error: "Acesso restrito a administradores globais" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (action === "manage-tenant" && method === "POST") {
      const r2 = getDiscreteR2Client();
      const out = await runManageTenant(sb, user, req, body, r2 ?? undefined);
      return sendJson(res, out.status, out.body);
    }

    if (action === "create-tenant" && method === "POST") {
      const out = await runCreateTenant(sb, user, req, body);
      return sendJson(res, out.status, out.body);
    }

    if (action === "update-plans" && method === "POST") {
      const plans = normalizePlansCatalog(body.plans);
      await savePlansCatalog(sb, plans);
      return sendJson(res, 200, { success: true, plans });
    }

    return sendJson(res, 404, { error: "Ação admin não encontrada", action });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin]", action, msg);
    return sendJson(res, 500, { error: msg });
  }
}
