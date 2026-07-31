import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { appCardClass, appInputClass, appLabelClass } from '../../lib/appUiTokens';

export { appInputClass, appLabelClass };

export function AppDemoCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(appCardClass, className)}>{children}</div>;
}

export function AppDemoTableShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-v5-table-shell overflow-hidden rounded-2xl border border-[#252C35] bg-[#151A21] shadow-[0_18px_44px_-34px_rgba(0,0,0,0.9)]">
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
    <div className="app-editorial-header mb-6 flex flex-col justify-between gap-4 border-b border-[#D8D0C4] pb-5 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Painel da casa</p>
        <h1 className="font-display text-2xl font-black tracking-tight text-[#17130D] sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-relaxed text-[#665F55]">{description}</p> : null}
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
        'app-v5-primary-button min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-[#080A0D] shadow-sm transition hover:bg-[#fde047] disabled:opacity-50',
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
