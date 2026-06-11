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
    <div className={cn(center && 'w-full text-center', !center && 'w-full', className)}>
      <p className={cn('landing-kicker', center && 'justify-center')}>
        {icon}
        {kicker}
      </p>
      <h2 id={titleId} className="landing-title">
        {title}
      </h2>
      {lead ? <p className={cn('landing-lead', center && 'mx-auto max-w-3xl')}>{lead}</p> : null}
    </div>
  );
}
