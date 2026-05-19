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
import {
  Building2,
  CalendarDays,
  Copy,
  FileJson2,
  Info,
  RefreshCw,
  ScrollText,
  Users,
  Wallet,
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
import {
  AdminDashboardLayout,
  AdminStatCard,
  AdminPanel,
  AdminQuickActions,
  type AdminNavTab,
} from "./AdminDashboardLayout";
import { TenantsTable } from "./TenantsTable";

type Tab = AdminNavTab;

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


function formatStatNumber(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatCurrencyBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

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
  const [tenantSearch, setTenantSearch] = useState("");

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

  const estimatedRevenue = useMemo(() => {
    return tenants.reduce((acc, t) => {
      const key = (t.plan || "premium").toLowerCase();
      const raw = plansCatalog[key];
      const price =
        raw && typeof raw === "object" && typeof (raw as { price?: unknown }).price === "number"
          ? (raw as { price: number }).price
          : key === "vita"
            ? 49.9
            : 5;
      return acc + (t.is_blocked ? 0 : price);
    }, 0);
  }, [tenants, plansCatalog]);

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

  const chartHeights = useMemo(() => {
    if (!dailySeries.length) return [30, 55, 40, 75, 90, 60, 120, 80, 140, 100, 160, 190];
    return dailySeries.map(([, count]) => 24 + Math.round((count / maxDaily) * 166));
  }, [dailySeries, maxDaily]);

  const overviewTenants = useMemo(() => filteredTenants.slice(0, 12), [filteredTenants]);

  function goTab(next: Tab) {
    setMsg(null);
    setTab(next);
  }

  const quickActions = [
    {
      label: "Liberar acesso vitalício",
      onClick: () => {
        goTab("tenants");
        setMsg("Seleccione um terreiro e use «Vitalício» ou «Gerenciar».");
      },
    },
    { label: "Criar comunicado global", onClick: () => goTab("whatsapp") },
    { label: "Adicionar novo terreiro", onClick: () => goTab("create") },
    { label: "Enviar notificações", onClick: () => goTab("whatsapp") },
    { label: "Gerar relatório financeiro", onClick: () => goTab("audit") },
  ];

  const statUsers =
    busy && !overview ? "…" : formatStatNumber((overview?.filhosCount ?? 0) + (overview?.leadersCount ?? 0));
  const statTerreiros = busy && !overview ? "…" : formatStatNumber(overview?.leadersCount);
  const statEventos =
    busy && !overview
      ? "…"
      : overview?.accessLogsAvailable === false
        ? "—"
        : formatStatNumber(overview?.accessEventsLast7Days);
  const statReceita = busy && !tenants.length ? "…" : formatCurrencyBRL(estimatedRevenue);

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
        {tab === "overview" && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <AdminStatCard title="Usuários" value={statUsers} icon={Users} />
              <AdminStatCard title="Terreiros" value={statTerreiros} icon={Building2} />
              <AdminStatCard title="Eventos (7d)" value={statEventos} icon={CalendarDays} />
              <AdminStatCard title="Receita ref." value={statReceita} icon={Wallet} />
            </section>

            {overview?.accessLogsAvailable === false && (
              <div className="flex items-start gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  A tabela <code className="text-yellow-400/90">access_logs</code> não existe — métricas de eventos
                  ficam desactivadas. O resto do painel funciona normalmente.
                </p>
              </div>
            )}

            <section className="grid xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AdminPanel
                  kicker="Estatísticas"
                  title="Crescimento do sistema"
                  action={
                    <span className="px-5 py-3 rounded-xl border border-zinc-700 text-zinc-300 text-sm">
                      Últimos {dailySeries.length || 12} dias
                    </span>
                  }
                >
                  <div className="h-[280px] sm:h-[320px] flex items-end gap-2 sm:gap-4">
                    {chartHeights.map((height, index) => (
                      <div
                        key={index}
                        className="admin-chart-bar min-w-0"
                        style={{ height: `${height}px` }}
                        title={dailySeries[index] ? `${dailySeries[index][0]}: ${dailySeries[index][1]}` : undefined}
                      />
                    ))}
                  </div>
                </AdminPanel>
              </div>
              <AdminQuickActions items={quickActions} />
            </section>

            <TenantsTable
              rows={overviewTenants}
              search={tenantSearch}
              onSearchChange={setTenantSearch}
              compact
              busy={busy}
              onManage={setDrawerTenantId}
              onBlock={(id, shouldBlock) => void manageTenant(id, shouldBlock ? "block" : "unblock")}
              onRenewMonth={(id) => void manageTenant(id, "renew", { amount: "1", unit: "months" })}
              onLifetime={(id) => void manageTenant(id, "set-lifetime")}
            />

            <AdminPanel kicker="Planos" title="Distribuição">
              <ul className="space-y-2">
                {Object.entries(overview?.planHistogram || {}).map(([k, v]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3"
                  >
                    <span className="text-zinc-300 font-medium">{k}</span>
                    <span className="bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full text-sm font-semibold">
                      {v}
                    </span>
                  </li>
                ))}
                {!Object.keys(overview?.planHistogram || {}).length && (
                  <li className="text-center text-zinc-500 py-6">Sem dados de planos.</li>
                )}
              </ul>
            </AdminPanel>
          </>
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
          />
        )}

        {tab === "logs" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-zinc-500">Tipo</span>
              <select
                value={logFilterType}
                onChange={(e) => setLogFilterType(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-yellow-500"
              >
                <option value="">Todos os eventos</option>
                {logEventTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void refreshLogs()}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm hover:border-yellow-500/40"
              >
                Actualizar
              </button>
              <span className="ml-auto text-xs text-zinc-500">
                {logs.length} {logs.length === 1 ? "linha" : "linhas"}
              </span>
            </div>
            <div className="rounded-[32px] border border-zinc-800 bg-zinc-950 overflow-hidden">
              {!logsAvailable ? (
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <ScrollText className="h-10 w-10 text-zinc-500" />
                  <p className="text-sm font-medium text-zinc-200">
                    Tabela <code className="text-yellow-400/90">access_logs</code> ainda não existe
                  </p>
                  <p className="max-w-md text-xs text-zinc-400">{logsNotice || "Crie a tabela no Supabase."}</p>
                </div>
              ) : !logs.length ? (
                <div className="py-16 text-center text-zinc-500 text-sm">Sem eventos registados ainda.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                        <th className="px-6 py-4">Quando</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Descrição</th>
                        <th className="px-6 py-4">Utilizador</th>
                        <th className="px-6 py-4">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((r) => {
                        const type = String(r.event_type || "");
                        const tone = eventTypeBadgeClass(type);
                        const userLabel =
                          r.user_email ||
                          logEmails[r.user_id] ||
                          (r.user_id ? String(r.user_id).slice(0, 8) : "—");
                        return (
                          <tr key={r.id} className="border-b border-zinc-900 hover:bg-zinc-900/50 text-zinc-300">
                            <td className="px-6 py-3 whitespace-nowrap text-zinc-400">
                              {r.created_at ? format(new Date(r.created_at), "dd/MM HH:mm") : "—"}
                            </td>
                            <td className="px-6 py-3">
                              {type ? (
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}
                                >
                                  {type}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-3 text-zinc-200">{r.description || "—"}</td>
                            <td className="px-6 py-3 text-zinc-400">{userLabel}</td>
                            <td className="px-6 py-3 text-zinc-500">{r.ip || "—"}</td>
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

        {tab === "storage" && (
          <AdminPanel kicker="Infra" title="Armazenamento R2">
            {!r2?.configured ? (
              <p className="text-sm text-zinc-400">{r2?.message || "A carregar…"}</p>
            ) : (
              <>
                <p className="mb-4 text-xs text-zinc-500">
                  Amostra de até {r2.keysScanned} chaves. {r2.truncated ? "Truncado." : ""}
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-zinc-500">
                        <th className="py-2 pr-4">Prefixo</th>
                        <th className="py-2 pr-4">Objectos</th>
                        <th className="py-2">MB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(r2.tenants || []).map((t: { tenantPrefix: string; objects: number; mb: number }) => (
                        <tr key={t.tenantPrefix} className="border-t border-zinc-800 text-xs text-zinc-300">
                          <td className="py-2 pr-4">{t.tenantPrefix}</td>
                          <td className="py-2 pr-4">{t.objects}</td>
                          <td className="py-2">{t.mb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </AdminPanel>
        )}

        {tab === "create" && (
          <AdminPanel kicker="Operação" title="Novo terreiro">
            <CreateTenantForm onDone={() => void refreshTenants()} />
          </AdminPanel>
        )}
        {tab === "demo" && (
          <AdminPanel kicker="Operação" title="Conta demonstração">
            <DemoForm />
          </AdminPanel>
        )}
        {tab === "plans" && <PlansEditor initial={plansCatalog} />}
        {tab === "whatsapp" && <WhatsAppPanel />}
        {tab === "audit" && <AuditPanel />}
        {tab === "monitor" && <AuditMonitor />}
      </AdminDashboardLayout>

      <TenantDrawer
        tenantId={drawerTenantId}
        onClose={() => {
          setDrawerTenantId(null);
          void refreshTenants();
        }}
      />
    </>
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
  price: 5,
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
