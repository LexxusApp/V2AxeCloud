import { cn } from '../lib/utils';
import { BRAND_TAGLINE } from '../constants/seoBrandKeywords';

export type AxeCloudLogoMarkSize = 'compact' | 'default' | 'large';

const sizeStyles: Record<
  AxeCloudLogoMarkSize,
  {
    root: string;
    emblem: string;
    emblemGlow: string;
    ring: string;
    dot: string;
    word: string;
    tagline: string;
  }
> = {
  compact: {
    root: 'gap-3 min-w-0 max-w-full',
    emblem: 'h-10 w-10 border',
    emblemGlow: 'shadow-[0_0_18px_rgba(242,185,15,0.16)]',
    ring: 'inset-[6px]',
    dot: 'h-2 w-2 shadow-[0_0_12px_rgba(242,185,15,0.8)]',
    word: 'text-[18px]',
    tagline: 'mt-1 text-[7px] tracking-[0.28em]',
  },
  default: {
    root: 'gap-3 min-w-0 max-w-full sm:min-w-[214px]',
    emblem: 'h-12 w-12 border',
    emblemGlow: 'shadow-[0_0_18px_rgba(242,185,15,0.16)]',
    ring: 'inset-[6px]',
    dot: 'h-2 w-2 shadow-[0_0_12px_rgba(242,185,15,0.8)]',
    word: 'text-2xl',
    tagline: 'mt-1 text-[9px] tracking-[0.28em]',
  },
  large: {
    root: 'gap-4 min-w-0 max-w-full sm:min-w-[260px]',
    emblem: 'h-16 w-16 border-2',
    emblemGlow: 'shadow-[0_0_32px_rgba(242,185,15,0.35)]',
    ring: 'inset-[9px] border-2',
    dot: 'h-3 w-3 shadow-[0_0_18px_rgba(242,185,15,0.95)]',
    word: 'text-[1.75rem] sm:text-[1.9rem]',
    tagline: 'mt-1.5 text-[10px] tracking-[0.34em]',
  },
};

/** Marca Ilê Asé em CSS — mesma identidade da landing (`Landing.tsx`). */
export function AxeCloudLogoMark({
  className,
  size = 'default',
  /** @deprecated use `size="compact"` */
  compact = false,
}: {
  className?: string;
  size?: AxeCloudLogoMarkSize;
  compact?: boolean;
}) {
  const resolvedSize: AxeCloudLogoMarkSize = compact && size === 'default' ? 'compact' : size;
  const s = sizeStyles[resolvedSize];

  return (
    <div
      className={cn('flex items-center bg-transparent', s.root, className)}
      aria-hidden
    >
      <div
        className={cn(
          'relative grid shrink-0 place-items-center rounded-full border-[#c78b00] text-[#d9a11a]',
          s.emblem,
          s.emblemGlow
        )}
      >
        <span className={cn('absolute rounded-full border-[#6c4a00]', s.ring)} />
        <span className="absolute h-px w-[82%] bg-[#9d6f05]" />
        <span className="absolute h-[82%] w-px bg-[#9d6f05]" />
        <span className={cn('relative rounded-full bg-[#f2b90f]', s.dot)} />
      </div>
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-[3px]">
          <span className={cn('font-black uppercase tracking-[0.22em] text-white', s.word)}>ILÊ</span>
          <span className={cn('font-black uppercase tracking-[0.22em] text-[#f2b90f]', s.word)}>ASÉ</span>
        </div>
        <p className={cn('text-center font-black uppercase text-[#d99c0a]', s.tagline)}>{BRAND_TAGLINE}</p>
      </div>
    </div>
  );
}

/** Emblema circular da marca (bússola) — sidebar, rodapé, etc. */
export function AxeCloudEmblem({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#c78b00] text-[#d9a11a] shadow-[0_0_14px_rgba(242,185,15,0.28)]',
        className
      )}
      aria-hidden
    >
      <span className="absolute inset-[5px] rounded-full border border-[#6c4a00]/90" />
      <span className="absolute h-px w-[70%] bg-[#9d6f05]" />
      <span className="absolute h-[70%] w-px bg-[#9d6f05]" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-[#f2b90f] shadow-[0_0_6px_rgba(242,185,15,0.85)]" />
    </div>
  );
}
