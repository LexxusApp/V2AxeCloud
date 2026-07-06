import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { LandingMockupSideRails } from '../landing/LandingMockupSideRails';
import { MarketingMockupFooter } from './MarketingMockupFooter';

type MarketingMockupLayoutProps = {
  children: ReactNode;
  className?: string;
  showFooter?: boolean;
  showSideRails?: boolean;
};

export function MarketingMockupLayout({
  children,
  className,
  showFooter = true,
  showSideRails = true,
}: MarketingMockupLayoutProps) {
  return (
    <>
      {showSideRails ? <LandingMockupSideRails /> : null}
      <div
        className={cn(
          'landing-v3 landing-mockup-theme relative min-h-dvh overflow-x-hidden bg-[#fdf8f0] font-sans text-[#1b1813] antialiased',
          className,
        )}
      >
        {children}
        {showFooter ? <MarketingMockupFooter /> : null}
      </div>
    </>
  );
}
