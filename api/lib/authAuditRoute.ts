import { applyDiscreteRouteCors } from "./corsOrigins.js";
import { createAuditLog, resolveTerreiroIdForUser } from "./createAuditLog.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./discreteSupabase.js";
import { verifyUser } from "./verifyUser.js";
import { consumeRateLimit } from "./rateLimit.js";

const CLIENT_ALLOWED_ACTIONS = new Set(["auth.login_success", "auth.login_failed"]);

export async function handleAuthAuditRoute(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "POST").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const rl = consumeRateLimit(req, { windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "audit" });
  if (!rl.allowed) {
    return sendJson(res, 429, { error: "Muitas tentativas de registro. Aguarde alguns minutos." });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}) || {};
    const action = String(body.action || "").trim();
    if (!CLIENT_ALLOWED_ACTIONS.has(action)) {
      return sendJson(res, 400, { error: "Ação de auditoria não permitida." });
    }

    const status = body.status === "success" ? "success" : "failed";
    let terreiroId = body.terreiroId != null ? String(body.terreiroId).trim() || null : null;
    const details: Record<string, unknown> = {
      ...(body.details && typeof body.details === "object" ? body.details : {}),
    };

    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    const token = authHeader ? String(authHeader).replace(/^Bearer\s+/i, "").trim() : "";

    if (action === "auth.login_success") {
      if (!token || token === "undefined" || token === "null") {
        return sendJson(res, 401, { error: "Autenticação obrigatória para login bem-sucedido." });
      }
      const { user, error: authError } = await verifyUser(sb, token);
      if (authError || !user?.id) {
        return sendJson(res, 401, { error: "Sessão inválida." });
      }
      details.userId = user.id;
      if (user.email) details.email = user.email;
      if (!terreiroId) terreiroId = await resolveTerreiroIdForUser(sb, user.id);
    } else {
      delete details.userId;
      if (details.email) {
        details.email = String(details.email).toLowerCase().trim().slice(0, 200);
      }
      if (token && token !== "undefined" && token !== "null") {
        const { user, error: authError } = await verifyUser(sb, token);
        if (!authError && user?.id && !terreiroId) {
          terreiroId = await resolveTerreiroIdForUser(sb, user.id);
        }
      }
    }

    void createAuditLog(sb, req, action, status, terreiroId, details);
    return sendJson(res, 200, { ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao registar auditoria";
    return sendJson(res, 500, { error: msg });
  }
}
