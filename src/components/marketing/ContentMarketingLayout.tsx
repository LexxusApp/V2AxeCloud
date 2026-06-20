import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { landingMockupShellClass } from '../landing/landingMockupUi';
import { MarketingMockupLayout } from './MarketingMockupLayout';
import { MarketingMockupPageHeader } from './MarketingMockupPageHeader';

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
    <MarketingMockupLayout>
      <main
        className={cn(
          'relative z-[1] mx-auto pb-16 pt-8 sm:pb-20 sm:pt-10',
          landingMockupShellClass,
          wide ? 'max-w-6xl' : 'max-w-3xl',
        )}
      >
        {backHref ? (
          <a
            href={backHref}
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1b1813]/50 transition hover:text-[#FFC107]"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </a>
        ) : null}

        <MarketingMockupPageHeader kicker={kicker} title={title} summary={summary} heroExtra={heroExtra} />

        <div className="mt-10 sm:mt-12">{children}</div>
      </main>
    </MarketingMockupLayout>
  );
}
