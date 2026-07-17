import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MatrizPageBackground } from './MatrizPageBackground';
import { cn } from '../../lib/utils';

export const matrizPortalCardClass =
  'rounded-[1.5rem] border border-[#e8dfd0] bg-white/80 shadow-sm shadow-black/5 backdrop-blur-sm';

export function MatrizKicker({ children }: { children: ReactNode }) {
  return (
    <span className="matriz-kicker-pulse inline-flex rounded-full bg-[#ffc107] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#1b1813]">
      {children}
    </span>
  );
}

export function MatrizSectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-xs font-black uppercase tracking-[0.2em] text-[#a87400]"
    >
      {children}
    </h2>
  );
}

type ContentMarketingLayoutProps = {
  kicker: string;
  title: string;
  summary: string;
  children?: ReactNode;
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
    <div className="landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#1b1813]">
      <MatrizPageBackground />
      <main
        className={cn(
          'relative z-[1] mx-auto w-full px-5 pb-24 pt-32 md:px-8 md:pt-36',
          wide ? 'max-w-7xl' : 'max-w-4xl',
        )}
      >
        {backHref ? (
          <a
            href={backHref}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#e8dfd0] bg-white/70 px-4 py-2 text-xs font-bold text-[#1b1813]/55 transition hover:border-[#ffc107]/40 hover:text-[#a87400]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </a>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10 lg:items-start">
          <motion.div
            className="contents"
            initial={{ opacity: 0, y: 34, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lg:col-start-1 lg:row-start-1">
              <MatrizKicker>{kicker}</MatrizKicker>
            </div>
            <h1 className="lg:col-start-1 lg:row-start-2 mt-6 max-w-none text-balance text-3xl font-black leading-[1.05] tracking-tight text-[#1b1813] sm:text-4xl md:text-5xl lg:text-6xl">
              {title}
            </h1>
            {summary ? (
              <p className="lg:col-start-1 lg:row-start-3 mt-4 w-full max-w-none text-base leading-relaxed text-[#1b1813]/66 md:text-lg">
                {summary}
              </p>
            ) : null}
            {heroExtra ? (
              <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-end w-full max-w-none lg:w-auto lg:max-w-md">
                {heroExtra}
              </div>
            ) : null}
          </motion.div>
        </section>

        <div className="mt-12 space-y-12 sm:mt-14">{children}</div>
      </main>
    </div>
  );
}
