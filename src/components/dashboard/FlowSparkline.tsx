import { useId } from 'react';
import { cn } from '../../lib/utils';

export type FlowPoint = { name: string; val: number };

type FlowSparklineProps = {
  data: FlowPoint[];
  yMax: number;
  className?: string;
};

const W = 360;
const H = 112;
const PAD = { top: 6, right: 8, bottom: 20, left: 36 };

function buildPoints(data: FlowPoint[], max: number) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const denom = Math.max(data.length - 1, 1);

  return data.map((p, i) => ({
    ...p,
    x: PAD.left + (i / denom) * innerW,
    y: PAD.top + innerH - (p.val / max) * innerH,
  }));
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function FlowSparkline({ data, yMax, className }: FlowSparklineProps) {
  const gradientId = useId().replace(/:/g, '');
  const max = Math.max(yMax, 1);
  const points = buildPoints(data, max);
  const baseline = H - PAD.bottom;
  const linePath = smoothPath(points);

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : '';

  const gridY = [0, 0.5, 1].map((t) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - t));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      className={cn('block max-w-full', className)}
      role="img"
      aria-label="Gráfico de fluxo financeiro"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBBC00" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#FBBC00" stopOpacity={0} />
        </linearGradient>
      </defs>

      {gridY.map((y) => (
        <line key={y} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#262626" strokeWidth={1} />
      ))}

      {points.map((p, i) =>
        i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 4) === 0 ? (
          <text
            key={`${p.name}-${i}`}
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            fill="#737373"
            fontSize={9}
            fontFamily="system-ui, sans-serif"
          >
            {p.name}
          </text>
        ) : null,
      )}

      {[0, max].map((v, i) => {
        const y = i === 0 ? H - PAD.bottom : PAD.top + 4;
        const label = v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v));
        return (
          <text
            key={`y-${i}`}
            x={PAD.left - 6}
            y={y}
            textAnchor="end"
            fill="#737373"
            fontSize={9}
            fontFamily="system-ui, sans-serif"
          >
            {label}
          </text>
        );
      })}

      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePath ? <path d={linePath} fill="none" stroke="#FBBC00" strokeWidth={2} /> : null}
    </svg>
  );
}
