/**
 * Rota isolada na Vercel — POST /api/admin/update-plans
 * (evita depender só do bundle api/index em deploys antigos)
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { isConsoleGlobalAdmin } from "../lib/consoleAdmin.js";
import { normalizePlansCatalog, savePlansCatalog } from "../lib/plansCatalog.js";

dotenv.config();

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  "https://axecloud.app",
  "https://www.axecloud.app",
  "https://axecloud-app.vercel.app",
  "https://v2-axe-cloud.vercel.app",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
]);
const VERCEL_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function applyCors(req: any, res: any): boolean {
  const origin = (req.headers && req.headers.origin) || "";
  const existingVary = res.getHeader && res.getHeader("Vary");
  const varyValue = existingVary
    ? Array.from(new Set(`${existingVary}, Origin`.split(/\s*,\s*/))).join(", ")
    : "Origin";
  res.setHeader("Vary", varyValue);
  const allowed =
    !!origin && (STATIC_ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_REGEX.test(origin));
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, apikey, X-Client-Info, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if ((req.method || "").toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyUser(supabaseAdmin: ReturnType<typeof createClient>, token: string) {
  return supabaseAdmin.auth.getUser(token);
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;

  if ((req.method || "").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Supabase não configurado no servidor." });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Não autorizado" });

  try {
    const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: authError } = await verifyUser(supabaseAdmin, token);
    const user = userData?.user;
    if (authError || !user) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    if (!(await isConsoleGlobalAdmin(supabaseAdmin, user))) {
      return res.status(403).json({ error: "Acesso restrito a administradores globais" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const plans = normalizePlansCatalog(body.plans);
    await savePlansCatalog(supabaseAdmin, plans);

    return res.status(200).json({ success: true, plans });
  } catch (err: any) {
    console.error("[admin/update-plans]", err?.message || err);
    return res.status(500).json({ error: err?.message || "Erro ao salvar planos" });
  }
}
