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
    <div className="landing-v3 relative min-h-screen overflow-x-hidden bg-[#080A0D] font-sans text-[#F1F5F9] antialiased selection:bg-[#1E293B] selection:text-white">
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-[#10141A] via-[#0A0C10] to-[#080A0D]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-24 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-48 -z-10 h-64 w-64 rounded-full bg-violet-500/5 blur-3xl"
        aria-hidden
      />

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
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#94A3B8] transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </a>
        ) : null}

        <header className="max-w-3xl">
          <p className="landing-kicker !justify-start !text-xs !tracking-[0.35em]">{kicker}</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-[#F1F5F9] sm:text-4xl lg:text-[2.65rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#94A3B8] sm:text-lg">{summary}</p>
          {heroExtra ? <div className="mt-6">{heroExtra}</div> : null}
        </header>

        <div className="mt-10 sm:mt-12">{children}</div>
      </main>

      <footer className="relative z-10 border-t border-[#1E242B] py-8 text-center text-xs text-[#64748B]">
        <a href={ROUTES.home} className="font-semibold text-[#94A3B8] transition hover:text-primary">
          AxéCloud
        </a>
        <span className="mx-2">·</span>
        <a href={ROUTES.contentHub} className="transition hover:text-[#94A3B8]">
          Conteúdo
        </a>
        <span className="mx-2">·</span>
        <a href={ROUTES.founderProgram} className="transition hover:text-[#94A3B8]">
          Programa Fundador
        </a>
      </footer>
    </div>
  );
}
