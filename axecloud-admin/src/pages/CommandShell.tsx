import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Cloud,
  Copy,
  FileJson2,
  Info,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, setAccessToken } from "@/lib/api";
import { cn } from "@/lib/cn";
import { admin, eventTypeBadgeClass } from "@/lib/adminTheme";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { TenantDrawer } from "./TenantDrawer";
import { AuditPanel } from "./AuditPanel";
import { AuditMonitor } from "./AuditMonitor";

type Tab = "overview" | "tenants" | "logs" | "storage" | "create" | "demo" | "plans" | "whatsapp" | "audit" | "monitor";

type Overview = {
  leadersCount: number;
  filhosCount: number;
  subscriptionsCount: number;
  planHistogram: Record<string, number>;
  accessLogsAvailable: boolean;
  accessEventsLast7Days: number;
};

type TenantRow = {
  id: string;
  email: string | null;
  nome_terreiro: string | null;
  cargo: string | null;
  is_blocked?: boolean | null;
  plan?: string;
  expires_at?: string | null;
  totalChildren?: number;
};


const NAV: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "tenants", label: "Terreiros", icon: Building2 },
  { id: "logs", label: "Entradas / logs", icon: ScrollText },
  { id: "storage", label: "Armazenamento R2", icon: Cloud },
  { id: "create", label: "Novo terreiro", icon: PlusCircle },
  { id: "demo", label: "Conta demo", icon: Sparkles },
  { id: "plans", label: "Planos globais", icon: FileJson2 },
  { id: "whatsapp", label: "WhatsApp admin", icon: MessageCircle },
  { id: "audit", label: "Auditoria", icon: ShieldCheck },
  { id: "monitor", label: "Monitor contínuo", icon: Activity },
];

export function CommandShell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [plansCatalog, setPlansCatalog] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [logEmails, setLogEmails] = useState<Record<string, string>>({});
  const [logEventTypes, setLogEventTypes] = useState<string[]>([]);
  const [logFilterType, setLogFilterType] = useState<string>("");
  const [logsAvailable, setLogsAvailable] = useState<boolean>(true);
  const [logsNotice, setLogsNotice] = useState<string>("");
  const [r2, setR2] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);

  const email = session.user.email || "";

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
    if (logFilterType) qs.set("eventType", logFilterType);
    const j = await apiJson<{
      rows: any[];
      emailByUser: Record<string, string>;
      accessLogsAvailable?: boolean;
      notice?: string;
      eventTypes?: string[];
    }>(`/api/admin-console/access-logs?${qs.toString()}`);
    setLogs(j.rows || []);
    setLogEmails(j.emailByUser || {});
    setLogsAvailable(j.accessLogsAvailable !== false);
    setLogsNotice(j.notice || "");
    if (Array.isArray(j.eventTypes) && j.eventTypes.length) setLogEventTypes(j.eventTypes);
  }, [logFilterType]);

  const refreshR2 = useCallback(async () => {
    const j = await apiJson("/api/admin-console/r2-usage?maxKeys=12000");
    setR2(j);
  }, []);

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
    if (tab === "storage") {
      void refreshR2().catch((e) => setMsg(String(e.message)));
    }
  }, [tab, refreshLogs, refreshR2]);

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

  const dailySeries = useMemo(() => {
    const d = activity?.dailyAccess as Record<string, number> | undefined;
    if (!d) return [];
    return Object.entries(d)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [activity]);

  const maxDaily = useMemo(() => Math.max(1, ...dailySeries.map(([, c]) => c)), [dailySeries]);

  return (
    <div className={admin.shell}>
      <aside className={`${admin.sidebar} p-5`}>
        <div className="mb-8 border-b border-neutral-800 pb-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 bg-black">
            <Activity className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <p className={admin.kicker}>Administração</p>
          <h1 className="mt-1 text-lg font-semibold text-white">AxéCloud</h1>
          <p className="mt-1 text-sm text-neutral-500">Console global de operação.</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setMsg(null);
                  setTab(n.id);
                }}
                className={cn("admin-nav-item", active ? "admin-nav-item-active" : "admin-nav-item-idle")}>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 border-t border-neutral-800 pt-5">
          <div className="truncate rounded-md bg-neutral-900 px-2.5 py-2 text-[11px] text-neutral-400 ring-1 ring-neutral-800">
            <Users className="mb-1 inline h-3 w-3 text-neutral-500" />
            <span className="block truncate font-medium text-neutral-300">{email}</span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className={`${admin.btnSecondary} w-full`}
          >
            <LogOut className="h-3 w-3" /> Terminar sessão
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className={admin.mainHeader}>
          <div>
            <p className={admin.kicker}>Secção</p>
            <h2 className="mt-0.5 text-xl font-semibold text-white">{NAV.find((x) => x.id === tab)?.label}</h2>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1 lg:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setMsg(null);
                  setTab(n.id);
                }}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === n.id ? "bg-white text-black" : "border border-neutral-700 text-neutral-400 hover:text-white"
                )}
              >
                {n.label}
              </button>
            ))}
          </div>
        </header>

        <main className={admin.main}>
          {msg && (
            <div
              className={cn(admin.alertInfo, /concluída|guardados|criado|criada|demo criada/i.test(msg) ? admin.alertSuccess : admin.alertError)}
            >
              {/concluída|guardados|criado|criada|demo criada/i.test(msg) ? null : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
              )}
              <p className="min-w-0 flex-1 leading-relaxed">{msg}</p>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Terreiros"
                  hint="terreiros activos"
                  value={busy && !overview ? "…" : (overview?.leadersCount ?? "—")}
                  icon={Building2}
                  />
                <StatCard
                  label="Filhos de santo"
                  hint="registos"
                  value={busy && !overview ? "…" : (overview?.filhosCount ?? "—")}
                  icon={Users}
                  />
                <StatCard
                  label="Acessos (7d)"
                  hint={overview?.accessLogsAvailable === false ? "tabela opcional" : "eventos registados"}
                  value={
                    busy && !overview
                      ? "…"
                      : overview?.accessLogsAvailable === false
                        ? "—"
                        : String(overview?.accessEventsLast7Days ?? "—")
                  }
                  icon={Activity}
                  />
              </div>

              {overview?.accessLogsAvailable === false && (
                <div className="flex items-start gap-3 rounded-md border border-neutral-600 bg-neutral-900 px-4 py-3 text-sm text-neutral-300/95">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                  <p>
                    A tabela <code className="admin-mono text-neutral-300">access_logs</code> não existe neste
                    projecto Supabase — métricas de acesso ficam desactivadas. O resto do painel funciona normalmente.
                  </p>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-5 shadow-md shadow-black/20 ring-1 ring-neutral-800 backdrop-blur-md">
                  <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-white">
                    <BarChart3 className="h-4 w-4 text-neutral-400" /> Distribuição de planos
                  </h3>
                  <ul className="space-y-2">
                    {Object.entries(overview?.planHistogram || {}).map(([k, v]) => (
                      <li
                        key={k}
                        className="flex items-center justify-between gap-3 rounded-md bg-neutral-900 px-3 py-2 ring-1 ring-neutral-800"
                      >
                        <span className="admin-mono text-[13px] text-neutral-300">{k}</span>
                        <span className="rounded-md bg-neutral-900 px-2 py-0.5 admin-mono text-[13px] font-semibold text-neutral-100 ring-1 ring-neutral-800">
                          {v}
                        </span>
                      </li>
                    ))}
                    {!Object.keys(overview?.planHistogram || {}).length && (
                      <li className="rounded-md border border-dashed border-white/10 py-8 text-center text-[13px] text-neutral-500">
                        Sem dados de planos para mostrar.
                      </li>
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-5 shadow-md shadow-black/20 ring-1 ring-neutral-800 backdrop-blur-md">
                  <h3 className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-white">
                    <Activity className="h-4 w-4 text-white/80" /> Ritmo de acessos
                  </h3>
                  <p className="mb-4 text-[11px] text-neutral-500">Últimos dias com dados em access_logs (quando existir).</p>
                  <div className="flex h-44 items-end gap-1.5 rounded-md bg-black/20 px-2 pb-2 pt-4 ring-1 ring-neutral-800">
                    {dailySeries.map(([day, count]) => {
                      const hPct = Math.round((count / maxDaily) * 100);
                      const hPx = 12 + Math.round((hPct / 100) * 120);
                      return (
                        <div key={day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                          <div
                            className="w-full max-w-[22px] rounded-t-sm bg-neutral-500"
                            style={{ height: `${hPx}px` }}
                            title={`${day}: ${count}`}
                          />
                          <span className="text-[10px] font-medium text-neutral-500">{day.slice(8)}</span>
                        </div>
                      );
                    })}
                    {!dailySeries.length && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                        <p className="text-sm text-neutral-400">Sem série temporal.</p>
                        <p className="max-w-xs text-xs text-neutral-600">
                          Cria a tabela de logs no Supabase ou ignora este gráfico — não afecta terreiros nem
                          subscrições.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "tenants" && (
            <div className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950 shadow-md ring-1 ring-neutral-800">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-neutral-800 bg-black/25 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Terreiro</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Expira</th>
                    <th className="px-4 py-3">Filhos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {tenants.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setDrawerTenantId(row.id)}
                      className="cursor-pointer transition-colors hover:bg-neutral-900"
                      title="Ver detalhes do terreiro"
                    >
                      <td className="px-4 py-3 font-medium text-white">{row.nome_terreiro || "—"}</td>
                      <td className="px-4 py-3 admin-mono text-[11px] text-neutral-400">{row.email}</td>
                      <td className="px-4 py-3 text-neutral-200">{row.plan || "—"}</td>
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        {row.expires_at ? format(new Date(row.expires_at), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">{row.totalChildren ?? 0}</td>
                      <td className="px-4 py-3">
                        {row.is_blocked ? (
                          <span className="admin-badge-muted">Bloqueado</span>
                        ) : (
                          <span className="admin-badge-strong">Activo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <MiniBtn onClick={() => void manageTenant(row.id, "renew", { amount: "1", unit: "months" })}>
                            +1 mês
                          </MiniBtn>
                          <MiniBtn onClick={() => void manageTenant(row.id, "set-lifetime")}>Vita</MiniBtn>
                          <MiniBtn onClick={() => void manageTenant(row.id, "block")}>Bloq.</MiniBtn>
                          <MiniBtn onClick={() => void manageTenant(row.id, "unblock")}>Desbloq.</MiniBtn>
                          <MiniBtn
                            onClick={() => {
                              if (confirm("Marcar terreiro como eliminado (soft delete)?")) {
                                void manageTenant(row.id, "delete");
                              }
                            }}
                          >
                            Soft del
                          </MiniBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {busy && <p className="p-4 text-xs text-neutral-500">A processar…</p>}
            </div>
          )}

          {tab === "logs" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 shadow-xl ring-1 ring-neutral-800">
                <span className="text-xs uppercase tracking-widest text-neutral-500">Tipo</span>
                <select
                  value={logFilterType}
                  onChange={(e) => setLogFilterType(e.target.value)}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-neutral-200 outline-none focus:border-neutral-300/40"
                >
                  <option value="">Todos os eventos</option>
                  {logEventTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void refreshLogs()}
                  className="rounded-md border border-white/10 bg-neutral-900 px-3 py-1 text-xs text-neutral-200 transition hover:bg-neutral-900"
                >
                  Actualizar
                </button>
                <span className="ml-auto text-[11px] text-neutral-500">
                  {logs.length} {logs.length === 1 ? "linha" : "linhas"}
                </span>
              </div>

              <div className="rounded-md border border-neutral-800 bg-neutral-950 shadow-xl ring-1 ring-neutral-800">
                {!logsAvailable ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    <ScrollText className="h-10 w-10 text-neutral-300/70" />
                    <p className="text-sm font-medium text-neutral-200">Tabela <code className="admin-mono text-neutral-300">access_logs</code> ainda não existe</p>
                    <p className="max-w-md text-xs leading-relaxed text-neutral-400">
                      {logsNotice || "Crie a tabela no Supabase para começar a registar eventos."}
                    </p>
                    <p className="max-w-lg text-[11px] leading-relaxed text-neutral-500">
                      Aplique o ficheiro{" "}
                      <code className="admin-mono text-neutral-200/90">supabase/migrations/20260513192500_access_logs.sql</code>{" "}
                      no SQL Editor do Supabase. Depois reinicie o backend e os eventos passarão a aparecer aqui em tempo real.
                    </p>
                  </div>
                ) : !logs.length ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    <ScrollText className="h-10 w-10 text-neutral-600" />
                    <p className="text-sm font-medium text-neutral-300">Sem eventos registados ainda</p>
                    <p className="max-w-md text-xs leading-relaxed text-neutral-500">
                      Faça uma ação no sistema (login de filho, criar terreiro, mudar plano, etc.) para gerar o primeiro evento.
                    </p>
                  </div>
                ) : (
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-neutral-800 bg-black/25 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                      <tr>
                        <th className="px-4 py-3">Quando</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Utilizador</th>
                        <th className="px-4 py-3">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {logs.map((r) => {
                        const type = String(r.event_type || "");
                        const tone = eventTypeBadgeClass(type);
                        const userLabel =
                          r.user_email ||
                          logEmails[r.user_id] ||
                          (r.user_id ? String(r.user_id).slice(0, 8) : "—");
                        return (
                          <tr key={r.id} className="text-xs text-neutral-300 hover:bg-neutral-900">
                            <td className="px-4 py-3 whitespace-nowrap admin-mono text-neutral-400">
                              {r.created_at ? format(new Date(r.created_at), "dd/MM HH:mm") : "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {type ? (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
                                  {type}
                                </span>
                              ) : (
                                <span className="text-neutral-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-200">
                              {r.description || (
                                <span className="text-neutral-500">{r.target_type ? `${r.target_type}: ${r.target_id || ""}` : "—"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 admin-mono text-neutral-400">{userLabel}</td>
                            <td className="px-4 py-3 admin-mono text-neutral-500">{r.ip || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === "storage" && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950 p-6 shadow-xl ring-1 ring-neutral-800">
              {!r2?.configured ? (
                <p className="text-sm text-neutral-400">{r2?.message || "A carregar…"}</p>
              ) : (
                <>
                  <p className="mb-4 text-xs text-neutral-500">
                    Amostra de até {r2.keysScanned} chaves no bucket R2 (prefixo = pasta / tenant).{" "}
                    {r2.truncated ? "Resultado truncado." : ""}
                  </p>
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[10px] font-semibold uppercase text-neutral-500">
                      <tr>
                        <th className="py-2">Prefixo</th>
                        <th className="py-2">Objectos</th>
                        <th className="py-2">MB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(r2.tenants || []).map((t: any) => (
                        <tr key={t.tenantPrefix} className="border-t border-white/5 admin-mono text-xs">
                          <td className="py-2 text-neutral-200">{t.tenantPrefix}</td>
                          <td className="py-2">{t.objects}</td>
                          <td className="py-2">{t.mb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {tab === "create" && <CreateTenantForm onDone={() => void refreshTenants()} />}
          {tab === "demo" && <DemoForm />}
          {tab === "plans" && <PlansEditor initial={plansCatalog} />}
          {tab === "whatsapp" && <WhatsAppPanel />}
          {tab === "audit" && <AuditPanel />}

          {tab === "monitor" && <AuditMonitor />}
        </main>
      </div>

      <TenantDrawer
        tenantId={drawerTenantId}
        onClose={() => {
          setDrawerTenantId(null);
          void refreshTenants();
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  hint,
  value,
  icon: Icon,
}: {
  label: string;
  hint: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className={admin.statCard}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={admin.kicker}>{label}</p>
          <p className="mt-1 text-sm text-neutral-500">{hint}</p>
        </div>
        <div className="rounded-md border border-neutral-700 p-2">
          <Icon className="h-4 w-4 text-neutral-300" strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function MiniBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={admin.btnGhost}
    >
      {children}
    </button>
  );
}

/** Gera senha numérica aleatória de 8 dígitos via Web Crypto (sem viés). */
function generateNumericPassword(length = 8): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);
    let out = "";
    for (let i = 0; i < length; i++) out += String(buf[i] % 10);
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i++) out += String(Math.floor(Math.random() * 10));
  return out;
}

function CreateTenantForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generateNumericPassword(8));
  const [pwdCopied, setPwdCopied] = useState(false);
  const [nomeTerreiro, setNomeTerreiro] = useState("");
  const [nomeZelador, setNomeZelador] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plan, setPlan] = useState<"premium" | "vita">("premium");
  const [status, setStatus] = useState<string | null>(null);

  function regeneratePassword() {
    setPassword(generateNumericPassword(8));
    setPwdCopied(false);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard?.writeText(password);
      setPwdCopied(true);
      window.setTimeout(() => setPwdCopied(false), 1500);
    } catch {
      /* clipboard pode estar bloqueado; ignorar silenciosamente */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      const r = await apiJson<{ welcome?: { status?: string } }>("/api/admin/create-tenant", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          nome_terreiro: nomeTerreiro,
          nome_zelador: nomeZelador,
          whatsapp,
          plan,
          observacao: "axecloud-admin",
        }),
      });
      const w = String(r?.welcome?.status || "");
      let suffix = "";
      if (w === "queued") suffix = " · WhatsApp de boas-vindas em rota.";
      else if (w === "no-phone") suffix = " · sem WhatsApp do zelador — boas-vindas pulada.";
      else if (w === "disabled") suffix = " · boas-vindas desligada nas configurações.";
      setStatus(`Terreiro criado.${suffix}`);
      onDone();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-md space-y-3 rounded-md border border-neutral-800 bg-neutral-950 p-5 shadow-lg ring-1 ring-neutral-800"
    >
      <div className="border-b border-neutral-800 pb-3">
        <h3 className="text-sm font-semibold text-white">Criar conta + terreiro</h3>
        <p className="mt-0.5 text-[11px] text-neutral-500">Cria o usuário no Auth, perfil e plano em uma única operação.</p>
      </div>

      <Field label="E-mail" value={email} onChange={setEmail} type="email" required />

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Senha inicial</label>
        <div className="mt-1 flex items-stretch gap-1.5">
          <input
            className="flex-1 rounded-md border border-white/10 bg-neutral-950 px-2.5 py-1.5 admin-mono text-sm  text-neutral-100 outline-none ring-neutral-400/20 focus:ring-2"
            value={password}
            required
            type="text"
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 8))}
            aria-label="Senha numérica de 8 dígitos"
          />
          <button
            type="button"
            onClick={regeneratePassword}
            title="Gerar nova senha"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-neutral-900 px-2.5 text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void copyPassword()}
            title="Copiar senha"
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-2.5 transition",
              pwdCopied
                ? "border-neutral-500 bg-neutral-900 text-white"
                : "border-white/10 bg-neutral-900 text-neutral-300 hover:bg-neutral-900 hover:text-white"
            )}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
          8 dígitos numéricos gerados automaticamente. Regenere ou edite antes de criar.
        </p>
      </div>

      <Field label="Nome do terreiro" value={nomeTerreiro} onChange={setNomeTerreiro} required />
      <Field label="Nome do zelador" value={nomeZelador} onChange={setNomeZelador} />
      <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Plano</label>
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 outline-none ring-neutral-400/20 focus:ring-2"
          value={plan}
          onChange={(e) => setPlan(e.target.value as typeof plan)}
        >
          <option value="premium">Premium (renovável)</option>
          <option value="vita">Plano Vita (vitalício)</option>
        </select>
      </div>
      {status && (
        <p className={cn("text-xs", /criado|criada/i.test(status) ? "text-white" : "text-white")}>
          {status}
        </p>
      )}
      <button
        type="submit"
        className="mt-1 w-full rounded-md bg-neutral-100 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-white active:bg-neutral-200"
      >
        Criar terreiro
      </button>
    </form>
  );
}

function DemoForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [days, setDays] = useState(14);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      const r = await apiJson<{ demoExpiresAt?: string }>("/api/admin-console/create-demo", {
        method: "POST",
        body: JSON.stringify({ email, password, demoDays: days }),
      });
      setStatus(`Demo criada. Expira: ${r.demoExpiresAt || "—"}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4 rounded-md border border-white/10 bg-neutral-900/50 p-6">
      <h3 className="text-lg font-bold text-white">Conta demonstração</h3>
      <p className="text-xs text-neutral-500">Plano premium com expiração curta; ideal para testes controlados.</p>
      <Field label="E-mail" value={email} onChange={setEmail} type="email" required />
      <Field label="Senha" value={password} onChange={setPassword} type="password" required />
      <div>
        <label className="text-xs font-bold uppercase text-neutral-500">Duração (dias)</label>
        <input
          type="number"
          min={3}
          max={90}
          className="mt-1 w-full rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </div>
      {status && <p className="text-sm text-white">{status}</p>}
      <button type="submit" className={`${admin.btnPrimary} w-full`}>
        Gerar demo
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{label}</label>
      <input
        className="mt-1 w-full rounded-md border border-white/10 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 outline-none ring-neutral-400/20 focus:ring-2"
        value={value}
        required={required}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
