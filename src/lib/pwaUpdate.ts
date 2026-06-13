import { buildEmergencyReloadUrl } from './urlHygiene';

type ApplyUpdateFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

let updateAvailable = false;
let applyUpdateFn: ApplyUpdateFn | null = null;
const listeners = new Set<Listener>();

const UPDATE_PROBE_MIN_MS = 30_000;
const UPDATE_APPLIED_KEY = 'axecloud_pwa_update_applied_at';
const APPLY_GRACE_MS = 120_000;

let lastProbeAt = 0;
let bannerMountClaimed = false;

function hasWaitingWorker(registration: ServiceWorkerRegistration): boolean {
  return Boolean(registration.waiting && navigator.serviceWorker.controller);
}

export function shouldSuppressPwaUpdatePrompt(): boolean {
  try {
    const appliedAt = Number(sessionStorage.getItem(UPDATE_APPLIED_KEY) || '0');
    return appliedAt > 0 && Date.now() - appliedAt < APPLY_GRACE_MS;
  } catch {
    return false;
  }
}

/** Evita dois banners se o root montar mais de uma vez (StrictMode, etc.). */
export function claimPwaBannerMount(): boolean {
  if (bannerMountClaimed) return false;
  bannerMountClaimed = true;
  return true;
}

export function releasePwaBannerMount(): void {
  bannerMountClaimed = false;
}

async function clearAxecloudCaches(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => /axecloud|workbox-precache|workbox-runtime/i.test(k))
        .map((k) => caches.delete(k)),
    );
  } catch {
    /* */
  }
}

function markPwaUpdateApplying(): void {
  try {
    sessionStorage.setItem(UPDATE_APPLIED_KEY, String(Date.now()));
    sessionStorage.removeItem('axecloud_pwa_update_pending');
    sessionStorage.removeItem('axecloud_sw_reload_pending');
  } catch {
    /* */
  }
  updateAvailable = false;
}

/** Detecta SW já em espera ou recém-instalado — essencial no PWA instalado no celular. */
export function attachServiceWorkerUpdateProbes(registration: ServiceWorkerRegistration): void {
  if (hasWaitingWorker(registration)) {
    markPwaUpdateAvailable();
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        markPwaUpdateAvailable();
      }
    });
  });
}

/** Consulta o servidor por nova versão do SW (com throttle leve). */
export async function probeServiceWorkerUpdate(
  registration?: ServiceWorkerRegistration,
  options?: { force?: boolean },
): Promise<void> {
  if (!registration || shouldSuppressPwaUpdatePrompt()) return;
  const now = Date.now();
  if (!options?.force && now - lastProbeAt < UPDATE_PROBE_MIN_MS) return;
  lastProbeAt = now;

  if (hasWaitingWorker(registration)) {
    markPwaUpdateAvailable();
    return;
  }

  try {
    await registration.update();
  } catch {
    /* offline */
  }

  if (hasWaitingWorker(registration)) {
    markPwaUpdateAvailable();
  }
}

/** Fallback direto quando workbox-window não entrega SKIP_WAITING ao worker em espera. */
async function postSkipWaitingToWaitingWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  if (updateAvailable) listener();
  return () => listeners.delete(listener);
}

export function isPwaUpdateAvailable(): boolean {
  return updateAvailable && !shouldSuppressPwaUpdatePrompt();
}

export function markPwaUpdateAvailable(remoteBuildId?: string): void {
  if (shouldSuppressPwaUpdatePrompt()) return;

  if (remoteBuildId) {
    try {
      sessionStorage.setItem('axecloud_pwa_remote_build', remoteBuildId);
      sessionStorage.removeItem(`axecloud_pwa_dismiss_${remoteBuildId}`);
    } catch {
      /* */
    }
  }
  if (updateAvailable) return;
  updateAvailable = true;
  listeners.forEach((l) => l());
}

export function bindPwaApplyUpdate(fn: ApplyUpdateFn): void {
  applyUpdateFn = fn;
}

/**
 * Uma única recarga com cache limpo — evita precisar tocar em «Atualizar» duas vezes no PWA.
 */
export async function applyPwaUpdate(): Promise<void> {
  markPwaUpdateApplying();

  try {
    if (applyUpdateFn) {
      await applyUpdateFn(false);
    }
    await postSkipWaitingToWaitingWorker();
    if ('serviceWorker' in navigator) {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
  } catch {
    /* segue para reload com cache limpo */
  }

  await clearAxecloudCaches();
  window.location.replace(buildEmergencyReloadUrl());
}
