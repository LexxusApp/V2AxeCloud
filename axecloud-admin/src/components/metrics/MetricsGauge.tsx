import { cn } from "@/lib/cn";

type MetricsGaugeProps = {
  label: string;
  value: number;
  display: string;
  status: "ok" | "warn" | "critical";
  size?: number;
};

function arcColor(status: MetricsGaugeProps["status"]) {
  if (status === "critical") return "var(--ac-danger)";
  if (status === "warn") return "var(--ac-warn)";
  return "var(--ac-success)";
}

export function MetricsGauge({ label, value, display, status, size = 88 }: MetricsGaugeProps) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = c - (pct / 100) * c;

  return (
    <div className="metrics-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ac-paper-border)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arcColor(status)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="metrics-gauge-arc"
        />
      </svg>
      <div className="metrics-gauge-center">
        <span
          className={cn(
            "metrics-gauge-value admin-mono",
            status === "critical" && "text-[var(--ac-danger)]",
            status === "warn" && "text-[var(--ac-warn)]",
            status === "ok" && "text-[var(--ac-success)]"
          )}
        >
          {display}
        </span>
      </div>
      <p className="metrics-gauge-label">{label}</p>
    </div>
  );
}
