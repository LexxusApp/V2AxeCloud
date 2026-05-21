import { cn } from '../lib/utils';

/** Marca Axé Cloud em CSS — mesma identidade da landing (`Landing.tsx`). */
export function AxeCloudLogoMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 bg-transparent',
        compact ? 'min-w-[176px]' : 'min-w-[214px]',
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          'relative grid shrink-0 place-items-center rounded-full border border-[#c78b00] text-[#d9a11a] shadow-[0_0_18px_rgba(242,185,15,0.16)]',
          compact ? 'h-10 w-10' : 'h-12 w-12'
        )}
      >
        <span className="absolute inset-[6px] rounded-full border border-[#6c4a00]" />
        <span className="absolute h-px w-[82%] bg-[#9d6f05]" />
        <span className="absolute h-[82%] w-px bg-[#9d6f05]" />
        <span className="relative h-2 w-2 rounded-full bg-[#f2b90f] shadow-[0_0_12px_rgba(242,185,15,0.8)]" />
      </div>
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-[3px]">
          <span
            className={cn(
              'font-black uppercase tracking-[0.22em] text-white',
              compact ? 'text-[18px]' : 'text-2xl'
            )}
          >
            AX
          </span>
          <span className={cn('font-black text-[#f2b90f]', compact ? 'text-[18px]' : 'text-2xl')}>É</span>
          <span
            className={cn(
              'font-black uppercase tracking-[0.22em] text-white',
              compact ? 'text-[18px]' : 'text-2xl'
            )}
          >
            CLOUD
          </span>
        </div>
        <p
          className={cn(
            'mt-1 text-center font-black uppercase tracking-[0.28em] text-[#d99c0a]',
            compact ? 'text-[7px]' : 'text-[9px]'
          )}
        >
          Gestão Sagrada
        </p>
      </div>
    </div>
  );
}
