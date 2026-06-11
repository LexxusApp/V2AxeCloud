import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { appCardClass, appInputClass, appLabelClass, appPanelClass } from '../../lib/appUiTokens';

export { appCardClass, appInputClass, appLabelClass, appPanelClass };

export function AppCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(appCardClass, className)}>{children}</div>;
}

export function AppPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(appPanelClass, className)}>{children}</div>;
}

type AppFieldProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

export function AppField({ label, className, children }: AppFieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className={appLabelClass}>{label}</span>
      {children}
    </label>
  );
}

export function AppInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(appInputClass, className)} {...props} />;
}

export function AppTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(appInputClass, 'min-h-[5rem] resize-y', className)} {...props} />;
}

export function AppSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(appInputClass, className)} {...props}>
      {children}
    </select>
  );
}

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const statusToneClass: Record<StatusTone, string> = {
  success: 'border-emerald-500/25 bg-emerald-950/50 text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-950/50 text-amber-300',
  danger: 'border-rose-500/25 bg-rose-950/50 text-rose-300',
  neutral: 'border-zinc-600/40 bg-zinc-900/60 text-zinc-400',
  info: 'border-sky-500/25 bg-sky-950/50 text-sky-300',
};

export function AppStatusPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        statusToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AppTabBar({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-xl border border-[#1E242B] bg-[#12161A] p-1',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              active ? 'bg-primary text-[#080A0D]' : 'text-[#94A3B8] hover:text-[#F1F5F9]',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
