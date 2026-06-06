import { performEmergencyHardReload } from './emergencyReload';

type ApplyUpdateFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

let updateAvailable = false;
let applyUpdateFn: ApplyUpdateFn | null = null;
const listeners = new Set<Listener>();

const CONTROLLER_CHANGE_WAIT_MS = 2500;

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

export function markPwaUpdateAvailable(): void {
  if (updateAvailable) return;
  updateAvailable = true;
  listeners.forEach((l) => l());
}

export function bindPwaApplyUpdate(fn: ApplyUpdateFn): void {
  applyUpdateFn = fn;
}

export async function applyPwaUpdate(): Promise<void> {
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
    // main.tsx também recarrega em controllerchange; garante reload se esse listener falhar.
    window.location.reload();
    return;
  }

  // SW não assumiu controle — limpa caches antigos e puxa bundle novo da rede.
  performEmergencyHardReload();
}
