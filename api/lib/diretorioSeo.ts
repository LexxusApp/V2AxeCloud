import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STATIC_SITEMAP_PATHS,
  buildCityPrerenderPage,
  buildMinimalSeoHtmlDocument,
  buildSitemapXml,
  buildTerreiroPrerenderPage,
  type DiretorioSeoTerreiro,
} from "../../lib/diretorioSeoShared.js";
import { apiReadRateLimit } from "./rateLimit.js";
import {
  parseDiretorioCityRoute,
  slugifyCidadeOnly,
  slugifyTerreiroNome,
} from "./diretorioSlug.js";

const TABLE = "terreiros_diretorio";
const SELECT =
  "nome, endereco, telefone, foto_url, link_maps, cidade, estado, slug, cidade_slug";

function mapSeoRow(row: Record<string, unknown>): DiretorioSeoTerreiro {
  const slug = String(row.slug || "").trim();
  const cidade = String(row.cidade || "").trim();
  const estado = row.estado ? String(row.estado).trim().toUpperCase() : null;
  const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
  return {
    slug,
    nome: String(row.nome || "Terreiro").trim(),
    endereco: row.endereco ? String(row.endereco).trim() : null,
    telefone: row.telefone ? String(row.telefone).trim() : null,
    fotoUrl: row.foto_url && slug ? `/api/v1/public/diretorio/foto/${encodeURIComponent(slug)}` : null,
    linkMaps: row.link_maps ? String(row.link_maps).trim() : null,
    cidade: cidade || null,
    estado,
    cidadeSlug,
    cidadeUrl: estado && cidadeSlug ? `/terreiros/${estado.toLowerCase()}/${cidadeSlug}` : null,
  };
}

function siteOrigin(): string {
  const raw = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://axecloud.com.br").trim();
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://axecloud.com.br";
  }
}

function matchesCitySlug(rowCidade: string, cidadeSlug: string): boolean {
  return slugifyCidadeOnly(rowCidade) === slugifyCidadeOnly(cidadeSlug);
}

export async function buildDiretorioSitemapRoutes(sb: SupabaseClient) {
  const { data, error } = await sb.from(TABLE).select("cidade, estado, cidade_slug, slug, created_at");
  if (error) throw error;

  const routes = STATIC_SITEMAP_PATHS.map((r) => ({
    path: r.path,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const cityKeys = new Set<string>();
  for (const row of data || []) {
    const cidade = String(row.cidade || "").trim();
    if (!cidade) continue;
    const estado = row.estado ? String(row.estado).trim().toUpperCase() : "SP";
    const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
    const cityPath = `/terreiros/${estado.toLowerCase()}/${cidadeSlug}`;
    if (!cityKeys.has(cityPath)) {
      cityKeys.add(cityPath);
      routes.push({ path: cityPath, changeFrequency: "weekly", priority: 0.85 });
    }

    const slug = String(row.slug || "").trim();
    if (slug) {
      routes.push({
        path: `/terreiro/${slug}`,
        changeFrequency: "monthly",
        priority: 0.75,
      });
    }
  }

  return routes;
}

export function registerDiretorioSeoRoutes(app: Express, { supabaseAdmin: sb }: { supabaseAdmin: SupabaseClient }) {
  app.get("/sitemap.xml", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const routes = await buildDiretorioSitemapRoutes(sb);
      const xml = buildSitemapXml(siteOrigin(), routes);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=7200");
      res.send(xml);
    } catch (e: unknown) {
      console.error("[sitemap.xml]", e);
      res.status(500).type("text/plain").send("Erro ao gerar sitemap.");
    }
  });

  app.get(
    "/api/v1/public/diretorio/render/terreiro/:slug",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = slugifyTerreiroNome(String(req.params.slug || ""));
        if (!slug) return res.status(400).send("Slug inválido");

        const { data, error } = await sb.from(TABLE).select(SELECT).eq("slug", slug).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).send("Não encontrado");

        const page = buildTerreiroPrerenderPage(mapSeoRow(data as Record<string, unknown>));
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
        res.send(buildMinimalSeoHtmlDocument(page));
      } catch (e: unknown) {
        console.error("[diretorio/render/terreiro]", e);
        res.status(500).send("Erro ao renderizar página.");
      }
    },
  );

  app.get(
    "/api/v1/public/diretorio/render/:estado/:cidade",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const parsed = parseDiretorioCityRoute(
          String(req.params.estado || ""),
          String(req.params.cidade || ""),
        );
        if (!parsed) return res.status(400).send("Cidade inválida");

        const { estado, cidadeSlug } = parsed;
        let query = sb.from(TABLE).select(SELECT).order("nome", { ascending: true });
        if (estado.length === 2) query = query.ilike("estado", estado.toUpperCase());

        const { data, error } = await query;
        if (error) throw error;

        const items = (data || [])
          .filter((row) => matchesCitySlug(String(row.cidade || ""), cidadeSlug))
          .map((row) => mapSeoRow(row as Record<string, unknown>));

        const first = items[0];
        const cidadeLabel =
          first?.cidade ||
          cidadeSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        const page = buildCityPrerenderPage(
          {
            cidade: cidadeLabel,
            estado: first?.estado || estado.toUpperCase(),
            cidadeSlug,
            total: items.length,
          },
          items,
        );

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
        res.send(buildMinimalSeoHtmlDocument(page));
      } catch (e: unknown) {
        console.error("[diretorio/render/cidade]", e);
        res.status(500).send("Erro ao renderizar página.");
      }
    },
  );
}
