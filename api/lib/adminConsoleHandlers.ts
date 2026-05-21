import type { SupabaseClient } from "@supabase/supabase-js";
import { countFilhosForPerfilLider } from "./countFilhosForTerreiro.js";
import { getAuditLogsDisabled } from "./createAuditLog.js";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";
import { loadPlansCatalog } from "./plansCatalog.js";

const SHADOW_FILHO_EMAIL = /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i;

function isShadowFilhoEmail(email?: string | null) {
  return typeof email === "string" && SHADOW_FILHO_EMAIL.test(email);
}

export async function handleAdminOverview(sb: SupabaseClient) {
  const { data: leaderRows, error: e1 } = await sb
    .from("perfil_lider")
    .select("id, email")
    .is("deleted_at", null);
  if (e1) throw e1;

  const { data: filhosRows, error: e2 } = await sb.from("filhos_de_santo").select("user_id");
  if (e2) throw e2;
  const filhosCount = (filhosRows || []).length;
  const childUserIdSet = new Set<string>(
    (filhosRows || []).map((r: { user_id?: string | null }) => String(r.user_id || "")).filter(Boolean)
  );

  const realLeaderIdSet = new Set<string>();
  for (const p of leaderRows || []) {
    const pid = String((p as { id?: string }).id || "");
    const pem = (p as { email?: string | null }).email;
    if (!pid) continue;
    if (childUserIdSet.has(pid)) continue;
    if (isShadowFilhoEmail(pem)) continue;
    realLeaderIdSet.add(pid);
  }
  const leadersCount = realLeaderIdSet.size;

  const { data: subs, error: e3 } = await sb.from("subscriptions").select("id, plan, status");
  if (e3) throw e3;

  const planHistogram: Record<string, number> = {};
  let realSubscriptionsCount = 0;
  for (const row of subs || []) {
    const subId = String((row as { id?: string }).id || "");
    if (subId && !realLeaderIdSet.has(subId)) continue;
    const p = String((row as { plan?: string }).plan || "unknown").toLowerCase();
    planHistogram[p] = (planHistogram[p] || 0) + 1;
    realSubscriptionsCount++;
  }

  let accessLast7d = 0;
  let accessLogsAvailable = true;
  const since = new Date();
  since.setDate(since.getDate() - 7);
  try {
    const { count: ac, error: e4 } = await sb
      .from("access_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since.toISOString());
    if (e4 && isMissingOrUnknownTable(e4, "access_logs")) {
      accessLogsAvailable = false;
    } else if (e4) {
      throw e4;
    } else {
      accessLast7d = ac ?? 0;
    }
  } catch (accessCatch: unknown) {
    if (isMissingOrUnknownTable(accessCatch as { message?: string }, "access_logs")) {
      accessLogsAvailable = false;
    } else {
      throw accessCatch;
    }
  }

  return {
    leadersCount,
    filhosCount: filhosCount ?? 0,
    subscriptionsCount: realSubscriptionsCount,
    planHistogram,
    accessLogsAvailable,
    accessEventsLast7Days: accessLast7d,
  };
}

export async function handleAdminActivity(sb: SupabaseClient) {
  const { data: childrenStats, error: childrenError } = await sb.from("filhos_de_santo").select("tenant_id");
  if (childrenError) throw childrenError;
  const childrenPerTenant: Record<string, number> = {};
  (childrenStats || []).forEach((c: { tenant_id?: string | null }) => {
    const tid = c.tenant_id;
    if (tid) childrenPerTenant[tid] = (childrenPerTenant[tid] || 0) + 1;
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let accessLogs: { created_at?: string; city?: string; ll?: number[] }[] | null = [];
  let accessLogsAvailable = true;
  let accessLogsError: string | undefined;
  try {
    const q = await sb
      .from("access_logs")
      .select("created_at, city, ll")
      .gte("created_at", thirtyDaysAgo.toISOString());
    if (q.error) {
      if (isMissingOrUnknownTable(q.error, "access_logs")) {
        accessLogsAvailable = false;
        accessLogsError = q.error.message;
      } else {
        throw q.error;
      }
    } else {
      accessLogs = q.data;
    }
  } catch (acErr: unknown) {
    if (isMissingOrUnknownTable(acErr as { message?: string }, "access_logs")) {
      accessLogsAvailable = false;
      accessLogsError = (acErr as { message?: string })?.message;
    } else {
      throw acErr;
    }
  }

  if (!accessLogsAvailable) {
    return {
      childrenPerTenant,
      dailyAccess: {},
      geoActivity: [],
      accessLogsAvailable: false,
      accessLogsError,
    };
  }

  const dailyAccess: Record<string, number> = {};
  (accessLogs || []).forEach((log) => {
    const date = String(log.created_at || "").split("T")[0];
    if (date) dailyAccess[date] = (dailyAccess[date] || 0) + 1;
  });
  return {
    childrenPerTenant,
    dailyAccess,
    geoActivity:
      accessLogs?.filter((l) => l.ll).map((l) => ({
        city: l.city,
        lat: l.ll![0],
        lon: l.ll![1],
      })) || [],
    accessLogsAvailable: true,
  };
}

export async function handleAdminAuditLogs(sb: SupabaseClient, query: URLSearchParams) {
  const limit = Math.min(500, Math.max(1, Number(query.get("limit") || 100)));
  const offset = Math.max(0, Number(query.get("offset") || 0));
  const filterAction = String(query.get("action") || "").trim();
  const filterStatus = String(query.get("status") || "").trim();
  const filterTerreiro = String(query.get("terreiroId") || "").trim();

  let q = sb
    .from("audit_logs")
    .select("id, created_at, action, status, terreiro_id, details, ip, user_agent, user_id, user_email");
  if (filterAction) q = q.eq("action", filterAction);
  if (filterStatus === "success" || filterStatus === "failed") q = q.eq("status", filterStatus);
  if (filterTerreiro) q = q.eq("terreiro_id", filterTerreiro);
  const { data: rows, error } = await q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (error && isMissingOrUnknownTable(error, "audit_logs")) {
    return {
      rows: [],
      auditLogsAvailable: false,
      notice:
        "A tabela audit_logs não existe neste projecto Supabase. Aplique supabase/migrations/20260520120000_audit_logs.sql.",
      actions: [] as string[],
    };
  }
  if (error) throw error;

  let actions: string[] = [];
  try {
    const { data: distinct } = await sb.from("audit_logs").select("action").not("action", "is", null).limit(500);
    const set = new Set<string>();
    for (const r of distinct || []) set.add(String((r as { action?: string }).action || ""));
    actions = [...set].filter(Boolean).sort();
  } catch {
    actions = [];
  }

  const auditLogState = getAuditLogsDisabled();
  return {
    rows: rows || [],
    auditLogsAvailable: true,
    notice: auditLogState.disabled
      ? `Gravação de audit_logs temporariamente pausada: ${auditLogState.reason || "erro anterior ao gravar"}.`
      : undefined,
    actions,
  };
}

export async function handleAdminTenants(sb: SupabaseClient) {
  const { data: profiles, error: pError } = await sb
    .from("perfil_lider")
    .select("id, tenant_id, email, nome_terreiro, cargo, updated_at, is_blocked, deleted_at")
    .is("deleted_at", null);
  if (pError) throw pError;

  const { data: subs, error: sError } = await sb.from("subscriptions").select("id, plan, expires_at, status");
  if (sError) throw sError;

  const { data: childrenRaw, error: cError } = await sb
    .from("filhos_de_santo")
    .select("tenant_id, lider_id, user_id");
  if (cError) throw cError;
  const childrenList = (childrenRaw || []) as {
    tenant_id?: string | null;
    lider_id?: string | null;
    user_id?: string | null;
  }[];
  const childUserIdSet = new Set<string>(
    childrenList.map((c) => String(c.user_id || "")).filter(Boolean)
  );

  const plans = await loadPlansCatalog(sb);

  const realTenants =
    profiles?.filter((p: { id: string; email?: string | null }) => {
      if (childUserIdSet.has(String(p.id))) return false;
      if (isShadowFilhoEmail(p.email)) return false;
      return true;
    }) || [];

  const augmentedProfiles = realTenants.map((p: { id: string; tenant_id?: string | null }) => {
    const sub = subs?.find((s: { id?: string }) => s.id === p.id);
    return {
      ...p,
      totalChildren: countFilhosForPerfilLider({ id: p.id, tenant_id: p.tenant_id }, childrenList),
      plan: sub?.plan || "premium",
      expires_at: sub?.expires_at ?? null,
      subscription_status: sub?.status ?? null,
    };
  });

  return { profiles: augmentedProfiles, plans };
}
