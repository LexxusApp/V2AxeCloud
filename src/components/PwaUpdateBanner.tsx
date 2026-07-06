import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { checkRemoteBuildVersion } from '../lib/buildVersionPoll';
import {
  applyPwaUpdate,
  claimPwaBannerMount,
  isPwaUpdateAvailable,
  releasePwaBannerMount,
  shouldSuppressPwaUpdatePrompt,
  subscribePwaUpdate,
} from '../lib/pwaUpdate';

const DISMISS_TTL_MS = 30 * 60 * 1000;

function dismissKeyForBuild(): string {
  try {
    const remote = sessionStorage.getItem('axecloud_pwa_remote_build') || 'pending';
    return `axecloud_pwa_dismiss_${remote}`;
  } catch {
    return 'axecloud_pwa_dismiss_pending';
  }
}

function isDismissedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(dismissKeyForBuild());
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function shouldShowBanner(): boolean {
  return (
    !shouldSuppressPwaUpdatePrompt() &&
    isPwaUpdateAvailable() &&
    !isDismissedRecently()
  );
}

export function PwaUpdateBanner() {
  const [canMount] = useState(() => claimPwaBannerMount());
  const [visible, setVisible] = useState(() => canMount && shouldShowBanner());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!canMount) return;
    return () => releasePwaBannerMount();
  }, [canMount]);

  useEffect(() => {
    if (!canMount) return;

    void checkRemoteBuildVersion().then((found) => {
      if (found && !isDismissedRecently() && !shouldSuppressPwaUpdatePrompt()) {
        setVisible(true);
      }
    });

    return subscribePwaUpdate(() => {
      if (!isDismissedRecently() && !shouldSuppressPwaUpdatePrompt()) {
        setVisible(true);
      }
    });
  }, [canMount]);

  if (!canMount || !visible) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(dismissKeyForBuild(), String(Date.now()));
    } catch {
      /* */
    }
    setVisible(false);
  };

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      await applyPwaUpdate();
    } catch {
      setApplying(false);
    }
  };

  return (
    <div
      id="axecloud-pwa-update-banner"
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100000] flex items-center justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-amber-500/40 bg-[#1a1510] px-4 py-3.5 text-sm text-amber-50 shadow-2xl shadow-black/50">
        <RefreshCw className={`h-5 w-5 shrink-0 text-amber-400 ${applying ? 'animate-spin' : ''}`} aria-hidden />
        <p className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold text-amber-200">Nova versão disponível.</span>{' '}
          Toque em atualizar para ver as novidades. Sua sessão é mantida.
        </p>
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={applying}
          className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
        >
          {applying ? 'Atualizando…' : 'Atualizar'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={applying}
          aria-label="Fechar aviso de atualização"
          className="shrink-0 rounded-lg p-1.5 text-amber-200/70 hover:bg-white/10 hover:text-amber-100 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
