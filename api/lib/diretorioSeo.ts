import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DIRETORIO_SEO_TEMPLATE_LASTMOD,
  STATIC_SITEMAP_PATHS,
  buildCityPrerenderPage,
  buildMinimalSeoHtmlDocument,
  buildSitemapXml,
  buildTerreiroPrerenderPage,
  type DiretorioSeoTerreiro,
} from "../../lib/diretorioSeoShared.js";
import { fetchAllTerreirosRows, fetchTerreirosByCitySlug } from "../../lib/diretorioQuery.js";
import { isDiretorioListingPublishable } from "../../lib/diretorioQuality.js";
import { resolveDiretorioTipo } from "../../lib/diretorioTipo.js";
import { apiReadRateLimit } from "./rateLimit.js";
import {
  parseDiretorioCityRoute,
  slugifyCidadeOnly,
  slugifyTerreiroNome,
} from "./diretorioSlug.js";

const TABLE = "terreiros_diretorio";
const SELECT =
  "nome, endereco, telefone, foto_url, link_maps, cidade, estado, slug, cidade_slug, tipo";

function sitemapLastModified(rawModified: string): string {
  if (!rawModified || Number.isNaN(new Date(rawModified).getTime())) {
    return DIRETORIO_SEO_TEMPLATE_LASTMOD;
  }

  const recordDate = new Date(rawModified).toISOString().slice(0, 10);
  return recordDate > DIRETORIO_SEO_TEMPLATE_LASTMOD
    ? recordDate
    : DIRETORIO_SEO_TEMPLATE_LASTMOD;
}

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

export async function buildDiretorioSitemapRoutes(sb: SupabaseClient) {
  const data = await fetchAllTerreirosRows(
    sb,
    TABLE,
    "nome, endereco, link_maps, cidade, estado, cidade_slug, slug, tipo, created_at, updated_at",
  );

  const routes: Array<{
    path: string;
    changeFrequency?: string;
    priority?: number;
    lastModified?: string;
  }> = STATIC_SITEMAP_PATHS.map((r) => ({
    path: r.path,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const cityRoutes = new Map<string, string | undefined>();
  for (const row of data || []) {
    if (!isDiretorioListingPublishable(row)) continue;
    if (resolveDiretorioTipo(row.tipo, String(row.nome || '')) !== 'terreiro') continue;
    const cidade = String(row.cidade || "").trim();
    if (!cidade) continue;
    const estado = row.estado ? String(row.estado).trim().toUpperCase() : "SP";
    const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
    const cityPath = `/terreiros/${estado.toLowerCase()}/${cidadeSlug}`;
    const rawModified = String(row.updated_at || row.created_at || "").trim();
    const modifiedDate = sitemapLastModified(rawModified);
    const previousCityDate = cityRoutes.get(cityPath);
    if (!previousCityDate || (modifiedDate && modifiedDate > previousCityDate)) {
      cityRoutes.set(cityPath, modifiedDate);
    }

    const slug = String(row.slug || "").trim();
    if (slug) {
      routes.push({
        path: `/terreiro/${slug}`,
        changeFrequency: "monthly",
        priority: 0.75,
        lastModified: modifiedDate,
      });
    }
  }

  for (const [path, lastModified] of cityRoutes) {
    routes.push({ path, changeFrequency: "weekly", priority: 0.85, lastModified });
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

        if (!isDiretorioListingPublishable(data as Record<string, unknown>)) {
          return res.status(404).send("Perfil indisponível");
        }

        if (resolveDiretorioTipo(data.tipo, String(data.nome || '')) !== 'terreiro') {
          return res.status(404).send("Perfil indisponível");
        }

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
        const data = await fetchTerreirosByCitySlug(sb, TABLE, SELECT, estado, cidadeSlug);

        const items = data
          .filter((row) => isDiretorioListingPublishable(row))
          .filter((row) => resolveDiretorioTipo(row.tipo, String(row.nome || '')) === 'terreiro')
          .map((row) => mapSeoRow(row));
        if (items.length === 0) return res.status(404).send("Cidade não encontrada");

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
