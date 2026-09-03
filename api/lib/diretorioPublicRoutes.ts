import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiReadRateLimit, publicFormRateLimit } from "./rateLimit.js";
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
import {
  fetchAllTerreirosRows,
  fetchTerreirosByCitySlug,
  fetchTerreirosByEstado,
} from "../../lib/diretorioQuery.js";
import { fetchBestGooglePhoto, isAllowedGooglePhotoUrl } from "./diretorioPhotoUrl.js";
import { isPlausibleDiretorioCoordinate } from "../../lib/diretorioCoordinates.js";
import { resolveDiretorioTipo } from "../../lib/diretorioTipo.js";
import { isDiretorioListingIndexable, isDiretorioListingPublishable } from "../../lib/diretorioQuality.js";
import { cachedJson } from "./ttlCache.js";
import { normalizeGiraSchedule } from "../../lib/giraSchedule.js";

type Deps = { supabaseAdmin: SupabaseClient };

const TABLE = "terreiros_diretorio";
const SELECT =
  "id, nome, endereco, telefone, foto_url, owner_photo_url, link_maps, instagram_url, cidade, estado, slug, cidade_slug, bairro, bairro_slug, tipo, latitude, longitude, coordinate_source, claimed_by_tenant_id, verified_at, gira_horarios, created_at";
const DIR_CACHE_TTL_SEC = Math.max(60, Number(process.env.DIR_CACHE_TTL_SEC || 600) || 600);

type DirectoryTrafficMetadata = {
  slug: string;
  visitor_id: string | null;
  referrer: string | null;
  source: string | null;
  medium: string | null;
  channel: "google_organic" | "google_ads" | "other";
  google: boolean;
  landing_path: string | null;
};

function cleanTrackingValue(value: unknown, max = 500): string | null {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function isGoogleReferrer(referrer: string | null): boolean {
  if (!referrer) return false;
  try {
    const hostname = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "google.com" || hostname.startsWith("google.") || hostname.endsWith(".google.com");
  } catch {
    return false;
  }
}

function directoryTrafficMetadata(body: unknown, slug: string): DirectoryTrafficMetadata {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const referrer = cleanTrackingValue(input.referrer);
  const source = cleanTrackingValue(input.source, 80)?.toLowerCase() || null;
  const medium = cleanTrackingValue(input.medium, 80)?.toLowerCase() || null;
  const visitorRaw = cleanTrackingValue(input.visitorId, 80);
  const visitorId = visitorRaw && /^[0-9a-f-]{36}$/i.test(visitorRaw) ? visitorRaw : null;
  const google = isGoogleReferrer(referrer) || source === "google" || source === "google_ads";
  const paid = google && (source === "google_ads" || /^(?:cpc|ppc|paid|paid_search)$/.test(medium || ""));
  return {
    slug,
    visitor_id: visitorId,
    referrer,
    source,
    medium,
    channel: paid ? "google_ads" : google ? "google_organic" : "other",
    google,
    landing_path: cleanTrackingValue(input.landingPath),
  };
}

const ESTADO_NOMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

function nomeEstado(uf: string): string {
  const key = String(uf || "").trim().toUpperCase();
  return ESTADO_NOMES[key] || key;
}

function validCoordinate(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : null;
}

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
  const nome = String(row.nome || "Terreiro").trim();
  const latitude = validCoordinate(row.latitude, 90);
  const longitude = validCoordinate(row.longitude, 180);
  const hasCoords =
    latitude !== null &&
    longitude !== null &&
    isPlausibleDiretorioCoordinate(latitude, longitude);
  return {
    slug,
    nome,
    endereco: row.endereco ? String(row.endereco).trim() : null,
    telefone: row.telefone ? String(row.telefone).trim() : null,
    fotoUrl: row.owner_photo_url
      ? String(row.owner_photo_url).trim()
      : row.foto_url && slug
        ? `${diretorioFotoProxyPath(slug)}?v=2`
        : null,
    linkMaps: row.link_maps ? String(row.link_maps).trim() : null,
    instagramUrl: row.instagram_url ? String(row.instagram_url).trim() : null,
    horariosGira: normalizeGiraSchedule(row.gira_horarios),
    cidade: cidade || null,
    estado,
    cidadeSlug,
    bairro,
    bairroSlug,
    tipo: resolveDiretorioTipo(row.tipo, nome),
    latitude: hasCoords ? latitude : null,
    longitude: hasCoords ? longitude : null,
    coordinateSource: hasCoords ? String(row.coordinate_source || "google_maps_url") : null,
    verificada: Boolean(row.verified_at),
    indexable: isDiretorioListingIndexable(row),
    perfilUrl: slug ? `/terreiro/${slug}` : null,
    cidadeUrl: estado && cidadeSlug ? `/terreiros/${estado.toLowerCase()}/${cidadeSlug}` : null,
  };
}

function diretorioFotoProxyPath(slug: string): string {
  return `/api/v1/public/diretorio/foto/${encodeURIComponent(slug)}`;
}

export function registerDiretorioPublicRoutes(app: Express, { supabaseAdmin: sb }: Deps) {
  app.post(
    "/api/v1/public/diretorio/terreiro/:slug/reivindicar",
    publicFormRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = slugifyTerreiroNome(String(req.params.slug || ""));
        const body = req.body && typeof req.body === "object" ? req.body : {};
        if (String(body.website || "").trim()) {
          return res.status(200).json({ success: true });
        }

        const requesterName = String(body.name || "").trim().slice(0, 120);
        const requesterRole = String(body.role || "").trim().slice(0, 120);
        const requesterEmail = String(body.email || "").trim().toLowerCase().slice(0, 180);
        const requesterPhone = String(body.phone || "").replace(/\D/g, "").slice(0, 15);
        const evidence = String(body.evidence || "").trim().slice(0, 1000);
        const message = String(body.message || "").trim().slice(0, 1500) || null;
        const conversion = body.conversion && typeof body.conversion === "object" ? body.conversion : {};

        if (!slug || slug.length < 2) return res.status(400).json({ error: "Perfil inválido." });
        if (requesterName.length < 3) return res.status(400).json({ error: "Informe seu nome completo." });
        if (requesterRole.length < 2) return res.status(400).json({ error: "Informe sua função na casa." });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
          return res.status(400).json({ error: "Informe um e-mail válido." });
        }
        if (requesterPhone.length < 10) return res.status(400).json({ error: "Informe um WhatsApp com DDD." });
        if (evidence.length < 8) {
          return res.status(400).json({ error: "Informe um link ou uma evidência do seu vínculo com a casa." });
        }
        if (body.acceptedTerms !== true) {
          return res.status(400).json({ error: "Confirme que as informações enviadas são verdadeiras." });
        }

        const { data: terreiro, error: terreiroError } = await sb
          .from(TABLE)
          .select("id, nome, verified_at")
          .eq("slug", slug)
          .maybeSingle();
        if (terreiroError) throw terreiroError;
        if (!terreiro) return res.status(404).json({ error: "Terreiro não encontrado no diretório." });
        if (terreiro.verified_at) {
          return res.status(409).json({ error: "Este perfil já foi verificado. Fale com o suporte em caso de alteração de responsável." });
        }

        const { data: pending, error: pendingError } = await sb
          .from("terreiro_claim_requests")
          .select("id, requester_email, requester_phone")
          .eq("terreiro_id", terreiro.id)
          .eq("status", "pending")
          .limit(50);
        if (pendingError) throw pendingError;
        const duplicate = (pending || []).find((item) =>
          String(item.requester_email || "").toLowerCase() === requesterEmail ||
          String(item.requester_phone || "").replace(/\D/g, "") === requesterPhone,
        );
        if (duplicate) {
          return res.status(409).json({
            error: "Já existe uma solicitação em análise com este e-mail ou WhatsApp.",
            requestId: duplicate.id,
          });
        }

        const { data: claim, error: claimError } = await sb
          .from("terreiro_claim_requests")
          .insert({
            terreiro_id: terreiro.id,
            requester_name: requesterName,
            requester_role: requesterRole,
            requester_email: requesterEmail,
            requester_phone: requesterPhone,
            evidence,
            message,
          })
          .select("id, status, created_at")
          .single();
        if (claimError) throw claimError;

        try {
          const { insertConversionEvent } = await import("./publicConversionTracking.js");
          await insertConversionEvent(
            sb,
            req,
            {
              ...conversion,
              eventName: "claim_completed",
              ctaId: "directory-profile-claim",
              metadata: { slug, claimId: claim.id },
            },
            { allowCompleted: true },
          );
        } catch (metricError) {
          console.warn("[public/diretorio/reivindicar] conversion metric failed:", metricError);
        }

        return res.status(201).json({
          success: true,
          requestId: claim.id,
          status: claim.status,
          message: "Solicitação enviada. Nossa equipe fará a verificação dos dados.",
        });
      } catch (e: unknown) {
        console.error("[public/diretorio/reivindicar]", e);
        const errorText = String((e as { message?: string })?.message || "");
        if (/terreiro_claim_requests|schema cache|does not exist/i.test(errorText)) {
          return res.status(503).json({ error: "O serviço de reivindicação está sendo configurado. Tente novamente em instantes." });
        }
        return res.status(500).json({ error: "Não foi possível enviar a solicitação. Tente novamente." });
      }
    },
  );

  app.post(
    "/api/v1/public/diretorio/reivindicacao/acompanhar",
    publicFormRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const slug = slugifyTerreiroNome(String(body.slug || ""));
        const requesterEmail = String(body.email || "").trim().toLowerCase().slice(0, 180);
        if (!slug || slug.length < 2) return res.status(400).json({ error: "Perfil inválido." });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
          return res.status(400).json({ error: "Informe o mesmo e-mail usado na solicitação." });
        }

        const { data: terreiro, error: terreiroError } = await sb
          .from(TABLE)
          .select("id, nome, slug, claimed_by_tenant_id, verified_at")
          .eq("slug", slug)
          .maybeSingle();
        if (terreiroError) throw terreiroError;
        if (!terreiro) return res.status(404).json({ error: "Perfil não encontrado." });

        const { data: claim, error: claimError } = await sb
          .from("terreiro_claim_requests")
          .select("id, status, requester_email, claimed_tenant_id, created_at, reviewed_at, updated_at")
          .eq("terreiro_id", terreiro.id)
          .eq("requester_email", requesterEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (claimError) throw claimError;
        if (!claim) {
          return res.status(404).json({ error: "Não encontramos uma solicitação para este perfil com esse e-mail." });
        }

        const linked = Boolean(claim.claimed_tenant_id || terreiro.claimed_by_tenant_id);
        return res.json({
          requestId: claim.id,
          protocol: String(claim.id).slice(0, 8).toUpperCase(),
          status: linked ? "linked" : claim.status,
          createdAt: claim.created_at,
          reviewedAt: claim.reviewed_at,
          updatedAt: claim.updated_at,
          terreiro: { nome: terreiro.nome, slug: terreiro.slug },
          nextAction:
            claim.status === "approved" && !linked
              ? { label: "Criar acesso e conectar a casa", href: `/register?claim=${encodeURIComponent(claim.id)}` }
              : linked
                ? { label: "Entrar no AxéCloud", href: "/entrar" }
                : null,
        });
      } catch (e: unknown) {
        console.error("[public/diretorio/reivindicacao/acompanhar]", e);
        return res.status(500).json({ error: "Não foi possível consultar a solicitação agora." });
      }
    },
  );

  app.get("/api/v1/public/diretorio/cidades", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const payload = await cachedJson<{ cidades: unknown[] }>(
        "cidades",
        DIR_CACHE_TTL_SEC,
        async () => {
          const data = await fetchAllTerreirosRows(
            sb,
            TABLE,
            "nome, endereco, link_maps, slug, cidade, estado, cidade_slug, tipo",
          );

          const map = new Map<
            string,
            { cidade: string; estado: string | null; cidadeSlug: string; count: number }
          >();

          for (const row of data || []) {
            if (!isDiretorioListingPublishable(row)) continue;
            if (resolveDiretorioTipo(row.tipo, String(row.nome || "")) !== "terreiro") continue;
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
          return { cidades };
        },
      );

      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      res.setHeader("X-Dir-Cache", "enabled");
      res.json(payload);
    } catch (e: unknown) {
      console.error("[public/diretorio/cidades]", e);
      res.status(500).json({ error: "Erro ao listar cidades do diretório." });
    }
  });

  app.get("/api/v1/public/diretorio/mapa", apiReadRateLimit, async (_req: Request, res: Response) => {
    try {
      const data = await fetchAllTerreirosRows(
        sb,
        TABLE,
        "nome, endereco, link_maps, instagram_url, slug, cidade, estado, tipo, latitude, longitude, verified_at",
      );
      const rows = (data || [])
        .filter((row) => isDiretorioListingPublishable(row))
        .map((row) => mapRow(row))
        .filter((row) => row.tipo === "terreiro" && row.latitude !== null && row.longitude !== null);
      const cities = [...new Set(rows.map((row) => String(row.cidade || "")))];
      const ufs = [...new Set(rows.map((row) => String(row.estado || "")))];
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
      res.json({
        v: 2,
        t: { listed: rows.length, exact: rows.length },
        cities,
        ufs,
        s: rows.map((row) => row.slug),
        n: rows.map((row) => row.nome),
        c: rows.map((row) => cities.indexOf(String(row.cidade || ""))),
        e: rows.map((row) => ufs.indexOf(String(row.estado || ""))),
        a: rows.map((row) => Math.round(Number(row.latitude) * 100000)),
        o: rows.map((row) => Math.round(Number(row.longitude) * 100000)),
        r: rows.map((row) => (row.verificada ? 1 : 0)),
        i: rows.map((row) => row.instagramUrl || ""),
      });
    } catch (error: unknown) {
      console.error("[public/diretorio/mapa]", error);
      res.status(500).json({ error: "Erro ao carregar pontos do mapa." });
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
      // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write -- buffer passed strict image magic-byte validation; SVG is rejected
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

        const publicItem = mapRow(data as Record<string, unknown>);
        if (!isDiretorioListingPublishable(data as Record<string, unknown>) || publicItem.tipo !== 'terreiro') {
          return res.status(404).json({ error: "Este perfil ainda não possui dados públicos confiáveis." });
        }

        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
        res.json(publicItem);
      } catch (e: unknown) {
        console.error("[public/diretorio/terreiro]", e);
        res.status(500).json({ error: "Erro ao carregar terreiro." });
      }
    },
  );

  /** Conta somente a ação explícita nos botões que levam ao perfil público. */
  app.post(
    "/api/v1/public/diretorio/terreiro/:slug/profile-click",
    publicFormRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = slugifyTerreiroNome(String(req.params.slug || ""));
        if (!slug || slug.length < 2) return res.status(400).json({ error: "Slug inválido." });

        const { data, error } = await sb.from(TABLE).select(SELECT).eq("slug", slug).maybeSingle();
        if (error) throw error;
        if (!data || !isDiretorioListingPublishable(data as Record<string, unknown>)) {
          return res.status(404).json({ error: "Terreiro não encontrado." });
        }

        const publicItem = mapRow(data as Record<string, unknown>);
        if (publicItem.tipo !== "terreiro") return res.status(404).json({ error: "Terreiro não encontrado." });

        const traffic = directoryTrafficMetadata(req.body, publicItem.slug);
        const { error: logError } = await sb.from("access_logs").insert({
          event_type: "directory.profile_click",
          target_type: "directory_terreiro",
          target_id: String(data.id),
          description: `Clique em Ver perfil: ${publicItem.nome}`.slice(0, 500),
          metadata: traffic,
        });
        if (logError) throw logError;
        res.status(204).end();
      } catch (e: unknown) {
        console.error("[public/diretorio/profile-click]", e);
        res.status(500).json({ error: "Erro ao registrar visita." });
      }
    },
  );

  /** Registra quem chegou diretamente a um perfil por uma busca do Google. */
  app.post(
    "/api/v1/public/diretorio/terreiro/:slug/google-view",
    publicFormRateLimit,
    async (req: Request, res: Response) => {
      try {
        const slug = slugifyTerreiroNome(String(req.params.slug || ""));
        if (!slug || slug.length < 2) return res.status(400).json({ error: "Slug inválido." });

        const traffic = directoryTrafficMetadata(req.body, slug);
        if (!traffic.google) return res.status(204).end();

        const { data, error } = await sb.from(TABLE).select(SELECT).eq("slug", slug).maybeSingle();
        if (error) throw error;
        if (!data || !isDiretorioListingPublishable(data as Record<string, unknown>)) {
          return res.status(404).json({ error: "Terreiro não encontrado." });
        }
        const publicItem = mapRow(data as Record<string, unknown>);
        if (publicItem.tipo !== "terreiro") return res.status(404).json({ error: "Terreiro não encontrado." });

        if (traffic.visitor_id) {
          const dayStart = new Date();
          dayStart.setUTCHours(0, 0, 0, 0);
          const { data: existing, error: existingError } = await sb
            .from("access_logs")
            .select("id")
            .eq("event_type", "directory.profile_google_view")
            .eq("target_type", "directory_terreiro")
            .eq("target_id", String(data.id))
            .gte("created_at", dayStart.toISOString())
            .contains("metadata", { visitor_id: traffic.visitor_id })
            .limit(1);
          if (existingError) throw existingError;
          if ((existing || []).length > 0) return res.status(204).end();
        }

        const { error: logError } = await sb.from("access_logs").insert({
          event_type: "directory.profile_google_view",
          target_type: "directory_terreiro",
          target_id: String(data.id),
          description: `Visita do Google ao perfil: ${publicItem.nome}`.slice(0, 500),
          metadata: traffic,
        });
        if (logError) throw logError;
        res.status(204).end();
      } catch (e: unknown) {
        console.error("[public/diretorio/google-view]", e);
        res.status(500).json({ error: "Erro ao registrar origem da visita." });
      }
    },
  );

  app.get(
    "/api/v1/public/diretorio/uf/:estado",
    apiReadRateLimit,
    async (req: Request, res: Response) => {
      try {
        const estado = String(req.params.estado || "")
          .trim()
          .toUpperCase();
        if (!/^[A-Z]{2}$/.test(estado)) {
          return res.status(400).json({ error: "Estado inválido." });
        }

        const payload = await cachedJson<{
          estado: string;
          nomeEstado: string;
          total: number;
          totalTerreiros: number;
          items: ReturnType<typeof mapRow>[];
        }>(`uf:${estado}`, DIR_CACHE_TTL_SEC, async () => {
          const data = await fetchTerreirosByEstado(sb, TABLE, SELECT, estado);
          const terreiros = data
            .filter((row) => isDiretorioListingPublishable(row))
            .map((row) => mapRow(row))
            .filter((item) => item.tipo === "terreiro");
          if (terreiros.length === 0) {
            const err = new Error("empty-uf") as Error & { status: number };
            err.status = 404;
            throw err;
          }
          return {
            estado,
            nomeEstado: nomeEstado(estado),
            total: terreiros.length,
            totalTerreiros: terreiros.length,
            items: terreiros,
          };
        });

        const requestedLimit = Number(req.query.limit);
        const limit =
          Number.isFinite(requestedLimit) && requestedLimit > 0
            ? Math.min(Math.floor(requestedLimit), 500)
            : null;
        const responseItems = limit ? payload.items.slice(0, limit) : payload.items;

        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
        res.setHeader("X-Dir-Cache", "enabled");
        res.json({ ...payload, items: responseItems });
      } catch (e: unknown) {
        if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
          return res.status(404).json({ error: "Nenhum terreiro público encontrado neste estado." });
        }
        console.error("[public/diretorio/uf]", e);
        res.status(500).json({ error: "Erro ao carregar terreiros do estado." });
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
        const cacheKey = `cidade:${estado.toLowerCase()}:${cidadeSlug}`;

        const payload = await cachedJson<{
          estado: string;
          cidade: string;
          cidadeSlug: string;
          total: number;
          totalTerreiros: number;
          totalLojas: number;
          items: ReturnType<typeof mapRow>[];
          bairros?: ReturnType<typeof groupItemsByBairro>;
        }>(cacheKey, DIR_CACHE_TTL_SEC, async () => {
          const data = await fetchTerreirosByCitySlug(sb, TABLE, SELECT, estado, cidadeSlug);
          const items = data
            .filter((row) => isDiretorioListingPublishable(row))
            .map((row) => mapRow(row));
          const terreiros = items.filter((item) => item.tipo === "terreiro");
          if (terreiros.length === 0) {
            const err = new Error("empty-city") as Error & { status: number };
            err.status = 404;
            throw err;
          }
          const first = terreiros[0];
          const cidadeLabel =
            first?.cidade ||
            cidadeSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const bairros = shouldGroupCityByBairro(cidadeSlug, terreiros)
            ? groupItemsByBairro(terreiros)
            : undefined;
          return {
            estado: first?.estado || estado.toUpperCase(),
            cidade: cidadeLabel,
            cidadeSlug,
            total: terreiros.length,
            totalTerreiros: terreiros.length,
            totalLojas: 0,
            items: terreiros,
            bairros,
          };
        });

        const requestedLimit = Number(req.query.limit);
        const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(Math.floor(requestedLimit), 200)
          : null;
        const responseItems = limit ? payload.items.slice(0, limit) : payload.items;

        res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
        res.setHeader("X-Dir-Cache", "enabled");
        res.json({
          ...payload,
          items: responseItems,
          bairros: limit ? undefined : payload.bairros,
        });
      } catch (e: unknown) {
        if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 404) {
          return res.status(404).json({ error: "Nenhum terreiro público encontrado nesta cidade." });
        }
        console.error("[public/diretorio/cidade]", e);
        res.status(500).json({ error: "Erro ao carregar terreiros da cidade." });
      }
    },
  );
}
