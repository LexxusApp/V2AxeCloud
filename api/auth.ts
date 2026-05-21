/**
 * Roteador único de autenticação: filho-login + audit-log.
 * URLs públicas preservadas via rewrites no vercel.json (?action=).
 */
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { handleAuthAuditRoute } from "./lib/authAuditRoute.js";
import { handleFilhoLoginRoute } from "./lib/filhoLoginRoute.js";
import { sendJson } from "./lib/discreteSupabase.js";

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;

  const action = String(req.query?.action || "")
    .trim()
    .toLowerCase();

  if (action === "filho-login") return handleFilhoLoginRoute(req, res);
  if (action === "audit-log") return handleAuthAuditRoute(req, res);

  return sendJson(res, 404, {
    error: "Rota de auth não encontrada",
    hint: "Use action=filho-login ou action=audit-log",
  });
}
