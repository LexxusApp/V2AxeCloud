import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
};

type MetricsTimeSeriesChartProps = {
  title: string;
  series: ChartSeries[];
  timestamps: string[];
  yMax?: number;
  yUnit?: string;
  height?: number;
  stacked?: boolean;
  emptyHint?: string;
};

function niceMax(values: number[], fallback = 100) {
  const m = Math.max(...values, 0);
  if (m <= 0) return fallback;
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  return Math.ceil(m / pow) * pow || fallback;
}

function yAt(v: number, width: number, height: number, yMax: number, i: number, len: number) {
  const step = len > 1 ? width / (len - 1) : width;
  const x = i * step;
  const y = height - (Math.min(v, yMax) / yMax) * (height - 8) - 4;
  return `${x},${y}`;
}

function bandPath(
  top: number[],
  bottom: number[],
  width: number,
  height: number,
  yMax: number
): string {
  const len = top.length;
  if (len === 0) return "";
  const fwd = top.map((v, i) => yAt(v, width, height, yMax, i, len));
  const bwd = bottom
    .map((v, i) => yAt(v, width, height, yMax, len - 1 - i, len))
    .reverse();
  return `M ${fwd.join(" L ")} L ${bwd.join(" L ")} Z`;
}

function lineAreaPath(values: number[], width: number, height: number, yMax: number): string {
  const len = values.length;
  if (len === 0) return "";
  const fwd = values.map((v, i) => yAt(v, width, height, yMax, i, len));
  const base = `${width},${height} 0,${height}`;
  return `M ${fwd.join(" L ")} L ${base} Z`;
}

export function MetricsTimeSeriesChart({
  title,
  series,
  timestamps,
  yMax: yMaxProp,
  yUnit = "%",
  height = 140,
  stacked = false,
  emptyHint,
}: MetricsTimeSeriesChartProps) {
  const width = 400;
  const hasData = series.some((s) => s.values.some((v) => v != null && Number.isFinite(v)));

  const { yMax, paths, ticks } = useMemo(() => {
    const flat: number[] = [];
    for (const s of series) {
      for (const v of s.values) {
        if (v != null && Number.isFinite(v)) flat.push(v);
      }
    }
    const yMax = yMaxProp ?? niceMax(flat, stacked ? 100 : 10);

    if (stacked && series.length > 0) {
      const len = series[0].values.length;
      const stackedPaths: { key: string; d: string; color: string; label: string }[] = [];
      const cumul: number[] = new Array(len).fill(0);
      for (const s of series) {
        const top = s.values.map((v, i) => {
          const n = v ?? 0;
          cumul[i] += n;
          return cumul[i];
        });
        const bottom = top.map((t, i) => t - (s.values[i] ?? 0));
        stackedPaths.push({
          key: s.key,
          d: bandPath(top, bottom, width, height, yMax),
          color: s.color,
          label: s.label,
        });
      }
      return { yMax, paths: stackedPaths, ticks: [0, yMax / 2, yMax] };
    }

    const linePaths = series.map((s) => {
      const nums = s.values.map((v) => (v != null && Number.isFinite(v) ? v : 0));
      const d = lineAreaPath(nums, width, height, yMax);
      return { key: s.key, d, color: s.color, label: s.label };
    });
    return { yMax, paths: linePaths, ticks: [0, yMax / 2, yMax] };
  }, [series, yMaxProp, stacked, height]);

  const t0 = timestamps[0];
  const t1 = timestamps[timestamps.length - 1];

  return (
    <div className="metrics-chart-panel">
      <div className="metrics-chart-head">
        <h4 className="metrics-chart-title">{title}</h4>
        {!hasData && emptyHint ? (
          <span className="metrics-chart-hint">{emptyHint}</span>
        ) : null}
      </div>
      <div className="metrics-chart-body">
        <div className="metrics-chart-y">
          {ticks.map((t) => (
            <span key={t} className="admin-mono">
              {t.toFixed(yMax >= 10 ? 0 : 1)}
              {yUnit}
            </span>
          ))}
        </div>
        <div className="metrics-chart-plot">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="metrics-chart-svg"
            role="img"
            aria-label={title}
          >
            {paths.map((p) => (
              <path key={p.key} d={p.d} fill={p.color} fillOpacity={stacked ? 0.75 : 0.35} />
            ))}
          </svg>
          <div className="metrics-chart-x">
            <span>
              {t0 ? format(new Date(t0), "HH:mm", { locale: ptBR }) : "—"}
            </span>
            <span>
              {t1 ? format(new Date(t1), "HH:mm", { locale: ptBR }) : "—"}
            </span>
          </div>
        </div>
      </div>
      <ul className="metrics-chart-legend">
        {series.map((s) => (
          <li key={s.key}>
            <span className="metrics-chart-dot" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
