/**
 * Dados públicos/leves: tenant-info + plans.
 */
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { handlePlansRoute } from "./lib/plansRoute.js";
import { handleTenantInfoRoute } from "./lib/tenantInfoRoute.js";
import { sendJson } from "./lib/discreteSupabase.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const route = String(req.query?.route || "")
    .trim()
    .toLowerCase();

  if (route === "tenant-info") return handleTenantInfoRoute(req, res);
  if (route === "plans") return handlePlansRoute(req, res);

  return sendJson(res, 404, { error: "Rota pública não encontrada", hint: "route=tenant-info|plans" });
}
