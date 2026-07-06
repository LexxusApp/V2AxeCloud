import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const DISMISS_KEY = 'axecloud_pwa_install_dismiss';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 600;

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* */
  }
}

export function PwaInstallBanner() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [latched, setLatched] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => isDismissedRecently());

  useEffect(() => {
    if (canInstall) setLatched(true);
  }, [canInstall]);

  useEffect(() => {
    if (!latched || dismissed || isInstalled) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [latched, dismissed, isInstalled]);

  if (!ready || dismissed || isInstalled) return null;

  const handleInstall = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await install();
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  return (
    <div
      id="axecloud-pwa-install-banner"
      role="dialog"
      aria-labelledby="axecloud-pwa-install-title"
      aria-describedby="axecloud-pwa-install-desc"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[99999] flex items-center justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-primary/35 bg-[#12161A] px-4 py-3.5 text-sm text-[#F1F5F9] shadow-2xl shadow-black/50">
        <Download className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 leading-snug">
          <span id="axecloud-pwa-install-title" className="font-semibold text-primary">
            Instalar o AxéCloud
          </span>
          <span id="axecloud-pwa-install-desc" className="text-[#94A3B8]">
            {' '}
            — fixe na tela inicial para acesso rápido como app.
          </span>
        </p>
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={busy}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Abrindo…' : 'Instalar'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          aria-label="Fechar aviso de instalação"
          className="shrink-0 rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-[#F1F5F9] disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
