import { ArrowRight, Crown, Sparkles } from 'lucide-react';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type FounderHeroCalloutProps = {
  variant?: 'sidebar' | 'banner';
  className?: string;
};

export function FounderHeroCallout({ variant = 'sidebar', className }: FounderHeroCalloutProps) {
  const { stats, loading } = useFounderProgramStats();
  const slotsLabel =
    !loading && stats.acceptingApplications
      ? `${stats.remainingSlots} vagas`
      : !loading && stats.acceptedHouses > 0
        ? 'Vagas limitadas'
        : `${FOUNDER_PROGRAM.maxSlots} vagas`;

  if (variant === 'banner') {
    return (
      <a
        href={ROUTES.founderProgram}
        className={cn(
          'founder-hero-cta group relative flex w-full max-w-lg items-center gap-4 overflow-hidden rounded-2xl border border-[#FBBC00]/50 bg-gradient-to-r from-[#1A1408] via-[#13171D] to-[#0B0D11] px-4 py-3.5 text-left transition hover:border-[#FBBC00]/80 sm:px-5',
          className,
        )}
        aria-label="Programa Fundador — 12 meses grátis para terreiros"
      >
        <span className="founder-hero-cta__ring pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#FBBC00]/40" aria-hidden />
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FBBC00]/35 bg-[#FBBC00]/15">
          <Crown className="h-5 w-5 text-[#FBBC00]" aria-hidden />
          <Sparkles className="founder-hero-cta__dot absolute -right-0.5 -top-0.5 h-3.5 w-3.5 text-amber-300" aria-hidden />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FBBC00]">
              Programa Fundador
            </span>
            <span className="founder-hero-cta__dot inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Ao vivo
            </span>
          </span>
          <span className="mt-0.5 block text-sm font-bold text-[#F1F5F9]">
            {FOUNDER_PROGRAM.freeMonths} meses grátis · {slotsLabel}
          </span>
        </span>
        <ArrowRight
          className="relative h-5 w-5 shrink-0 text-[#FBBC00] transition group-hover:translate-x-0.5"
          aria-hidden
        />
      </a>
    );
  }

  return (
    <a
      href={ROUTES.founderProgram}
      className={cn(
        'founder-hero-cta group relative block w-full max-w-[220px] overflow-hidden rounded-2xl border border-[#FBBC00]/50 bg-gradient-to-b from-[#1A1408] via-[#13171D] to-[#0B0D11] p-4 text-left transition hover:border-[#FBBC00]/80 hover:shadow-[0_0_40px_rgba(251,188,0,0.2)]',
        className,
      )}
      aria-label="Programa Fundador — 12 meses grátis para terreiros"
    >
      <span className="founder-hero-cta__ring pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#FBBC00]/40" aria-hidden />
      <span className="founder-hero-cta__ring founder-hero-cta__ring--delay pointer-events-none absolute inset-0 rounded-2xl border border-[#FBBC00]/25" aria-hidden />

      <span className="relative flex items-center justify-between gap-2">
        <span className="founder-hero-cta__dot inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          Ao vivo
        </span>
        <Sparkles className="founder-hero-cta__dot h-4 w-4 text-amber-300/90" aria-hidden />
      </span>

      <span className="relative mt-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[#FBBC00]/35 bg-[#FBBC00]/15">
        <Crown className="h-6 w-6 text-[#FBBC00]" aria-hidden />
      </span>

      <span className="relative mt-3 block text-[10px] font-black uppercase tracking-[0.22em] text-[#FBBC00]">
        Programa Fundador
      </span>
      <span className="relative mt-1 block font-display text-lg font-black leading-tight text-[#F1F5F9]">
        {FOUNDER_PROGRAM.freeMonths} meses grátis
      </span>
      <span className="relative mt-1 block text-xs font-semibold text-[#94A3B8]">{slotsLabel}</span>
      <span className="relative mt-3 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#FBBC00]">
        Ver vagas
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </a>
  );
}
