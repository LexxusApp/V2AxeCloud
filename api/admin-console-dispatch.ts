/**
 * Rotas mutáveis do console admin (POST/PATCH/DELETE) sem carregar api/index.ts.
 * O path original chega em ?target= (ver rewrites no vercel.json).
 */
import express from "express";
import { registerAdminConsoleRoutes } from "./admin-console-routes.js";
import { applyDiscreteRouteCors } from "./lib/corsOrigins.js";
import { getAdminConsoleRouteDeps } from "./lib/getAdminConsoleDeps.js";

let appPromise: Promise<express.Express> | null = null;

async function getApp(): Promise<express.Express> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
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
  return appPromise;
}

function restoreOriginalUrl(req: any): void {
  const target = String(req.query?.target || req.query?.path || "").trim().replace(/^\/+/, "");
  if (!target) return;
  const rawUrl = String(req.url || "");
  const qIndex = rawUrl.indexOf("?");
  const qs = qIndex >= 0 ? rawUrl.slice(qIndex) : "";
  const base = `/api/admin-console/${target}`;
  const cleanedQs = qs
    ? "?" +
      new URLSearchParams(
        [...new URLSearchParams(qs.replace(/^\?/, ""))].filter(([k]) => k !== "target" && k !== "path")
      ).toString()
    : "";
  req.url = `${base}${cleanedQs}`;
}

export default async function handler(req: any, res: any) {
  if (applyDiscreteRouteCors(req, res)) return;
  restoreOriginalUrl(req);
  const app = await getApp();
  return app(req, res);
}
