import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '../../lib/routes';

type MarketingPageShellProps = {
  title: string;
  kicker?: string;
  summary?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export default function MarketingPageShell({
  title,
  kicker,
  summary,
  children,
  backHref = ROUTES.home,
  backLabel = 'Voltar ao site',
}: MarketingPageShellProps) {
  return (
    <div className="min-h-dvh bg-neutral-950 text-zinc-300">
      <header className="border-b border-white/5 bg-neutral-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </a>
          <a href={ROUTES.home} className="text-sm font-black text-white">
            AxéCloud
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {kicker ? (
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary/90">{kicker}</p>
        ) : null}
        <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">{title}</h1>
        {summary ? <p className="mt-3 text-sm leading-relaxed text-zinc-400">{summary}</p> : null}
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
