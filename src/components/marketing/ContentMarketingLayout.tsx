import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ROUTES } from '../../lib/routes';
import { MarketingSubpageTopNav } from './MarketingTopNav';

type ContentMarketingLayoutProps = {
  kicker: string;
  title: string;
  summary: string;
  children: ReactNode;
  heroExtra?: ReactNode;
  backHref?: string;
  backLabel?: string;
  wide?: boolean;
};

export function ContentMarketingLayout({
  kicker,
  title,
  summary,
  children,
  heroExtra,
  backHref,
  backLabel = 'Voltar ao conteúdo',
  wide = true,
}: ContentMarketingLayoutProps) {
  return (
    <div className="landing-v3 relative min-h-screen overflow-x-hidden font-sans antialiased">
      <MarketingSubpageTopNav />

      <main
        className={cn(
          'relative z-10 mx-auto px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10',
          wide ? 'max-w-6xl' : 'max-w-3xl',
        )}
      >
        {backHref ? (
          <a
            href={backHref}
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 transition hover:text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </a>
        ) : null}

        <header className="max-w-3xl">
          <p className="landing-kicker !justify-start !text-xs !tracking-[0.35em]">{kicker}</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-[#1b1813] sm:text-4xl lg:text-[2.65rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">{summary}</p>
          {heroExtra ? <div className="mt-6">{heroExtra}</div> : null}
        </header>

        <div className="mt-10 sm:mt-12">{children}</div>
      </main>

      <footer className="relative z-10 border-t border-[#ece4d2] bg-[#161310] py-8 text-center text-xs text-neutral-400">
        <a href={ROUTES.home} className="font-semibold text-neutral-300 transition hover:text-amber-400">
          AxéCloud
        </a>
        <span className="mx-2">·</span>
        <a href={ROUTES.contentHub} className="transition hover:text-amber-400">
          Conteúdo
        </a>
        <span className="mx-2">·</span>
        <a href={ROUTES.founderProgram} className="transition hover:text-amber-400">
          Programa Fundador
        </a>
      </footer>
    </div>
  );
}
