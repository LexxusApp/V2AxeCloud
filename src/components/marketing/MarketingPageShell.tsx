import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../lib/routes';

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
    <div
      className={cn(
        'relative min-h-dvh text-zinc-300',
        isFounder ? 'bg-[#050505]' : 'bg-neutral-950',
      )}
    >
      {isFounder ? (
        <div className="landing-grid-faint pointer-events-none fixed inset-0 opacity-25" aria-hidden />
      ) : null}

      <header className="relative z-10 border-b border-[#2a2108]/80 bg-[#050505]/95 backdrop-blur-xl">
        <div
          className={cn(
            'mx-auto flex items-center justify-between px-4 py-4 sm:px-6',
            isFounder ? 'max-w-6xl' : 'max-w-3xl',
          )}
        >
          <a
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 transition hover:text-primary sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </a>
          <a href={ROUTES.home} className="text-sm font-black text-white sm:text-base">
            AxéCloud
          </a>
        </div>
      </header>

      <main
        className={cn(
          'relative z-10 mx-auto px-4 sm:px-6',
          isFounder ? 'max-w-6xl py-10 sm:py-14' : 'max-w-3xl py-10',
        )}
      >
        {kicker ? (
          <p
            className={cn(
              isFounder
                ? 'landing-kicker !text-xs !tracking-[0.35em]'
                : 'text-[11px] font-black uppercase tracking-[0.35em] text-primary/90',
            )}
          >
            {kicker}
          </p>
        ) : null}
        <h1
          className={cn(
            'mt-2 font-extrabold leading-tight text-white',
            isFounder ? 'text-3xl sm:text-4xl lg:text-[2.75rem]' : 'text-2xl sm:text-3xl',
          )}
        >
          {title}
        </h1>
        {summary ? (
          <p
            className={cn(
              'mt-4 leading-relaxed text-zinc-400',
              isFounder ? 'max-w-3xl text-base sm:text-lg' : 'text-sm',
            )}
          >
            {summary}
          </p>
        ) : null}
        {heroExtra ? <div className="mt-6">{heroExtra}</div> : null}
        <div className={cn(isFounder ? 'mt-10 sm:mt-12' : 'mt-10')}>{children}</div>
      </main>
    </div>
  );
}
