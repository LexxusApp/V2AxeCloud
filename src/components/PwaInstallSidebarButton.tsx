import { Download } from 'lucide-react';
import { usePwaInstall } from '../contexts/PwaInstallContext';
import { cn } from '../lib/utils';

type PwaInstallSidebarButtonProps = {
  className?: string;
  onAfterClick?: () => void;
};

/**
 * CTA compacto para instalação PWA — cantos assimétricos, uma faixa de ícone à esquerda.
 */
export function PwaInstallSidebarButton({ className, onAfterClick }: PwaInstallSidebarButtonProps) {
  const { canPromptInstall, promptInstall } = usePwaInstall();

  if (!canPromptInstall) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void promptInstall();
        onAfterClick?.();
      }}
      className={cn(
        'group flex w-full max-w-full items-stretch overflow-hidden text-left outline-none',
        'rounded-[11px_5px_11px_5px] border border-emerald-500/22 bg-emerald-950/[0.18]',
        'transition-[border-color,background-color] duration-200',
        'hover:border-emerald-400/38 hover:bg-emerald-900/22',
        'focus-visible:ring-2 focus-visible:ring-emerald-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        className
      )}
      aria-label="Instalar aplicativo AxéCloud"
    >
      <span
        className={cn(
          'flex w-8 shrink-0 items-center justify-center border-r border-emerald-500/15',
          'bg-emerald-500/[0.10] text-emerald-300/95 transition-colors',
          'group-hover:bg-emerald-500/[0.16] group-hover:text-emerald-200'
        )}
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5 pl-2.5 pr-2">
        <span className="text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-emerald-400/95">
          Instalar
        </span>
        <span className="text-[10.5px] font-medium leading-tight tracking-tight text-emerald-50/88">
          aplicativo
        </span>
      </span>
    </button>
  );
}
