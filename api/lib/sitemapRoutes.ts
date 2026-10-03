import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

type Deps = { supabaseAdmin: SupabaseClient };

const CURRENT_SITEMAP_URL = "https://axecloud.com.br/sitemap.xml";

function retireLegacySitemap(_req: Request, res: Response) {
  res.status(410);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.setHeader("Link", `<${CURRENT_SITEMAP_URL}>; rel="sitemap"`);
  res.send(`Sitemap antigo removido. Use ${CURRENT_SITEMAP_URL}`);
}

/**
 * Mantém as rotas antigas com 410 para o Google abandonar o inventário de
 * aproximadamente 15 mil URLs que antecede o filtro de qualidade atual.
 */
export function registerSitemapRoutes(app: Express, _deps: Deps) {
  app.get("/sitemap-terreiros.xml", retireLegacySitemap);
  app.get("/sitemap-terreiros-:page.xml", retireLegacySitemap);
}
