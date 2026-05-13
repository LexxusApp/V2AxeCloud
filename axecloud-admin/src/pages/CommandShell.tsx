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
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiJson, setAccessToken } from "@/lib/api";
import { cn } from "@/lib/cn";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { TenantDrawer } from "./TenantDrawer";

type Tab = "overview" | "tenants" | "logs" | "storage" | "create" | "demo" | "plans" | "whatsapp";

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

function eventTypeTone(t: string): string {
  if (!t) return "bg-white/[0.05] text-slate-300";
  if (t.startsWith("tenant.created") || t.startsWith("demo.")) return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20";
  if (t.startsWith("tenant.block") || t.includes("delete") || t.endsWith("failed") || t.endsWith("-error")) return "bg-red-500/15 text-red-300 ring-1 ring-red-400/20";
  if (t.startsWith("tenant.unblock") || t.startsWith("tenant.renew") || t.startsWith("tenant.set-lifetime")) return "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20";
  if (t.startsWith("tenant.change-plan") || t.startsWith("plans.")) return "bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20";
  if (t.startsWith("filho.login")) return "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20";
  if (t.startsWith("whatsapp.")) return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20";
  if (t.startsWith("welcome-message.")) return "bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-400/20";
  if (t.includes("password")) return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20";
  return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/20";
}

const NAV: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "tenants", label: "Terreiros", icon: Building2 },
  { id: "logs", label: "Entradas / logs", icon: ScrollText },
  { id: "storage", label: "Armazenamento R2", icon: Cloud },
  { id: "create", label: "Novo terreiro", icon: PlusCircle },
  { id: "demo", label: "Conta demo", icon: Sparkles },
  { id: "plans", label: "Planos globais", icon: FileJson2 },
  { id: "whatsapp", label: "WhatsApp admin", icon: MessageCircle },
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
    <div className="relative flex min-h-full overflow-hidden bg-[#060910] text-[#e8edf5]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 20% -10%, rgba(34,211,238,0.22), transparent 55%),
            radial-gradient(ellipse 60% 40% at 100% 0%, rgba(167,139,250,0.18), transparent 50%),
            radial-gradient(ellipse 50% 30% at 50% 100%, rgba(16,185,129,0.08), transparent 45%)
          `,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <aside className="relative z-10 hidden w-[272px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0a101c]/90 p-6 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl lg:flex">
        <div className="mb-10">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400/25 to-violet-500/20 ring-1 ring-white/10">
            <Activity className="h-5 w-5 text-cyan-300" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-400/80">Console</p>
          <h1 className="mt-1 text-lg font-extrabold tracking-tight text-white">AxéCloud Command</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">Operação global do ecossistema.</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
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
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition-all",
                  active
                    ? "bg-gradient-to-r from-cyan-500/20 to-transparent text-white shadow-[inset_3px_0_0_0_rgba(34,211,238,0.9)] ring-1 ring-cyan-500/25"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"
                  )}
                />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-4 border-t border-white/[0.06] pt-6">
          <div className="truncate rounded-md bg-white/[0.03] px-3 py-2 text-xs text-slate-400 ring-1 ring-white/[0.05]">
            <Users className="mb-1 inline h-3.5 w-3.5 text-slate-500" />
            <span className="block truncate font-medium text-slate-300">{email}</span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.07]"
          >
            <LogOut className="h-3.5 w-3.5" /> Terminar sessão
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] bg-[#0a101c]/80 px-4 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">Secção</p>
            <h2 className="mt-0.5 text-xl font-bold tracking-tight text-white">{NAV.find((x) => x.id === tab)?.label}</h2>
          </div>
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setMsg(null);
                  setTab(n.id);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold",
                  tab === n.id
                    ? "bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40"
                    : "bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06]"
                )}
              >
                {n.label}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 space-y-8 overflow-y-auto p-4 pb-16 lg:p-10">
          {msg && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
                /concluída|guardados|criado|criada|demo criada/i.test(msg)
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-100"
                  : "border-rose-500/35 bg-rose-950/35 text-rose-100"
              )}
            >
              {/concluída|guardados|criado|criada|demo criada/i.test(msg) ? null : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              )}
              <p className="min-w-0 flex-1 leading-relaxed">{msg}</p>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
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
                  accent="cyan"
                />
                <StatCard
                  label="Filhos de santo"
                  hint="registos"
                  value={busy && !overview ? "…" : (overview?.filhosCount ?? "—")}
                  icon={Users}
                  accent="violet"
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
                  accent="emerald"
                />
              </div>

              {overview?.accessLogsAvailable === false && (
                <div className="flex items-start gap-3 rounded-md border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/95">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p>
                    A tabela <code className="font-mono-data text-amber-200">access_logs</code> não existe neste
                    projecto Supabase — métricas de acesso ficam desactivadas. O resto do painel funciona normalmente.
                  </p>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/80 p-6 shadow-xl shadow-black/20 ring-1 ring-white/[0.04] backdrop-blur-md">
                  <h3 className="mb-5 flex items-center gap-2 text-sm font-bold text-white">
                    <BarChart3 className="h-4 w-4 text-cyan-400" /> Distribuição de planos
                  </h3>
                  <ul className="space-y-3">
                    {Object.entries(overview?.planHistogram || {}).map(([k, v]) => (
                      <li
                        key={k}
                        className="flex items-center justify-between gap-3 rounded-md bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.05]"
                      >
                        <span className="font-mono-data text-sm text-slate-300">{k}</span>
                        <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono-data text-sm font-bold text-cyan-200">
                          {v}
                        </span>
                      </li>
                    ))}
                    {!Object.keys(overview?.planHistogram || {}).length && (
                      <li className="rounded-md border border-dashed border-white/10 py-8 text-center text-sm text-slate-500">
                        Sem dados de planos para mostrar.
                      </li>
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/80 p-6 shadow-xl shadow-black/20 ring-1 ring-white/[0.04] backdrop-blur-md">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="h-4 w-4 text-emerald-400" /> Ritmo de acessos
                  </h3>
                  <p className="mb-5 text-xs text-slate-500">Últimos dias com dados em access_logs (quando existir).</p>
                  <div className="flex h-44 items-end gap-1.5 rounded-md bg-black/20 px-2 pb-2 pt-4 ring-1 ring-white/[0.05]">
                    {dailySeries.map(([day, count]) => {
                      const hPct = Math.round((count / maxDaily) * 100);
                      const hPx = 12 + Math.round((hPct / 100) * 120);
                      return (
                        <div key={day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                          <div
                            className="w-full max-w-[22px] rounded-t-md bg-gradient-to-t from-cyan-600/90 via-teal-500/80 to-emerald-400/90 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                            style={{ height: `${hPx}px` }}
                            title={`${day}: ${count}`}
                          />
                          <span className="text-[10px] font-medium text-slate-500">{day.slice(8)}</span>
                        </div>
                      );
                    })}
                    {!dailySeries.length && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
                        <p className="text-sm text-slate-400">Sem série temporal.</p>
                        <p className="max-w-xs text-xs text-slate-600">
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
            <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#0c121f]/60 shadow-xl ring-1 ring-white/[0.04]">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                <tbody className="divide-y divide-white/5">
                  {tenants.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setDrawerTenantId(row.id)}
                      className="cursor-pointer transition-colors hover:bg-cyan-500/[0.04]"
                      title="Ver detalhes do terreiro"
                    >
                      <td className="px-4 py-3 font-medium text-white">{row.nome_terreiro || "—"}</td>
                      <td className="px-4 py-3 font-mono-data text-xs text-slate-400">{row.email}</td>
                      <td className="px-4 py-3 text-cyan-300">{row.plan || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {row.expires_at ? format(new Date(row.expires_at), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3">{row.totalChildren ?? 0}</td>
                      <td className="px-4 py-3">
                        {row.is_blocked ? (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                            Bloqueado
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                            Activo
                          </span>
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
              {busy && <p className="p-4 text-xs text-slate-500">A processar…</p>}
            </div>
          )}

          {tab === "logs" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.08] bg-[#0c121f]/60 px-3 py-2 shadow-xl ring-1 ring-white/[0.04]">
                <span className="text-xs uppercase tracking-widest text-slate-500">Tipo</span>
                <select
                  value={logFilterType}
                  onChange={(e) => setLogFilterType(e.target.value)}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-slate-200 outline-none focus:border-cyan-400/40"
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
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                >
                  Actualizar
                </button>
                <span className="ml-auto text-[11px] text-slate-500">
                  {logs.length} {logs.length === 1 ? "linha" : "linhas"}
                </span>
              </div>

              <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/60 shadow-xl ring-1 ring-white/[0.04]">
                {!logsAvailable ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    <ScrollText className="h-10 w-10 text-amber-400/70" />
                    <p className="text-sm font-medium text-slate-200">Tabela <code className="font-mono-data text-amber-200">access_logs</code> ainda não existe</p>
                    <p className="max-w-md text-xs leading-relaxed text-slate-400">
                      {logsNotice || "Crie a tabela no Supabase para começar a registar eventos."}
                    </p>
                    <p className="max-w-lg text-[11px] leading-relaxed text-slate-500">
                      Aplique o ficheiro{" "}
                      <code className="font-mono-data text-cyan-200/80">supabase/migrations/20260513192500_access_logs.sql</code>{" "}
                      no SQL Editor do Supabase. Depois reinicie o backend e os eventos passarão a aparecer aqui em tempo real.
                    </p>
                  </div>
                ) : !logs.length ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                    <ScrollText className="h-10 w-10 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">Sem eventos registados ainda</p>
                    <p className="max-w-md text-xs leading-relaxed text-slate-500">
                      Faça uma ação no sistema (login de filho, criar terreiro, mudar plano, etc.) para gerar o primeiro evento.
                    </p>
                  </div>
                ) : (
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-white/[0.06] bg-black/25 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Quando</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Utilizador</th>
                        <th className="px-4 py-3">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {logs.map((r) => {
                        const type = String(r.event_type || "");
                        const tone = eventTypeTone(type);
                        const userLabel =
                          r.user_email ||
                          logEmails[r.user_id] ||
                          (r.user_id ? String(r.user_id).slice(0, 8) : "—");
                        return (
                          <tr key={r.id} className="text-xs text-slate-300 hover:bg-white/[0.02]">
                            <td className="px-4 py-3 whitespace-nowrap font-mono-data text-slate-400">
                              {r.created_at ? format(new Date(r.created_at), "dd/MM HH:mm") : "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {type ? (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
                                  {type}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-200">
                              {r.description || (
                                <span className="text-slate-500">{r.target_type ? `${r.target_type}: ${r.target_id || ""}` : "—"}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono-data text-slate-400">{userLabel}</td>
                            <td className="px-4 py-3 font-mono-data text-slate-500">{r.ip || "—"}</td>
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
            <div className="rounded-md border border-white/[0.08] bg-[#0c121f]/70 p-6 shadow-xl ring-1 ring-white/[0.04]">
              {!r2?.configured ? (
                <p className="text-sm text-slate-400">{r2?.message || "A carregar…"}</p>
              ) : (
                <>
                  <p className="mb-4 text-xs text-slate-500">
                    Amostra de até {r2.keysScanned} chaves no bucket R2 (prefixo = pasta / tenant).{" "}
                    {r2.truncated ? "Resultado truncado." : ""}
                  </p>
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="py-2">Prefixo</th>
                        <th className="py-2">Objectos</th>
                        <th className="py-2">MB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(r2.tenants || []).map((t: any) => (
                        <tr key={t.tenantPrefix} className="border-t border-white/5 font-mono-data text-xs">
                          <td className="py-2 text-cyan-200">{t.tenantPrefix}</td>
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
  accent,
}: {
  label: string;
  hint: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  accent: "cyan" | "violet" | "amber" | "emerald";
}) {
  const ring =
    accent === "cyan"
      ? "from-cyan-400/90 to-teal-500/30"
      : accent === "violet"
        ? "from-violet-400/90 to-fuchsia-600/30"
        : accent === "amber"
          ? "from-amber-400/90 to-orange-500/30"
          : "from-emerald-400/90 to-green-600/30";
  return (
    <div className="group relative overflow-hidden rounded-md border border-white/[0.07] bg-[#0c121f]/90 p-5 shadow-lg shadow-black/30 ring-1 ring-white/[0.04] backdrop-blur-sm transition hover:border-white/[0.12] hover:ring-cyan-500/10">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ring} opacity-90`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-1 text-[11px] text-slate-600">{hint}</p>
        </div>
        <div className="rounded-md bg-white/[0.05] p-2 ring-1 ring-white/[0.06]">
          <Icon className="h-4 w-4 text-slate-300" />
        </div>
      </div>
      <p className="mt-4 font-mono-data text-3xl font-black tracking-tight text-white tabular-nums">{value}</p>
    </div>
  );
}

function MiniBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-200"
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
      className="mx-auto max-w-lg space-y-4 rounded-md border border-white/[0.08] bg-[#0c121f]/70 p-6 shadow-xl ring-1 ring-white/[0.04]"
    >
      <h3 className="text-lg font-bold text-white">Criar conta + terreiro</h3>
      <Field label="E-mail" value={email} onChange={setEmail} type="email" required />

      <div>
        <label className="text-xs font-bold uppercase text-slate-500">Senha inicial</label>
        <div className="mt-1 flex items-stretch gap-2">
          <input
            className="flex-1 rounded-md border border-white/10 bg-slate-950 px-3 py-2 font-mono-data text-base tracking-[0.35em] text-emerald-100 outline-none ring-cyan-500/30 focus:ring-2"
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
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-200 hover:bg-white/[0.08]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void copyPassword()}
            title="Copiar senha"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-md border px-3 text-xs font-bold transition",
              pwdCopied
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
            )}
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Senha numérica de 8 dígitos gerada automaticamente. Você pode regenerar ou editar manualmente antes de criar.
        </p>
      </div>

      <Field label="Nome do terreiro" value={nomeTerreiro} onChange={setNomeTerreiro} required />
      <Field label="Nome do zelador" value={nomeZelador} onChange={setNomeZelador} />
      <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
      <div>
        <label className="text-xs font-bold uppercase text-slate-500">Plano</label>
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          value={plan}
          onChange={(e) => setPlan(e.target.value as typeof plan)}
        >
          <option value="premium">Premium (renovável)</option>
          <option value="vita">Plano Vita (vitalício)</option>
        </select>
      </div>
      {status && <p className="text-sm text-cyan-300">{status}</p>}
      <button
        type="submit"
        className="w-full rounded-md bg-gradient-to-r from-violet-600 to-cyan-500 py-3 text-sm font-bold text-white"
      >
        Criar
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
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-4 rounded-md border border-white/10 bg-slate-900/50 p-6">
      <h3 className="text-lg font-bold text-white">Conta demonstração</h3>
      <p className="text-xs text-slate-500">Plano premium com expiração curta; ideal para testes controlados.</p>
      <Field label="E-mail" value={email} onChange={setEmail} type="email" required />
      <Field label="Senha" value={password} onChange={setPassword} type="password" required />
      <div>
        <label className="text-xs font-bold uppercase text-slate-500">Duração (dias)</label>
        <input
          type="number"
          min={3}
          max={90}
          className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </div>
      {status && <p className="text-sm text-emerald-300">{status}</p>}
      <button type="submit" className="w-full rounded-md bg-emerald-600 py-3 text-sm font-bold text-white">
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
      <label className="text-xs font-bold uppercase text-slate-500">{label}</label>
      <input
        className="mt-1 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-500/30 focus:ring-2"
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
  price: 149.9,
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
  accent,
  data,
  onChange,
}: {
  title: string;
  subtitle: string;
  accent: "cyan" | "violet";
  data: CatalogEntry;
  onChange: (next: CatalogEntry) => void;
}) {
  const bar =
    accent === "cyan"
      ? "from-cyan-400 to-teal-500"
      : "from-violet-400 to-fuchsia-500";
  return (
    <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0c121f]/90 shadow-xl ring-1 ring-white/[0.04]">
      <div className={`h-1.5 bg-gradient-to-r ${bar}`} />
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome público</label>
          <input
            className="mt-1 w-full rounded-md border border-white/[0.1] bg-[#080c14] px-3 py-2.5 text-sm text-white outline-none ring-cyan-500/20 focus:ring-2"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Preço (referência)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            className="mt-1 w-full rounded-md border border-white/[0.1] bg-[#080c14] px-3 py-2.5 font-mono-data text-sm text-cyan-100 outline-none ring-cyan-500/20 focus:ring-2"
            value={Number.isFinite(data.price) ? data.price : 0}
            onChange={(e) => onChange({ ...data, price: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</label>
          <textarea
            rows={4}
            className="mt-1 w-full resize-none rounded-md border border-white/[0.1] bg-[#080c14] px-3 py-2.5 text-sm leading-relaxed text-slate-200 outline-none ring-cyan-500/20 focus:ring-2"
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
      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-5 py-4 ring-1 ring-white/[0.04]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-400/90">Catálogo</p>
            <h3 className="mt-1 text-xl font-bold text-white">Premium e Plano Vita</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Estes dois planos são os únicos comerciais do AxéCloud. Os textos abaixo alimentam a app (tabela{" "}
              <code className="font-mono-data text-cyan-200/90">global_settings</code>, id{" "}
              <code className="font-mono-data text-cyan-200/90">plans</code>). Entradas antigas como Axé/Orô são
              ignoradas ao guardar.
            </p>
          </div>
          <FileJson2 className="hidden h-10 w-10 shrink-0 text-slate-600 sm:block" aria-hidden />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlanCatalogCard
          title="Premium"
          subtitle="Renovável — acesso completo às funções."
          accent="cyan"
          data={premium}
          onChange={setPremium}
        />
        <PlanCatalogCard
          title="Plano Vita"
          subtitle="Vitalício — sem data de expiração."
          accent="violet"
          data={vita}
          onChange={setVita}
        />
      </div>

      {status && (
        <p
          className={
            /guardados/i.test(status)
              ? "text-sm font-medium text-emerald-300"
              : "text-sm font-medium text-rose-300"
          }
        >
          {status}
        </p>
      )}
      <button
        type="button"
        onClick={() => void save()}
        className="rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/30 transition hover:opacity-95"
      >
        Guardar planos
      </button>
    </div>
  );
}
