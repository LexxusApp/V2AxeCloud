import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const previewInputClass =
  'w-full rounded-lg border border-[#dccfb8] bg-white px-2.5 py-2 text-xs text-[#1b1813] placeholder:text-[#1b1813]/40 focus:border-[#FFC107]/60 focus:outline-none focus:ring-1 focus:ring-[#FFC107]/30';

export const previewLabelClass =
  'mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#1b1813]/50';

export function PreviewCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('landing-mockup-inset-card rounded-2xl p-4 sm:p-5', className)}>{children}</div>
  );
}

export function PreviewPanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('landing-mockup-card rounded-2xl p-5 sm:p-6', className)}>{children}</div>;
}

export function PreviewKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'text-[#1b1813]',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <PreviewPanelCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1b1813]/50">{label}</p>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#dccfb8] bg-[#faf6ef]">
          <Icon className={cn('h-4 w-4 text-[#FFC107]', accent)} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <p className="font-display text-2xl font-black tracking-tight text-[#1b1813]">{value}</p>
      {hint ? <div className="text-[11px] font-medium text-[#1b1813]/55">{hint}</div> : null}
    </PreviewPanelCard>
  );
}

export function PreviewSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 className="font-display text-lg font-bold text-[#1b1813]">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-[#1b1813]/60">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
