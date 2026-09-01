import type { ReactNode } from 'react';
import { MarketingMockupFooter } from './MarketingMockupFooter';
import { MatrizPageBackground } from './MatrizPageBackground';

type MatrizEditorialLayoutProps = {
  children: ReactNode;
  showFooter?: boolean;
};

/**
 * Identidade pública editorial do AxéCloud.
 * Mantida separada do layout legado para que páginas já aprovadas não mudem.
 */
export function MatrizEditorialLayout({ children, showFooter = true }: MatrizEditorialLayoutProps) {
  return (
    <div className="landing-v3 relative min-h-dvh overflow-x-clip bg-[#fdf8f0] font-display text-[#181a16]">
      <MatrizPageBackground />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[34rem] bg-gradient-to-b from-[#0b100c]/[0.055] via-transparent to-transparent"
        aria-hidden
      />
      {children}
      {showFooter ? <MarketingMockupFooter /> : null}
    </div>
  );
}
