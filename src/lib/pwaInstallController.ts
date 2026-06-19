import { isInstalledRelatedWebApp, isStandalonePwa } from './pwaInstall';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type Listener = () => void;

let initialized = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedHint = false;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

async function refreshInstalledHint(): Promise<void> {
  if (isStandalonePwa()) {
    installedHint = true;
    notify();
    return;
  }
  const related = await isInstalledRelatedWebApp();
  if (related !== installedHint) {
    installedHint = related;
    notify();
  }
}

/** Registra listeners globais — chamar uma vez no boot do app (main.tsx). */
export function initPwaInstallController(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  void refreshInstalledHint();
  window.setTimeout(() => void refreshInstalledHint(), 500);
  window.setTimeout(() => void refreshInstalledHint(), 2000);

  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'] as const;
  const mqls = displayModes.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
  const onDisplayChange = () => void refreshInstalledHint();
  mqls.forEach((mql) => mql.addEventListener('change', onDisplayChange));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
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

export function canShowPwaInstallPrompt(): boolean {
  return Boolean(deferredPrompt) && !installedHint && !isStandalonePwa();
}

export function isPwaInstalled(): boolean {
  return installedHint || isStandalonePwa();
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
