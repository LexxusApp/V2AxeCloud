import { useCallback, useEffect, useMemo, useState } from "react";

import { format } from "date-fns";

import { ptBR } from "date-fns/locale";

import {

  Activity,

  AlertTriangle,

  CheckCircle2,

  ExternalLink,

  HelpCircle,

  RefreshCw,

  Server,

} from "lucide-react";

import { apiJson } from "@/lib/api";

import { cn } from "@/lib/cn";

import { MetricsGauge } from "@/components/metrics/MetricsGauge";

import { MetricsTimeSeriesChart } from "@/components/metrics/MetricsTimeSeriesChart";

import { AdminPanel, AdminStatCard } from "./AdminDashboardLayout";



type MetricItem = {

  key: string;

  label: string;

  group: string;

  format: string;

  value: number | null;

  display: string;

  status: "ok" | "warn" | "critical" | "unknown";

};



type MetricsGaugeDto = {

  id: string;

  label: string;

  value: number;

  display: string;

  unit: "%";

  status: "ok" | "warn" | "critical";

};



type HistoryPoint = {

  ts: string;

  cpuBusy: number | null;

  cpuIdle: number | null;

  cpuUser: number | null;

  cpuSystem: number | null;

  cpuIowait: number | null;

  ramUsedPct: number | null;

  swapUsedPct: number | null;

  load5: number | null;

  rootFsUsedPct: number | null;

  connPct: number | null;

  diskIoNow: number | null;

  netRecvKbps: number | null;

  netSendKbps: number | null;

};



type MetricsSnapshot = {

  configured: boolean;

  available: boolean;

  projectRef: string | null;

  scrapedAt: string | null;

  seriesCount: number;

  error?: string;

  hint?: string;

  docsUrl: string;

  studioUrl: string | null;

  groups: Record<string, MetricItem[]>;

  gauges: MetricsGaugeDto[];

  history: HistoryPoint[];

  historyMaxPoints: number;

  scrapeIntervalSec: number;

  resourceSummary: {

    cpus: number;

    ramTotalBytes: number | null;

    ramAvailableBytes: number | null;

    swapTotalBytes: number | null;

    connOpen: number | null;

    connMax: number | null;

  };

};



function formatBytes(n: number | null): string {

  if (n == null || !Number.isFinite(n)) return "—";

  const gb = n / 1024 ** 3;

  if (gb >= 1) return `${gb.toFixed(1)} GiB`;

  const mb = n / 1024 ** 2;

  return `${mb.toFixed(0)} MiB`;

}



function statusIcon(status: MetricItem["status"]) {

  if (status === "critical") return <AlertTriangle className="h-4 w-4 text-[var(--ac-danger)]" />;

  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-[var(--ac-warn)]" />;

  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-[var(--ac-success)]" />;

  return <HelpCircle className="h-4 w-4 text-[var(--ac-text-faint)]" />;

}



function statusBorder(status: MetricItem["status"]) {

  if (status === "critical") return "border-[rgba(166,27,18,0.35)] bg-[var(--ac-danger-soft)]";

  if (status === "warn") return "border-[rgba(138,90,0,0.3)] bg-[var(--ac-warn-soft)]";

  return "border-[var(--ac-paper-border)] bg-[var(--ac-paper-elevated)]";

}



type SupabaseMetricsPanelProps = {

  onMessage?: (msg: string) => void;

};



export function SupabaseMetricsPanel({ onMessage }: SupabaseMetricsPanelProps) {

  const [data, setData] = useState<MetricsSnapshot | null>(null);

  const [busy, setBusy] = useState(false);



  const load = useCallback(

    async (refresh = false) => {

      setBusy(true);

      try {

        const qs = refresh ? "?refresh=1" : "";

        const j = await apiJson<MetricsSnapshot & { success?: boolean }>(

          `/api/admin-console/supabase-metrics${qs}`

        );

        setData(j);

        if (j.error && onMessage) onMessage(j.error);

      } catch (e) {

        const msg = e instanceof Error ? e.message : "Erro ao carregar métricas";

        if (onMessage) onMessage(msg);

      } finally {

        setBusy(false);

      }

    },

    [onMessage]

  );



  useEffect(() => {

    void load(true);

  }, [load]);



  useEffect(() => {

    if (!data?.available) return;

    const id = window.setInterval(() => void load(true), (data.scrapeIntervalSec || 60) * 1000);

    return () => window.clearInterval(id);

  }, [data?.available, data?.scrapeIntervalSec, load]);



  const history = data?.history ?? [];

  const timestamps = useMemo(() => history.map((p) => p.ts), [history]);

  const historyHint =

    history.length < 2

      ? "Aguarde ~2 min (scrape a cada 60s) para séries de CPU/rede"

      : undefined;



  const connItems = data?.groups?.Conexões || [];

  const openDb = connItems.find((i) => i.label.includes("Conexões SQL abertas"));

  const pooler = data?.groups?.Pooler?.[0];

  const rs = data?.resourceSummary;



  const detailGroups = data?.groups

    ? Object.entries(data.groups).filter(([name]) => name !== "Recursos")

    : [];



  return (

    <div className="space-y-6">

      <div className="admin-alert-info">

        <Server className="h-4 w-4 shrink-0 text-[var(--ac-accent)]" />

        <div className="min-w-0 text-sm">

          <p className="font-medium text-[var(--ac-text)]">Infra Supabase (estilo Studio / Grafana)</p>

          <p className="mt-1 text-[var(--ac-text-muted)]">

            Gauges e gráficos derivados da{" "}

            <a

              href={data?.docsUrl || "https://supabase.com/docs/guides/telemetry/metrics"}

              target="_blank"

              rel="noreferrer"

              className="font-semibold text-[var(--ac-accent)] hover:underline"

            >

              Metrics API

            </a>

            . O histórico é acumulado no servidor (~{data?.scrapeIntervalSec ?? 60}s por ponto), como no fluxo{" "}

            <a

              href="https://github.com/supabase/supabase-grafana"

              target="_blank"

              rel="noreferrer"

              className="text-[var(--ac-accent)] hover:underline"

            >

              supabase-grafana

            </a>

            .

          </p>

        </div>

      </div>



      {data?.error ? (

        <div className="admin-alert-warn text-[var(--ac-warn)]">

          <p className="font-semibold">{data.error}</p>

          {data.hint ? <p className="mt-2 text-[13px] opacity-90">{data.hint}</p> : null}

        </div>

      ) : null}



      <div className="flex flex-wrap items-center gap-2">

        <button

          type="button"

          onClick={() => void load(true)}

          disabled={busy}

          className="admin-btn-secondary"

        >

          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />

          Actualizar

        </button>

        {data?.studioUrl ? (

          <a href={data.studioUrl} target="_blank" rel="noreferrer" className="admin-btn-secondary">

            Supabase Studio

            <ExternalLink className="h-3.5 w-3.5" />

          </a>

        ) : null}

        {data?.projectRef ? (

          <span className="admin-badge admin-mono">ref: {data.projectRef}</span>

        ) : null}

        {data?.scrapedAt ? (

          <span className="text-xs text-[var(--ac-text-faint)]">

            {format(new Date(data.scrapedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}

            {data.seriesCount ? ` · ${data.seriesCount} séries` : ""}

            {history.length ? ` · ${history.length}/${data.historyMaxPoints} pontos` : ""}

          </span>

        ) : null}

      </div>



      {data?.available ? (

        <>

          <AdminPanel kicker="Quick" title="CPU / Mem / Disco / Conexões">

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

              <div className="metrics-gauge-row">

                {(data.gauges?.length ? data.gauges : []).map((g) => (

                  <MetricsGauge

                    key={g.id}

                    label={g.label}

                    value={g.value}

                    display={g.display}

                    status={g.status}

                  />

                ))}

                {!data.gauges?.length ? (

                  <p className="text-sm text-[var(--ac-text-muted)]">

                    Primeira leitura: gauges de RAM, disco e carga aparecem já; CPU e rede após o 2.º scrape.

                  </p>

                ) : null}

              </div>

              <dl className="metrics-summary-table shrink-0">

                <dt>CPU (nó)</dt>

                <dd>{rs?.cpus ?? "—"}</dd>

                <dt>RAM total</dt>

                <dd>{formatBytes(rs?.ramTotalBytes ?? null)}</dd>

                <dt>RAM disponível</dt>

                <dd>{formatBytes(rs?.ramAvailableBytes ?? null)}</dd>

                <dt>SWAP total</dt>

                <dd>{formatBytes(rs?.swapTotalBytes ?? null)}</dd>

                <dt>Conexões SQL</dt>

                <dd>

                  {rs?.connOpen != null && rs?.connMax != null

                    ? `${rs.connOpen} / ${rs.connMax}`

                    : openDb?.display ?? "—"}

                </dd>

              </dl>

            </div>

          </AdminPanel>



          <AdminPanel kicker="Séries" title="CPU / Memória / Rede / Disco">

            <div className="metrics-charts-grid">

              <MetricsTimeSeriesChart

                title="CPU (modos)"

                timestamps={timestamps}

                stacked

                yMax={100}

                yUnit="%"

                emptyHint={historyHint}

                series={[

                  {
                    key: "iowait",
                    label: "Iowait",
                    color: "rgba(166, 27, 18, 0.75)",
                    values: history.map((p) => p.cpuIowait),
                  },
                  {
                    key: "system",
                    label: "System",
                    color: "rgba(138, 90, 0, 0.85)",
                    values: history.map((p) => p.cpuSystem),
                  },
                  {
                    key: "user",
                    label: "User",
                    color: "rgba(90, 111, 158, 0.9)",
                    values: history.map((p) => p.cpuUser),
                  },
                  {
                    key: "idle",
                    label: "Idle",
                    color: "rgba(74, 124, 89, 0.85)",
                    values: history.map((p) => p.cpuIdle),
                  },

                ]}

              />

              <MetricsTimeSeriesChart

                title="Memória"

                timestamps={timestamps}

                yMax={100}

                yUnit="%"

                series={[

                  {

                    key: "ram",

                    label: "RAM usada",

                    color: "rgba(90, 111, 158, 0.85)",

                    values: history.map((p) => p.ramUsedPct),

                  },

                  {

                    key: "swap",

                    label: "SWAP usada",

                    color: "rgba(166, 27, 18, 0.7)",

                    values: history.map((p) => p.swapUsedPct),

                  },

                ]}

              />

              <MetricsTimeSeriesChart

                title="Rede (kb/s)"

                timestamps={timestamps}

                yUnit=" kb/s"

                emptyHint={historyHint}

                series={[

                  {

                    key: "rx",

                    label: "Recepção",

                    color: "rgba(74, 124, 89, 0.8)",

                    values: history.map((p) => p.netRecvKbps),

                  },

                  {

                    key: "tx",

                    label: "Transmissão",

                    color: "rgba(138, 90, 0, 0.8)",

                    values: history.map((p) => p.netSendKbps),

                  },

                ]}

              />

              <MetricsTimeSeriesChart

                title="Disco raiz & I/O"

                timestamps={timestamps}

                series={[

                  {

                    key: "root",

                    label: "FS / (%)",

                    color: "rgba(74, 124, 89, 0.8)",

                    values: history.map((p) => p.rootFsUsedPct),

                  },

                  {

                    key: "io",

                    label: "I/O em progresso",

                    color: "rgba(90, 111, 158, 0.75)",

                    values: history.map((p) => p.diskIoNow),

                  },

                  {

                    key: "conn",

                    label: "Conexões SQL (%)",

                    color: "rgba(166, 27, 18, 0.65)",

                    values: history.map((p) => p.connPct),

                  },

                ]}

              />

            </div>

          </AdminPanel>



          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

            <AdminStatCard

              title="Conexões DB"

              value={openDb?.display ?? "—"}

              icon={Activity}

              hint={openDb?.status === "critical" ? "Próximo do limite" : undefined}

            />

            <AdminStatCard title="Pooler activo" value={pooler?.display ?? "—"} icon={Server} />

            <AdminStatCard

              title="CPU ocupada"

              value={

                data.gauges?.find((g) => g.id === "cpu")?.display ??

                (history.at(-1)?.cpuBusy != null ? `${history.at(-1)!.cpuBusy!.toFixed(1)}%` : "—")

              }

              icon={Activity}

            />

            <AdminStatCard

              title="Séries Prometheus"

              value={String(data.seriesCount)}

              icon={Activity}

              hint="Snapshot Metrics API"

            />

          </section>



          {detailGroups.map(([groupName, items]) => (

            <AdminPanel key={groupName} kicker="Detalhe" title={groupName}>

              <ul className="grid gap-2 sm:grid-cols-2">

                {items.map((item) => (

                  <li

                    key={item.key}

                    className={cn(

                      "flex items-center justify-between gap-3 rounded-[var(--ac-radius-sm)] border px-3 py-2.5",

                      statusBorder(item.status)

                    )}

                  >

                    <div className="flex min-w-0 items-center gap-2">

                      {statusIcon(item.status)}

                      <span className="text-sm text-[var(--ac-text)]">{item.label}</span>

                    </div>

                    <span className="admin-mono shrink-0 text-sm font-semibold text-[var(--ac-text)]">

                      {item.display}

                    </span>

                  </li>

                ))}

              </ul>

            </AdminPanel>

          ))}

        </>

      ) : data && !data.error ? (

        <AdminPanel kicker="Estado" title="Métricas indisponíveis">

          <p className="text-sm text-[var(--ac-text-muted)]">

            Configure <code className="admin-mono text-xs">SUPABASE_METRICS_SECRET_KEY</code> (ou service role) e o

            project ref no servidor. Actualize após configurar.

          </p>

        </AdminPanel>

      ) : null}

    </div>

  );

}

