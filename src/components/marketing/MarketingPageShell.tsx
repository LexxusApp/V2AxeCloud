import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../lib/routes';
import { landingMockupShellClass } from '../landing/landingMockupUi';
import { MarketingMockupLayout } from './MarketingMockupLayout';
import { MarketingMockupPageHeader } from './MarketingMockupPageHeader';

type MarketingPageShellProps = {
  title: string;
  kicker?: string;
  summary?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Layout mais rico (Programa Fundador, etc.) */
  variant?: 'default' | 'founder';
  heroExtra?: ReactNode;
};

export default function MarketingPageShell({
  title,
  kicker,
  summary,
  children,
  backHref = ROUTES.home,
  backLabel = 'Voltar ao site',
  variant = 'default',
  heroExtra,
}: MarketingPageShellProps) {
  const isFounder = variant === 'founder';

  return (
    <MarketingMockupLayout>
      <main
        className={cn(
          'relative z-[1] mx-auto pb-16 pt-8 sm:pb-20 sm:pt-10',
          landingMockupShellClass,
          isFounder ? 'max-w-6xl' : 'max-w-3xl',
        )}
      >
        <a
          href={backHref}
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1b1813]/50 transition hover:text-[#FFC107]"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </a>

        {kicker ? (
          <MarketingMockupPageHeader kicker={kicker} title={title} summary={summary} heroExtra={heroExtra} />
        ) : (
          <>
            <h1
              className={cn(
                'font-display font-black leading-tight text-[#1b1813]',
                isFounder ? 'text-3xl sm:text-4xl lg:text-[2.75rem]' : 'text-2xl sm:text-3xl',
              )}
            >
              {title}
            </h1>
            {summary ? (
              <p className={cn('mt-4 leading-relaxed text-[#1b1813]/65', isFounder ? 'max-w-3xl text-base sm:text-lg' : 'text-sm')}>
                {summary}
              </p>
            ) : null}
            {heroExtra ? <div className="mt-6">{heroExtra}</div> : null}
          </>
        )}

        <div className={cn(isFounder ? 'mt-10 sm:mt-12' : 'mt-10')}>{children}</div>
      </main>
    </MarketingMockupLayout>
  );
}
