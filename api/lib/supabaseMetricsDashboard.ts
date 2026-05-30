/**
 * Dashboard estilo Grafana/Supabase Studio — gauges + séries temporais.
 * A Metrics API só devolve snapshot; guardamos histórico em memória (scrape ~60s).
 */
import type { ParsedMetricSeries } from "./supabaseMetrics.js";

export type MetricsHistoryPoint = {
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

export type MetricsGauge = {
  id: string;
  label: string;
  value: number;
  display: string;
  unit: "%";
  status: "ok" | "warn" | "critical";
};

export type MetricsDashboardExtras = {
  gauges: MetricsGauge[];
  history: MetricsHistoryPoint[];
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

const HISTORY_MAX = 120;
const SCRAPE_INTERVAL_SEC = 60;

let metricsHistory: MetricsHistoryPoint[] = [];
let lastCpuModes: Record<string, number> | null = null;
let lastNetRx = 0;
let lastNetTx = 0;
let lastScrapeMs = 0;

function dbSeries(series: ParsedMetricSeries[], name: string): ParsedMetricSeries[] {
  return series.filter((s) => s.name === name && s.labels.includes('service_type="db"'));
}

function sumSeries(rows: ParsedMetricSeries[]): number {
  return rows.reduce((a, s) => a + s.value, 0);
}

function labelValue(labels: string, key: string): string | null {
  const m = labels.match(new RegExp(`${key}="([^"]+)"`));
  return m ? m[1] : null;
}

function getCpuModes(series: ParsedMetricSeries[]): Record<string, number> {
  const modes: Record<string, number> = {};
  for (const s of dbSeries(series, "node_cpu_seconds_total")) {
    const mode = labelValue(s.labels, "mode");
    if (!mode) continue;
    modes[mode] = (modes[mode] || 0) + s.value;
  }
  return modes;
}

function cpuPercentsFromDelta(
  prev: Record<string, number>,
  curr: Record<string, number>,
  dtSec: number
): Pick<
  MetricsHistoryPoint,
  "cpuBusy" | "cpuIdle" | "cpuUser" | "cpuSystem" | "cpuIowait"
> | null {
  if (dtSec <= 0) return null;
  const modes = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  let total = 0;
  const deltas: Record<string, number> = {};
  for (const mode of modes) {
    const d = Math.max(0, (curr[mode] || 0) - (prev[mode] || 0));
    deltas[mode] = d;
    total += d;
  }
  if (total <= 0) return null;
  const pct = (mode: string) => ((deltas[mode] || 0) / total) * 100;
  const idle = pct("idle");
  return {
    cpuBusy: Math.min(100, Math.max(0, 100 - idle)),
    cpuIdle: idle,
    cpuUser: pct("user"),
    cpuSystem: pct("system"),
    cpuIowait: pct("iowait"),
  };
}

function gaugeStatus(id: string, value: number): MetricsGauge["status"] {
  if (id === "cpu" && value >= 85) return "critical";
  if (id === "cpu" && value >= 70) return "warn";
  if (id === "ram" && value >= 90) return "critical";
  if (id === "ram" && value >= 80) return "warn";
  if (id === "swap" && value >= 50) return "warn";
  if (id === "swap" && value >= 80) return "critical";
  if (id === "conn" && value >= 90) return "critical";
  if (id === "conn" && value >= 75) return "warn";
  if (id === "rootfs" && value >= 90) return "critical";
  if (id === "rootfs" && value >= 80) return "warn";
  if (id === "load5" && value >= 100) return "critical";
  if (id === "load5" && value >= 80) return "warn";
  return "ok";
}

function buildGauges(input: {
  cpuBusy: number | null;
  load5: number | null;
  cpus: number;
  ramUsedPct: number | null;
  swapUsedPct: number | null;
  rootFsUsedPct: number | null;
  connPct: number | null;
}): MetricsGauge[] {
  const loadPct =
    input.load5 != null && input.cpus > 0
      ? Math.min(100, (input.load5 / input.cpus) * 100)
      : null;

  const defs: { id: string; label: string; value: number | null }[] = [
    { id: "cpu", label: "CPU ocupada", value: input.cpuBusy },
    { id: "load5", label: "Carga (5m)", value: loadPct },
    { id: "ram", label: "RAM usada", value: input.ramUsedPct },
    { id: "swap", label: "SWAP usada", value: input.swapUsedPct },
    { id: "rootfs", label: "Disco raiz", value: input.rootFsUsedPct },
    { id: "conn", label: "Conexões SQL", value: input.connPct },
  ];

  return defs
    .filter((d) => d.value != null && Number.isFinite(d.value))
    .map((d) => ({
      id: d.id,
      label: d.label,
      value: Math.round(d.value! * 10) / 10,
      display: `${d.value!.toFixed(1)}%`,
      unit: "%" as const,
      status: gaugeStatus(d.id, d.value!),
    }));
}

export function buildMetricsDashboard(series: ParsedMetricSeries[]): MetricsDashboardExtras {
  const now = Date.now();
  const dtSec = lastScrapeMs > 0 ? (now - lastScrapeMs) / 1000 : SCRAPE_INTERVAL_SEC;

  const memTotal = sumSeries(dbSeries(series, "node_memory_MemTotal_bytes"));
  const memAvail = sumSeries(dbSeries(series, "node_memory_MemAvailable_bytes"));
  const swapTotal = sumSeries(dbSeries(series, "node_memory_SwapTotal_bytes"));
  const swapFree = sumSeries(dbSeries(series, "node_memory_SwapFree_bytes"));
  const load5 = sumSeries(dbSeries(series, "node_load5")) || null;
  const diskIo = sumSeries(dbSeries(series, "node_disk_io_now")) || null;

  const fsSize = sumSeries(
    dbSeries(series, "node_filesystem_size_bytes").filter((s) => s.labels.includes('mountpoint="/"'))
  );
  const fsAvail = sumSeries(
    dbSeries(series, "node_filesystem_avail_bytes").filter((s) => s.labels.includes('mountpoint="/"'))
  );

  const connOpen = sumSeries(
    dbSeries(series, "db_sql_connection_open").filter((s) => s.labels.includes('service_type="db"'))
  );
  const connMax = sumSeries(dbSeries(series, "db_sql_connection_max_open")) || null;

  const ramUsedPct =
    memTotal > 0 ? Math.min(100, Math.max(0, ((memTotal - memAvail) / memTotal) * 100)) : null;
  const swapUsedPct =
    swapTotal > 0 ? Math.min(100, Math.max(0, ((swapTotal - swapFree) / swapTotal) * 100)) : null;
  const rootFsUsedPct =
    fsSize > 0 ? Math.min(100, Math.max(0, ((fsSize - fsAvail) / fsSize) * 100)) : null;
  const connPct =
    connMax != null && connMax > 0 ? Math.min(100, (connOpen / connMax) * 100) : null;

  const cpuModes = getCpuModes(series);
  const cpuFromDelta =
    lastCpuModes && dtSec > 0 ? cpuPercentsFromDelta(lastCpuModes, cpuModes, dtSec) : null;

  const netRx = sumSeries(dbSeries(series, "node_network_receive_bytes_total"));
  const netTx = sumSeries(dbSeries(series, "node_network_transmit_bytes_total"));
  let netRecvKbps: number | null = null;
  let netSendKbps: number | null = null;
  if (lastScrapeMs > 0 && dtSec > 0) {
    netRecvKbps = Math.max(0, ((netRx - lastNetRx) / dtSec) * 8) / 1000;
    netSendKbps = Math.max(0, ((netTx - lastNetTx) / dtSec) * 8) / 1000;
  }

  const cpuCount = Math.max(
    1,
    new Set(
      dbSeries(series, "node_cpu_seconds_total").map((s) => labelValue(s.labels, "cpu")).filter(Boolean)
    ).size || 2
  );

  const point: MetricsHistoryPoint = {
    ts: new Date(now).toISOString(),
    cpuBusy: cpuFromDelta?.cpuBusy ?? null,
    cpuIdle: cpuFromDelta?.cpuIdle ?? null,
    cpuUser: cpuFromDelta?.cpuUser ?? null,
    cpuSystem: cpuFromDelta?.cpuSystem ?? null,
    cpuIowait: cpuFromDelta?.cpuIowait ?? null,
    ramUsedPct,
    swapUsedPct,
    load5,
    rootFsUsedPct,
    connPct,
    diskIoNow: diskIo,
    netRecvKbps,
    netSendKbps,
  };

  metricsHistory.push(point);
  if (metricsHistory.length > HISTORY_MAX) {
    metricsHistory = metricsHistory.slice(-HISTORY_MAX);
  }

  lastCpuModes = cpuModes;
  lastNetRx = netRx;
  lastNetTx = netTx;
  lastScrapeMs = now;

  const gauges = buildGauges({
    cpuBusy: point.cpuBusy,
    load5,
    cpus: cpuCount,
    ramUsedPct,
    swapUsedPct,
    rootFsUsedPct,
    connPct,
  });

  return {
    gauges,
    history: [...metricsHistory],
    historyMaxPoints: HISTORY_MAX,
    scrapeIntervalSec: SCRAPE_INTERVAL_SEC,
    resourceSummary: {
      cpus: cpuCount,
      ramTotalBytes: memTotal || null,
      ramAvailableBytes: memAvail || null,
      swapTotalBytes: swapTotal || null,
      connOpen: connOpen || null,
      connMax,
    },
  };
}

/** Para testes / reinício do processo */
export function resetMetricsHistory() {
  metricsHistory = [];
  lastCpuModes = null;
  lastNetRx = 0;
  lastNetTx = 0;
  lastScrapeMs = 0;
}
