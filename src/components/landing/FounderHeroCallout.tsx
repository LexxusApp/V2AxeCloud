import { ArrowRight, Crown, Flame, Sparkles } from 'lucide-react';
import { FOUNDER_PROGRAM } from '../../constants/founderProgram';
import { useFounderProgramStats } from '../../hooks/useFounderProgramStats';
import { ROUTES } from '../../lib/routes';
import { cn } from '../../lib/utils';

type FounderHeroCalloutProps = {
  variant?: 'sidebar' | 'banner';
  className?: string;
};

function FounderVipCallout({
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
    <div className={cn('founder-vip-wrap', isBanner && 'founder-vip-wrap--banner', className)}>
      <a
        href={ROUTES.founderProgram}
        className={cn('founder-vip-cta group', isBanner && 'founder-vip-cta--banner')}
        aria-label="Programa Fundador — 12 meses grátis para terreiros"
      >
        <span className="founder-vip-cta__halo" aria-hidden />
        <span className="founder-vip-cta__halo founder-vip-cta__halo--delay" aria-hidden />
        <span className="founder-vip-cta__shine" aria-hidden />
        <span className="founder-vip-cta__corner founder-vip-cta__blink" aria-hidden>
          <Flame className="h-3 w-3" />
          Últimas vagas
        </span>

        <span className={cn('founder-vip-cta__body', isBanner && 'founder-vip-cta__body--banner')}>
          <span className="founder-vip-cta__seal founder-vip-cta__pulse-icon">
            <Crown className="h-7 w-7" aria-hidden />
            <Sparkles className="founder-vip-cta__spark h-4 w-4" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="founder-vip-cta__live founder-vip-cta__blink">
              <span className="founder-vip-cta__live-dot" aria-hidden />
              Programa Fundador
            </span>
            <span className="founder-vip-cta__headline">
              {FOUNDER_PROGRAM.freeMonths} meses grátis
            </span>
            <span className="founder-vip-cta__slots founder-vip-cta__pulse-text">{slotsLabel}</span>
            <span className="founder-vip-cta__action">
              Quero minha vaga
              <ArrowRight className="founder-vip-cta__arrow h-4 w-4" aria-hidden />
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

  return <FounderVipCallout variant={variant} className={className} slotsLabel={slotsLabel} />;
}
