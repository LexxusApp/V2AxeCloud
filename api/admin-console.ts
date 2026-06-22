/**
 * Console admin (leve): session + overview/activity/audit/r2.
 * Rotas pesadas (WhatsApp, audit scan, etc.) carregam admin-console-routes só no dispatch.
 */
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
import { isConsoleGlobalAdmin } from "./lib/consoleAdmin.js";
import {
  runTenantDetail,
  runTenantResetPassword,
  runTenantSetRole,
} from "./lib/adminTenantHandlers.js";

type ExpressApp = import("express").Express;

const TENANT_PATH_RE = /^tenant\/([^/]+)(?:\/(set-role|reset-password))?$/;

function parseBody(req: any): Record<string, unknown> {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}) || {};
}

async function handleTenantRoutes(target: string, method: string, req: any, res: any): Promise<boolean> {
  const m = target.match(TENANT_PATH_RE);
  if (!m) return false;

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
    return true;
  }

  const ctx = await requireConsoleAdminDiscrete(sb, req, res);
  if (!ctx) return true;

  const tenantId = m[1];
  const sub = m[2];
  const r2 = getDiscreteR2Client();

  try {
    if (!sub && method === "GET") {
      sendJson(res, 200, await runTenantDetail(sb, r2, tenantId));
      return true;
    }
    if (sub === "set-role" && method === "POST") {
      sendJson(res, 200, await runTenantSetRole(sb, ctx.user, req, tenantId, parseBody(req) as { role?: string }));
      return true;
    }
    if (sub === "reset-password" && method === "POST") {
      sendJson(res, 200, await runTenantResetPassword(sb, ctx.user, req, tenantId));
      return true;
    }
    sendJson(res, 405, { error: "Método não permitido para este terreiro" });
    return true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao processar terreiro";
    console.error("[admin-console/tenant]", sub || "detail", msg);
    sendJson(res, 500, { error: msg });
    return true;
  }
}

let dispatchAppPromise: Promise<ExpressApp> | null = null;

async function getDispatchApp(): Promise<ExpressApp> {
  if (dispatchAppPromise) return dispatchAppPromise;
  dispatchAppPromise = (async () => {
    const express = (await import("express")).default;
    const { registerAdminConsoleRoutes } = await import("./admin-console-routes.js");
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

async function handleSession(req: any, res: any): Promise<void> {
  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    sendJson(res, 503, { error: "Supabase não configurado na função da Vercel" });
    return;
  }
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) {
    sendJson(res, 401, { error: "Não autorizado" });
    return;
  }
  const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
  const { user, error: authError } = await verifyUser(sb, token);
  if (authError || !user) {
    sendJson(res, 401, { error: "Sessão inválida" });
    return;
  }
  const ok = await isConsoleGlobalAdmin(sb, user);
  if (!ok) {
    sendJson(res, 403, { error: "Acesso negado ao console administrativo" });
    return;
  }
  sendJson(res, 200, { ok: true, user: { id: user.id, email: user.email } });
}

async function handleGatewayGet(route: string, req: any, res: any): Promise<void> {
  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
    return;
  }
  const ctx = await requireConsoleAdminDiscrete(sb, req, res);
  if (!ctx) return;

  try {
    switch (route) {
      case "overview":
        sendJson(res, 200, await handleAdminOverview(sb));
        return;
      case "activity":
        sendJson(res, 200, await handleAdminActivity(sb));
        return;
      case "audit-logs":
        sendJson(res, 200, await handleAdminAuditLogs(sb, parseQuery(req)));
        return;
      case "r2-usage": {
        const r2 = getDiscreteR2Client();
        if (!r2) {
          sendJson(res, 200, {
            configured: false,
            message:
              "R2 não configurado (R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).",
          });
          return;
        }
        const cap = Math.min(50000, Math.max(500, Number(parseQuery(req).get("maxKeys") || 8000)));
        sendJson(res, 200, await handleAdminR2Usage(r2.client, r2.bucket, cap));
        return;
      }
      default:
        sendJson(res, 404, { error: "Rota do console não encontrada", route });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin-console/gateway]", route, msg);
    sendJson(res, 500, { error: msg });
  }
}

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  try {
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

    if (await handleTenantRoutes(target, method, req, res)) return;

    restoreReqUrl(req, "/api/admin-console");
    const app = await getDispatchApp();
    return app(req, res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin-console] fatal:", msg);
    sendJson(res, 500, { error: msg });
  }
}
