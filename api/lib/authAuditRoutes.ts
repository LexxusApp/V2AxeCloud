import type { Express, Request, Response } from "express";
import { createAuditLog, resolveTerreiroIdForUser } from "./createAuditLog.js";
import { getBearerToken } from "./requireAuth.js";
import { verifyUser } from "./verifyUser.js";
import { auditLogRateLimit } from "./rateLimit.js";
import { safeErrorMessage } from "./safeError.js";

type VerifyUserFn = (token: string) => Promise<{ user: any; error: any }>;

const CLIENT_ALLOWED_ACTIONS = new Set(["auth.login_success", "auth.login_failed"]);

export type AuthAuditRouteDeps = {
  supabaseAdmin: { from: (t: string) => any };
  /** @deprecated preferir verifyUser(supabaseAdmin, token) internamente */
  verifyUser?: VerifyUserFn;
};

/**
 * POST /api/auth/audit-log — chamado pelo app e pelo painel admin após tentativa de login (Supabase Auth no cliente).
 */
export function registerAuthAuditRoutes(app: Express, deps: AuthAuditRouteDeps) {
  app.post("/api/auth/audit-log", auditLogRateLimit, async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as {
        action?: string;
        status?: string;
        terreiroId?: string | null;
        details?: Record<string, unknown>;
      };

      const action = String(body.action || "").trim();
      if (!CLIENT_ALLOWED_ACTIONS.has(action)) {
        return res.status(400).json({ error: "Ação de auditoria não permitida." });
      }

      const status = body.status === "success" ? "success" : "failed";
      let terreiroId = body.terreiroId != null ? String(body.terreiroId).trim() || null : null;
      const details: Record<string, unknown> = {
        ...(body.details && typeof body.details === "object" ? body.details : {}),
      };

      const token = getBearerToken(req);
      const resolveUser = (t: string) =>
        deps.verifyUser
          ? deps.verifyUser(t)
          : verifyUser(deps.supabaseAdmin as any, t);

      if (action === "auth.login_success") {
        if (!token || token === "undefined" || token === "null") {
          return res.status(401).json({ error: "Autenticação obrigatória para login bem-sucedido." });
        }
        const { user, error: authError } = await resolveUser(token);
        if (authError || !user?.id) {
          return res.status(401).json({ error: "Sessão inválida." });
        }
        details.userId = user.id;
        if (user.email) details.email = user.email;
        if (!terreiroId) terreiroId = await resolveTerreiroIdForUser(deps.supabaseAdmin, user.id);
      } else {
        delete details.userId;
        if (details.email) {
          details.email = String(details.email).toLowerCase().trim().slice(0, 200);
        }
        if (token && token !== "undefined" && token !== "null") {
          const { user, error: authError } = await resolveUser(token);
          if (!authError && user?.id) {
            if (!terreiroId) terreiroId = await resolveTerreiroIdForUser(deps.supabaseAdmin, user.id);
          }
        }
      }

      void createAuditLog(deps.supabaseAdmin, req, action, status, terreiroId, details);
      return res.json({ ok: true });
    } catch (e: unknown) {
      return res.status(500).json({ error: safeErrorMessage(e, "Erro ao registar auditoria") });
    }
  });
}
