import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function readStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return false;
}

export type PwaInstallContextValue = {
  /** Navegador oferece instalação e o app não está em modo instalado (standalone). */
  canPromptInstall: boolean;
  /** Dispara o prompt nativo; após uso o evento é consumido. */
  promptInstall: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);
const PWA_INSTALL_DISMISS_KEY = 'axecloud-pwa-install-dismissed';

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const isDev = import.meta.env.DEV;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(readStandalone);

  useEffect(() => {
    if (isDev) return;
    const mqStandalone = window.matchMedia('(display-mode: standalone)');
    const mqFs = window.matchMedia('(display-mode: fullscreen)');
    const sync = () => setIsStandalone(readStandalone());
    mqStandalone.addEventListener('change', sync);
    mqFs.addEventListener('change', sync);
    return () => {
      mqStandalone.removeEventListener('change', sync);
      mqFs.removeEventListener('change', sync);
    };
  }, [isDev]);

  useEffect(() => {
    if (isDev || readStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (!path.startsWith('/dashboard')) return;
      if (localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === '1') return;
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(readStandalone());
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [isDev]);

  const promptInstall = useCallback(async () => {
    if (isDev || !deferredPrompt) return;
    const evt = deferredPrompt;
    await evt.prompt();
    try {
      const { outcome } = await evt.userChoice;
      if (outcome === 'dismissed') {
        localStorage.setItem(PWA_INSTALL_DISMISS_KEY, '1');
      }
    } catch {
      /* ignorado */
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      canPromptInstall: !isDev && !isStandalone && deferredPrompt !== null,
      promptInstall: isDev
        ? async () => {
            /* noop em dev */
          }
        : promptInstall,
    }),
    [isDev, isStandalone, deferredPrompt, promptInstall]
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      return {
        canPromptInstall: false,
        promptInstall: async () => {
          /* noop em dev */
        },
      };
    }
    throw new Error('usePwaInstall deve ser usado dentro de PwaInstallProvider');
  }
  return ctx;
}
