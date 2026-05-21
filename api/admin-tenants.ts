import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { requireConsoleAdminDiscrete } from "./lib/adminConsoleAuth.js";
import { handleAdminTenants } from "./lib/adminConsoleHandlers.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./lib/discreteSupabase.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, { error: "Supabase não configurado na função da Vercel." });
  }

  const ctx = await requireConsoleAdminDiscrete(sb, req, res);
  if (!ctx) return;

  try {
    const data = await handleAdminTenants(sb);
    return sendJson(res, 200, data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[admin-tenants]", msg);
    return sendJson(res, 500, { error: msg });
  }
}
