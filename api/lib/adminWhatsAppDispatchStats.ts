import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfDay, startOfMonth } from "date-fns";
import { isMissingOrUnknownTable } from "./adminConsoleAuth.js";

const SHADOW_FILHO_EMAIL = /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i;

export type WhatsAppDispatchPeriod = "daily" | "monthly";

export type WhatsAppDispatchStatsRow = {
  tenantId: string;
  nomeTerreiro: string | null;
  email: string | null;
  count: number;
};

export type WhatsAppDispatchStatsResult = {
  available: boolean;
  period: WhatsAppDispatchPeriod;
  since: string;
  total: number;
  tenantsWithDispatches: number;
  tenants: WhatsAppDispatchStatsRow[];
};

function isShadowFilhoEmail(email?: string | null): boolean {
  return typeof email === "string" && SHADOW_FILHO_EMAIL.test(email);
}

function resolvePeriodSince(period: WhatsAppDispatchPeriod): Date {
  const now = new Date();
  return period === "daily" ? startOfDay(now) : startOfMonth(now);
}

async function fetchSentLogTenantIds(sb: SupabaseClient, sinceIso: string): Promise<string[]> {
  const tenantIds: string[] = [];
  const pageSize = 2000;
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("whatsapp_logs")
      .select("tenant_id")
      .in("status", ["sent", "partial"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const tid = String((row as { tenant_id?: string | null }).tenant_id || "").trim();
      if (tid) tenantIds.push(tid);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return tenantIds;
}

export async function fetchWhatsAppDispatchStats(
  sb: SupabaseClient,
  period: WhatsAppDispatchPeriod
): Promise<WhatsAppDispatchStatsResult> {
  const since = resolvePeriodSince(period);
  const sinceIso = since.toISOString();

  const empty: WhatsAppDispatchStatsResult = {
    available: true,
    period,
    since: sinceIso,
    total: 0,
    tenantsWithDispatches: 0,
    tenants: [],
  };

  let logTenantIds: string[];
  try {
    logTenantIds = await fetchSentLogTenantIds(sb, sinceIso);
  } catch (e: unknown) {
    if (isMissingOrUnknownTable(e as { message?: string }, "whatsapp_logs")) {
      return { ...empty, available: false };
    }
    throw e;
  }

  const counts = new Map<string, number>();
  for (const tid of logTenantIds) {
    counts.set(tid, (counts.get(tid) || 0) + 1);
  }

  const { data: leaderRows, error: leadersError } = await sb
    .from("perfil_lider")
    .select("id, email, nome_terreiro")
    .is("deleted_at", null);
  if (leadersError) throw leadersError;

  const { data: filhosRows, error: filhosError } = await sb.from("filhos_de_santo").select("user_id");
  if (filhosError) throw filhosError;

  const childUserIdSet = new Set<string>(
    (filhosRows || []).map((r: { user_id?: string | null }) => String(r.user_id || "")).filter(Boolean)
  );

  const tenants: WhatsAppDispatchStatsRow[] = [];
  for (const row of leaderRows || []) {
    const tenantId = String((row as { id?: string }).id || "").trim();
    if (!tenantId) continue;
    if (childUserIdSet.has(tenantId)) continue;
    const email = (row as { email?: string | null }).email ?? null;
    if (isShadowFilhoEmail(email)) continue;

    tenants.push({
      tenantId,
      nomeTerreiro: (row as { nome_terreiro?: string | null }).nome_terreiro ?? null,
      email,
      count: counts.get(tenantId) || 0,
    });
  }

  tenants.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (a.nomeTerreiro || a.email || "").localeCompare(b.nomeTerreiro || b.email || "", "pt-BR");
  });

  const total = logTenantIds.length;
  const tenantsWithDispatches = tenants.filter((t) => t.count > 0).length;

  return {
    available: true,
    period,
    since: sinceIso,
    total,
    tenantsWithDispatches,
    tenants,
  };
}
