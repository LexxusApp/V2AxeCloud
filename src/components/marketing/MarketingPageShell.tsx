import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../lib/routes';
import { MarketingSubpageTopNav } from './MarketingTopNav';

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
    <div className="landing-v3 relative min-h-dvh overflow-x-hidden font-sans antialiased">
      <MarketingSubpageTopNav />

      <main
        className={cn(
          'relative z-10 mx-auto px-4 sm:px-6',
          isFounder ? 'max-w-6xl py-10 sm:py-14' : 'max-w-3xl py-10',
        )}
      >
        <a
          href={backHref}
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 transition hover:text-amber-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </a>

        {kicker ? (
          <p
            className={cn(
              isFounder
                ? 'landing-kicker !text-xs !tracking-[0.35em]'
                : 'text-[11px] font-black uppercase tracking-[0.35em] text-amber-700',
            )}
          >
            {kicker}
          </p>
        ) : null}
        <h1
          className={cn(
            'mt-2 font-display font-extrabold leading-tight text-[#1b1813]',
            isFounder ? 'text-3xl sm:text-4xl lg:text-[2.75rem]' : 'text-2xl sm:text-3xl',
          )}
        >
          {title}
        </h1>
        {summary ? (
          <p
            className={cn(
              'mt-4 leading-relaxed text-neutral-600',
              isFounder ? 'max-w-3xl text-base sm:text-lg' : 'text-sm',
            )}
          >
            {summary}
          </p>
        ) : null}
        {heroExtra ? <div className="mt-6">{heroExtra}</div> : null}
        <div className={cn(isFounder ? 'mt-10 sm:mt-12' : 'mt-10')}>{children}</div>
      </main>

      <footer className="relative z-10 border-t border-[#ece4d2] bg-[#161310] py-8 text-center text-xs text-neutral-400">
        <a href={ROUTES.home} className="font-semibold text-neutral-300 transition hover:text-amber-400">
          AxéCloud
        </a>
      </footer>
    </div>
  );
}
