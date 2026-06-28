import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit } from "./rateLimit.js";
import {
  parseDiretorioCityRoute,
  slugifyCidadeOnly,
  slugifyTerreiroNome,
} from "./diretorioSlug.js";
import {
  groupItemsByBairro,
  resolveTerreiroBairro,
  shouldGroupCityByBairro,
  slugifyBairro,
} from "../../lib/diretorioBairro.js";
import { fetchAllTerreirosRows, fetchTerreirosByCitySlug } from "../../lib/diretorioQuery.js";
import { fetchBestGooglePhoto, isAllowedGooglePhotoUrl } from "./diretorioPhotoUrl.js";

type Deps = { supabaseAdmin: SupabaseClient };

const TABLE = "terreiros_diretorio";
const SELECT =
  "id, nome, endereco, telefone, foto_url, link_maps, cidade, estado, slug, cidade_slug, bairro, bairro_slug, created_at";

function mapRow(row: Record<string, unknown>) {
  const slug = String(row.slug || "").trim();
  const cidade = String(row.cidade || "").trim();
  const estado = row.estado ? String(row.estado).trim().toUpperCase() : null;
  const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
  const bairroRaw = row.bairro ? String(row.bairro).trim() : null;
  const bairro =
    bairroRaw ||
    resolveTerreiroBairro({ endereco: row.endereco ? String(row.endereco) : null, cidade }) ||
    null;
  const bairroSlug = bairro ? String(row.bairro_slug || slugifyBairro(bairro)).trim() : null;
  return {
    slug,
    nome: String(row.nome || "Terreiro").trim(),
    endereco: row.endereco ? String(row.endereco).trim() : null,
    telefone: row.telefone ? String(row.telefone).trim() : null,
    fotoUrl: row.foto_url && slug ? `${diretorioFotoProxyPath(slug)}?v=2` : null,
    linkMaps: row.link_maps ? String(row.link_maps).trim() : null,
    cidade: cidade || null,
    estado,
    cidadeSlug,
    bairro,
    bairroSlug,
    perfilUrl: slug ? `/terreiro/${slug}` : null,
    cidadeUrl: estado && cidadeSlug ? `/terreiros/${estado.toLowerCase()}/${cidadeSlug}` : null,
  };
}

function diretorioFotoProxyPath(slug: string): string {
  return `/api/v1/public/diretorio/foto/${encodeURIComponent(slug)}`;
}

export function registerDiretorioPublicRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  app.get("/api/v1/public/diretorio/cidades", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const data = await fetchAllTerreirosRows(sb, TABLE, "cidade, estado, cidade_slug");

      const map = new Map<
        string,
        { cidade: string; estado: string | null; cidadeSlug: string; count: number }
      >();

      for (const row of data || []) {
        const cidade = String(row.cidade || "").trim();
        if (!cidade) continue;
        const estado = row.estado ? String(row.estado).trim().toUpperCase() : null;
        const cidadeSlug = String(row.cidade_slug || slugifyCidadeOnly(cidade)).trim();
        const uf = estado?.toLowerCase() || "br";
        const key = `${uf}:${cidadeSlug}`;
        const cur = map.get(key);
        if (cur) cur.count += 1;
        else map.set(key, { cidade, estado, cidadeSlug, count: 1 });
      }

      const cidades = [...map.values()].sort(
        (a, b) => b.count - a.count || a.cidade.localeCompare(b.cidade, "pt-BR"),
      );

      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      res.json({ cidades });
    } catch (e: unknown) {
      console.error("[public/diretorio/cidades]", e);
      res.status(500).json({ error: "Erro ao listar cidades do diretório." });
    }
  });

  /** Proxy de foto (Google bloqueia hotlink direto no browser). */
  app.get("/api/v1/public/diretorio/foto/:slug", apiReadRateLimit, async (req: Request, res: Response) => {
    try {
      const slug = slugifyTerreiroNome(String(req.params.slug || ""));
      if (!slug) return res.status(400).end();

      const { data, error } = await sb.from(TABLE).select("foto_url").eq("slug", slug).maybeSingle();
      if (error) throw error;
      const rawUrl = data?.foto_url ? String(data.foto_url).trim() : "";
      if (!rawUrl || !isAllowedGooglePhotoUrl(rawUrl)) return res.status(404).end();

      const photo = await fetchBestGooglePhoto(rawUrl);
      if (!photo) {
        console.warn("[public/diretorio/foto] sem imagem útil", slug);
        return res.status(502).end();
      }

      res.setHeader("Content-Type", photo.contentType);
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
      res.send(photo.buf);
    } catch (e: unknown) {
      console.error("[public/diretorio/foto]", e);
      res.status(500).end();
    }
  });

  /** Terreiro individual — registrar antes de /:estado/:cidade (evita "terreiro" ser lido como UF "te"). */
  app.get(
    "/api/v1/public/diretorio/terreiro/:slug",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = slugifyTerreiroNome(String(req.params.slug || ""));
        if (!slug || slug.length < 2) {
          return res.status(400).json({ error: "Slug inválido." });
        }

        const { data, error } = await sb.from(TABLE).select(SELECT).eq("slug", slug).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Terreiro não encontrado no diretório." });

        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
        res.json(mapRow(data as Record<string, unknown>));
      } catch (e: unknown) {
        console.error("[public/diretorio/terreiro]", e);
        res.status(500).json({ error: "Erro ao carregar terreiro." });
      }
    },
  );

  app.get(
    "/api/v1/public/diretorio/:estado/:cidade",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const parsed = parseDiretorioCityRoute(
          String(req.params.estado || ""),
          String(req.params.cidade || ""),
        );
        if (!parsed) return res.status(400).json({ error: "Rota de cidade inválida." });

        const { estado, cidadeSlug } = parsed;

        const data = await fetchTerreirosByCitySlug(sb, TABLE, SELECT, estado, cidadeSlug);

        const items = data.map((row) => mapRow(row));

        const first = items[0];
        const cidadeLabel =
          first?.cidade ||
          cidadeSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        const bairros = shouldGroupCityByBairro(cidadeSlug, items)
          ? groupItemsByBairro(items)
          : undefined;

        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
        res.json({
          estado: first?.estado || estado.toUpperCase(),
          cidade: cidadeLabel,
          cidadeSlug,
          total: items.length,
          items,
          bairros,
        });
      } catch (e: unknown) {
        console.error("[public/diretorio/cidade]", e);
        res.status(500).json({ error: "Erro ao carregar terreiros da cidade." });
      }
    },
  );
}
