import { Download } from 'lucide-react';
import { useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';

type Props = {
  className?: string;
  variant?: 'banner' | 'link';
};

export function PwaInstallPrompt({ className, variant = 'banner' }: Props) {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  if (isInstalled || !canInstall) return null;

  const handleInstall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await install();
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={busy}
        className={className}
      >
        {busy ? 'Abrindo instalação…' : 'Instalar aplicativo'}
      </button>
    );
  }

  return (
    <div
      className={
        className ??
        'flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2.5 text-left text-[12px] text-primary/95'
      }
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">
        Instale o AxéCloud na tela inicial para acesso rápido e atualizações automáticas.
      </p>
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={busy}
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold text-black hover:opacity-90 disabled:opacity-60"
      >
        {busy ? '…' : 'Instalar'}
      </button>
    </div>
  );
}
