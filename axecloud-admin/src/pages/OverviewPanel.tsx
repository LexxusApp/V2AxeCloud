import { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Gauge,
  Globe,
  MapPin,
  RefreshCw,
  Crown,
  TrendingUp,
  Users,
  Wallet,
  Ban,
  Clock,
  Server,
  PlusCircle,
  MessageCircle,
  FileText,
  Infinity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AdminPanel, AdminQuickActions } from "./AdminDashboardLayout";
import { TenantsTable } from "./TenantsTable";
import type { AdminNavTab } from "./AdminDashboardLayout";

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

type MetricsSnapshot = {
  available: boolean;
  error?: string;
  groups?: Record<string, { label: string; display: string; status: string }[]>;
};

type OverviewPanelProps = {
  overview: Overview | null;
  tenants: TenantRow[];
  activity: {
    dailyAccess?: Record<string, number>;
    geoActivity?: { city?: string }[];
    accessLogsAvailable?: boolean;
    auditLogsAvailable?: boolean;
    totalEvents30d?: number;
    trafficSource?: "access_logs" | "audit_logs" | "both" | "none";
    publicSiteVisitorsAvailable?: boolean;
    publicSitePageViewsAvailable?: boolean;
    publicSiteDailyVisitors?: Record<string, number>;
    publicSiteVisitorsLast7Days?: number;
    publicSiteVisitorsLast30Days?: number;
    publicSiteVisitorsToday?: number;
    publicSiteTopPages?: { bucket: string; label: string; visitors: number; sharePct: number }[];
  } | null;
  plansCatalog: Record<string, unknown>;
  busy: boolean;
  tenantSearch: string;
  onTenantSearchChange: (q: string) => void;
  onTab: (tab: AdminNavTab) => void;
  onRefresh: () => void;
  onManage: (id: string) => void;
  onBlock: (id: string, block: boolean) => void;
  onRenewMonth: (id: string) => void;
  onLifetime: (id: string) => void;
  quickActions: { label: string; onClick: () => void; icon?: LucideIcon }[];
};

function HeroMetric({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="min-w-0">
      <p className="admin-label">{label}</p>
      <p className="admin-metric-hero-value admin-mono">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--ac-text-muted)]">{sub}</p> : null}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="admin-metric-hero text-left w-full">
        {content}
      </button>
    );
  }
  return <article className="admin-metric-hero">{content}</article>;
}

function CompactMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <article className="admin-metric-compact">
      <p className="admin-label">{label}</p>
      <p className="admin-metric-compact-value admin-mono">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-[var(--ac-text-faint)]">{sub}</p> : null}
    </article>
  );
}

function formatStatNumber(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatCurrencyBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

function planLabel(key: string): string {
  const k = key.toLowerCase();
  if (k === "vita") return "Vita";
  if (k === "premium") return "Premium";
  if (k === "lifetime" || k === "vitalicio") return "Vitalício";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function OverviewPanel({
  overview,
  tenants,
  activity,
  plansCatalog,
  busy,
  tenantSearch,
  onTenantSearchChange,
  onTab,
  onRefresh,
  onManage,
  onBlock,
  onRenewMonth,
  onLifetime,
  quickActions,
}: OverviewPanelProps) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const j = await apiJson<MetricsSnapshot>("/api/admin-console/supabase-metrics");
      setMetrics(j);
    } catch {
      setMetrics(null);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const blockedCount = useMemo(() => tenants.filter((t) => t.is_blocked).length, [tenants]);
  const activeCount = tenants.length - blockedCount;

  const expiringSoon = useMemo(() => {
    const now = new Date();
    return tenants
      .filter((t) => {
        if (t.is_blocked || !t.expires_at) return false;
        try {
          const exp = parseISO(t.expires_at);
          const days = differenceInDays(exp, now);
          return days >= 0 && days <= 14;
        } catch {
          return false;
        }
      })
      .sort((a, b) => (a.expires_at || "").localeCompare(b.expires_at || ""))
      .slice(0, 5);
  }, [tenants]);

  const totalFilhos = useMemo(() => {
    const fromTenants = tenants.reduce((s, t) => s + (t.totalChildren ?? 0), 0);
    return fromTenants > 0 ? fromTenants : (overview?.filhosCount ?? 0);
  }, [tenants, overview?.filhosCount]);

  const estimatedRevenue = useMemo(() => {
    return tenants.reduce((acc, t) => {
      const key = (t.plan || "premium").toLowerCase();
      const raw = plansCatalog[key];
      const price =
        raw && typeof raw === "object" && typeof (raw as { price?: unknown }).price === "number"
          ? (raw as { price: number }).price
          : key === "vita"
            ? 49.9
            : 69.9;
      return acc + (t.is_blocked ? 0 : price);
    }, 0);
  }, [tenants, plansCatalog]);

  const dailySeries = useMemo(() => {
    const d = activity?.dailyAccess;
    if (!d) return [];
    return Object.entries(d)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [activity]);

  const publicTopPages = useMemo(() => activity?.publicSiteTopPages ?? [], [activity]);

  const publicDailySeries = useMemo(() => {
    const d = activity?.publicSiteDailyVisitors;
    if (!d) return [];
    return Object.entries(d)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [activity]);

  const maxDaily = useMemo(() => Math.max(1, ...dailySeries.map(([, c]) => c)), [dailySeries]);
  const maxPublicDaily = useMemo(
    () => Math.max(1, ...publicDailySeries.map(([, c]) => c)),
    [publicDailySeries]
  );

  const topCities = useMemo(() => {
    const geo = activity?.geoActivity;
    if (!geo?.length) return [];
    const counts = new Map<string, number>();
    for (const g of geo) {
      const city = String(g.city || "").trim();
      if (!city) continue;
      counts.set(city, (counts.get(city) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [activity]);

  const planEntries = useMemo(() => {
    const hist = overview?.planHistogram || {};
    const total = Object.values(hist).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(hist)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, count: v, pct: Math.round((v / total) * 100) }));
  }, [overview?.planHistogram]);

  const founder = overview?.founderApplications;
  const infraItems = useMemo(() => {
    if (!metrics?.available || !metrics.groups) return [];
    const pick = ["Conexões", "Pooler", "Recursos"];
    const out: { label: string; display: string; status: string }[] = [];
    for (const g of pick) {
      const items = metrics.groups[g];
      if (items?.[0]) out.push(items[0]);
    }
    return out;
  }, [metrics]);

  const criticalInfra = infraItems.some((i) => i.status === "critical" || i.status === "warn");

  const overviewTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    const list = q
      ? tenants.filter(
          (t) =>
            (t.nome_terreiro || "").toLowerCase().includes(q) ||
            (t.email || "").toLowerCase().includes(q)
        )
      : tenants;
    return list.slice(0, 8);
  }, [tenants, tenantSearch]);

  const statLoading = busy && !overview;

  return (
    <div className="overview-page space-y-6">
      <div className="admin-dashboard-hero">
        <div>
          <h1 className="admin-dashboard-greeting">Painel operacional</h1>
          <p className="admin-dashboard-date">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void onRefresh();
            void loadMetrics();
          }}
          disabled={busy}
          className="admin-btn-secondary"
        >
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
          Actualizar dados
        </button>
      </div>

      <section className="admin-metric-hero-grid">
        <HeroMetric
          label="Terreiros activos"
          value={statLoading ? "…" : formatStatNumber(activeCount)}
          sub={blockedCount > 0 ? `${blockedCount} bloqueado(s) · ${tenants.length} total` : `${tenants.length} cadastrados`}
          onClick={() => onTab("tenants")}
        />
        <HeroMetric
          label="MRR referência"
          value={busy && !tenants.length ? "…" : formatCurrencyBRL(estimatedRevenue)}
          sub={`${overview?.subscriptionsCount ?? 0} assinatura(s) activas`}
          onClick={() => onTab("plans")}
        />
        <HeroMetric
          label="Infra Supabase"
          value={metrics?.available ? (criticalInfra ? "Atenção" : "Operacional") : "—"}
          sub={metrics?.error ? "verificar configuração" : metrics?.available ? "métricas em tempo real" : "sem dados"}
          onClick={() => onTab("metrics")}
        />
      </section>

      <section className="admin-metric-compact-grid">
        <CompactMetric
          label="Filhos de santo"
          value={statLoading ? "…" : formatStatNumber(totalFilhos)}
          sub="cadastrados"
        />
        <CompactMetric
          label="Visitantes (7d)"
          value={
            statLoading
              ? "…"
              : activity?.publicSiteVisitorsAvailable === false
                ? "N/D"
                : formatStatNumber(activity?.publicSiteVisitorsLast7Days)
          }
          sub={activity?.publicSiteVisitorsAvailable ? `hoje: ${formatStatNumber(activity?.publicSiteVisitorsToday)}` : "migration pendente"}
        />
        <CompactMetric
          label="Uso logado (7d)"
          value={
            statLoading
              ? "…"
              : overview?.accessLogsAvailable === false
                ? "N/D"
                : formatStatNumber(overview?.accessEventsLast7Days)
          }
          sub={activity?.totalEvents30d ? `${activity.totalEvents30d} eventos (30d)` : "sessões e logins"}
        />
        <CompactMetric
          label="Programa Fundador"
          value={founder?.available ? formatStatNumber(founder.pending) : "—"}
          sub={founder?.available ? `${founder.remainingSlots} vagas restantes` : "migração pendente"}
        />
      </section>

      {(founder?.pending ?? 0) > 0 || expiringSoon.length > 0 || blockedCount > 0 ? (
        <section className="overview-alerts">
          {(founder?.pending ?? 0) > 0 && (
            <div className="overview-alert overview-alert--warn">
              <Clock className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">
                  {founder!.pending} inscrição(ões) aguardando triagem
                </p>
                <p className="text-xs opacity-80 mt-0.5">Programa Fundador</p>
              </div>
              <button type="button" className="overview-alert-btn" onClick={() => onTab("founders")}>
                Abrir
              </button>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div className="overview-alert overview-alert--info">
              <Clock className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">
                  {expiringSoon.length} terreiro(s) expiram em até 14 dias
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs opacity-85">
                  {expiringSoon.map((t) => (
                    <li key={t.id} className="truncate">
                      {t.nome_terreiro || t.email} —{" "}
                      {t.expires_at
                        ? format(parseISO(t.expires_at), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" className="overview-alert-btn" onClick={() => onTab("tenants")}>
                Ver todos
              </button>
            </div>
          )}
          {blockedCount > 0 && (
            <div className="overview-alert overview-alert--danger">
              <Ban className="h-4 w-4 shrink-0" />
              <p className="flex-1 text-sm font-semibold">{blockedCount} terreiro(s) bloqueado(s)</p>
              <button type="button" className="overview-alert-btn" onClick={() => onTab("tenants")}>
                Gerir
              </button>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 space-y-5">
          <AdminPanel
            kicker="Site público"
            title="Visitantes por dia"
            action={
              <span className="text-xs text-[var(--ac-text-faint)]">
                {publicDailySeries.length
                  ? `${activity?.publicSiteVisitorsLast30Days ?? 0} visitantes · ${publicDailySeries.length} dias`
                  : activity?.publicSiteVisitorsAvailable
                    ? "0 visitantes nos últimos 30 dias"
                    : "tabela ausente"}
              </span>
            }
          >
            {publicDailySeries.length ? (
              <div className="overview-chart">
                <div className="overview-chart-bars">
                  {publicDailySeries.map(([day, count]) => {
                    const h = 12 + Math.round((count / maxPublicDaily) * 148);
                    const label = day.length >= 10 ? format(parseISO(day), "dd/MM") : day;
                    return (
                      <div key={day} className="overview-chart-col" title={`${day}: ${count} visitante(s)`}>
                        <span className="overview-chart-val admin-mono">{count}</span>
                        <div
                          className="overview-chart-bar bg-[var(--ac-accent)]"
                          style={{ height: `${h}px` }}
                        />
                        <span className="overview-chart-day">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--ac-text-muted)] max-w-md mx-auto">
                <Globe className="mx-auto h-8 w-8 text-[var(--ac-text-faint)] mb-2" />
                {!activity?.publicSiteVisitorsAvailable ? (
                  <>
                    Tabela <code className="text-[var(--ac-accent)]">public_site_visitors</code> não encontrada.
                    Aplique <code className="text-[var(--ac-accent)]">supabase/migrations/20260619120000_public_site_visitors.sql</code>.
                  </>
                ) : (
                  <>
                    Nenhum visitante registado nos últimos 30 dias. O contador inicia quando alguém abre páginas
                    públicas (landing, terreiros, cadastro, etc.) sem estar logado.
                  </>
                )}
              </div>
            )}
          </AdminPanel>

          {publicTopPages.length > 0 ? (
            <AdminPanel
              kicker="Site público"
              title="Páginas mais visitadas (30 dias)"
              action={
                <span className="text-xs text-[var(--ac-text-faint)]">
                  visitantes únicos por secção
                </span>
              }
            >
              <ul className="space-y-2">
                {publicTopPages.slice(0, 10).map((row) => (
                  <li
                    key={row.bucket}
                    className="flex items-center gap-3 rounded-[var(--ac-radius-sm)] border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ac-text)] truncate">{row.label}</p>
                      <p className="text-[10px] text-[var(--ac-text-faint)] admin-mono truncate">{row.bucket}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="admin-mono text-sm font-semibold text-[var(--ac-accent)]">{row.visitors}</p>
                      <p className="text-[10px] text-[var(--ac-text-muted)]">{row.sharePct}%</p>
                    </div>
                    <div className="hidden sm:block w-24 h-1.5 rounded-full bg-[var(--ac-paper-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--ac-accent)]"
                        style={{ width: `${Math.max(4, row.sharePct)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </AdminPanel>
          ) : activity?.publicSiteVisitorsAvailable && activity?.publicSitePageViewsAvailable === false ? (
            <div className="admin-alert-info text-sm">
              Breakdown por página disponível após aplicar{" "}
              <code className="admin-mono text-[var(--ac-accent)]">20260619143000_public_site_page_views.sql</code>.
            </div>
          ) : null}

          <AdminPanel
            kicker="Sistema logado"
            title="Eventos por dia"
            action={
              <span className="text-xs text-[var(--ac-text-faint)]">
                {dailySeries.length
                  ? `${activity?.totalEvents30d ?? 0} eventos · ${dailySeries.length} dias`
                  : activity?.auditLogsAvailable || activity?.accessLogsAvailable
                    ? "0 eventos nos últimos 30 dias"
                    : "tabelas de log ausentes"}
              </span>
            }
          >
            {dailySeries.length ? (
              <div className="overview-chart">
                <div className="overview-chart-bars">
                  {dailySeries.map(([day, count]) => {
                    const h = 12 + Math.round((count / maxDaily) * 148);
                    const label = day.length >= 10 ? format(parseISO(day), "dd/MM") : day;
                    return (
                      <div key={day} className="overview-chart-col" title={`${day}: ${count}`}>
                        <span className="overview-chart-val admin-mono">{count}</span>
                        <div className="overview-chart-bar" style={{ height: `${h}px` }} />
                        <span className="overview-chart-day">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[var(--ac-text-muted)] max-w-md mx-auto">
                <TrendingUp className="mx-auto h-8 w-8 text-[var(--ac-text-faint)] mb-2" />
                {!activity?.accessLogsAvailable && !activity?.auditLogsAvailable ? (
                  <>
                    Tabelas <code className="text-[var(--ac-accent)]">access_logs</code> e{" "}
                    <code className="text-[var(--ac-accent)]">audit_logs</code> não encontradas. Aplique as migrations
                    em <code className="text-[var(--ac-accent)]">supabase/migrations/</code>.
                  </>
                ) : (
                  <>
                    Nenhum evento nos últimos 30 dias. Logins e acções do admin passam a contar em{" "}
                    <code className="text-[var(--ac-accent)]">audit_logs</code>; sessões do app em{" "}
                    <code className="text-[var(--ac-accent)]">access_logs</code> (após login).
                  </>
                )}
              </div>
            )}
          </AdminPanel>

          <TenantsTable
            rows={overviewTenants}
            search={tenantSearch}
            onSearchChange={onTenantSearchChange}
            compact
            busy={busy}
            onManage={onManage}
            onBlock={onBlock}
            onRenewMonth={onRenewMonth}
            onLifetime={onLifetime}
          />
        </div>

        <div className="xl:col-span-4 space-y-5">
          {infraItems.length > 0 && (
            <AdminPanel kicker="Infra" title="Supabase agora" action={
              <button type="button" className="admin-btn-ghost text-xs" onClick={() => onTab("metrics")}>
                Detalhes <Gauge className="h-3.5 w-3.5" />
              </button>
            }>
              <ul className="space-y-2">
                {infraItems.map((m, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-[var(--ac-radius-sm)] border px-3 py-2.5 text-sm",
                      m.status === "critical"
                        ? "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]"
                        : m.status === "warn"
                          ? "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)]"
                          : "border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)]"
                    )}
                  >
                    <span className="text-[var(--ac-text-muted)] text-xs">{m.label}</span>
                    <span className="admin-mono font-medium text-[var(--ac-text)]">{m.display}</span>
                  </li>
                ))}
              </ul>
            </AdminPanel>
          )}

          <AdminPanel kicker="Planos" title="Distribuição">
            {planEntries.length ? (
              <ul className="space-y-3">
                {planEntries.map(({ key, count, pct }) => (
                  <li key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--ac-text)]">{planLabel(key)}</span>
                      <span className="admin-mono text-[var(--ac-text-muted)]">
                        {count} <span className="text-[var(--ac-text-faint)]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="overview-plan-bar">
                      <div className="overview-plan-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ac-text-muted)] py-4 text-center">Sem assinaturas registadas.</p>
            )}
          </AdminPanel>

          {topCities.length > 0 && (
            <AdminPanel kicker="Geografia" title="Top cidades (30d)">
              <ul className="space-y-1.5">
                {topCities.map(([city, count], i) => (
                  <li
                    key={city}
                    className="flex items-center gap-2 rounded-[var(--ac-radius-sm)] px-2 py-1.5 text-sm hover:bg-[var(--ac-paper-elevated)]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold bg-[var(--ac-accent-soft)] text-[var(--ac-accent)]">
                      {i + 1}
                    </span>
                    <MapPin className="h-3.5 w-3.5 text-[var(--ac-text-faint)] shrink-0" />
                    <span className="flex-1 truncate text-[var(--ac-text)]">{city}</span>
                    <span className="admin-mono text-xs text-[var(--ac-text-muted)]">{count}</span>
                  </li>
                ))}
              </ul>
            </AdminPanel>
          )}

          <AdminQuickActions items={quickActions} />
        </div>
      </section>

      {activity && !activity.accessLogsAvailable && activity.auditLogsAvailable && (
        <div className="admin-alert-info">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--ac-warn)]" />
          <p className="text-sm">
            <code className="admin-mono text-[var(--ac-accent)]">access_logs</code> ausente — o tráfego usa apenas{" "}
            <code className="admin-mono text-[var(--ac-accent)]">audit_logs</code> (logins e acções administrativas).
          </p>
        </div>
      )}
    </div>
  );
}
