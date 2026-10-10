import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Camera,
  Calendar,
  Users,
  CreditCard,
  Settings,
  ShieldAlert,
  Smartphone,
  Laptop,
  CheckCircle2,
  RefreshCw,
  Search,
  CheckCheck,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AdminStatCard, AdminPanel } from "./AdminDashboardLayout";

export type TenantFeatureFailure = {
  id: string;
  created_at: string;
  tenant_id: string | null;
  feature: string;
  route: string | null;
  http_status: number | null;
  source: string;
  error_message: string | null;
  error_fingerprint: string | null;
  metadata: {
    action?: string;
    clientUserAgent?: string;
    isMobile?: boolean;
    clientTimestamp?: string;
    [key: string]: unknown;
  };
  resolved_at: string | null;
  terreiro_nome?: string | null;
  zelador_nome?: string | null;
  terreiro_email?: string | null;
};

type FailuresResponse = {
  ok: boolean;
  rows: TenantFeatureFailure[];
  total: number;
  unresolvedCount: number;
  byFeature: Record<string, number>;
};

export function TenantFailuresPanel({ onMessage }: { onMessage?: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [data, setData] = useState<FailuresResponse>({
    ok: true,
    rows: [],
    total: 0,
    unresolvedCount: 0,
    byFeature: {},
  });

  const [featureFilter, setFeatureFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [periodFilter, setPeriodFilter] = useState<"today" | "24h" | "7d" | "all">("today");
  const [search, setSearch] = useState("");

  const loadFailures = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: "100",
        status: statusFilter,
        period: periodFilter,
      });
      if (featureFilter !== "all") qs.set("feature", featureFilter);

      const res = await apiJson<FailuresResponse>(
        `/api/admin-console/tenant-feature-failures?${qs.toString()}`
      );
      setData(res);
    } catch (err: unknown) {
      console.error("[TenantFailuresPanel] Erro ao carregar:", err);
      onMessage?.(err instanceof Error ? err.message : "Erro ao carregar falhas.");
    } finally {
      setLoading(false);
    }
  }, [featureFilter, statusFilter, periodFilter, onMessage]);

  useEffect(() => {
    void loadFailures();
  }, [loadFailures]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await apiJson(`/api/admin-console/tenant-feature-failures/${id}/resolve`, {
        method: "POST",
      });
      onMessage?.("Falha marcada como resolvida!");
      void loadFailures();
    } catch (err: unknown) {
      onMessage?.(err instanceof Error ? err.message : "Erro ao resolver falha.");
    } finally {
      setResolvingId(null);
    }
  };

  const handleResolveAll = async () => {
    if (!confirm("Deseja marcar todas as falhas visíveis como resolvidas?")) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin-console/tenant-feature-failures/resolve-all`, {
        method: "POST",
        body: JSON.stringify({ feature: featureFilter }),
      });
      onMessage?.("Todas as falhas pendentes foram marcadas como resolvidas!");
      void loadFailures();
    } catch (err: unknown) {
      onMessage?.(err instanceof Error ? err.message : "Erro ao resolver falhas em lote.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter(
      (r) =>
        (r.terreiro_nome && r.terreiro_nome.toLowerCase().includes(q)) ||
        (r.zelador_nome && r.zelador_nome.toLowerCase().includes(q)) ||
        (r.error_message && r.error_message.toLowerCase().includes(q)) ||
        (r.feature && r.feature.toLowerCase().includes(q)) ||
        (r.route && r.route.toLowerCase().includes(q))
    );
  }, [data.rows, search]);

  const getFeatureBadge = (feature: string) => {
    switch (feature) {
      case "fotos":
        return { label: "Fotos / Upload", icon: Camera, color: "text-blue-950 bg-blue-100 border-blue-300 font-semibold" };
      case "agenda":
        return { label: "Agenda / Giras", icon: Calendar, color: "text-purple-950 bg-purple-100 border-purple-300 font-semibold" };
      case "membros":
        return { label: "Membros / Filhos", icon: Users, color: "text-emerald-950 bg-emerald-100 border-emerald-300 font-semibold" };
      case "financeiro":
        return { label: "Financeiro / Pix", icon: CreditCard, color: "text-amber-950 bg-amber-100 border-amber-300 font-semibold" };
      case "configuracoes":
        return { label: "Configurações", icon: Settings, color: "text-neutral-900 bg-neutral-200 border-neutral-300 font-semibold" };
      default:
        return { label: feature, icon: AlertTriangle, color: "text-rose-950 bg-rose-100 border-rose-300 font-semibold" };
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return "agora há pouco";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `há ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `há ${diffDays}d`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AdminStatCard
          title="Total Pendentes"
          value={String(data.unresolvedCount)}
          hint={periodFilter === "today" ? "Erros de zeladores hoje" : "Erros de zeladores sem resolução"}
          icon={AlertTriangle}
          tone="rose"
        />
        <AdminStatCard
          title="Falhas em Fotos"
          value={String(data.byFeature["fotos"] || 0)}
          hint="Perfil, comprovantes, galeria"
          icon={Camera}
          tone="blue"
        />
        <AdminStatCard
          title="Falhas em Giras"
          value={String(data.byFeature["agenda"] || 0)}
          hint="Criação e edição de eventos"
          icon={Calendar}
          tone="violet"
        />
        <AdminStatCard
          title="Falhas em Membros"
          value={String(data.byFeature["membros"] || 0)}
          hint="Cadastro de filhos da corrente"
          icon={Users}
          tone="emerald"
        />
        <AdminStatCard
          title="Falhas no Financeiro"
          value={String(data.byFeature["financeiro"] || 0)}
          hint="Mensalidades e cobranças"
          icon={CreditCard}
          tone="amber"
        />
      </div>

      <AdminPanel
        kicker="TELEMETRIA EM TEMPO REAL"
        title="Monitor de Falhas do Zelador"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadFailures()}
              disabled={loading}
              className="admin-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5 text-neutral-800 bg-white border border-neutral-300 hover:text-neutral-950 font-medium"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Atualizar
            </button>
            {data.unresolvedCount > 0 && statusFilter === "unresolved" && (
              <button
                type="button"
                onClick={() => void handleResolveAll()}
                disabled={loading}
                className="admin-btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 text-emerald-900 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 font-semibold shadow-xs"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Resolver todas
              </button>
            )}
          </div>
        }
      >
        {/* Barra de Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--ac-paper-border)] pb-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-700 font-medium flex items-center gap-1 mr-1">
              <Filter className="h-3.5 w-3.5 text-neutral-500" />
              Recurso:
            </span>
            {(["all", "fotos", "agenda", "membros", "financeiro", "geral"] as const).map((feat) => {
              const count = feat === "all" ? data.unresolvedCount : data.byFeature[feat] || 0;
              return (
                <button
                  key={feat}
                  type="button"
                  onClick={() => setFeatureFilter(feat)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    featureFilter === feat
                      ? "bg-indigo-600 text-white border-indigo-700 font-semibold shadow-xs"
                      : "bg-white text-neutral-800 border-neutral-300 hover:text-neutral-950 hover:border-neutral-400 font-medium"
                  )}
                >
                  {feat === "all" ? "Todos" : feat.charAt(0).toUpperCase() + feat.slice(1)}
                  {count > 0 && ` (${count})`}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="admin-input text-xs !py-1 !px-2.5 font-medium text-neutral-900 bg-white border-neutral-300"
              title="Período da contagem de falhas"
            >
              <option value="today">Apenas Hoje</option>
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="all">Todo o histórico</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="admin-input text-xs !py-1 !px-2.5 font-medium text-neutral-900 bg-white border-neutral-300"
            >
              <option value="unresolved">Pendentes</option>
              <option value="resolved">Resolvidos</option>
              <option value="all">Todos os registros</option>
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar terreiro ou erro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-input text-xs !py-1 !pl-8 !pr-3 w-48 sm:w-56 font-medium text-neutral-900 bg-white border-neutral-300"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Falhas */}
        {loading && filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-700 font-medium">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Carregando registros de falha...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-neutral-800 border border-dashed border-neutral-300 rounded-xl my-4 bg-white/80">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-neutral-950 text-base">
              {statusFilter === "unresolved"
                ? periodFilter === "today"
                  ? "Nenhuma falha registrada hoje!"
                  : "Nenhuma falha pendente no momento!"
                : "Nenhum registro encontrado com estes filtros."}
            </p>
            <p className="text-xs text-neutral-700 font-medium mt-1">
              {periodFilter === "today"
                ? "Todos os recursos dos terreiros (fotos, giras, membros, mensalidades) operaram com sucesso hoje."
                : "Todos os recursos dos terreiros (fotos, giras, membros, mensalidades) estão operando normalmente."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ac-paper-border)]">
            {filteredRows.map((row) => {
              const badge = getFeatureBadge(row.feature);
              const BadgeIcon = badge.icon;
              const isResolved = Boolean(row.resolved_at);

              return (
                <div
                  key={row.id}
                  className={cn(
                    "py-4 px-2 hover:bg-[var(--ac-paper-subtle)] transition-colors rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4",
                    isResolved && "opacity-60"
                  )}
                >
                  {/* Informações Principais */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border",
                          badge.color
                        )}
                      >
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>

                      {row.metadata?.action && (
                        <span className="text-[11px] admin-mono text-neutral-900 font-semibold bg-neutral-200/90 border border-neutral-300 px-2 py-0.5 rounded">
                          {String(row.metadata.action)}
                        </span>
                      )}

                      <span className="text-xs text-neutral-700 font-medium flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-neutral-500" />
                        {formatRelativeTime(row.created_at)}
                      </span>

                      {row.metadata?.isMobile ? (
                        <span className="text-[11px] text-neutral-700 font-medium flex items-center gap-1" title="Dispositivo Móvel">
                          <Smartphone className="h-3.5 w-3.5 text-neutral-500" /> Mobile
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-700 font-medium flex items-center gap-1" title="Computador">
                          <Laptop className="h-3.5 w-3.5 text-neutral-500" /> Desktop
                        </span>
                      )}
                    </div>

                    {/* Mensagem de Erro Destacada */}
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-950 font-semibold admin-mono break-words shadow-xs">
                      {row.error_message || "Erro não detalhado"}
                    </div>

                    {/* Identificação do Terreiro */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs pt-1">
                      <span className="text-neutral-700">
                        Terreiro:{" "}
                        <strong className="text-neutral-950 font-bold">
                          {row.terreiro_nome || "Terreiro não associado"}
                        </strong>
                      </span>
                      {row.zelador_nome && (
                        <span className="text-neutral-700">
                          Zelador: <span className="text-neutral-950 font-semibold">{row.zelador_nome}</span>
                        </span>
                      )}
                      {row.terreiro_email && (
                        <span className="text-neutral-700 font-medium bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">{row.terreiro_email}</span>
                      )}
                      {row.route && (
                        <span className="text-neutral-700 font-medium truncate max-w-xs" title={row.route}>
                          Rota: <span className="text-neutral-900 font-mono font-medium">{row.route}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ação de Resolução */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {isResolved ? (
                      <span className="text-xs text-emerald-950 font-semibold flex items-center gap-1 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                        Resolvido
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleResolve(row.id)}
                        disabled={resolvingId === row.id}
                        className="admin-btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5 text-neutral-800 bg-white border-neutral-300 hover:text-emerald-800 hover:border-emerald-400 font-medium shadow-xs"
                      >
                        {resolvingId === row.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-neutral-600" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-neutral-500" />
                        )}
                        Marcar resolvido
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
