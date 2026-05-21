/**
 * Rota leve para Vercel — valida sessão do console admin sem carregar api/index.ts.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { applyDiscreteRouteCors } from "../lib/corsOrigins.js";
import { getConsoleAdminEmailAllowlist, isConsoleGlobalAdmin } from "../lib/consoleAdmin.js";
import { verifyUser } from "../lib/verifyUser.js";

dotenv.config();

const viteEnv = (import.meta as any).env || {};

function getServerEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key] || viteEnv[key];
    if (value) return value;
  }
  return undefined;
}

const SUPABASE_URL = getServerEnv("VITE_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getServerEnv(
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_SERVICE_KEY"
);

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function sendJson(res: any, status: number, body: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return sendJson(res, 503, {
      error: "Supabase não configurado na função da Vercel",
      missing: { supabaseUrl: !SUPABASE_URL, supabaseKey: !SUPABASE_SERVICE_ROLE_KEY },
    });
  }

  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) {
    return sendJson(res, 401, { error: "Não autorizado" });
  }

  const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
  const { user, error: authError } = await verifyUser(supabaseAdmin, token);
  if (authError || !user) {
    return sendJson(res, 401, {
      error: "Sessão inválida",
      details: authError?.message ? String(authError.message).slice(0, 200) : undefined,
    });
  }

  const ok = await isConsoleGlobalAdmin(supabaseAdmin, user);
  if (!ok) {
    const allow = getConsoleAdminEmailAllowlist();
    const userEmail = String(user.email || "")
      .trim()
      .toLowerCase();
    return sendJson(res, 403, {
      error: "Acesso negado ao console administrativo",
      debug: {
        userEmail,
        allowlistCount: allow.length,
        allowlistSample: allow.slice(0, 3),
        hint: !allow.includes(userEmail)
          ? `O email "${userEmail}" não está na allowlist do servidor. Contacte o suporte.`
          : "Perfil admin global ausente em perfil_lider — tente sair e entrar de novo.",
      },
    });
  }

  return sendJson(res, 200, {
    ok: true,
    user: { id: user.id, email: user.email },
  });
}
