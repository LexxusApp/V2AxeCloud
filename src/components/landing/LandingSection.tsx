import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type LandingSectionProps = {
  id?: string;
  className?: string;
  variant?: 'default' | 'highlight' | 'alt' | 'dark';
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
  headingLevel?: 'h1' | 'h2';
};

export function LandingSectionHeader({
  kicker,
  title,
  titleId,
  lead,
  center = true,
  icon,
  className,
  headingLevel = 'h2',
}: LandingSectionHeaderProps) {
  const Heading = headingLevel;
  return (
    <div className={cn(center && 'flex w-full flex-col items-center text-center', !center && 'w-full', className)}>
      <span className="landing-mockup-kicker inline-flex items-center gap-1.5">
        {icon}
        {kicker}
      </span>
      <Heading id={titleId} className="landing-title mt-5 font-display font-black tracking-tight text-[#1b1813]">
        {title}
      </Heading>
      <span
        className={cn('mt-4 block h-1 w-10 rounded-full bg-[#FFC107]', center ? 'mx-auto' : '')}
        aria-hidden
      />
      {lead ? (
        <p className={cn('landing-lead mt-4 text-[#1b1813]/70', center && 'mx-auto max-w-2xl')}>{lead}</p>
      ) : null}
    </div>
  );
}
