import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type LandingSectionProps = {
  id?: string;
  className?: string;
  variant?: 'default' | 'highlight' | 'alt';
  children: ReactNode;
  'aria-labelledby'?: string;
};

export function LandingSection({
  id,
  className,
  variant = 'default',
  children,
  'aria-labelledby': labelledBy,
}: LandingSectionProps) {
  return (
    <section
      id={id}
      className={cn('landing-section', `landing-section--${variant}`, className)}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  );
}

type LandingSectionHeaderProps = {
  kicker: string;
  title: ReactNode;
  titleId?: string;
  lead?: string;
  center?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function LandingSectionHeader({
  kicker,
  title,
  titleId,
  lead,
  center = true,
  icon,
  className,
}: LandingSectionHeaderProps) {
  return (
    <div className={cn(center && 'flex w-full flex-col items-center text-center', !center && 'w-full', className)}>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-800">
        {icon}
        {kicker}
      </span>
      <h2 id={titleId} className="landing-title mt-4">
        {title}
      </h2>
      <span
        className={cn('mt-4 block h-1 w-12 rounded-full bg-amber-400/80', center ? 'mx-auto' : '')}
        aria-hidden
      />
      {lead ? <p className={cn('landing-lead mt-4', center && 'mx-auto max-w-2xl')}>{lead}</p> : null}
    </div>
  );
}
