import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Cores dos ícones — mesmo padrão do design de referência (v3). */
export type LandingIconAccent = 'gold' | 'emerald' | 'rose' | 'sky' | 'violet' | 'amber';

const ICON_CLASS: Record<LandingIconAccent, string> = {
  gold: 'text-primary',
  emerald: 'text-emerald-400',
  rose: 'text-rose-400',
  sky: 'text-sky-400',
  violet: 'text-violet-400',
  amber: 'text-amber-400',
};

export function landingIconClass(accent: LandingIconAccent, className?: string) {
  return cn(ICON_CLASS[accent], className);
}

export function LandingIconBox({
  accent,
  children,
  className,
  size = 'md',
}: {
  accent: LandingIconAccent;
  children: ReactNode;
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div
      className={cn(
        'landing-v3-icon-box',
        size === 'lg' && 'landing-v3-icon-box--lg',
        className,
      )}
      data-accent={accent}
    >
      {children}
    </div>
  );
}
