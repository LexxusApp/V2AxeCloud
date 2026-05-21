/**
 * Console admin: session + overview/activity/audit/r2 + demais rotas (dispatch).
 */
import express from "express";
import { registerAdminConsoleRoutes } from "./admin-console-routes.js";
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { requireConsoleAdminDiscrete } from "./lib/adminConsoleAuth.js";
import {
  handleAdminActivity,
  handleAdminAuditLogs,
  handleAdminOverview,
} from "./lib/adminConsoleHandlers.js";
import { handleAdminR2Usage } from "./lib/adminConsoleR2.js";
import { getAdminConsoleRouteDeps } from "./lib/getAdminConsoleDeps.js";
import { getDiscreteR2Client } from "./lib/r2ClientDiscrete.js";
import { getDiscreteSupabaseAdmin, parseQuery, sendJson } from "./lib/discreteSupabase.js";
import { restoreReqUrl } from "./lib/restoreReqUrl.js";
import { verifyUser } from "./lib/verifyUser.js";
import { getConsoleAdminEmailAllowlist, isConsoleGlobalAdmin } from "./lib/consoleAdmin.js";

let dispatchAppPromise: Promise<express.Express> | null = null;

async function getDispatchApp(): Promise<express.Express> {
  if (dispatchAppPromise) return dispatchAppPromise;
  dispatchAppPromise = (async () => {
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    const deps = getAdminConsoleRouteDeps();
    if (!deps) {
      app.use((_req, res) => {
        res.status(503).json({ error: "Supabase não configurado na função da Vercel." });
      });
      return app;
    }
    registerAdminConsoleRoutes(app, deps);
    return app;
  })();
  return dispatchAppPromise;
}

async function handleSession(req: any, res: any): Promise<boolean> {
  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    sendJson(res, 503, { error: "Supabase não configurado na função da Vercel" });
    return true;
  }
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) {
    sendJson(res, 401, { error: "Não autorizado" });
    return true;
  }
  const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
  const { user, error: authError } = await verifyUser(sb, token);
  if (authError || !user) {
    sendJson(res, 401, { error: "Sessão inválida" });
    return true;
  }
  const ok = await isConsoleGlobalAdmin(sb, user);
  if (!ok) {
    const allow = getConsoleAdminEmailAllowlist();
    const userEmail = String(user.email || "")
      .trim()
      .toLowerCase();
    sendJson(res, 403, {
      error: "Acesso negado ao console administrativo",
      debug: {
        userEmail,
        allowlistCount: allow.length,
        hint: !allow.includes(userEmail)
          ? `O email "${userEmail}" não está na allowlist do servidor.`
          : "Perfil admin global ausente em perfil_lider.",
      },
    });
    return true;
  }
  sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email } });
  return true;
}

async function handleGatewayGet(route: string, req: any, res: any): Promise<boolean> {
  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
    return true;
  }
  const ctx = await requireConsoleAdminDiscrete(sb, req, res);
  if (!ctx) return true;

  try {
    switch (route) {
      case "overview":
        sendJson(res, 200, await handleAdminOverview(sb));
        return true;
      case "activity":
        sendJson(res, 200, await handleAdminActivity(sb));
        return true;
      case "audit-logs":
        sendJson(res, 200, await handleAdminAuditLogs(sb, parseQuery(req)));
        return true;
      case "r2-usage": {
        const r2 = getDiscreteR2Client();
        if (!r2) {
          sendJson(res, 200, {
            configured: false,
            message:
              "R2 não configurado (R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
          });
          return true;
        }
        const cap = Math.min(50000, Math.max(500, Number(parseQuery(req).get("maxKeys") || 8000)));
        sendJson(res, 200, await handleAdminR2Usage(r2.client, r2.bucket, cap));
        return true;
      }
      default:
        return false;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin-console/gateway]", route, msg);
    sendJson(res, 500, { error: msg });
    return true;
  }
}

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const target = String(req.query?.target || req.query?.route || "")
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase();
  const method = String(req.method || "GET").toUpperCase();

  if (target === "session" && method === "GET") {
    await handleSession(req, res);
    return;
  }

  const gatewayRoutes = new Set(["overview", "activity", "audit-logs", "r2-usage"]);
  if (gatewayRoutes.has(target) && method === "GET") {
    await handleGatewayGet(target, req, res);
    return;
  }

  restoreReqUrl(req, "/api/admin-console");
  const app = await getDispatchApp();
  return app(req, res);
}
