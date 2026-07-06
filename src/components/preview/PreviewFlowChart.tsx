const CHART_DATA = [
  { dia: '01', entradas: 420, saidas: 180 },
  { dia: '05', entradas: 680, saidas: 220 },
  { dia: '08', entradas: 510, saidas: 390 },
  { dia: '12', entradas: 890, saidas: 240 },
  { dia: '15', entradas: 720, saidas: 310 },
  { dia: '18', entradas: 950, saidas: 420 },
  { dia: '22', entradas: 640, saidas: 280 },
  { dia: '26', entradas: 1100, saidas: 350 },
  { dia: '30', entradas: 780, saidas: 190 },
];

function buildAreaPath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return '';
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `${points.join(' ')} L${width},${height} L0,${height} Z`;
}

function buildLinePath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return '';
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function PreviewFlowChart() {
  const width = 560;
  const height = 200;
  const max = Math.max(...CHART_DATA.flatMap((d) => [d.entradas, d.saidas])) * 1.1;
  const entradas = CHART_DATA.map((d) => d.entradas);
  const saidas = CHART_DATA.map((d) => d.saidas);

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height + 28}`}
        className="h-52 w-full sm:h-60"
        role="img"
        aria-label="Gráfico de entradas e saídas do mês"
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={0}
            y1={height * ratio}
            x2={width}
            y2={height * ratio}
            stroke="#dccfb8"
            strokeDasharray="4 4"
          />
        ))}
        <path d={buildAreaPath(entradas, width, height, max)} fill="rgba(255,193,7,0.22)" />
        <path
          d={buildLinePath(entradas, width, height, max)}
          fill="none"
          stroke="#FFC107"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={buildLinePath(saidas, width, height, max)}
          fill="none"
          stroke="#1b1813"
          strokeOpacity={0.22}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {CHART_DATA.filter((_, i) => i % 2 === 0).map((d, i, arr) => {
          const idx = i * 2;
          const x = (idx / Math.max(CHART_DATA.length - 1, 1)) * width;
          return (
            <text
              key={d.dia}
              x={x}
              y={height + 20}
              fill="#1b1813"
              fillOpacity={0.45}
              fontSize={10}
              fontWeight={600}
              textAnchor={i === arr.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
            >
              {d.dia} JUN
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-bold text-[#1b1813]/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#FFC107]" aria-hidden />
          Entradas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#1b1813]/25" aria-hidden />
          Saídas
        </span>
      </div>
    </div>
  );
}
