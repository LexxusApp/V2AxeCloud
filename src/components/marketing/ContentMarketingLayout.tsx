import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MatrizPageBackground } from './MatrizPageBackground';
import { cn } from '../../lib/utils';

export const matrizPortalCardClass =
  'rounded-[1.5rem] border border-[#e8dfd0] bg-white/80 shadow-sm shadow-black/5 backdrop-blur-sm';

export const cinematicPortalCardClass =
  'rounded-2xl border border-white/[0.1] bg-[#11150f]/90 shadow-[0_24px_70px_rgba(0,0,0,.22)]';

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
  theme?: 'light' | 'cinematic';
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
  theme = 'light',
}: ContentMarketingLayoutProps) {
  const cinematic = theme === 'cinematic';
  return (
    <div className={cn(
      'relative min-h-dvh overflow-x-clip font-sans',
      cinematic
        ? 'cinematic-content bg-[#0b0f0a] text-[#f4efe3]'
        : 'landing-v3 landing-mockup-theme bg-[#fdf8f0] text-[#1b1813]',
    )}>
      {cinematic ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(229,174,18,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(229,174,18,.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,#000,transparent_82%)]" />
          <div className="absolute -right-40 top-32 h-[34rem] w-[34rem] rounded-full border border-[#e5ae12]/15 shadow-[0_0_0_80px_rgba(229,174,18,.025),0_0_0_160px_rgba(229,174,18,.018)]" />
          <div className="absolute left-0 top-0 h-[42rem] w-[42rem] bg-[radial-gradient(circle,rgba(31,83,61,.22),transparent_64%)]" />
        </div>
      ) : <MatrizPageBackground />}
      <main
        className={cn(
          'relative z-[1] mx-auto w-full px-5 pb-24 pt-32 md:px-8 md:pt-36',
          wide ? 'max-w-7xl' : 'max-w-4xl',
        )}
      >
        {backHref ? (
          <a
            href={backHref}
            className={cn(
              'mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition',
              cinematic
                ? 'border-white/10 bg-white/[.04] text-[#a9ada3] hover:border-[#e5ae12]/50 hover:text-[#f4efe3]'
                : 'border-[#e8dfd0] bg-white/70 text-[#1b1813]/55 hover:border-[#ffc107]/40 hover:text-[#a87400]',
            )}
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
              {cinematic ? (
                <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.24em] text-[#e5ae12]">
                  <i className="h-2 w-2 rounded-full bg-[#56d9a3] shadow-[0_0_16px_#56d9a3]" /> {kicker}
                </span>
              ) : <MatrizKicker>{kicker}</MatrizKicker>}
            </div>
            <h1 className={cn(
              'lg:col-start-1 lg:row-start-2 mt-6 max-w-none text-balance text-3xl font-black leading-[1.01] tracking-[-.045em] sm:text-4xl md:text-5xl lg:text-6xl',
              cinematic ? 'max-w-4xl text-[#f4efe3]' : 'text-[#1b1813]',
            )}>
              {title}
            </h1>
            {summary ? (
              <p className={cn(
                'lg:col-start-1 lg:row-start-3 mt-5 w-full max-w-3xl text-base leading-relaxed md:text-lg',
                cinematic ? 'text-[#a9ada3]' : 'text-[#1b1813]/66',
              )}>
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

        <div className={cn('mt-12 space-y-12 sm:mt-14', cinematic && 'border-t border-white/[.08] pt-10')}>{children}</div>
      </main>
    </div>
  );
}
