import type { Express, NextFunction, Request, Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = path.join(ROOT, "cinematic-site");
const LEAFLET = path.join(ROOT, "node_modules", "leaflet", "dist");

/** Mesmas páginas que `install-cinematic-marketing.mjs` instala em produção — sem a home (`/`). */
const HTML_PAGES: Record<string, string> = {
  "/terreiros": "terreiros.html",
  "/eventos": "eventos.html",
  "/evento": "evento.html",
  "/conteudo": "conteudo.html",
  "/conteudo/calendario-liturgico": "calendario-liturgico.html",
  "/por-que-axecloud": "por-que-axecloud.html",
  "/espaco-do-fiel": "espaco-do-fiel.html",
  "/senhas": "senhas.html",
};

const STATIC_FILES: Record<string, string> = {
  "/shared-footer.css": path.join(SOURCE, "shared-footer.css"),
  "/shared-footer.js": path.join(SOURCE, "shared-footer.js"),
  "/styles.css": path.join(SOURCE, "styles.css"),
  "/styles-claro.css": path.join(SOURCE, "styles-claro.css"),
  "/app.js": path.join(SOURCE, "app.js"),
  "/production-bridge.js": path.join(SOURCE, "production-bridge.js"),
  "/vendor/L.TileLayer.NoGap.js": path.join(SOURCE, "vendor", "L.TileLayer.NoGap.js"),
  "/vendor/leaflet/leaflet.css": path.join(LEAFLET, "leaflet.css"),
  "/vendor/leaflet/leaflet.js": path.join(LEAFLET, "leaflet.js"),
};

function normalizeDevPath(req: Request): string {
  return String(req.path || "").replace(/\/+$/, "") || "/";
}

function sendHtml(res: Response, file: string) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(readFileSync(file, "utf8"));
}

function sendExistingFile(res: Response, file: string, next: NextFunction) {
  if (!existsSync(file)) return next();
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(file);
}

/**
 * No localhost o Vite entrega o SPA React. Em produção `/terreiros` (e o resto
 * do marketing) é o HTML cinematográfico. Este middleware replica isso no DEV
 * para o "Voltar para o Mapa" não cair na listagem antiga.
 */
export function registerDevCinematicMarketing(app: Express): void {
  if (process.env.NODE_ENV === "production") return;
  if (!existsSync(path.join(SOURCE, "terreiros.html"))) {
    console.warn("[DEV] cinematic-site/terreiros.html ausente — /terreiros continua no SPA.");
    return;
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const p = normalizeDevPath(req);

    const staticFile = STATIC_FILES[p];
    if (staticFile) return sendExistingFile(res, staticFile, next);

    if (p.startsWith("/vendor/leaflet/")) {
      const relative = p.slice("/vendor/leaflet/".length);
      if (!relative || relative.includes("..")) return next();
      return sendExistingFile(res, path.join(LEAFLET, relative), next);
    }

    if (p.startsWith("/assets/")) {
      const relative = p.slice("/assets/".length);
      if (!relative || relative.includes("..")) return next();
      return sendExistingFile(res, path.join(SOURCE, "assets", relative), next);
    }

    const exactPage = HTML_PAGES[p];
    if (exactPage) {
      const file = path.join(SOURCE, exactPage);
      if (!existsSync(file)) return next();
      return sendHtml(res, file);
    }

    if (/^\/evento\/[^/]+$/.test(p)) {
      const file = path.join(SOURCE, "evento.html");
      if (existsSync(file)) return sendHtml(res, file);
    }

    if (/^\/senhas\/[^/]+$/.test(p)) {
      const file = path.join(SOURCE, "senhas.html");
      if (existsSync(file)) return sendHtml(res, file);
    }

    next();
  });
}
