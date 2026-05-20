import type { Express, Request, Response } from "express";
import { createAuditLog, resolveTerreiroIdForUser } from "./createAuditLog.js";

type VerifyUser = (token: string) => Promise<{ user: any; error: any }>;

const CLIENT_ALLOWED_ACTIONS = new Set(["auth.login_success", "auth.login_failed"]);

export type AuthAuditRouteDeps = {
  supabaseAdmin: { from: (t: string) => any };
  verifyUser: VerifyUser;
};

/**
 * POST /api/auth/audit-log — chamado pelo app e pelo painel admin após tentativa de login (Supabase Auth no cliente).
 */
export function registerAuthAuditRoutes(app: Express, deps: AuthAuditRouteDeps) {
  app.post("/api/auth/audit-log", async (req: Request, res: Response) => {
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

      const authHeader = req.headers.authorization;
      if (authHeader) {
        const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
        if (token && token !== "undefined" && token !== "null") {
          const { user, error: authError } = await deps.verifyUser(token);
          if (!authError && user?.id) {
            details.userId = user.id;
            if (user.email) details.email = user.email;
            if (!terreiroId) terreiroId = await resolveTerreiroIdForUser(deps.supabaseAdmin, user.id);
          }
        }
      }

      if (action === "auth.login_failed" && details.email) {
        details.email = String(details.email).toLowerCase().trim().slice(0, 200);
      }

      void createAuditLog(deps.supabaseAdmin, req, action, status, terreiroId, details);
      return res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao registar auditoria";
      return res.status(500).json({ error: msg });
    }
  });
}
