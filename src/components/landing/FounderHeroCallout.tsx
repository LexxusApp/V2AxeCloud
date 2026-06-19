import { ArrowRight, Crown, Sparkles, Zap } from 'lucide-react';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type FounderHeroCalloutProps = {
  variant?: 'sidebar' | 'banner';
  className?: string;
};

function FounderStickerShell({
  variant,
  className,
  slotsLabel,
}: {
  variant: 'sidebar' | 'banner';
  className?: string;
  slotsLabel: string;
}) {
  const isBanner = variant === 'banner';

  return (
    <div className={cn('founder-sticker-wrap', isBanner && 'founder-sticker-wrap--banner', className)}>
      <a
        href={ROUTES.founderProgram}
        className={cn('founder-sticker-cta group', isBanner && 'founder-sticker-cta--banner')}
        aria-label="Programa Fundador — 12 meses grátis para terreiros"
      >
        <span className="founder-sticker-cta__burst" aria-hidden />
        <span className="founder-sticker-cta__ring" aria-hidden />
        <span className="founder-sticker-cta__ring founder-sticker-cta__ring--b" aria-hidden />
        <span className="founder-sticker-cta__shine" aria-hidden />

        <span className="founder-sticker-cta__ribbon founder-sticker-cta__blink-fast" aria-hidden>
          <Zap className="h-3 w-3" />
          Limitado
        </span>

        {isBanner ? (
          <span className="founder-sticker-cta__body founder-sticker-cta__body--banner">
            <span className="founder-sticker-cta__crown founder-sticker-cta__pulse-icon shrink-0">
              <Crown className="h-6 w-6" aria-hidden />
              <Sparkles className="founder-sticker-cta__spark h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="founder-sticker-cta__live founder-sticker-cta__blink-fast inline-flex">
                <span className="founder-sticker-cta__live-dot" aria-hidden />
                Ao vivo
              </span>
              <span className="founder-sticker-cta__label mt-1 block">Programa Fundador</span>
              <span className="founder-sticker-cta__headline mt-0.5 block text-base">
                <span className="founder-sticker-cta__blink-text">{FOUNDER_PROGRAM.freeMonths} meses grátis</span>
              </span>
              <span className="founder-sticker-cta__slots founder-sticker-cta__pulse-text mt-0.5 block">
                {slotsLabel}
              </span>
            </span>
            <ArrowRight className="founder-sticker-cta__arrow h-6 w-6 shrink-0" aria-hidden />
          </span>
        ) : (
          <span className="founder-sticker-cta__body">
            <span className="flex items-start justify-between gap-2">
              <span className="founder-sticker-cta__live founder-sticker-cta__blink-fast">
                <span className="founder-sticker-cta__live-dot" aria-hidden />
                Ao vivo
              </span>
              <Sparkles className="founder-sticker-cta__spark h-5 w-5" aria-hidden />
            </span>

            <span className="founder-sticker-cta__crown founder-sticker-cta__pulse-icon mt-3">
              <Crown className="h-7 w-7" aria-hidden />
            </span>

            <span className="founder-sticker-cta__label mt-3 block">Programa Fundador</span>
            <span className="founder-sticker-cta__headline mt-1 block">
              <span className="founder-sticker-cta__blink-text">{FOUNDER_PROGRAM.freeMonths} meses</span>
              <br />
              <span className="founder-sticker-cta__pulse-text">grátis</span>
            </span>
            <span className="founder-sticker-cta__slots founder-sticker-cta__pulse-text mt-2 block">{slotsLabel}</span>
            <span className="founder-sticker-cta__cta mt-3 inline-flex items-center gap-1">
              Ver vagas
              <ArrowRight className="founder-sticker-cta__arrow h-4 w-4" aria-hidden />
            </span>
          </span>
        )}
      </a>
    </div>
  );
}

export function FounderHeroCallout({ variant = 'sidebar', className }: FounderHeroCalloutProps) {
  const { stats, loading } = useFounderProgramStats();
  const slotsLabel =
    !loading && stats.acceptingApplications
      ? `${stats.remainingSlots} vagas abertas`
      : !loading && stats.acceptedHouses > 0
        ? 'Últimas vagas'
        : `${FOUNDER_PROGRAM.maxSlots} vagas`;

  return <FounderStickerShell variant={variant} className={className} slotsLabel={slotsLabel} />;
}
