import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { appCardClass, appInputClass, appLabelClass } from '../../lib/appUiTokens';

export { appInputClass, appLabelClass };

export function AppDemoCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(appCardClass, className)}>{children}</div>;
}

export function AppDemoTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E242B] bg-[#13171D]">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function AppDemoPanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div>
        <h3 className="font-display text-lg font-bold text-[#F1F5F9]">{title}</h3>
        {description ? <p className="text-xs text-[#94A3B8]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AppPrimaryButton({
  children,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-[#080A0D] shadow-sm transition hover:bg-[#fde047] disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function childStatusClass(status: string) {
  if (status === 'Ativo') {
    return 'rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[9px] font-bold text-emerald-300';
  }
  if (status === 'Pendente') {
    return 'rounded-full border border-amber-500/30 bg-amber-950/50 px-2 py-0.5 text-[9px] font-bold text-amber-300';
  }
  return 'rounded-full border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-[9px] font-bold text-zinc-400';
}
