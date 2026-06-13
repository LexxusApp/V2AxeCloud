import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { checkRemoteBuildVersion } from '../lib/buildVersionPoll';
import { applyPwaUpdate, isPwaUpdateAvailable, subscribePwaUpdate } from '../lib/pwaUpdate';

const DISMISS_KEY = 'axecloud_pwa_update_dismissed_at';
const DISMISS_TTL_MS = 30 * 60 * 1000;

function isDismissedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function PwaUpdateBanner() {
  const [visible, setVisible] = useState(() => isPwaUpdateAvailable() && !isDismissedRecently());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    void checkRemoteBuildVersion().then((found) => {
      if (found && !isDismissedRecently()) setVisible(true);
    });
    return subscribePwaUpdate(() => {
      if (!isDismissedRecently()) setVisible(true);
    });
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* */
    }
    setVisible(false);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyPwaUpdate();
    } catch {
      setApplying(false);
      return;
    }
    window.setTimeout(() => setApplying(false), 4000);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[100000] flex items-center justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-0 sm:pb-0 sm:pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
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
          aria-label="Fechar aviso de atualização"
          className="shrink-0 rounded-lg p-1.5 text-amber-200/70 hover:bg-white/10 hover:text-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
