import { ArrowRight, Crown } from 'lucide-react';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type FounderHeroCalloutProps = {
  variant?: 'sidebar' | 'banner';
  className?: string;
};

function FounderSoftCallout({
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
    <div className={cn('founder-soft-wrap', isBanner && 'founder-soft-wrap--banner', className)}>
      <a
        href={ROUTES.founderProgram}
        className={cn('founder-soft-cta group', isBanner && 'founder-soft-cta--banner')}
        aria-label="Programa Fundador — 12 meses grátis para terreiros"
      >
        <span className={cn('founder-soft-cta__body', isBanner && 'founder-soft-cta__body--banner')}>
          <span className="founder-soft-cta__icon">
            <Crown className="h-5 w-5" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="founder-soft-cta__label">
              Programa Fundador
            </span>
            <span className="founder-soft-cta__headline">
              {FOUNDER_PROGRAM.freeMonths} meses grátis
            </span>
            <span className="founder-soft-cta__slots">{slotsLabel}</span>
            <span className="founder-soft-cta__action">
              Ver Programa
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </span>
        </span>
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

  return <FounderSoftCallout variant={variant} className={className} slotsLabel={slotsLabel} />;
}
