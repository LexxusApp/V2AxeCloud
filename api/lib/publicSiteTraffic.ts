import type { Request } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import geoip from "geoip-lite";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicPageBreakdownRow = {
  bucket: string;
  label: string;
  visitors: number;
  sharePct: number;
};

export type PublicSiteTrafficStats = {
  available: boolean;
  pageViewsAvailable: boolean;
  dailyVisitors: Record<string, number>;
  visitorsLast7Days: number;
  visitorsLast30Days: number;
  visitorsToday: number;
  topPages: PublicPageBreakdownRow[];
};

function extractClientIp(req: Request | any): string | null {
  try {
    const xff = req?.headers?.["x-forwarded-for"];
    if (xff) {
      const first = String(xff).split(",")[0]?.trim();
      if (first) return first.slice(0, 64);
    }
    const xri = req?.headers?.["x-real-ip"];
    if (xri) {
      const v = String(xri).trim();
      if (v) return v.slice(0, 64);
    }
    const ip = req?.ip || req?.socket?.remoteAddress || null;
    return ip ? String(ip).replace(/^::ffff:/, "").slice(0, 64) : null;
  } catch {
    return null;
  }
}

function sanitizePath(path: string): string {
  const raw = String(path || "/").trim();
  const withoutQuery = raw.split("?")[0]?.split("#")[0] || "/";
  const p = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const normalized = p.replace(/\/+$/, "") || "/";
  return normalized.slice(0, 300);
}

/** Agrupa paths em buckets legíveis no painel admin. */
export function bucketPublicPath(path: string): { bucket: string; label: string } {
  const p = sanitizePath(path);

  if (p === "/") return { bucket: "/", label: "Landing (início)" };
  if (p === "/termos") return { bucket: "/termos", label: "Termos de uso" };
  if (p === "/privacidade") return { bucket: "/privacidade", label: "Privacidade" };
  if (p === "/programa-fundador") return { bucket: "/register", label: "Cadastro (redirect legado)" };
  if (p === "/espaco-do-fiel") return { bucket: "/espaco-do-fiel", label: "Espaço do Fiel" };
  if (p === "/register") return { bucket: "/register", label: "Cadastro" };
  if (p === "/checkout") return { bucket: "/checkout", label: "Checkout" };
  if (p === "/terreiros") return { bucket: "/terreiros", label: "Diretório de terreiros" };
  if (p.startsWith("/terreiros/cidade/")) return { bucket: "/terreiros/cidade/*", label: "Terreiros por cidade" };
  if (p.startsWith("/terreiros/")) return { bucket: "/terreiros/perfil/*", label: "Perfil de terreiro" };
  if (p === "/eventos") return { bucket: "/eventos", label: "Eventos públicos" };
  if (p.startsWith("/conteudo/calendario-liturgico")) {
    return { bucket: "/conteudo/calendario-liturgico", label: "Calendário litúrgico" };
  }
  if (p === "/conteudo/glossario") return { bucket: "/conteudo/glossario", label: "Glossário" };
  if (p === "/conteudo") return { bucket: "/conteudo", label: "Hub de conteúdo" };
  if (p.startsWith("/conteudo/")) return { bucket: "/conteudo/artigo/*", label: "Artigos / conteúdo" };
  if (p.startsWith("/consulente/")) return { bucket: "/consulente/*", label: "Portal consulente" };
  if (p.startsWith("/convite/")) return { bucket: "/convite/*", label: "Convite (RSVP)" };
  if (p.startsWith("/widget/")) return { bucket: "/widget/*", label: "Widget embebido" };

  return { bucket: p, label: p };
}

const BUCKET_LABELS: Record<string, string> = {
  "/": "Landing (início)",
  "/termos": "Termos de uso",
  "/privacidade": "Privacidade",
  "/register": "Cadastro",
  "/espaco-do-fiel": "Espaço do Fiel",
  "/checkout": "Checkout",
  "/terreiros": "Diretório de terreiros",
  "/terreiros/cidade/*": "Terreiros por cidade",
  "/terreiros/perfil/*": "Perfil de terreiro",
  "/eventos": "Eventos públicos",
  "/conteudo/calendario-liturgico": "Calendário litúrgico",
  "/conteudo/glossario": "Glossário",
  "/conteudo": "Hub de conteúdo",
  "/conteudo/artigo/*": "Artigos / conteúdo",
  "/consulente/*": "Portal consulente",
  "/convite/*": "Convite (RSVP)",
  "/widget/*": "Widget embebido",
};

export function labelForPathBucket(bucket: string): string {
  return BUCKET_LABELS[bucket] || bucket;
}

async function insertPageView(
  sb: SupabaseClient,
  visitDate: string,
  visitorId: string,
  path: string
): Promise<void> {
  const { bucket, label: _label } = bucketPublicPath(path);
  const { error } = await sb.from("public_site_page_views").insert({
    visit_date: visitDate,
    visitor_id: visitorId,
    path: sanitizePath(path),
    path_bucket: bucket,
  });
  if (error && String(error.code || "") !== "23505") {
    if (isMissingOrUnknownTable(error, "public_site_page_views")) return;
    throw error;
  }
}

export async function trackPublicSiteVisit(
  sb: SupabaseClient,
  req: Request | any,
  input: { visitorId: string; path: string; referrer?: string | null }
): Promise<{ ok: boolean; duplicate?: boolean }> {
  const visitorId = String(input.visitorId || "").trim().toLowerCase();
  if (!UUID_RE.test(visitorId)) return { ok: false };

  const visitDate = new Date().toISOString().slice(0, 10);
  const safePath = sanitizePath(input.path);
  const ip = extractClientIp(req);
  let geo: geoip.Lookup | null = null;
  if (ip && ip !== "::1" && ip !== "127.0.0.1") {
    geo = geoip.lookup(ip) || null;
  }

  const { error } = await sb.from("public_site_visitors").insert({
    visit_date: visitDate,
    visitor_id: visitorId,
    entry_path: safePath,
    referrer: input.referrer ? String(input.referrer).slice(0, 500) : null,
    country: geo?.country || null,
    city: geo?.city || null,
    user_agent: req.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 500) : null,
  });

  let duplicate = false;
  if (error) {
    if (String(error.code || "") === "23505") duplicate = true;
    else if (isMissingOrUnknownTable(error, "public_site_visitors")) return { ok: false };
    else throw error;
  }

  await insertPageView(sb, visitDate, visitorId, safePath);
  return { ok: true, duplicate };
}

function buildTopPages(
  rows: { path_bucket?: string | null; visitor_id?: string | null }[]
): PublicPageBreakdownRow[] {
  const bucketVisitors = new Map<string, Set<string>>();
  const bucketLabels = new Map<string, string>();

  for (const row of rows) {
    const bucket = String(row.path_bucket || "").trim();
    const visitorId = String(row.visitor_id || "").trim();
    if (!bucket || !visitorId) continue;
    if (!bucketVisitors.has(bucket)) bucketVisitors.set(bucket, new Set());
    bucketVisitors.get(bucket)!.add(visitorId);
    if (!bucketLabels.has(bucket)) {
      bucketLabels.set(bucket, labelForPathBucket(bucket));
    }
  }

  const entries = [...bucketVisitors.entries()]
    .map(([bucket, set]) => ({
      bucket,
      label: bucketLabels.get(bucket) || bucket,
      visitors: set.size,
      sharePct: 0,
    }))
    .sort((a, b) => b.visitors - a.visitors);

  const total = entries.reduce((sum, row) => sum + row.visitors, 0) || 1;
  return entries.map((row) => ({
    ...row,
    sharePct: Math.round((row.visitors / total) * 100),
  }));
}

export async function fetchPublicSiteTrafficStats(sb: SupabaseClient): Promise<PublicSiteTrafficStats> {
  const empty: PublicSiteTrafficStats = {
    available: false,
    pageViewsAvailable: false,
    dailyVisitors: {},
    visitorsLast7Days: 0,
    visitorsLast30Days: 0,
    visitorsToday: 0,
    topPages: [],
  };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceDate = thirtyDaysAgo.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since7 = sevenDaysAgo.toISOString().slice(0, 10);

  try {
    const { data, error } = await sb
      .from("public_site_visitors")
      .select("visit_date")
      .gte("visit_date", sinceDate);

    if (error) {
      if (isMissingOrUnknownTable(error, "public_site_visitors")) return empty;
      throw error;
    }

    const dailyVisitors: Record<string, number> = {};
    let visitorsLast30Days = 0;
    let visitorsLast7Days = 0;
    let visitorsToday = 0;

    for (const row of data || []) {
      const d = String((row as { visit_date?: string }).visit_date || "");
      if (!d) continue;
      dailyVisitors[d] = (dailyVisitors[d] || 0) + 1;
      visitorsLast30Days++;
      if (d >= since7) visitorsLast7Days++;
      if (d === today) visitorsToday++;
    }

    let topPages: PublicPageBreakdownRow[] = [];
    let pageViewsAvailable = false;
    try {
      const pageRes = await sb
        .from("public_site_page_views")
        .select("path_bucket, visitor_id")
        .gte("visit_date", sinceDate);
      if (pageRes.error) {
        if (!isMissingOrUnknownTable(pageRes.error, "public_site_page_views")) throw pageRes.error;
      } else {
        pageViewsAvailable = true;
        topPages = buildTopPages(pageRes.data || []);
      }
    } catch (pageErr: unknown) {
      if (!isMissingOrUnknownTable(pageErr as { message?: string }, "public_site_page_views")) throw pageErr;
    }

    return {
      available: true,
      pageViewsAvailable,
      dailyVisitors,
      visitorsLast7Days,
      visitorsLast30Days,
      visitorsToday,
      topPages,
    };
  } catch (err: unknown) {
    if (isMissingOrUnknownTable(err as { message?: string }, "public_site_visitors")) return empty;
    throw err;
  }
}
