import { getRunningBuildId } from './buildId';
import { buildEmergencyReloadUrl } from './urlHygiene';

type ApplyUpdateFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

let updateAvailable = false;
let applyUpdateFn: ApplyUpdateFn | null = null;
const listeners = new Set<Listener>();

const UPDATE_PROBE_MIN_MS = 30_000;
const UPDATE_APPLIED_AT_KEY = 'axecloud_pwa_update_applied_at';
const UPDATE_APPLIED_BUILD_KEY = 'axecloud_pwa_applied_build';
const REMOTE_BUILD_KEY = 'axecloud_pwa_remote_build';
const APPLY_GRACE_MS = 120_000;

let lastProbeAt = 0;
let bannerMountClaimed = false;

function hasWaitingWorker(registration: ServiceWorkerRegistration): boolean {
  return Boolean(registration.waiting && navigator.serviceWorker.controller);
}

function readAppliedAt(): number {
  try {
    const local = Number(localStorage.getItem(UPDATE_APPLIED_AT_KEY) || '0');
    const session = Number(sessionStorage.getItem(UPDATE_APPLIED_AT_KEY) || '0');
    return Math.max(local, session);
  } catch {
    return 0;
  }
}

export function getAppliedBuildId(): string | null {
  try {
    return localStorage.getItem(UPDATE_APPLIED_BUILD_KEY);
  } catch {
    return null;
  }
}

export function isBuildAlreadyApplied(buildId: string): boolean {
  const applied = getAppliedBuildId();
  if (!applied || applied !== buildId) return false;
  const running = getRunningBuildId();
  return Boolean(running && running === buildId);
}

/** Remove marca de build aplicado quando o bundle em execução ficou desatualizado. */
export function reconcileStaleAppliedBuild(): void {
  const applied = getAppliedBuildId();
  const running = getRunningBuildId();
  if (!applied || !running || applied === running) return;
  try {
    localStorage.removeItem(UPDATE_APPLIED_BUILD_KEY);
    localStorage.removeItem(UPDATE_APPLIED_AT_KEY);
  } catch {
    /* */
  }
}

export function acknowledgeAppliedBuild(buildId: string): void {
  try {
    localStorage.setItem(UPDATE_APPLIED_BUILD_KEY, buildId);
    localStorage.setItem(UPDATE_APPLIED_AT_KEY, String(Date.now()));
    sessionStorage.removeItem(REMOTE_BUILD_KEY);
  } catch {
    /* */
  }
  updateAvailable = false;
}

export function shouldSuppressPwaUpdatePrompt(): boolean {
  try {
    const appliedAt = readAppliedAt();
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

function getPendingRemoteBuildId(): string | undefined {
  try {
    return sessionStorage.getItem(REMOTE_BUILD_KEY) || getAppliedBuildId() || undefined;
  } catch {
    return undefined;
  }
}

function markPwaUpdateApplying(buildId?: string): void {
  try {
    const appliedAt = String(Date.now());
    localStorage.setItem(UPDATE_APPLIED_AT_KEY, appliedAt);
    sessionStorage.setItem(UPDATE_APPLIED_AT_KEY, appliedAt);
    if (buildId) {
      localStorage.setItem(UPDATE_APPLIED_BUILD_KEY, buildId);
    }
    sessionStorage.removeItem('axecloud_pwa_update_pending');
    sessionStorage.removeItem('axecloud_sw_reload_pending');
  } catch {
    /* */
  }
  updateAvailable = false;
}

function waitForServiceWorkerActivation(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, timeoutMs);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
  });
}

/** Detecta SW já em espera ou recém-instalado — essencial no PWA instalado no celular. */
export function attachServiceWorkerUpdateProbes(
  registration: ServiceWorkerRegistration,
  onUpdateHint?: () => void,
): void {
  const hint = () => onUpdateHint?.();

  if (hasWaitingWorker(registration)) {
    hint();
  }

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        hint();
      }
    });
  });
}

/** Consulta o servidor por nova versão do SW (com throttle leve). */
export async function probeServiceWorkerUpdate(
  registration?: ServiceWorkerRegistration,
  options?: { force?: boolean; onUpdateHint?: () => void },
): Promise<void> {
  if (!registration || shouldSuppressPwaUpdatePrompt()) return;
  const now = Date.now();
  if (!options?.force && now - lastProbeAt < UPDATE_PROBE_MIN_MS) return;
  lastProbeAt = now;

  const hint = () => options?.onUpdateHint?.();

  if (hasWaitingWorker(registration)) {
    hint();
    return;
  }

  try {
    await registration.update();
  } catch {
    /* offline */
  }

  if (hasWaitingWorker(registration)) {
    hint();
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
    if (isBuildAlreadyApplied(remoteBuildId)) return;
    try {
      sessionStorage.setItem(REMOTE_BUILD_KEY, remoteBuildId);
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
 * Uma única recarga com cache limpo — aguarda o novo SW assumir controle antes do reload.
 */
export async function applyPwaUpdate(): Promise<void> {
  markPwaUpdateApplying(getPendingRemoteBuildId());

  try {
    if (applyUpdateFn) {
      await applyUpdateFn(false);
    }
    await postSkipWaitingToWaitingWorker();
    await waitForServiceWorkerActivation(4000);
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
