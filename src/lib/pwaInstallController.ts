import { isInstalledRelatedWebApp, isStandalonePwa } from './pwaInstall';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type Listener = () => void;

type WindowWithEarlyInstall = Window & {
  __axecloudDeferredInstall?: BeforeInstallPromptEvent | null;
};

const EARLY_INSTALL_EVENT = 'axecloud:beforeinstallprompt';

let initialized = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedHint = false;
const listeners = new Set<Listener>();

function adoptEarlyDeferredPrompt(): void {
  if (typeof window === 'undefined' || deferredPrompt) return;
  const early = (window as WindowWithEarlyInstall).__axecloudDeferredInstall;
  if (!early) return;
  deferredPrompt = early;
  notify();
}

/** Referência estável — useSyncExternalStore exige igualdade por referência entre renders. */
let snapshot = { canInstall: false, isInstalled: false };

function syncSnapshot(): void {
  const canInstall = Boolean(deferredPrompt) && !installedHint && !isStandalonePwa();
  const isInstalled = installedHint || isStandalonePwa();
  if (snapshot.canInstall === canInstall && snapshot.isInstalled === isInstalled) return;
  snapshot = { canInstall, isInstalled };
}

function notify(): void {
  syncSnapshot();
  listeners.forEach((listener) => listener());
}

async function refreshInstalledHint(): Promise<void> {
  if (isStandalonePwa()) {
    if (!installedHint) {
      installedHint = true;
      notify();
    }
    return;
  }
  const related = await isInstalledRelatedWebApp();
  // Com prompt ativo o Chrome ainda oferece instalação — não esconder o banner.
  if (related && !deferredPrompt && related !== installedHint) {
    installedHint = related;
    notify();
  }
}

/** Registra listeners globais — chamar uma vez no boot do app (main.tsx). */
export function initPwaInstallController(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  adoptEarlyDeferredPrompt();
  window.addEventListener(EARLY_INSTALL_EVENT, adoptEarlyDeferredPrompt);

  void refreshInstalledHint();
  window.setTimeout(() => void refreshInstalledHint(), 2000);

  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'] as const;
  const mqls = displayModes.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
  const onDisplayChange = () => void refreshInstalledHint();
  mqls.forEach((mql) => mql.addEventListener('change', onDisplayChange));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    (window as WindowWithEarlyInstall).__axecloudDeferredInstall = deferredPrompt;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installedHint = true;
    deferredPrompt = null;
    notify();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshInstalledHint();
  });
}

export function subscribePwaInstallState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallSnapshot(): typeof snapshot {
  syncSnapshot();
  return snapshot;
}

export function canShowPwaInstallPrompt(): boolean {
  return getPwaInstallSnapshot().canInstall;
}

export function isPwaInstalled(): boolean {
  return getPwaInstallSnapshot().isInstalled;
}

export async function triggerPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable' | 'ios'> {
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;

  if (isIos) return 'ios';

  if (deferredPrompt) {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      deferredPrompt = null;
      installedHint = true;
      notify();
    }
    return choice.outcome;
  }

  return 'unavailable';
}
