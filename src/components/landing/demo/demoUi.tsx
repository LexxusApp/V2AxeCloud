import type { ReactNode } from 'react';
import { appCardClass, appInputClass, appLabelClass } from '../../../lib/appUiTokens';
import { cn } from '../../../lib/utils';

export type DemoToast = { message: string; type: 'success' | 'info' | 'error' } | null;

export const demoInputClass = appInputClass;
export const demoLabelClass = appLabelClass;

export function DemoCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(appCardClass, className)}>{children}</div>;
}

export function DemoToastBar({ toast }: { toast: DemoToast }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-6 left-1/2 z-[90] max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl',
        toast.type === 'success' && 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200',
        toast.type === 'info' && 'border-sky-500/30 bg-sky-950/90 text-sky-200',
        toast.type === 'error' && 'border-rose-500/30 bg-rose-950/90 text-rose-200',
      )}
    >
      {toast.message}
    </div>
  );
}
