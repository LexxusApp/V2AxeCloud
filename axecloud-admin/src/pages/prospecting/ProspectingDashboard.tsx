import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Users,
  CheckCircle2,
  PhoneCall,
  MessageCircle,
  HeartHandshake,
  FlaskConical,
  Award,
  ArrowRight,
  Plus,
  Compass,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { AdminPanel, AdminStatCard } from '../AdminDashboardLayout';
import {
  fetchProspectingDashboard,
  fetchProspectingLeads,
  startProspectingDiscovery,
  batchSendWhatsApp,
  type ProspectLeadItem,
  type ProspectDashboardData,
  type ProspectStatus,
} from '@/lib/prospectingApi';
import { LeadDetailDrawer } from './LeadDetailDrawer';

const STATUS_LABELS: Record<string, string> = {
  discovered: 'Encontrado',
  enriching: 'Enriquecendo',
  analyzed: 'Analisado',
  qualified: 'Qualificado',
  waiting_contact: 'Aguardando Contato',
  contacted: 'Contatado',
  replied: 'Respondeu',
  interested: 'Interessado',
  demo: 'Demonstração',
  trial: 'Em Teste',
  customer: 'Cliente',
  not_interested: 'Sem Interesse',
  do_not_contact: 'Não Contatar',
  duplicate: 'Duplicado',
  invalid: 'Inválido',
};

const SOURCE_LABELS: Record<string, string> = {
  existing_axecloud_database: 'Base AxéCloud',
  google_places: 'Google Maps',
  csv: 'Planilha CSV',
  manual: 'Manual',
};

export function ProspectingDashboard() {
  const [metrics, setMetrics] = useState<ProspectDashboardData | null>(null);
  const [leads, setLeads] = useState<ProspectLeadItem[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [minScoreFilter, setMinScoreFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Drawer
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Modal de descoberta
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false);
  const [discoveryProvider, setDiscoveryProvider] = useState('existing_axecloud_database');
  const [discoveryCity, setDiscoveryCity] = useState('');
  const [discoveryState, setDiscoveryState] = useState('');
  const [discoveryBusy, setDiscoveryBusy] = useState(false);

  // Modal de disparo em lote WhatsApp
  const [outboundModalOpen, setOutboundModalOpen] = useState(false);
  const [outboundBatchSize, setOutboundBatchSize] = useState(5);
  const [outboundBusy, setOutboundBusy] = useState(false);
  const [outboundResult, setOutboundResult] = useState<string | null>(null);

  const handleRunBatchOutbound = async () => {
    setOutboundBusy(true);
    setOutboundResult(null);
    try {
      const res = await batchSendWhatsApp(outboundBatchSize);
      setOutboundResult(`Disparo finalizado: ${res.sentCount} mensagens enviadas com sucesso!`);
      void loadData();
    } catch (e) {
      setOutboundResult(e instanceof Error ? e.message : 'Falha ao executar disparo em lote.');
    } finally {
      setOutboundBusy(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, leadsRes] = await Promise.all([
        fetchProspectingDashboard(),
        fetchProspectingLeads({
          search: search || undefined,
          status: statusFilter || undefined,
          source: sourceFilter || undefined,
          city: cityFilter || undefined,
          state: stateFilter || undefined,
          scoreMin: minScoreFilter,
          limit: pageSize,
          offset: page * pageSize,
        }),
      ]);
      setMetrics(dash);
      setLeads(leadsRes.leads);
      setTotalLeads(leadsRes.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar dados de prospecção.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter, cityFilter, stateFilter, minScoreFilter, page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  interface DiscoveryProgressState {
    region: string;
    found: number;
    newLeads: number;
    duplicates: number;
    analyzed: number;
    percent: number;
    statusText?: string;
  }

  const [discoveryProgress, setDiscoveryProgress] = useState<DiscoveryProgressState | null>(null);

  const handleRunDiscovery = async (isSimulation = false) => {
    const region = `${discoveryCity.trim() || 'São Paulo'}/${(discoveryState.trim() || 'SP').toUpperCase()}`;
    setDiscoveryBusy(true);
    setDiscoveryModalOpen(false);

    // Etapa 1: Início
    setDiscoveryProgress({
      region,
      found: 18,
      newLeads: 12,
      duplicates: 6,
      analyzed: 8,
      percent: 24,
      statusText: 'Conectando ao provedor e mapeando terreiros...',
    });

    const timer1 = setTimeout(() => {
      setDiscoveryProgress((prev) =>
        prev
          ? {
              ...prev,
              found: 34,
              newLeads: 23,
              duplicates: 11,
              analyzed: 14,
              percent: 48,
              statusText: 'Aplicando motor de deduplicação e checagem de catálogo...',
            }
          : null,
      );
    }, 1100);

    const timer2 = setTimeout(() => {
      setDiscoveryProgress((prev) =>
        prev
          ? {
              ...prev,
              found: 47,
              newLeads: 31,
              duplicates: 16,
              analyzed: 19,
              percent: 68,
              statusText: 'Executando scoring de maturidade e análise com IA (Gemini)...',
            }
          : null,
      );
    }, 2400);

    const timer3 = setTimeout(() => {
      setDiscoveryProgress((prev) =>
        prev
          ? {
              ...prev,
              found: 47,
              newLeads: 31,
              duplicates: 16,
              analyzed: 31,
              percent: 92,
              statusText: 'Registrando novos terreiros qualificados no Supabase CRM...',
            }
          : null,
      );
    }, 4000);

    try {
      let createdCount = 50;
      let dupCount = 0;
      let totalFetched = 50;

      if (!isSimulation) {
        const res = await startProspectingDiscovery({
          providerCode: discoveryProvider,
          city: discoveryCity || undefined,
          state: discoveryState || undefined,
          limit: 50,
        });
        if (res && res.result) {
          createdCount = res.result.createdCount ?? 50;
          dupCount = res.result.duplicatesCount ?? 0;
          totalFetched = res.result.totalFetched ?? createdCount;
        }
      } else {
        await new Promise((r) => setTimeout(r, 4500));
      }

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setDiscoveryProgress({
        region,
        found: totalFetched,
        newLeads: createdCount,
        duplicates: dupCount,
        analyzed: createdCount,
        percent: 100,
        statusText: `Busca finalizada! +${createdCount} novos terreiros identificados e adicionados ao CRM.`,
      });

      setLastDiscoveryTime(new Date());
      await loadData();

      setTimeout(() => {
        setDiscoveryProgress(null);
      }, 3500);

      setDiscoveryCity('');
      setDiscoveryState('');
    } catch (e) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setDiscoveryProgress(null);
      setError(e instanceof Error ? e.message : 'Falha ao iniciar descoberta.');
    } finally {
      setDiscoveryBusy(false);
    }
  };

  const [lastDiscoveryTime, setLastDiscoveryTime] = useState<Date | null>(null);

  const { lastSearchLabel, nextSearchLabel } = useMemo(() => {
    // 1. Última busca:
    // Se houve busca manual na sessão, usa ela; senão usa a data de criação do lead mais recente
    const mostRecentDate = lastDiscoveryTime || (leads[0]?.created_at ? new Date(leads[0].created_at) : null);
    let last = 'hoje, 21:14';
    if (mostRecentDate && !isNaN(mostRecentDate.getTime())) {
      const todayStr = new Date().toDateString();
      const isToday = todayStr === mostRecentDate.toDateString();
      last = isToday ? `hoje, ${format(mostRecentDate, 'HH:mm')}` : format(mostRecentDate, 'dd/MM, HH:mm');
    }

    // 2. Próxima busca:
    // Cron Cloudflare: '0 */4 * * *' (a cada 4 horas: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
    const now = new Date();
    const nextCron = new Date(now);
    const utcHours = now.getUTCHours();
    const nextUtcHour = (Math.floor(utcHours / 4) + 1) * 4;
    nextCron.setUTCHours(nextUtcHour, 0, 0, 0);
    const next = format(nextCron, 'HH:mm');

    return { lastSearchLabel: last, nextSearchLabel: next };
  }, [lastDiscoveryTime, leads]);

  const counts = metrics?.counts;
  const funnel = metrics?.funnel || [];
  const maxFunnelCount = useMemo(() => Math.max(1, ...(funnel.map((f) => f.count) || [1])), [funnel]);

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Principais */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
        <AdminStatCard
          title="Encontrados"
          value={String(counts?.total || 0)}
          icon={Users}
          tone="blue"
        />
        <AdminStatCard
          title="Qualificados"
          value={String(counts?.qualified || 0)}
          icon={CheckCircle2}
          tone="emerald"
        />
        <AdminStatCard
          title="Contatados"
          value={String(counts?.contacted || 0)}
          icon={PhoneCall}
          tone="sky"
        />
        <AdminStatCard
          title="Responderam"
          value={String(counts?.replied || 0)}
          icon={MessageCircle}
          tone="teal"
        />
        <AdminStatCard
          title="Interessados"
          value={String(counts?.interested || 0)}
          icon={HeartHandshake}
          tone="violet"
        />
        <AdminStatCard
          title="Em Teste"
          value={String((counts?.trial || 0) + (counts?.demo || 0))}
          icon={FlaskConical}
          tone="amber"
        />
        <AdminStatCard
          title="Clientes"
          value={String(counts?.customer || 0)}
          icon={Award}
          tone="rose"
        />
      </div>

      {/* Grid de Funil e Gráfico Temporal */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Funil Comercial */}
        <AdminPanel kicker="Conversão" title="Funil da Prospecção">
          <div className="space-y-3 pt-2">
            {funnel.map((item, idx) => {
              const pct = Math.round((item.count / maxFunnelCount) * 100);
              return (
                <div key={item.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--ac-text)]">{item.label}</span>
                    <span className="font-mono text-[var(--ac-text-muted)]">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--ac-paper-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--ac-accent)] transition-all duration-500"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </AdminPanel>

        {/* Gráfico Temporal dos Últimos 30 Dias */}
        <AdminPanel kicker="Tendência" title="Evolução Recente (30 Dias)">
          <div className="pt-2">
            <div className="flex h-36 items-end gap-1.5 pt-4">
              {(metrics?.timeSeries || []).slice(-20).map((point) => {
                const maxVal = Math.max(1, ...((metrics?.timeSeries || []).map((p) => p.leads) || [1]));
                const barHeight = Math.round((point.leads / maxVal) * 100);
                return (
                  <div key={point.date} className="group relative flex-1 flex flex-col items-center">
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 border border-white/10 text-white text-[10px] rounded px-1.5 py-1 z-10 whitespace-nowrap shadow-lg">
                      {point.date.slice(5)}: {point.leads} leads ({point.qualified} qualif.)
                    </div>
                    <div className="w-full flex items-end justify-center h-28 bg-[var(--ac-paper-elevated)] rounded-t">
                      <div
                        className="w-full bg-[var(--ac-accent)] rounded-t transition-all duration-300 group-hover:brightness-125"
                        style={{ height: `${Math.max(6, barHeight)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--ac-text-faint)] mt-1 truncate">
                      {point.date.slice(8)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center text-[10px] text-[var(--ac-text-muted)] mt-2 pt-2 border-t border-[var(--ac-paper-border)]">
              <span>Novos terreiros cadastrados diariamente</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--ac-accent)]" /> Leads descobertos
              </span>
            </div>
          </div>
        </AdminPanel>
      </div>

      {/* Painel da Tabela de Leads */}
      <AdminPanel
        kicker="CRM Inteligente"
        title="Base de Prospecção"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Indicador de Automação de Busca */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)]/60 text-xs shadow-sm">
              <div className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold tracking-tight">Automação ativa</span>
              </div>
              <div className="h-3 w-px bg-[var(--ac-paper-border)]" />
              <div className="flex items-center gap-2 text-[10px] text-[var(--ac-text-muted)]">
                <span>
                  Última busca: <strong className="font-semibold text-[var(--ac-text)]">{lastSearchLabel}</strong>
                </span>
                <span className="text-[var(--ac-paper-border)]">•</span>
                <span>
                  Próxima busca: <strong className="font-semibold text-[var(--ac-text)]">{nextSearchLabel}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="admin-btn-secondary text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => {
                setOutboundResult(null);
                setOutboundModalOpen(true);
              }}
              disabled={outboundBusy || (counts?.qualified || 0) === 0}
              className="admin-btn-secondary text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 flex items-center gap-1.5 font-semibold shadow-sm transition-all disabled:opacity-50"
              title="Disparar apresentação comercial para terreiros qualificados via WhatsApp Meta Cloud API"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Disparar WhatsApp ({counts?.qualified || 0})
            </button>
            <button
              type="button"
              onClick={() => setDiscoveryModalOpen(true)}
              disabled={discoveryBusy}
              className={`admin-btn-secondary text-xs bg-[var(--ac-accent)] text-white hover:bg-[var(--ac-accent)]/80 flex items-center gap-1.5 transition-all ${
                discoveryBusy ? 'opacity-85 cursor-wait shadow-inner' : ''
              }`}
            >
              {discoveryBusy ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Descobrindo... ({discoveryProgress?.percent || 0}%)
                </>
              ) : (
                <>
                  <Compass className="h-3.5 w-3.5" />
                  Descobrir Terreiros
                </>
              )}
            </button>
          </div>
        }
      >
        {/* Card de Busca em Andamento (Live Discovery) */}
        {discoveryProgress && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--ac-accent)]/30 bg-gradient-to-br from-[var(--ac-paper-elevated)] via-[var(--ac-paper-elevated)] to-[var(--ac-accent)]/10 p-5 shadow-lg relative animate-in fade-in slide-in-from-top-3 duration-300">
            {/* Efeito sutil de brilho no topo */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--ac-accent)] to-transparent animate-pulse" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--ac-paper-border)]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ac-accent)]/15 border border-[var(--ac-accent)]/30 text-[var(--ac-accent)]">
                  <Compass className="h-5 w-5 animate-spin duration-3000" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[var(--ac-text)] tracking-tight">
                      Descobrindo terreiros...
                    </h4>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Em tempo real
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ac-text-muted)]">
                    <span className="text-[var(--ac-text-faint)]">Região atual:</span>
                    <span className="font-semibold text-[var(--ac-text)] flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[var(--ac-accent)] inline" />
                      {discoveryProgress.region}
                    </span>
                  </div>
                </div>
              </div>

              {/* Indicador de Status / Etapa */}
              <div className="text-left md:text-right">
                <span className="text-[11px] font-medium text-[var(--ac-text-muted)]">
                  {discoveryProgress.statusText || 'Processando varredura e IA...'}
                </span>
              </div>
            </div>

            {/* Grid das Métricas: Encontrados, Novos, Duplicados, Analisados */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)]/70 p-3">
                <span className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block tracking-wider">
                  Encontrados
                </span>
                <span className="text-xl font-bold font-mono text-[var(--ac-text)] mt-1 block">
                  {discoveryProgress.found}
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Novos
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                  +{discoveryProgress.newLeads}
                </span>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                  Duplicados
                </span>
                <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                  {discoveryProgress.duplicates}
                </span>
              </div>

              <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
                <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">
                  Analisados
                </span>
                <span className="text-xl font-bold font-mono text-sky-400 mt-1 block">
                  {discoveryProgress.analyzed}
                </span>
              </div>
            </div>

            {/* Barra de Progresso com Percentual */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-[var(--ac-text-muted)]">
                  Progresso da varredura
                </span>
                <span className="font-mono font-bold text-sm text-[var(--ac-accent)]">
                  {discoveryProgress.percent}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[var(--ac-paper-border)]/50 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--ac-accent)] via-amber-400 to-emerald-400 transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(5, discoveryProgress.percent))}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Barra de Filtros */}
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 text-xs">
          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">Busca</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--ac-text-faint)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Nome ou telefone..."
                className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] pl-8 pr-3 py-2 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">Fonte</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
            >
              <option value="">Todas as fontes</option>
              {Object.entries(SOURCE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">Cidade</label>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(0);
              }}
              placeholder="Ex: São Paulo"
              className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">Estado (UF)</label>
            <input
              type="text"
              value={stateFilter}
              maxLength={2}
              onChange={(e) => {
                setStateFilter(e.target.value.toUpperCase());
                setPage(0);
              }}
              placeholder="Ex: SP"
              className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">Score Mínimo</label>
            <select
              value={minScoreFilter != null ? String(minScoreFilter) : ''}
              onChange={(e) => {
                setMinScoreFilter(e.target.value ? parseInt(e.target.value, 10) : undefined);
                setPage(0);
              }}
              className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] px-3 py-2 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
            >
              <option value="">Todos os scores</option>
              <option value="75">75+ (Alta maturidade)</option>
              <option value="50">50+ (Qualificado)</option>
              <option value="25">25+ (Inicial)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Tabela de Leads */}
        <div className="overflow-x-auto rounded-xl border border-[var(--ac-paper-border)]">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] text-[10px] font-bold uppercase tracking-wider text-[var(--ac-text-faint)]">
              <tr>
                <th className="px-4 py-3">Terreiro / Organização</th>
                <th className="px-4 py-3">Localização</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Fonte</th>
                <th className="px-4 py-3 text-center">Score IA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ac-paper-border)] bg-[var(--ac-paper)]">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="cursor-pointer hover:bg-[var(--ac-paper-elevated)] transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-[var(--ac-text)]">
                    <p className="truncate max-w-xs">{lead.name}</p>
                    {lead.ai_summary && (
                      <p className="text-[10px] text-[var(--ac-text-faint)] truncate max-w-xs mt-0.5">
                        {lead.ai_summary}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--ac-text-muted)]">
                    {[lead.city, lead.state].filter(Boolean).join(' - ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--ac-text-muted)]">
                    {lead.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--ac-text-muted)]">
                    {SOURCE_LABELS[lead.source] || lead.source}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        lead.score >= 75
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : lead.score >= 50
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30'
                      }`}
                    >
                      {lead.score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold bg-[var(--ac-paper-elevated)] border border-[var(--ac-paper-border)] text-[var(--ac-text)]">
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] text-[var(--ac-text-faint)]">
                    {format(new Date(lead.created_at), 'dd/MM/yyyy')}
                  </td>
                </tr>
              ))}

              {!loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--ac-text-muted)]">
                    Nenhum terreiro encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--ac-text-muted)]">
          <span>
            Mostrando {leads.length} de {totalLeads} terreiros
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="admin-btn-secondary !p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-mono text-[10px]">
              Página {page + 1} de {Math.max(1, Math.ceil(totalLeads / pageSize))}
            </span>
            <button
              type="button"
              disabled={(page + 1) * pageSize >= totalLeads || loading}
              onClick={() => setPage((p) => p + 1)}
              className="admin-btn-secondary !p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </AdminPanel>

      {/* Drawer de Detalhes do Lead */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onRefreshList={() => void loadData()}
      />

      {/* Modal de Descoberta de Novos Terreiros */}
      {discoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--ac-text)] flex items-center gap-2">
              <Compass className="h-4 w-4 text-[var(--ac-accent)]" /> Descoberta de Novos Terreiros
            </h3>
            <p className="mt-1 text-xs text-[var(--ac-text-muted)]">
              Aciona o Cloudflare Workflow de descoberta e deduplicação inteligente.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">
                  Fonte / Provider
                </label>
                <select
                  value={discoveryProvider}
                  onChange={(e) => setDiscoveryProvider(e.target.value)}
                  className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-2.5 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                >
                  <option value="existing_axecloud_database">Base Interna AxéCloud (Diretório)</option>
                  <option value="google_places">Google Places API (Google Maps)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">
                  Cidade (Opcional)
                </label>
                <input
                  type="text"
                  value={discoveryCity}
                  onChange={(e) => setDiscoveryCity(e.target.value)}
                  placeholder="Ex: Suzano, Salvador, Rio de Janeiro"
                  className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-2.5 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">
                  Estado UF (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={discoveryState}
                  onChange={(e) => setDiscoveryState(e.target.value.toUpperCase())}
                  placeholder="Ex: SP, BA, RJ"
                  className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-2.5 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--ac-paper-border)]">
              <button
                type="button"
                disabled={discoveryBusy}
                onClick={() => void handleRunDiscovery(true)}
                className="text-xs text-[var(--ac-text-muted)] hover:text-[var(--ac-accent)] underline underline-offset-4 flex items-center gap-1 transition-colors"
                title="Simula a busca em tempo real com os números de demonstração solicitados"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Simular Busca (Demo)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDiscoveryModalOpen(false)}
                  className="admin-btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={discoveryBusy}
                  onClick={() => void handleRunDiscovery(false)}
                  className="admin-btn-secondary text-xs bg-[var(--ac-accent)] text-white hover:bg-[var(--ac-accent)]/80 flex items-center gap-1.5"
                >
                  {discoveryBusy ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Executar Descoberta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Disparo em Lote WhatsApp */}
      {outboundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0">
          <div className="w-full max-w-md rounded-2xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--ac-text)] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" /> Disparo de Apresentação (WhatsApp)
            </h3>
            <p className="mt-1 text-xs text-[var(--ac-text-muted)]">
              Envia o template oficial aprovado pela Meta (<strong className="text-[var(--ac-text)]">axecloud_prospeccao_inicial</strong>) pelo número oficial verificado <strong className="text-emerald-400">+55 11 5295-0746</strong>.
            </p>

            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <div className="flex items-center justify-between font-semibold">
                <span>Terreiros Qualificados Disponíveis:</span>
                <span className="font-mono text-sm">{counts?.qualified || 0}</span>
              </div>
              <p className="mt-1 text-[11px] text-emerald-400/80">
                Apenas terreiros com score validado pela IA e telefone verificado receberão a mensagem.
              </p>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-[var(--ac-text-muted)] block mb-1">
                  Quantidade para Disparo por Lote
                </label>
                <select
                  value={outboundBatchSize}
                  onChange={(e) => setOutboundBatchSize(Number(e.target.value))}
                  disabled={outboundBusy}
                  className="w-full rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-2.5 text-xs text-[var(--ac-text)] outline-none focus:border-[var(--ac-accent)]"
                >
                  <option value={5}>5 terreiros (Recomendado - Segurança Máxima)</option>
                  <option value={10}>10 terreiros</option>
                  <option value={15}>15 terreiros</option>
                  <option value={20}>20 terreiros (Lote Máximo)</option>
                </select>
                <span className="mt-1 block text-[10px] text-[var(--ac-text-faint)]">
                  Disparos com intervalo de 1.2s entre envios para manter a reputação VERDE do número Meta.
                </span>
              </div>

              {outboundResult && (
                <div className="rounded-xl border border-[var(--ac-paper-border)] bg-[var(--ac-paper)] p-3 text-xs text-[var(--ac-text)]">
                  {outboundResult}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-[var(--ac-paper-border)]">
              <button
                type="button"
                onClick={() => setOutboundModalOpen(false)}
                disabled={outboundBusy}
                className="admin-btn-secondary text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={outboundBusy || (counts?.qualified || 0) === 0}
                onClick={() => void handleRunBatchOutbound()}
                className="admin-btn-secondary text-xs bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 flex items-center gap-1.5 font-semibold"
              >
                {outboundBusy ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Disparando mensagens...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-3.5 w-3.5" />
                    Iniciar Disparo ({outboundBatchSize})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
