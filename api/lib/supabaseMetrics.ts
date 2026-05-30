/**
 * Supabase Metrics API (Prometheus) — proxy server-side para o console admin.
 * @see https://supabase.com/docs/guides/telemetry/metrics
 */
import {
  getSupabaseProjectRef,
  getSupabaseServerServiceKey,
  getSupabaseServerUrl,
} from "./supabaseServerEnv.js";

export type MetricFormat = "number" | "bytes" | "percent" | "boolean" | "ms";

type MetricDef = {
  name: string;
  label: string;
  group: string;
  format: MetricFormat;
  /** Como agregar várias séries com o mesmo nome */
  agg: "sum" | "max" | "min" | "avg" | "any";
  /** Filtro opcional em labels (substring no bloco de labels) */
  labelIncludes?: string;
};

const METRIC_DEFS: MetricDef[] = [
  {
    name: "db_sql_connection_open",
    label: "Conexões SQL abertas",
    group: "Conexões",
    format: "number",
    agg: "sum",
    labelIncludes: 'service_type="db"',
  },
  {
    name: "db_sql_connection_open",
    label: "Conexões SQL (GoTrue)",
    group: "Conexões",
    format: "number",
    agg: "sum",
    labelIncludes: 'service_type="gotrue"',
  },
  {
    name: "db_sql_connection_max_open",
    label: "Limite de conexões SQL",
    group: "Conexões",
    format: "number",
    agg: "max",
  },
  {
    name: "db_sql_connection_wait_total",
    label: "Esperas por conexão (total)",
    group: "Conexões",
    format: "number",
    agg: "sum",
  },
  {
    name: "supavisor_connections_active",
    label: "Pooler Supavisor (ativas)",
    group: "Pooler",
    format: "number",
    agg: "sum",
  },
  {
    name: "node_memory_MemAvailable_bytes",
    label: "RAM disponível (nó DB)",
    group: "Recursos",
    format: "bytes",
    agg: "min",
    labelIncludes: 'service_type="db"',
  },
  {
    name: "node_memory_MemTotal_bytes",
    label: "RAM total (nó DB)",
    group: "Recursos",
    format: "bytes",
    agg: "max",
    labelIncludes: 'service_type="db"',
  },
  {
    name: "node_disk_io_now",
    label: "I/O de disco em progresso",
    group: "Disco",
    format: "number",
    agg: "sum",
    labelIncludes: 'service_type="db"',
  },
  {
    name: "postgresql_restarts_total",
    label: "Reinícios PostgreSQL",
    group: "Saúde",
    format: "number",
    agg: "max",
  },
  {
    name: "pg_stat_database_numbackends",
    label: "Backends PostgreSQL",
    group: "PostgreSQL",
    format: "number",
    agg: "sum",
  },
];

export type ParsedMetricSeries = {
  name: string;
  labels: string;
  value: number;
};

export type MetricSnapshotItem = {
  key: string;
  label: string;
  group: string;
  format: MetricFormat;
  value: number | null;
  display: string;
  status: "ok" | "warn" | "critical" | "unknown";
};

import type { MetricsDashboardExtras } from "./supabaseMetricsDashboard.js";
import { buildMetricsDashboard } from "./supabaseMetricsDashboard.js";

export type SupabaseMetricsSnapshot = {
  configured: boolean;
  available: boolean;
  projectRef: string | null;
  scrapedAt: string | null;
  seriesCount: number;
  error?: string;
  hint?: string;
  docsUrl: string;
  studioUrl: string | null;
  groups: Record<string, MetricSnapshotItem[]>;
  gauges: MetricsDashboardExtras["gauges"];
  history: MetricsDashboardExtras["history"];
  historyMaxPoints: number;
  scrapeIntervalSec: number;
  resourceSummary: MetricsDashboardExtras["resourceSummary"];
};

let cache: { expires: number; payload: SupabaseMetricsSnapshot } | null = null;
const CACHE_TTL_MS = 55_000;

function parsePrometheusLines(text: string): ParsedMetricSeries[] {
  const out: ParsedMetricSeries[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace <= 0) continue;
    const valueRaw = trimmed.slice(lastSpace + 1).trim();
    const left = trimmed.slice(0, lastSpace).trim();
    const brace = left.indexOf("{");
    const name = brace === -1 ? left : left.slice(0, brace);
    const labels = brace === -1 ? "" : left.slice(brace);
    const value = Number(valueRaw);
    if (!Number.isFinite(value)) continue;
    out.push({ name, labels, value });
  }
  return out;
}

function aggregate(values: number[], agg: MetricDef["agg"]): number | null {
  if (!values.length) return null;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "max":
      return Math.max(...values);
    case "min":
      return Math.min(...values);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "any":
      return values[0];
    default:
      return values[0];
  }
}

function formatDisplay(value: number | null, format: MetricFormat): string {
  if (value == null) return "—";
  if (format === "boolean") return value >= 1 ? "Sim" : "Não";
  if (format === "bytes") {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GB`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)} KB`;
    return `${Math.round(value)} B`;
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "ms") return `${Math.round(value)} ms`;
  if (Number.isInteger(value) || Math.abs(value) >= 100) return new Intl.NumberFormat("pt-BR").format(Math.round(value));
  return value.toFixed(2);
}

function statusFor(def: MetricDef, value: number | null): MetricSnapshotItem["status"] {
  if (value == null) return "unknown";
  if (def.name === "postgresql_restarts_total" && value > 0) return "warn";
  if (def.name === "db_sql_connection_open" && def.labelIncludes?.includes("db")) {
    return "ok";
  }
  if (def.name === "node_memory_MemAvailable_bytes" && value < 128 * 1024 * 1024) return "critical";
  if (def.name === "node_memory_MemAvailable_bytes" && value < 256 * 1024 * 1024) return "warn";
  return "ok";
}

function buildSnapshotItems(
  series: ParsedMetricSeries[],
  defs: MetricDef[]
): MetricSnapshotItem[] {
  const items: MetricSnapshotItem[] = [];

  for (const def of defs) {
    const matched = series.filter((s) => {
      if (s.name !== def.name) return false;
      if (def.labelIncludes && !s.labels.includes(def.labelIncludes)) return false;
      return true;
    });
    const value = aggregate(
      matched.map((m) => m.value),
      def.agg
    );
    items.push({
      key: `${def.name}:${def.labelIncludes || "all"}`,
      label: def.label,
      group: def.group,
      format: def.format,
      value,
      display: formatDisplay(value, def.format),
      status: statusFor(def, value),
    });
  }

  return items;
}

function enrichConnectionWarnings(items: MetricSnapshotItem[]): void {
  const openDb = items.find((i) => i.key.startsWith('db_sql_connection_open:service_type="db"'));
  const limit = items.find((i) => i.label === "Limite de conexões SQL");
  if (openDb?.value != null && limit?.value != null && limit.value > 0) {
    const pct = (openDb.value / limit.value) * 100;
    if (pct >= 90) openDb.status = "critical";
    else if (pct >= 75) openDb.status = "warn";
    openDb.display = `${formatDisplay(openDb.value, "number")} (${pct.toFixed(0)}% do limite)`;
  }
}

export function getSupabaseMetricsPassword(): string | undefined {
  return (
    process.env.SUPABASE_METRICS_SECRET_KEY ||
    process.env.SUPABASE_SECRET_API_KEY ||
    getSupabaseServerServiceKey()
  );
}

export async function fetchSupabaseMetricsSnapshot(options?: {
  bypassCache?: boolean;
}): Promise<SupabaseMetricsSnapshot> {
  const docsUrl = "https://supabase.com/docs/guides/telemetry/metrics";
  const url = getSupabaseServerUrl();
  const projectRef = getSupabaseProjectRef(url);
  const password = getSupabaseMetricsPassword();
  const studioUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}` : null;

  const emptyDash = {
    gauges: [] as MetricsDashboardExtras["gauges"],
    history: [] as MetricsDashboardExtras["history"],
    historyMaxPoints: 120,
    scrapeIntervalSec: 60,
    resourceSummary: {
      cpus: 0,
      ramTotalBytes: null,
      ramAvailableBytes: null,
      swapTotalBytes: null,
      connOpen: null,
      connMax: null,
    },
  };

  const base: SupabaseMetricsSnapshot = {
    configured: Boolean(projectRef && password),
    available: false,
    projectRef,
    scrapedAt: null,
    seriesCount: 0,
    docsUrl,
    studioUrl,
    groups: {},
    ...emptyDash,
  };

  if (!projectRef || !password) {
    return {
      ...base,
      error: "Métricas não configuradas no servidor.",
      hint: "Defina VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY (ou sb_secret em SUPABASE_METRICS_SECRET_KEY).",
    };
  }

  if (!options?.bypassCache && cache && cache.expires > Date.now()) {
    return cache.payload;
  }

  const metricsUrl = `https://${projectRef}.supabase.co/customer/v1/privileged/metrics`;
  const auth = Buffer.from(`service_role:${password}`, "utf8").toString("base64");

  try {
    const res = await fetch(metricsUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "text/plain; version=0.0.4",
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 401
          ? "Autenticação recusada. Use a Secret API key (sb_secret_…) ou a service_role em SUPABASE_SERVICE_ROLE_KEY."
          : res.status === 404
            ? "Endpoint não encontrado — confira o project ref."
            : undefined;
      return {
        ...base,
        error: `Metrics API respondeu ${res.status}.`,
        hint: hint || body.slice(0, 200) || undefined,
      };
    }

    const text = await res.text();
    const parsed = parsePrometheusLines(text);
    const items = buildSnapshotItems(parsed, METRIC_DEFS);
    enrichConnectionWarnings(items);

    const groups: Record<string, MetricSnapshotItem[]> = {};
    for (const item of items) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }

    const dashboard = buildMetricsDashboard(parsed);

    const payload: SupabaseMetricsSnapshot = {
      configured: true,
      available: true,
      projectRef,
      scrapedAt: new Date().toISOString(),
      seriesCount: parsed.length,
      docsUrl,
      studioUrl,
      groups,
      gauges: dashboard.gauges,
      history: dashboard.history,
      historyMaxPoints: dashboard.historyMaxPoints,
      scrapeIntervalSec: dashboard.scrapeIntervalSec,
      resourceSummary: dashboard.resourceSummary,
    };

    cache = { expires: Date.now() + CACHE_TTL_MS, payload };
    return payload;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao contactar Metrics API";
    return {
      ...base,
      error: msg,
      hint: "A Metrics API está em beta e exige projeto Supabase hospedado (não self-hosted).",
    };
  }
}
