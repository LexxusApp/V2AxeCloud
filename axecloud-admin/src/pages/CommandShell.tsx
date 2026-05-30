import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import { FileJson2, ScrollText, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, setAccessToken } from "@/lib/api";
import { cn } from "@/lib/cn";
import { admin, auditStatusBadgeClass, eventTypeBadgeClass } from "@/lib/adminTheme";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { TenantDrawer } from "./TenantDrawer";
import { AuditMonitor } from "./AuditMonitor";
import { AdminDashboardLayout, type AdminNavTab } from "./AdminDashboardLayout";
import { OverviewPanel } from "./OverviewPanel";
import { TenantsTable } from "./TenantsTable";
import { QuickActionDialogs, type QuickActionKind } from "./QuickActionDialogs";
import { FounderProgramPanel } from "./FounderProgramPanel";
import { SupabaseMetricsPanel } from "./SupabaseMetricsPanel";
import { StoragePanel } from "./StoragePanel";
import { CreateTenantPage } from "./CreateTenantPage";
import { DemoAccountPanel } from "./DemoAccountPanel";
import { founderRowToPrefill, type FounderTenantPrefill } from "@/lib/founderPrefill";

type Tab = AdminNavTab;

type Overview = {
  leadersCount: number;
  filhosCount: number;
  subscriptionsCount: number;
  planHistogram: Record<string, number>;
  accessLogsAvailable: boolean;
  accessEventsLast7Days: number;
  founderApplications?: {
    available: boolean;
    pending: number;
    total: number;
    remainingSlots: number;
  };
};

type TenantRow = {
  id: string;
  email: string | null;
  nome_terreiro: string | null;
  cargo: string | null;
  is_blocked?: boolean | null;
  plan?: string;
  expires_at?: string | null;
  created_at?: string | null;
  totalChildren?: number;
};


function userDisplayName(session: Session): string {
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const full = typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full;
  const email = session.user.email || "";
  const local = email.split("@")[0] || "Admin";
  return local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function userInitials(session: Session): string {
  const name = userDisplayName(session);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function CommandShell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plansCatalog, setPlansCatalog] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [logEventTypes, setLogEventTypes] = useState<string[]>([]);
  const [logFilterType, setLogFilterType] = useState<string>("");
  const [logsAvailable, setLogsAvailable] = useState<boolean>(true);
  const [logsNotice, setLogsNotice] = useState<string>("");
  const [activity, setActivity] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [quickAction, setQuickAction] = useState<QuickActionKind>(null);
  const [founderPrefill, setFounderPrefill] = useState<FounderTenantPrefill | null>(null);

  const email = session.user.email || "";
  const displayName = userDisplayName(session);
  const initials = userInitials(session);

  const refreshOverview = useCallback(async () => {
    const o = await apiJson<Overview>("/api/admin-console/overview");
    setOverview(o);
  }, []);

  const refreshTenants = useCallback(async () => {
    const t = await apiJson<{ profiles: TenantRow[]; plans: Record<string, unknown> }>("/api/admin/tenants");
    setTenants(t.profiles || []);
    setPlansCatalog(t.plans || {});
  }, []);

  const refreshLogs = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "200" });
    if (logFilterType) qs.set("action", logFilterType);
    const j = await apiJson<{
      rows: any[];
      auditLogsAvailable?: boolean;
      notice?: string;
      actions?: string[];
    }>(`/api/admin-console/audit-logs?${qs.toString()}`);
    setLogs(j.rows || []);
    setLogsAvailable(j.auditLogsAvailable !== false);
    setLogsNotice(j.notice || "");
    if (Array.isArray(j.actions) && j.actions.length) setLogEventTypes(j.actions);
  }, [logFilterType]);

  const refreshActivity = useCallback(async () => {
    const j = await apiJson("/api/admin-console/activity");
    setActivity(j);
  }, []);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      setMsg(null);
      const results = await Promise.allSettled([refreshOverview(), refreshTenants(), refreshActivity()]);
      const errs = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
      if (errs.length) setMsg(errs.join(" · "));
      setBusy(false);
    })();
  }, [refreshActivity, refreshOverview, refreshTenants]);

  useEffect(() => {
    if (tab === "logs") {
      void refreshLogs().catch((e) => setMsg(String(e.message)));
    }
  }, [tab, refreshLogs]);

  async function logout() {
    setAccessToken(null);
    await supabase?.auth.signOut();
  }

  async function manageTenant(targetUserId: string, action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      await apiJson("/api/admin/manage-tenant", {
        method: "POST",
        body: JSON.stringify({ targetUserId, action, ...extra }),
      });
      await refreshTenants();
      await refreshOverview();
      setMsg("Operação concluída.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTenant(targetUserId: string) {
    const row = tenants.find((t) => t.id === targetUserId);
    const label = row?.nome_terreiro || row?.email || targetUserId;
    if (
      !window.confirm(
        `Excluir permanentemente «${label}»?\n\nRemove dados do terreiro no banco, storage e contas de acesso. Não pode ser desfeito.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiJson("/api/admin/manage-tenant", {
        method: "POST",
        body: JSON.stringify({ targetUserId, action: "permanent-delete" }),
      });
      if (drawerTenantId === targetUserId) setDrawerTenantId(null);
      await refreshTenants();
      await refreshOverview();
      setMsg("Terreiro excluído permanentemente.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        (t.nome_terreiro || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.plan || "").toLowerCase().includes(q)
    );
  }, [tenants, tenantSearch]);

  function goTab(next: Tab) {
    setMsg(null);
    setTab(next);
  }

  function openCreateFromFounder(row: Parameters<typeof founderRowToPrefill>[0]) {
    setFounderPrefill(founderRowToPrefill(row));
    goTab("create");
    setMsg("Formulário pré-preenchido com dados do Programa Fundador.");
  }

  const quickActions = [
    {
      label: "Liberar acesso vitalício",
      onClick: () => {
        if (!tenants.length) {
          setMsg("Nenhum terreiro carregado. Actualize a página.");
          return;
        }
        setQuickAction("lifetime");
      },
    },
    { label: "Criar comunicado global", onClick: () => setQuickAction("notice") },
    { label: "Adicionar novo terreiro", onClick: () => goTab("create") },
    { label: "Enviar notificações", onClick: () => setQuickAction("notify") },
    { label: "Gerar relatório financeiro", onClick: () => setQuickAction("report") },
  ];

  async function refreshDashboard() {
    setBusy(true);
    try {
      await Promise.all([refreshOverview(), refreshTenants(), refreshActivity()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao actualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminDashboardLayout
        session={session}
        tab={tab}
        onTab={goTab}
        onLogout={() => void logout()}
        displayName={displayName}
        initials={initials}
        msg={msg}
        onDismissMsg={() => setMsg(null)}
      >
        <div key={tab} className="admin-tab-pane min-h-[min(50vh,28rem)]">
        {tab === "overview" && (
          <OverviewPanel
            overview={overview}
            tenants={tenants}
            activity={activity}
            plansCatalog={plansCatalog}
            busy={busy}
            tenantSearch={tenantSearch}
            onTenantSearchChange={setTenantSearch}
            onTab={goTab}
            onRefresh={() => void refreshDashboard()}
            onManage={setDrawerTenantId}
            onBlock={(id, shouldBlock) => void manageTenant(id, shouldBlock ? "block" : "unblock")}
            onRenewMonth={(id) => void manageTenant(id, "renew", { amount: "1", unit: "months" })}
            onLifetime={(id) => void manageTenant(id, "set-lifetime")}
            quickActions={quickActions}
          />
        )}

        {tab === "tenants" && (
          <TenantsTable
            rows={filteredTenants}
            search={tenantSearch}
            onSearchChange={setTenantSearch}
            busy={busy}
            onManage={setDrawerTenantId}
            onBlock={(id, shouldBlock) => void manageTenant(id, shouldBlock ? "block" : "unblock")}
            onRenewMonth={(id) => void manageTenant(id, "renew", { amount: "1", unit: "months" })}
            onLifetime={(id) => void manageTenant(id, "set-lifetime")}
            onDelete={(id) => void deleteTenant(id)}
          />
        )}

        {tab === "founders" && (
          <FounderProgramPanel onMessage={setMsg} onCreateTenant={openCreateFromFounder} />
        )}

        {tab === "logs" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-surface)] px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-[var(--ac-text-muted)]">Ação</span>
              <select
                value={logFilterType}
                onChange={(e) => setLogFilterType(e.target.value)}
                className="admin-input !w-auto min-w-[12rem]"
              >
                <option value="">Todas as ações</option>
                {logEventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void refreshLogs()} className="admin-btn-secondary">
                Actualizar
              </button>
              <span className="ml-auto text-xs text-[var(--ac-text-muted)]">
                {logs.length} {logs.length === 1 ? "linha" : "linhas"}
              </span>
            </div>
            <div className={admin.tableWrap}>
              {!logsAvailable ? (
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <ScrollText className="h-10 w-10 text-[var(--ac-text-faint)]" />
                  <p className="text-sm font-medium text-[var(--ac-text)]">
                    Tabela <code className="admin-mono text-[var(--ac-accent)]">audit_logs</code> ainda não existe
                  </p>
                  <p className="max-w-md text-xs text-[var(--ac-text-muted)]">
                    {logsNotice || "Aplique supabase/migrations/20260520120000_audit_logs.sql no Supabase."}
                  </p>
                </div>
              ) : !logs.length ? (
                <div className="py-16 text-center text-[var(--ac-text-muted)] text-sm">
                  Sem eventos de auditoria registados ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={cn(admin.table, "table-fixed")}>
                    <colgroup>
                      <col className="w-[5.75rem]" />
                      <col className="w-[6.5rem]" />
                      <col className="w-[4.25rem]" />
                      <col />
                      <col className="w-[5.5rem]" />
                      <col className="w-[4.25rem]" />
                      <col className="w-[5.75rem]" />
                    </colgroup>
                    <thead>
                      <tr className={admin.thead}>
                        <th className={cn(admin.th, "!px-2 !py-2")}>Quando</th>
                        <th className={cn(admin.th, "!px-2 !py-2")}>Ação</th>
                        <th className={cn(admin.th, "!px-2 !py-2")}>Estado</th>
                        <th className={cn(admin.th, "!px-2 !py-2")}>Detalhes</th>
                        <th className={cn(admin.th, "!px-2 !py-2")}>Utilizador</th>
                        <th className={cn(admin.th, "!px-2 !py-2")}>Terreiro</th>
                        <th className={cn(admin.th, "!px-2 !py-2")}>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((r) => {
                        const action = String(r.action || "");
                        const status = String(r.status || "");
                        const detailsObj = r.details && typeof r.details === "object" ? r.details : null;
                        const detailsText = detailsObj
                          ? [
                              detailsObj.email && `email: ${detailsObj.email}`,
                              detailsObj.mode && `modo: ${detailsObj.mode}`,
                              detailsObj.surface && `origem: ${detailsObj.surface}`,
                              detailsObj.reason && `motivo: ${detailsObj.reason}`,
                              detailsObj.path && `rota: ${detailsObj.path}`,
                              detailsObj.description && String(detailsObj.description).slice(0, 80),
                              detailsObj.message && String(detailsObj.message).slice(0, 80),
                              detailsObj.targetType && `alvo: ${detailsObj.targetType}`,
                              detailsObj.targetId && `id: ${String(detailsObj.targetId).slice(0, 8)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ") || JSON.stringify(detailsObj).slice(0, 100)
                          : "—";
                        const detailsDisplay =
                          detailsText.length > 72 ? `${detailsText.slice(0, 69)}…` : detailsText;
                        const userFull =
                          r.user_email ||
                          (r.user_id ? String(r.user_id) : "");
                        const userLabel = userFull
                          ? userFull.includes("@")
                            ? userFull.replace(/@.+$/, "")
                            : userFull.slice(0, 8)
                          : "—";
                        const terreiroLabel = r.terreiro_id ? String(r.terreiro_id).slice(0, 8) : "—";
                        const actionShort =
                          action.length > 22 ? `…${action.slice(-21)}` : action;
                        return (
                          <tr key={r.id} className={cn(admin.trHover, "border-b border-[var(--ac-paper-border)]")}>
                            <td className="px-2 py-2 whitespace-nowrap text-[var(--ac-text-muted)] text-[11px]">
                              {r.created_at ? format(new Date(r.created_at), "dd/MM HH:mm") : "—"}
                            </td>
                            <td className="px-2 py-2 max-w-0">
                              {action ? (
                                <span
                                  className={cn(
                                    "block truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                    eventTypeBadgeClass(action)
                                  )}
                                  title={action}
                                >
                                  {actionShort}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {status ? (
                                <span
                                  className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${auditStatusBadgeClass(status)}`}
                                >
                                  {status === "success" ? "OK" : status.slice(0, 6)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              className="px-2 py-2 max-w-0 truncate text-[11px] text-[var(--ac-text)]"
                              title={detailsText}
                            >
                              {detailsDisplay}
                            </td>
                            <td
                              className="px-2 py-2 max-w-0 truncate text-[11px] text-[var(--ac-text-muted)]"
                              title={userFull || undefined}
                            >
                              {userLabel}
                            </td>
                            <td
                              className="px-2 py-2 max-w-0 truncate admin-mono text-[11px] text-[var(--ac-text-faint)]"
                              title={r.terreiro_id || ""}
                            >
                              {terreiroLabel}
                            </td>
                            <td
                              className="px-2 py-2 max-w-0 truncate admin-mono text-[11px] text-[var(--ac-text-faint)]"
                              title={r.user_agent ? `${r.ip || ""} · ${r.user_agent}` : r.ip || ""}
                            >
                              {r.ip || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "metrics" && <SupabaseMetricsPanel onMessage={setMsg} />}

        {tab === "storage" && <StoragePanel onMessage={setMsg} />}

        {tab === "create" && (
          <CreateTenantPage
            prefill={founderPrefill}
            onClearPrefill={() => setFounderPrefill(null)}
            onDone={() => {
              setFounderPrefill(null);
              void refreshTenants();
              void refreshOverview();
            }}
          />
        )}
        {tab === "demo" && <DemoAccountPanel />}
        {tab === "plans" && <PlansEditor initial={plansCatalog} />}
        {tab === "whatsapp" && <WhatsAppPanel />}
        {tab === "monitor" && <AuditMonitor />}
        </div>
      </AdminDashboardLayout>

      <TenantDrawer
        tenantId={drawerTenantId}
        onClose={() => {
          setDrawerTenantId(null);
          void refreshTenants();
        }}
      />

      <QuickActionDialogs
        kind={quickAction}
        onClose={() => setQuickAction(null)}
        tenants={tenants}
        busy={busy}
        onLifetime={async (tenantId) => {
          await manageTenant(tenantId, "set-lifetime");
        }}
        onSuccess={(m) => setMsg(m)}
        onError={(m) => setMsg(m)}
      />
    </>
  );
}

type CatalogEntry = { name: string; price: number; description: string };

const CATALOG_DEFAULT_PREMIUM: CatalogEntry = {
  name: "Premium",
  price: 89.9,
  description: "Gestão espiritual e financeira completa para o seu terreiro. Plano renovável.",
};
const CATALOG_DEFAULT_VITA: CatalogEntry = {
  name: "Plano Vita",
  price: 49.9,
  description: "Vitalício — acesso completo sem expiração.",
};

function pickCatalogEntry(raw: Record<string, unknown>, key: "premium" | "vita", defaults: CatalogEntry): CatalogEntry {
  const row = raw[key];
  if (!row || typeof row !== "object") return { ...defaults };
  const o = row as Record<string, unknown>;
  return {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : defaults.name,
    price: typeof o.price === "number" && Number.isFinite(o.price) ? o.price : defaults.price,
    description:
      typeof o.description === "string" && o.description.trim() ? o.description.trim() : defaults.description,
  };
}

function PlanCatalogCard({
  title,
  subtitle,
  data,
  onChange,
}: {
  title: string;
  subtitle: string;
  data: CatalogEntry;
  onChange: (next: CatalogEntry) => void;
}) {
  return (
    <div className={admin.card}>
      <div className="space-y-3.5 p-5">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-[11px] text-neutral-500">{subtitle}</p>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Nome público</label>
          <input
            className="mt-1 w-full rounded-md border border-neutral-800 bg-black px-2.5 py-2 text-sm text-white outline-none ring-neutral-400/20 focus:ring-2"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Preço (referência)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            className="mt-1 w-full rounded-md border border-neutral-800 bg-black px-2.5 py-2 admin-mono text-sm text-neutral-100 outline-none ring-neutral-400/20 focus:ring-2"
            value={Number.isFinite(data.price) ? data.price : 0}
            onChange={(e) => onChange({ ...data, price: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Descrição</label>
          <textarea
            rows={4}
            className="mt-1 w-full resize-none rounded-md border border-neutral-800 bg-black px-2.5 py-2 text-sm leading-relaxed text-neutral-200 outline-none ring-neutral-400/20 focus:ring-2"
            value={data.description}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function PlansEditor({ initial }: { initial: Record<string, unknown> }) {
  const [premium, setPremium] = useState<CatalogEntry>(CATALOG_DEFAULT_PREMIUM);
  const [vita, setVita] = useState<CatalogEntry>(CATALOG_DEFAULT_VITA);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const raw = initial || {};
    setPremium(pickCatalogEntry(raw, "premium", CATALOG_DEFAULT_PREMIUM));
    setVita(pickCatalogEntry(raw, "vita", CATALOG_DEFAULT_VITA));
  }, [initial]);

  async function save() {
    setStatus(null);
    try {
      await apiJson("/api/admin/update-plans", {
        method: "POST",
        body: JSON.stringify({ plans: { premium, vita } }),
      });
      setStatus("Planos globais guardados.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Erro ao guardar");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="rounded-md border border-neutral-800 bg-neutral-900 px-5 py-4 ring-1 ring-neutral-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase  text-neutral-500">Catálogo</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Premium e Plano Vita</h3>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
              Estes dois planos são os únicos comerciais do AxéCloud. O preço do Premium alimenta checkout, Pix e
              cartão EFI na hora (tabela{" "}
              <code className="admin-mono text-neutral-200/90">global_settings</code>, id{" "}
              <code className="admin-mono text-neutral-200/90">plans</code>). Entradas antigas como Axé/Orô são
              ignoradas ao guardar.
            </p>
          </div>
          <FileJson2 className="hidden h-10 w-10 shrink-0 text-neutral-600 sm:block" aria-hidden />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanCatalogCard
          title="Premium"
          subtitle="Renovável — acesso completo às funções."
          data={premium}
          onChange={setPremium}
        />
        <PlanCatalogCard
          title="Plano Vita"
          subtitle="Vitalício — sem data de expiração."
          data={vita}
          onChange={setVita}
        />
      </div>

      {status && (
        <p
          className={
            /guardados/i.test(status)
              ? "text-sm font-medium text-white"
              : "text-sm font-medium text-white"
          }
        >
          {status}
        </p>
      )}
      <button
        type="button"
        onClick={() => void save()}
        className="rounded-md bg-neutral-100 px-6 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-white active:bg-neutral-200"
      >
        Guardar planos
      </button>
    </div>
  );
}
