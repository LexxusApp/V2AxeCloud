import type { SupabaseClient } from "@supabase/supabase-js";
import { countFilhosForPerfilLider } from "./countFilhosForTerreiro.js";
import { getAuditLogsDisabled } from "./createAuditLog.js";
import { isMissingOrUnknownTable, isRememberedMissingTable } from "./adminConsoleAuth.js";
import { loadPlansCatalog } from "./plansCatalog.js";
import { getFounderApplicationStats } from "./founderProgramAdmin.js";
import { fetchAdminActivityStats } from "./adminActivityStats.js";

const SHADOW_FILHO_EMAIL = /(^f_[a-f0-9-]{8,}@|@axecloud\.internal$)/i;
const ACCESS_HEARTBEATS = "(access.session.activity,session.activity)";

function isShadowFilhoEmail(email?: string | null) {
  return typeof email === "string" && SHADOW_FILHO_EMAIL.test(email);
}

export async function handleAdminOverview(sb: SupabaseClient) {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const leadersPromise = sb.from("perfil_lider").select("id, email").is("deleted_at", null);
  const filhosCountPromise = sb.from("filhos_de_santo").select("id", { count: "exact", head: true });
  const subsPromise = sb.from("subscriptions").select("id, plan, status");
  const accessPromise = isRememberedMissingTable("access_logs")
    ? Promise.resolve({ count: 0, error: null, skipped: true as const })
    : sb
        .from("access_logs")
        .select("id", { count: "estimated", head: true })
        .gte("created_at", sinceIso)
        .not("event_type", "in", ACCESS_HEARTBEATS);
  const founderPromise = getFounderApplicationStats(sb).catch(() => ({
    available: false,
    pending: 0,
    total: 0,
    remainingSlots: 20,
  }));

  const leadersRes = await leadersPromise;
  if (leadersRes.error) throw leadersRes.error;

  const leaderIds = (leadersRes.data || [])
    .map((p: { id?: string }) => String(p.id || ""))
    .filter(Boolean);
  const childLeadersPromise =
    leaderIds.length > 0
      ? sb.from("filhos_de_santo").select("user_id").in("user_id", leaderIds)
      : Promise.resolve({ data: [] as { user_id?: string | null }[], error: null });

  const [filhosCountRes, subsRes, accessRes, founderStats, childLeadersRes] = await Promise.all([
    filhosCountPromise,
    subsPromise,
    accessPromise,
    founderPromise,
    childLeadersPromise,
  ]);

  if (filhosCountRes.error) throw filhosCountRes.error;
  if (subsRes.error) throw subsRes.error;
  if (childLeadersRes.error) throw childLeadersRes.error;

  const childUserIdSet = new Set<string>(
    (childLeadersRes.data || [])
      .map((r: { user_id?: string | null }) => String(r.user_id || ""))
      .filter(Boolean)
  );

  const realLeaderIdSet = new Set<string>();
  for (const p of leadersRes.data || []) {
    const pid = String((p as { id?: string }).id || "");
    const pem = (p as { email?: string | null }).email;
    if (!pid) continue;
    if (childUserIdSet.has(pid)) continue;
    if (isShadowFilhoEmail(pem)) continue;
    realLeaderIdSet.add(pid);
  }

  const planHistogram: Record<string, number> = {};
  let realSubscriptionsCount = 0;
  for (const row of subsRes.data || []) {
    const subId = String((row as { id?: string }).id || "");
    if (subId && !realLeaderIdSet.has(subId)) continue;
    const p = String((row as { plan?: string }).plan || "unknown").toLowerCase();
    planHistogram[p] = (planHistogram[p] || 0) + 1;
    realSubscriptionsCount++;
  }

  let accessLast7d = 0;
  let accessLogsAvailable = true;
  if ("skipped" in accessRes && accessRes.skipped) {
    accessLogsAvailable = false;
  } else if (accessRes.error && isMissingOrUnknownTable(accessRes.error, "access_logs")) {
    accessLogsAvailable = false;
  } else if (accessRes.error) {
    throw accessRes.error;
  } else {
    accessLast7d = accessRes.count ?? 0;
  }

  return {
    leadersCount: realLeaderIdSet.size,
    filhosCount: filhosCountRes.count ?? 0,
    subscriptionsCount: realSubscriptionsCount,
    planHistogram,
    accessLogsAvailable,
    accessEventsLast7Days: accessLast7d,
    founderApplications: {
      available: founderStats.available,
      pending: founderStats.pending,
      total: founderStats.total,
      remainingSlots: founderStats.remainingSlots,
    },
  };
}

export async function handleAdminActivity(sb: SupabaseClient) {
  return fetchAdminActivityStats(sb);
}

type UnifiedAuditRow = {
  id: string;
  created_at: string;
  action: string;
  status: string;
  terreiro_id: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  user_id: string | null;
  user_email: string | null;
  source: "audit_logs" | "access_logs" | "whatsapp_logs";
};

function mapAccessLogRow(r: Record<string, unknown>): UnifiedAuditRow {
  const eventType = String(r.event_type || "event");
  const meta =
    r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : null;
  return {
    id: `access:${String(r.id || "")}`,
    created_at: String(r.created_at || ""),
    action: eventType.startsWith("access.") ? eventType : `access.${eventType}`,
    status: "success",
    terreiro_id: r.tenant_id ? String(r.tenant_id) : null,
    details: {
      description: r.description ?? null,
      targetType: r.target_type ?? null,
      targetId: r.target_id ?? null,
      ...(meta || {}),
    },
    ip: r.ip ? String(r.ip) : null,
    user_agent: r.user_agent ? String(r.user_agent) : null,
    user_id: r.user_id ? String(r.user_id) : null,
    user_email: r.user_email ? String(r.user_email) : null,
    source: "access_logs",
  };
}

/** Ruído de sessão que engole o feed quando "Ocultar heartbeats" está ligado. */
function isSessionNoiseAction(action: string): boolean {
  const a = String(action || "").toLowerCase();
  return (
    a === "access.session.activity" ||
    a === "access.session.start" ||
    a === "access.session" ||
    a === "session.activity" ||
    a === "session.start"
  );
}

export async function handleAdminAuditLogs(sb: SupabaseClient, query: URLSearchParams) {
  const limit = Math.min(500, Math.max(1, Number(query.get("limit") || 100)));
  const offset = Math.max(0, Number(query.get("offset") || 0));
  const filterAction = String(query.get("action") || "").trim();
  const filterStatus = String(query.get("status") || "").trim();
  const filterTerreiro = String(query.get("terreiroId") || "").trim();
  const filterUser = String(query.get("userId") || "").trim();
  const hideHeartbeats = String(query.get("hideHeartbeats") || "1") !== "0";

  // Sem filtro: busca justa por fonte (evita session/login engolir WA e outras ações).
  const fairMode = !filterAction;
  const perSourceCap = fairMode
    ? Math.min(300, Math.max(80, Math.ceil(limit * 0.7) + 40))
    : Math.min(500, offset + limit + 150);

  const wantAudit =
    !filterAction ||
    (!filterAction.startsWith("access.") && !filterAction.startsWith("wa."));
  const wantAccess = !filterAction || filterAction.startsWith("access.");
  const wantWa = !filterAction || filterAction.startsWith("wa.");

  let auditRows: UnifiedAuditRow[] = [];
  let auditTableMissing = false;
  let waNotice: string | undefined;

  if (wantAudit) {
    try {
      let q = sb
        .from("audit_logs")
        .select("id, created_at, action, status, terreiro_id, details, ip, user_agent, user_id, user_email");
      if (filterAction && !filterAction.startsWith("access.") && !filterAction.startsWith("wa.")) {
        q = q.eq("action", filterAction);
      }
      if (filterStatus === "success" || filterStatus === "failed") q = q.eq("status", filterStatus);
      if (filterTerreiro) q = q.eq("terreiro_id", filterTerreiro);
      const { data: rows, error } = await q
        .order("created_at", { ascending: false })
        .range(0, perSourceCap - 1);

      if (error && isMissingOrUnknownTable(error, "audit_logs")) {
        auditTableMissing = true;
      } else if (error) {
        throw error;
      } else {
        auditRows = (rows || []).map((r) => ({
          ...(r as UnifiedAuditRow),
          source: "audit_logs" as const,
        }));
      }
    } catch (e: unknown) {
      if (!isMissingOrUnknownTable(e as { message?: string }, "audit_logs")) throw e;
      auditTableMissing = true;
    }
  }

  let accessRows: UnifiedAuditRow[] = [];
  let accessTableMissing = false;

  if (wantAccess) {
    try {
      const cols =
        "id, created_at, event_type, user_id, user_email, target_type, target_id, description, ip, user_agent, metadata, tenant_id";
      // Busca um pouco a mais quando vamos descartar sessões no cliente
      const accessFetch = hideHeartbeats && fairMode ? Math.min(500, perSourceCap * 3) : perSourceCap;
      let q = sb.from("access_logs").select(cols);
      if (filterAction.startsWith("access.")) {
        q = q.eq("event_type", filterAction.slice("access.".length));
      }
      if (filterTerreiro) q = q.eq("tenant_id", filterTerreiro);
      if (filterUser) q = q.eq("user_id", filterUser);
      // Filtra sessões no banco para não engolir insight/WA/auth na página
      if (hideHeartbeats) {
        q = q.not("event_type", "in", "(session.activity,session.start,session)");
      }
      const { data, error } = await q.order("created_at", { ascending: false }).range(0, accessFetch - 1);
      if (error && isMissingOrUnknownTable(error, "access_logs")) {
        accessTableMissing = true;
      } else if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (/column .* does not exist|could not find the .* column/.test(msg)) {
          accessTableMissing = true;
        } else {
          throw error;
        }
      } else {
        accessRows = (data || [])
          .map((r) => mapAccessLogRow(r as Record<string, unknown>))
          .filter((r) => !(hideHeartbeats && fairMode && isSessionNoiseAction(r.action)))
          .slice(0, perSourceCap);
      }
    } catch (e: unknown) {
      if (isMissingOrUnknownTable(e as { message?: string }, "access_logs")) {
        accessTableMissing = true;
      } else {
        const msg = String((e as { message?: string })?.message || "").toLowerCase();
        if (!/column .* does not exist|could not find the .* column/.test(msg)) throw e;
        accessTableMissing = true;
      }
    }
  }

  let waRows: UnifiedAuditRow[] = [];
  let waTableMissing = false;

  if (wantWa) {
    try {
      let q = sb
        .from("whatsapp_logs")
        .select("id, created_at, tenant_id, tipo, telefone, mensagem, status");
      if (filterAction.startsWith("wa.")) {
        q = q.eq("tipo", filterAction.slice("wa.".length));
      }
      if (filterTerreiro) q = q.eq("tenant_id", filterTerreiro);
      const { data, error } = await q.order("created_at", { ascending: false }).range(0, perSourceCap - 1);
      if (error && isMissingOrUnknownTable(error, "whatsapp_logs")) {
        waTableMissing = true;
      } else if (error) {
        console.warn("[admin-audit-logs] whatsapp_logs:", error.message);
        waNotice = `WhatsApp logs indisponíveis: ${error.message}`;
      } else {
        waRows = (data || []).map((r) => {
          const tipo = String((r as { tipo?: string }).tipo || "mensagem");
          const tel = String((r as { telefone?: string }).telefone || "");
          const msg = String((r as { mensagem?: string }).mensagem || "").slice(0, 120);
          const st = String((r as { status?: string }).status || "success").toLowerCase();
          return {
            id: `wa:${String((r as { id?: string }).id || "")}`,
            created_at: String((r as { created_at?: string }).created_at || ""),
            action: `wa.${tipo}`,
            status: st === "failed" || st === "error" ? "failed" : "success",
            terreiro_id: (r as { tenant_id?: string }).tenant_id
              ? String((r as { tenant_id?: string }).tenant_id)
              : null,
            details: {
              description: msg || `WhatsApp ${tipo}`,
              telefone: tel || null,
              tipo,
            },
            ip: null,
            user_agent: null,
            user_id: null,
            user_email: tel ? `wa:${tel}` : null,
            source: "whatsapp_logs" as UnifiedAuditRow["source"],
          };
        });
      }
    } catch (e: unknown) {
      if (isMissingOrUnknownTable(e as { message?: string }, "whatsapp_logs")) {
        waTableMissing = true;
      } else {
        console.warn("[admin-audit-logs] whatsapp_logs exception:", e);
        waNotice = "Falha ao ler whatsapp_logs.";
      }
    }
  }

  const isNoise = (r: UnifiedAuditRow) => hideHeartbeats && isSessionNoiseAction(r.action);

  let merged: UnifiedAuditRow[];
  if (fairMode) {
    const a = auditRows.filter((r) => !isNoise(r));
    const x = accessRows.filter((r) => !isNoise(r));
    const w = waRows.filter((r) => !isNoise(r));
    // Intercala por horário mantendo presença de cada fonte no topo da página
    merged = [...a, ...x, ...w];
  } else {
    merged = [...auditRows, ...accessRows, ...waRows].filter((r) => !isNoise(r));
  }

  if (filterAction.startsWith("access.") || filterAction.startsWith("wa.")) {
    merged = merged.filter((r) => r.action === filterAction);
  }
  if (filterStatus === "success" || filterStatus === "failed") {
    merged = merged.filter((r) => r.status === filterStatus);
  }
  merged.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  // Em modo "Todas", garante quota mínima de cada fonte na página (depois do sort temporal)
  let page: UnifiedAuditRow[];
  if (fairMode && offset === 0) {
    const bySource = {
      audit_logs: merged.filter((r) => r.source === "audit_logs"),
      access_logs: merged.filter((r) => r.source === "access_logs"),
      whatsapp_logs: merged.filter((r) => r.source === "whatsapp_logs"),
    };
    const quota = Math.max(25, Math.floor(limit / 3));
    const picked = new Set<string>();
    const fair: UnifiedAuditRow[] = [];
    for (const key of ["whatsapp_logs", "audit_logs", "access_logs"] as const) {
      for (const row of bySource[key].slice(0, quota)) {
        if (picked.has(row.id)) continue;
        picked.add(row.id);
        fair.push(row);
      }
    }
    for (const row of merged) {
      if (fair.length >= limit) break;
      if (picked.has(row.id)) continue;
      picked.add(row.id);
      fair.push(row);
    }
    fair.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    page = fair.slice(0, limit);
  } else {
    page = merged.slice(offset, offset + limit);
  }

  const actionSet = new Set<string>([
    "auth.login_success",
    "auth.login_failed",
    "auth.register_completed",
    "wa.dados_acesso",
    "wa.convite_evento",
    "wa.aviso_gira",
    "wa.cobranca_mensalidade",
    "wa.transmissao_aviso",
    "access.session.activity",
    "access.insight.dismissed",
  ]);
  for (const r of merged) actionSet.add(r.action);
  const actions = [...actionSet].filter(Boolean).sort();

  const auditLogState = getAuditLogsDisabled();
  let notice: string | undefined;
  if (auditTableMissing && accessTableMissing && waTableMissing) {
    notice = "Tabelas de log ausentes. Aplique as migrations em supabase/migrations/.";
  } else if (auditTableMissing) {
    notice = "audit_logs ausente — a mostrar access_logs e WhatsApp.";
  } else if (auditLogState.disabled) {
    notice = `Gravação em audit_logs pausada: ${auditLogState.reason || "erro anterior"}. Eventos antigos, access e WA continuam visíveis.`;
  }
  if (waNotice) notice = notice ? `${notice} ${waNotice}` : waNotice;

  return {
    rows: page,
    auditLogsAvailable: !auditTableMissing || !accessTableMissing || !waTableMissing,
    notice,
    actions,
    sources: {
      audit_logs: !auditTableMissing,
      access_logs: !accessTableMissing,
      whatsapp_logs: !waTableMissing && !waNotice,
    },
    counts: {
      audit: auditRows.length,
      access: accessRows.length,
      whatsapp: waRows.length,
      page: page.length,
    },
    hideHeartbeats,
  };
}

export async function handleAdminTenants(sb: SupabaseClient) {
  const [profilesRes, subsRes, childrenRes, plans] = await Promise.all([
    sb
      .from("perfil_lider")
      .select("id, tenant_id, email, nome_terreiro, cargo, updated_at, is_blocked, deleted_at")
      .is("deleted_at", null),
    sb.from("subscriptions").select("id, plan, expires_at, status, pending_since"),
    sb.from("filhos_de_santo").select("tenant_id, lider_id, user_id"),
    loadPlansCatalog(sb),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (subsRes.error) throw subsRes.error;
  if (childrenRes.error) throw childrenRes.error;

  const profiles = profilesRes.data;
  const subs = subsRes.data;
  const childrenList = (childrenRes.data || []) as {
    tenant_id?: string | null;
    lider_id?: string | null;
    user_id?: string | null;
  }[];
  const childUserIdSet = new Set<string>(
    childrenList.map((c) => String(c.user_id || "")).filter(Boolean)
  );

  const realTenants =
    profiles?.filter((p: { id: string; email?: string | null }) => {
      if (childUserIdSet.has(String(p.id))) return false;
      if (isShadowFilhoEmail(p.email)) return false;
      return true;
    }) || [];

  const augmentedProfiles = realTenants.map((p: { id: string; tenant_id?: string | null; updated_at?: string | null }) => {
    const sub = subs?.find((s: { id?: string }) => s.id === p.id);
    return {
      ...p,
      totalChildren: countFilhosForPerfilLider({ id: p.id, tenant_id: p.tenant_id }, childrenList),
      plan: sub?.plan || "premium",
      expires_at: sub?.expires_at ?? null,
      subscription_status: sub?.status ?? null,
      created_at: (sub as { pending_since?: string | null })?.pending_since ?? p.updated_at ?? null,
    };
  });

  return { profiles: augmentedProfiles, plans };
}
