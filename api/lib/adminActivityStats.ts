import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";

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

async function loadAccessLogRows(
  sb: SupabaseClient,
  sinceIso: string
): Promise<
  | { ok: true; rows: { created_at?: string; city?: string | null; metadata?: { ll?: number[] } | null }[] }
  | { ok: false; missing: boolean; message?: string }
> {
  try {
    const q = await sb
      .from("access_logs")
      .select("created_at, city, metadata")
      .gte("created_at", sinceIso);
    if (q.error) {
      if (isMissingOrUnknownTable(q.error, "access_logs")) {
        return { ok: false, missing: true, message: q.error.message };
      }
      throw q.error;
    }
    return { ok: true, rows: q.data || [] };
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
  | { ok: true; rows: { created_at?: string }[] }
  | { ok: false; missing: boolean; message?: string }
> {
  try {
    const q = await sb.from("audit_logs").select("created_at").gte("created_at", sinceIso);
    if (q.error) {
      if (isMissingOrUnknownTable(q.error, "audit_logs")) {
        return { ok: false, missing: true, message: q.error.message };
      }
      throw q.error;
    }
    return { ok: true, rows: q.data || [] };
  } catch (err: unknown) {
    if (isMissingOrUnknownTable(err as { message?: string }, "audit_logs")) {
      return { ok: false, missing: true, message: (err as { message?: string })?.message };
    }
    throw err;
  }
}

/** Estatísticas de actividade para o painel admin (tráfego diário + geo). */
export async function fetchAdminActivityStats(sb: SupabaseClient): Promise<AdminActivityStats> {
  const { data: childrenStats, error: childrenError } = await sb.from("filhos_de_santo").select("tenant_id");
  if (childrenError) throw childrenError;

  const childrenPerTenant: Record<string, number> = {};
  (childrenStats || []).forEach((c: { tenant_id?: string | null }) => {
    const tid = c.tenant_id;
    if (tid) childrenPerTenant[tid] = (childrenPerTenant[tid] || 0) + 1;
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceIso = thirtyDaysAgo.toISOString();

  const accessResult = await loadAccessLogRows(sb, sinceIso);
  const auditResult = await loadAuditLogRows(sb, sinceIso);

  const accessLogsAvailable = accessResult.ok;
  const auditLogsAvailable = auditResult.ok;

  const dailyAccess: Record<string, number> = {};
  let fromAccess = 0;
  let fromAudit = 0;

  if (accessResult.ok) {
    for (const log of accessResult.rows) {
      bumpDaily(dailyAccess, log.created_at);
      fromAccess++;
    }
  }

  if (auditResult.ok) {
    for (const log of auditResult.rows) {
      bumpDaily(dailyAccess, log.created_at);
      fromAudit++;
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

  const { fetchPublicSiteTrafficStats } = await import("./publicSiteTraffic.js");
  const publicTraffic = await fetchPublicSiteTrafficStats(sb);
  const { fetchConversionFunnelStats } = await import('./publicConversionTracking.js');
  const publicConversionFunnel = await fetchConversionFunnelStats(sb, publicTraffic.visitorsLast30Days);

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
