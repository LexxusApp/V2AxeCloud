/**
 * Rota isolada na Vercel — POST /api/admin/update-plans
 * (evita depender só do bundle api/index em deploys antigos)
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { isConsoleGlobalAdmin } from "../lib/consoleAdmin.js";
import { normalizePlansCatalog, savePlansCatalog } from "../lib/plansCatalog.js";

import { applyDiscreteRouteCors } from "../lib/corsOrigins.js";

dotenv.config();

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
  if (applyDiscreteRouteCors(req, res)) return;

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
