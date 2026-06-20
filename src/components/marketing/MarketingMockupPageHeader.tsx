import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type MarketingMockupPageHeaderProps = {
  kicker: string;
  title: ReactNode;
  summary?: string;
  className?: string;
  heroExtra?: ReactNode;
};

export function MarketingMockupPageHeader({
  kicker,
  title,
  summary,
  className,
  heroExtra,
}: MarketingMockupPageHeaderProps) {
  return (
    <header className={cn('max-w-3xl', className)}>
      <p className="landing-mockup-kicker inline-flex">{kicker}</p>
      <h1 className="mt-5 font-display text-3xl font-black leading-tight tracking-tight text-[#1b1813] sm:text-4xl lg:text-[2.65rem]">
        {title}
      </h1>
      {summary ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#1b1813]/65 sm:text-lg">{summary}</p>
      ) : null}
      {heroExtra ? <div className="mt-6">{heroExtra}</div> : null}
    </header>
  );
}
