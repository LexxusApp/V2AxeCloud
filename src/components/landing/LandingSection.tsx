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
      <div className="landing-section-grid pointer-events-none" aria-hidden />
      {children}
    </section>
  );
}

type LandingSectionHeaderProps = {
  kicker: string;
  title: string;
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
    <div className={cn(center && 'mx-auto max-w-2xl text-center', className)}>
      <p className="landing-kicker">
        {icon}
        {kicker}
      </p>
      <h2 id={titleId} className="landing-title">
        {title}
      </h2>
      {lead ? <p className="landing-lead">{lead}</p> : null}
    </div>
  );
}
