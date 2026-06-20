import type { ReactNode } from 'react';
import { appCardClass, appInputClass, appLabelClass } from '../../../lib/appUiTokens';
import { cn } from '../../../lib/utils';

export type DemoToast = { message: string; type: 'success' | 'info' | 'error' } | null;

export const demoInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/30';

export const demoLabelClass =
  'mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500';

export function DemoCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm p-5', className)}>{children}</div>;
}

export function DemoToastBar({ toast }: { toast: DemoToast }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-6 left-1/2 z-[90] max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl',
        toast.type === 'success' && 'border-amber-500/30 bg-neutral-950/90 text-amber-200',
        toast.type === 'info' && 'border-sky-500/30 bg-sky-950/90 text-sky-200',
        toast.type === 'error' && 'border-rose-500/30 bg-rose-950/90 text-rose-200',
      )}
    >
      {toast.message}
    </div>
  );
}
