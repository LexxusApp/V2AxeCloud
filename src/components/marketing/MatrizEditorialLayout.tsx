import type { ReactNode } from 'react';
import { MarketingMockupFooter } from './MarketingMockupFooter';
import { MatrizPageBackground } from './MatrizPageBackground';

type MatrizEditorialLayoutProps = {
  children: ReactNode;
  showFooter?: boolean;
  backgroundVariant?: 'warm' | 'stone';
};

/**
 * Identidade pública editorial do AxéCloud.
 * Mantida separada do layout legado para que páginas já aprovadas não mudem.
 */
export function MatrizEditorialLayout({
  children,
  showFooter = true,
  backgroundVariant = 'warm',
}: MatrizEditorialLayoutProps) {
  return (
    <div
      className={
        'landing-v3 relative min-h-dvh overflow-x-clip font-display text-[#181a16] ' +
        (backgroundVariant === 'stone' ? 'landing-v3--stone bg-[#f2f3ef]' : 'bg-[#fdf8f0]')
      }
    >
      <MatrizPageBackground variant={backgroundVariant} />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[34rem] bg-gradient-to-b from-[#0b100c]/[0.055] via-transparent to-transparent"
        aria-hidden
      />
      {children}
      {showFooter ? <MarketingMockupFooter /> : null}
    </div>
  );
}
