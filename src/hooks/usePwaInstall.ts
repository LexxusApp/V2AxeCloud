import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  canShowPwaInstallPrompt,
  isPwaInstalled,
  subscribePwaInstallState,
  triggerPwaInstall,
} from '../lib/pwaInstallController';

function getSnapshot(): { canInstall: boolean; isInstalled: boolean } {
  return {
    canInstall: canShowPwaInstallPrompt(),
    isInstalled: isPwaInstalled(),
  };
}

export function usePwaInstall() {
  const state = useSyncExternalStore(subscribePwaInstallState, getSnapshot, getSnapshot);

  return {
    ...state,
    install: triggerPwaInstall,
  };
}

/** Força re-render após hidratação (getInstalledRelatedApps é async no boot). */
export function usePwaInstallHydrated() {
  const base = usePwaInstall();
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setTick((n) => n + 1), 800);
    return () => window.clearTimeout(t);
  }, []);

  return base;
}
