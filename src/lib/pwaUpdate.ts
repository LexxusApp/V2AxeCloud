import { performEmergencyHardReload } from './emergencyReload';

type ApplyUpdateFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

let updateAvailable = false;
let applyUpdateFn: ApplyUpdateFn | null = null;
const listeners = new Set<Listener>();

const CONTROLLER_CHANGE_WAIT_MS = 2500;
const UPDATE_PROBE_MIN_MS = 30_000;

let lastProbeAt = 0;

function hasWaitingWorker(registration: ServiceWorkerRegistration): boolean {
  return Boolean(registration.waiting && navigator.serviceWorker.controller);
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
  if (!registration) return;
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

function waitForControllerChange(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (changed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(changed);
    };

    const onChange = () => finish(true);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
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
  return updateAvailable;
}

export function markPwaUpdateAvailable(remoteBuildId?: string): void {
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

export async function applyPwaUpdate(): Promise<void> {
  try {
    sessionStorage.setItem('axecloud_sw_reload_pending', '1');
  } catch {
    /* */
  }

  const controllerChanged = waitForControllerChange(CONTROLLER_CHANGE_WAIT_MS);

  try {
    if (applyUpdateFn) {
      await applyUpdateFn(true);
    }
    await postSkipWaitingToWaitingWorker();
  } catch {
    performEmergencyHardReload();
    return;
  }

  const changed = await controllerChanged;
  if (changed) {
    window.location.reload();
    return;
  }

  performEmergencyHardReload();
}
