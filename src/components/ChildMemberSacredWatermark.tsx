import { cn } from '../lib/utils';

/** Marca d'água sagrada (ponto riscado / bússola) nos cards de Membros. */
export function ChildMemberSacredWatermark({ className }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const ticks = Array.from({ length: 32 }, (_, i) => i * 11.25);

  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-primary', className)}
      aria-hidden
    >
      <circle cx="100" cy="100" r="94" stroke="currentColor" strokeWidth="0.65" opacity="0.55" />
      <circle cx="100" cy="100" r="84" stroke="currentColor" strokeWidth="0.45" opacity="0.4" />
      <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="0.5" opacity="0.65" />
      <circle cx="100" cy="100" r="58" stroke="currentColor" strokeWidth="0.45" opacity="0.5" />
      <circle cx="100" cy="100" r="44" stroke="currentColor" strokeWidth="0.5" opacity="0.7" />
      <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="0.55" opacity="0.75" />
      <circle cx="100" cy="100" r="16" stroke="currentColor" strokeWidth="0.55" opacity="0.85" />
      <circle cx="100" cy="100" r="5.5" fill="currentColor" opacity="0.55" />

      {rays.map((deg) => (
        <g key={`ray-${deg}`} opacity={deg % 45 === 0 ? 0.85 : 0.42}>
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="14"
            stroke="currentColor"
            strokeWidth={deg % 45 === 0 ? 0.65 : 0.4}
            transform={`rotate(${deg} 100 100)`}
          />
          <line
            x1="100"
            y1="30"
            x2="100"
            y2="38"
            stroke="currentColor"
            strokeWidth="0.45"
            transform={`rotate(${deg} 100 100)`}
          />
        </g>
      ))}

      {ticks.map((deg) => (
        <line
          key={`tick-${deg}`}
          x1="100"
          y1="10"
          x2="100"
          y2={deg % 22.5 === 0 ? 18 : 15}
          stroke="currentColor"
          strokeWidth="0.35"
          opacity="0.35"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}

      <rect
        x="74"
        y="74"
        width="52"
        height="52"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.55"
        transform="rotate(45 100 100)"
      />
      <rect
        x="86"
        y="86"
        width="28"
        height="28"
        stroke="currentColor"
        strokeWidth="0.45"
        opacity="0.45"
        transform="rotate(45 100 100)"
      />

      {[0, 90, 180, 270].map((deg) => (
        <path
          key={`arc-${deg}`}
          d="M 100 44 A 28 28 0 0 1 119.8 63.8"
          stroke="currentColor"
          strokeWidth="0.45"
          opacity="0.5"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}

      {[45, 135, 225, 315].map((deg) => (
        <path
          key={`petal-${deg}`}
          d="M 100 58 A 18 18 0 0 1 112.7 70.7"
          stroke="currentColor"
          strokeWidth="0.4"
          opacity="0.38"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}

      <line x1="100" y1="6" x2="100" y2="194" stroke="currentColor" strokeWidth="0.35" opacity="0.25" />
      <line x1="6" y1="100" x2="194" y2="100" stroke="currentColor" strokeWidth="0.35" opacity="0.25" />
    </svg>
  );
}
