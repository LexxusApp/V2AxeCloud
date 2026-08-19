import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

type Deps = { supabaseAdmin: SupabaseClient };

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://axecloud.com.br";
const BATCH = 1000;

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  );
}

export function registerSitemapRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  // Sitemap index listing all terreiro sitemaps
  app.get("/sitemap-terreiros.xml", async (_req: Request, res: Response) => {
    try {
      const { count, error } = await sb
        .from("terreiros_diretorio")
        .select("id", { count: "exact", head: true })
        .not("slug", "is", null)
        .neq("slug", "");
      if (error) throw error;

      const total = count || 0;
      const pages = Math.ceil(total / BATCH) || 1;
      const lastmod = new Date().toISOString().slice(0, 10);

      const sitemaps = Array.from({ length: pages }, (_, i) =>
        `  <sitemap>\n    <loc>${xmlEscape(`${SITE_URL}/sitemap-terreiros-${i + 1}.xml`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
      ).join("\n");

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps}\n</sitemapindex>`,
      );
    } catch (error: unknown) {
      console.error("[sitemap-terreiros]", error);
      res.status(500).send("Erro ao gerar sitemap.");
    }
  });

  // Paginated terreiro sitemap pages
  app.get("/sitemap-terreiros-:page.xml", async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.params.page || "1"), 10) || 1);
      const offset = (page - 1) * BATCH;

      const { data, error } = await sb
        .from("terreiros_diretorio")
        .select("slug, updated_at")
        .not("slug", "is", null)
        .neq("slug", "")
        .order("id", { ascending: true })
        .range(offset, offset + BATCH - 1);
      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).send("Página não encontrada.");

      const urls = data
        .map((row) => {
          const slug = String(row.slug || "").trim();
          if (!slug) return "";
          const lastmod = row.updated_at
            ? String(row.updated_at).slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          return [
            "  <url>",
            `    <loc>${xmlEscape(`${SITE_URL}/terreiro/${encodeURIComponent(slug)}`)}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            "    <changefreq>weekly</changefreq>",
            "    <priority>0.6</priority>",
            "  </url>",
          ].join("\n");
        })
        .filter(Boolean)
        .join("\n");

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
      );
    } catch (error: unknown) {
      console.error("[sitemap-terreiros-page]", error);
      res.status(500).send("Erro ao gerar sitemap.");
    }
  });
}
