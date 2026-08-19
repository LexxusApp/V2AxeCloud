import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingOrUnknownTable, isRememberedMissingTable } from "./adminConsoleAuth.js";

const ACCESS_HEARTBEATS = "(access.session.activity,session.activity)";
const DAILY_SAMPLE_LIMIT = 4000;
const GEO_SAMPLE_LIMIT = 600;

export type AdminActivityStats = {
  childrenPerTenant: Record<string, number>;
  dailyAccess: Record<string, number>;
  geoActivity: { city?: string | null; lat?: number; lon?: number }[];
  accessLogsAvailable: boolean;
  auditLogsAvailable: boolean;
  accessLogsError?: string;
  totalEvents30d: number;
  trafficSource: "access_logs" | "audit_logs" | "both" | "none";
  publicSiteVisitorsAvailable: boolean;
  publicSitePageViewsAvailable: boolean;
  publicSiteDailyVisitors: Record<string, number>;
  publicSiteVisitorsLast7Days: number;
  publicSiteVisitorsLast30Days: number;
  publicSiteVisitorsToday: number;
  publicSiteTopPages: { bucket: string; label: string; visitors: number; sharePct: number }[];
  publicConversionFunnel: {
    available: boolean;
    periodDays: number;
    visitors: number;
    landingViews: number;
    ctaClicks: number;
    registerViews: number;
    registerStarted: number;
    registerCompleted: number;
    registerFailures: number;
    sectionReach: {
      sectionId: string;
      label: string;
      visitors: number;
      reachPct: number;
      dropOffPct: number;
    }[];
    visitToClickPct: number;
    clickToStartPct: number;
    startToCompletePct: number;
    visitToCompletePct: number;
  };
};

function bumpDaily(bucket: Record<string, number>, createdAt: string | null | undefined) {
  const date = String(createdAt || "").split("T")[0];
  if (!date) return;
  bucket[date] = (bucket[date] || 0) + 1;
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

async function loadAccessLogRows(
  sb: SupabaseClient,
  sinceIso: string
): Promise<
  | {
      ok: true;
      rows: { created_at?: string; city?: string | null; metadata?: { ll?: number[] } | null }[];
      totalCount: number;
    }
  | { ok: false; missing: boolean; message?: string }
> {
  if (isRememberedMissingTable("access_logs")) {
    return { ok: false, missing: true };
  }
  try {
    const [countRes, dailyRes, geoRes] = await Promise.all([
      sb
        .from("access_logs")
        .select("id", { count: "estimated", head: true })
        .gte("created_at", sinceIso)
        .not("event_type", "in", ACCESS_HEARTBEATS),
      sb
        .from("access_logs")
        .select("created_at")
        .gte("created_at", sinceIso)
        .not("event_type", "in", ACCESS_HEARTBEATS)
        .order("created_at", { ascending: false })
        .limit(DAILY_SAMPLE_LIMIT),
      sb
        .from("access_logs")
        .select("city, metadata")
        .gte("created_at", sinceIso)
        .not("city", "is", null)
        .limit(GEO_SAMPLE_LIMIT),
    ]);

    const firstError = countRes.error || dailyRes.error || geoRes.error;
    if (firstError) {
      if (isMissingOrUnknownTable(firstError, "access_logs")) {
        return { ok: false, missing: true, message: firstError.message };
      }
      throw firstError;
    }

    const dailyRows = (dailyRes.data || []) as { created_at?: string }[];
    const geoRows = (geoRes.data || []) as {
      city?: string | null;
      metadata?: { ll?: number[] } | null;
    }[];
    const byCreated = new Map<string, { created_at?: string; city?: string | null; metadata?: { ll?: number[] } | null }>();
    for (const row of dailyRows) {
      byCreated.set(`d:${row.created_at || ""}:${byCreated.size}`, row);
    }
    for (const row of geoRows) {
      byCreated.set(`g:${byCreated.size}`, row);
    }
    return {
      ok: true,
      rows: [...byCreated.values()],
      totalCount: countRes.count ?? dailyRows.length,
    };
  } catch (err: unknown) {
    if (isMissingOrUnknownTable(err as { message?: string }, "access_logs")) {
      return { ok: false, missing: true, message: (err as { message?: string })?.message };
    }
    throw err;
  }
}

async function loadAuditLogRows(
  sb: SupabaseClient,
  sinceIso: string
): Promise<
  | { ok: true; rows: { created_at?: string }[]; totalCount: number }
  | { ok: false; missing: boolean; message?: string }
> {
  if (isRememberedMissingTable("audit_logs")) {
    return { ok: false, missing: true };
  }
  try {
    const [countRes, dailyRes] = await Promise.all([
      sb.from("audit_logs").select("id", { count: "estimated", head: true }).gte("created_at", sinceIso),
      sb
        .from("audit_logs")
        .select("created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(DAILY_SAMPLE_LIMIT),
    ]);
    const firstError = countRes.error || dailyRes.error;
    if (firstError) {
      if (isMissingOrUnknownTable(firstError, "audit_logs")) {
        return { ok: false, missing: true, message: firstError.message };
      }
      throw firstError;
    }
    return {
      ok: true,
      rows: dailyRes.data || [],
      totalCount: countRes.count ?? (dailyRes.data || []).length,
    };
  } catch (err: unknown) {
    if (isMissingOrUnknownTable(err as { message?: string }, "audit_logs")) {
      return { ok: false, missing: true, message: (err as { message?: string })?.message };
    }
    throw err;
  }
}

/** Estatísticas de actividade para o painel admin (tráfego diário + geo). */
export async function fetchAdminActivityStats(sb: SupabaseClient): Promise<AdminActivityStats> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceIso = thirtyDaysAgo.toISOString();

  const { fetchPublicSiteTrafficStats } = await import("./publicSiteTraffic.js");
  const { fetchConversionFunnelStats } = await import("./publicConversionTracking.js");

  const [childrenRes, accessResult, auditResult, publicTraffic, publicConversionFunnel] = await Promise.all([
    sb.from("filhos_de_santo").select("tenant_id"),
    loadAccessLogRows(sb, sinceIso),
    loadAuditLogRows(sb, sinceIso),
    fetchPublicSiteTrafficStats(sb),
    fetchConversionFunnelStats(sb, 0, { maxRowsPerEvent: 2500 }),
  ]);
  if (childrenRes.error) throw childrenRes.error;

  const childrenPerTenant: Record<string, number> = {};
  (childrenRes.data || []).forEach((c: { tenant_id?: string | null }) => {
    const tid = c.tenant_id;
    if (tid) childrenPerTenant[tid] = (childrenPerTenant[tid] || 0) + 1;
  });

  if (publicTraffic.visitorsLast30Days > 0) {
    publicConversionFunnel.visitors = publicTraffic.visitorsLast30Days;
    publicConversionFunnel.visitToClickPct = pct(
      publicConversionFunnel.ctaClicks,
      publicConversionFunnel.visitors
    );
    publicConversionFunnel.visitToCompletePct = pct(
      publicConversionFunnel.registerCompleted,
      publicConversionFunnel.visitors
    );
  }

  const accessLogsAvailable = accessResult.ok;
  const auditLogsAvailable = auditResult.ok;

  const dailyAccess: Record<string, number> = {};
  let fromAccess = 0;
  let fromAudit = 0;

  if (accessResult.ok) {
    fromAccess = accessResult.totalCount;
    for (const log of accessResult.rows) {
      bumpDaily(dailyAccess, log.created_at);
    }
  }

  if (auditResult.ok) {
    fromAudit = auditResult.totalCount;
    for (const log of auditResult.rows) {
      bumpDaily(dailyAccess, log.created_at);
    }
  }

  const geoActivity: AdminActivityStats["geoActivity"] = [];
  if (accessResult.ok) {
    for (const log of accessResult.rows) {
      const meta = log.metadata as { ll?: number[] } | null | undefined;
      const ll = Array.isArray(meta?.ll) && meta.ll.length >= 2 ? meta.ll : null;
      if (ll) {
        geoActivity.push({ city: log.city, lat: ll[0], lon: ll[1] });
      } else if (log.city) {
        geoActivity.push({ city: log.city });
      }
    }
  }

  let trafficSource: AdminActivityStats["trafficSource"] = "none";
  if (fromAccess > 0 && fromAudit > 0) trafficSource = "both";
  else if (fromAccess > 0) trafficSource = "access_logs";
  else if (fromAudit > 0) trafficSource = "audit_logs";

  const totalEvents30d = fromAccess + fromAudit;

  return {
    childrenPerTenant,
    dailyAccess,
    geoActivity,
    accessLogsAvailable,
    auditLogsAvailable,
    accessLogsError: accessResult.ok ? undefined : ("message" in accessResult ? accessResult.message : undefined),
    totalEvents30d,
    trafficSource,
    publicSiteVisitorsAvailable: publicTraffic.available,
    publicSitePageViewsAvailable: publicTraffic.pageViewsAvailable,
    publicSiteDailyVisitors: publicTraffic.dailyVisitors,
    publicSiteVisitorsLast7Days: publicTraffic.visitorsLast7Days,
    publicSiteVisitorsLast30Days: publicTraffic.visitorsLast30Days,
    publicSiteVisitorsToday: publicTraffic.visitorsToday,
    publicSiteTopPages: publicTraffic.topPages,
    publicConversionFunnel,
  };
}
