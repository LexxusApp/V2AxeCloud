/**
 * GET /api/plans — catálogo em global_settings (id = plans).
 */
import { applyDiscreteRouteCors } from "./corsOrigins.js";
import { getDiscreteSupabaseAdmin, sendJson } from "./discreteSupabase.js";
import { loadPlansCatalogWithMeta, PLANS_CATALOG_DEFAULT } from "./plansCatalog.js";
import { getSupabaseProjectRef, getSupabaseServerUrl } from "./supabaseServerEnv.js";
import { safeErrorMessage } from "./safeError.js";

export async function handlePlansRoute(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const sb = getDiscreteSupabaseAdmin();
  if (!sb) {
    return sendJson(res, 503, {
      error: "Supabase não configurado na função da Vercel.",
      hint: "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no projeto Vercel (Settings → Environment Variables).",
    });
  }

  try {
    const loaded = await loadPlansCatalogWithMeta(sb);
    if (!loaded.fromDatabase) {
      console.warn(
        "[api/plans] global_settings.plans ausente ou ilegível — usando fallback. project=",
        getSupabaseProjectRef() || "?"
      );
    }

    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, must-revalidate");
    return sendJson(res, 200, {
      success: true,
      plans: loaded.plans,
      meta: {
        fromDatabase: loaded.fromDatabase,
        updatedAt: loaded.updatedAt,
        projectRef: getSupabaseProjectRef(getSupabaseServerUrl()),
        premiumPrice: loaded.plans.premium?.price ?? PLANS_CATALOG_DEFAULT.premium.price,
      },
    });
  } catch (e: unknown) {
    return sendJson(res, 500, { error: safeErrorMessage(e, "Erro ao buscar planos") });
  }
}
