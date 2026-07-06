import { Award } from 'lucide-react';
import { cn } from '../../lib/utils';

type FounderHouseBadgeProps = {
  className?: string;
  /** compact = header; full = inline; panel = coluna lateral no perfil */
  variant?: 'compact' | 'full' | 'panel';
};

/** Selo exibido ao zelador quando o terreiro está aceito no Programa Fundador. */
export function FounderHouseBadge({ className, variant = 'full' }: FounderHouseBadgeProps) {
  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-[#FBBC00]/30 bg-[#FBBC00]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#FBBC00]',
          className
        )}
        title="Casa Fundadora AxéCloud — Programa Fundador"
      >
        <Award className="h-3 w-3" aria-hidden />
        FUNDADOR
      </span>
    );
  }

  if (variant === 'panel') {
    return (
      <div
        className={cn(
          'flex h-full min-h-[7.5rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#FBBC00]/30 bg-gradient-to-br from-[#FBBC00]/15 via-[#FBBC00]/5 to-transparent px-5 py-6 text-center',
          className
        )}
        role="status"
        aria-label="Casa Fundadora do Programa Fundador AxéCloud"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FBBC00]/35 bg-[#FBBC00]/20 text-[#FBBC00]">
          <Award className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FBBC00]">
            Programa Fundador
          </p>
          <p className="text-base font-black text-white">Casa Fundadora</p>
          <p className="text-xs leading-relaxed text-zinc-400">
            Selo no perfil da casa · prioridade no portal público
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 rounded-2xl border border-[#FBBC00]/25 bg-gradient-to-r from-[#FBBC00]/10 to-transparent px-4 py-3',
        className
      )}
      role="status"
      aria-label="Casa Fundadora do Programa Fundador AxéCloud"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FBBC00]/30 bg-[#FBBC00]/15 text-[#FBBC00]">
        <Award className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FBBC00]/80">
          Programa Fundador
        </p>
        <p className="text-sm font-bold text-white">Casa Fundadora AxéCloud</p>
        <p className="text-xs text-zinc-500">Selo no perfil da casa · prioridade no portal público</p>
      </div>
    </div>
  );
}
