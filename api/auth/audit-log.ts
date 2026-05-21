import { applyDiscreteRouteCors } from "../lib/corsOrigins.js";
import { createAuditLog, resolveTerreiroIdForUser } from "../lib/createAuditLog.js";
import { getDiscreteSupabaseAdmin, sendJson } from "../lib/discreteSupabase.js";
import { verifyUser } from "../lib/verifyUser.js";

const CLIENT_ALLOWED_ACTIONS = new Set(["auth.login_success", "auth.login_failed"]);

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "POST").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
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
    if (authHeader) {
      const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
      if (token && token !== "undefined" && token !== "null") {
        const { user, error: authError } = await verifyUser(sb, token);
        if (!authError && user?.id) {
          details.userId = user.id;
          if (user.email) details.email = user.email;
          if (!terreiroId) terreiroId = await resolveTerreiroIdForUser(sb, user.id);
        }
      }
    }

    if (action === "auth.login_failed" && details.email) {
      details.email = String(details.email).toLowerCase().trim().slice(0, 200);
    }

    void createAuditLog(sb, req, action, status, terreiroId, details);
    return sendJson(res, 200, { ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao registar auditoria";
    return sendJson(res, 500, { error: msg });
  }
}
